import argparse
import csv
import html
import json
import re
import sys
import time
import unicodedata
from http.cookiejar import CookieJar
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import HTTPCookieProcessor, Request, build_opener, urlopen


CSV_URL = "https://www.fukushi.metro.tokyo.lg.jp/documents/d/fukushi/akachanflat_ichiranr80331_csv-csv"
SOURCE_URL = "https://www.fukushi.metro.tokyo.lg.jp/kodomo/kosodate/akachanflat"
SWITCH_MAP_URL = "https://kosodateswitch.metro.tokyo.lg.jp/map"
SWITCH_FACILITY_URL = "https://kosodateswitch.metro.tokyo.lg.jp/facility/list"
LAST_VERIFIED_AT = "2026-03-31"


TOKYO_GRID = [
    # Mainland Tokyo.
    (lat / 10, lng / 10)
    for lat in range(354, 359)
    for lng in range(1389, 1402)
] + [
    # Izu and Ogasawara island centers.
    (34.7500, 139.3500),
    (34.3770, 139.2560),
    (34.0800, 139.5300),
    (33.8900, 139.6000),
    (33.1100, 139.7900),
    (32.4600, 139.7600),
    (27.0940, 142.1910),
    (26.6400, 142.1600),
]

COORDINATE_OVERRIDES = {
    # These three official CSV rows were not returned by the map API grid, or
    # had a name/address mismatch in the map API response.
    "245": {
        "lat": 35.6091188579,
        "lng": 139.7219277971,
        "url": "",
        "coordinate_match": "manual_geocode",
    },
    "477": {
        "lat": 35.75807,
        "lng": 139.73720,
        "url": "",
        "coordinate_match": "manual_geocode",
    },
    "1606": {
        "lat": 35.7713175,
        "lng": 139.3149287,
        "url": "https://kosodateswitch.metro.tokyo.lg.jp/facility/flat/12770",
        "coordinate_match": "manual_geocode",
    },
}


def normalize(value: str | None) -> str:
    if not value:
        return ""
    text = unicodedata.normalize("NFKC", value)
    text = text.replace("東京都", "")
    text = re.sub(r"[\s\r\n　_・･\-－ー]+", "", text)
    return text.lower()


def download(url: str) -> bytes:
    with urlopen(url, timeout=30) as response:
        return response.read()


def load_csv_rows(csv_path: Path | None) -> list[dict[str, str]]:
    if csv_path:
        raw = csv_path.read_bytes()
    else:
        raw = download(CSV_URL)

    decoded = raw.decode("cp932")
    rows = list(csv.reader(decoded.splitlines()))
    records = []
    for index, row in enumerate(rows[3:], start=1):
        if len(row) < 10 or not any(cell.strip() for cell in row[:5]):
            continue
        records.append(
            {
                "id": str(index),
                "area": row[0].strip(),
                "nearest_station": row[1].strip(),
                "name": row[2].strip(),
                "operator": row[3].strip(),
                "address": row[4].strip(),
                "available_days": row[5].strip(),
                "open_hours": row[6].strip(),
                "target_users": row[7].strip(),
                "nursing_room_lock": row[8].strip(),
                "note": row[9].strip(),
            }
        )
    return records


def create_switch_session():
    opener = build_opener(HTTPCookieProcessor(CookieJar()))
    page = opener.open(SWITCH_MAP_URL, timeout=30).read().decode("utf-8")
    match = re.search(r'<meta name="csrf-token" content="([^"]+)"', page)
    if not match:
        raise RuntimeError("Could not find CSRF token on Tokyo Kosodate Switch map page.")
    return opener, match.group(1)


def fetch_switch_facilities(delay_seconds: float) -> list[dict]:
    opener, token = create_switch_session()
    by_url: dict[str, dict] = {}

    for lat, lng in TOKYO_GRID:
        body = urlencode(
            {
                "lat": f"{lat:.6f}",
                "lng": f"{lng:.6f}",
                "km": "8",
                "count": "300",
                "shop_type": "3|6|7",
            }
        ).encode("utf-8")
        request = Request(
            SWITCH_FACILITY_URL,
            data=body,
            headers={
                "Content-Type": "application/x-www-form-urlencoded",
                "X-CSRF-TOKEN": token,
                "X-Requested-With": "XMLHttpRequest",
            },
            method="POST",
        )
        response = json.loads(opener.open(request, timeout=30).read().decode("utf-8"))
        if response.get("code") != 0:
            raise RuntimeError(f"Tokyo Kosodate Switch API returned {response!r}")

        for point in response["result"]["list"]:
            for facility in point.get("facility", []):
                if not (facility.get("flat") or facility.get("flat_female") or facility.get("flat_key")):
                    continue
                item = {
                    **facility,
                    "lat": float(point["lat"]),
                    "lng": float(point["lng"]),
                }
                by_url[item["url"]] = item
        if delay_seconds:
            time.sleep(delay_seconds)

    return list(by_url.values())


def match_coordinate(record: dict[str, str], switch_records: list[dict]) -> dict | None:
    if record["id"] in COORDINATE_OVERRIDES:
        return COORDINATE_OVERRIDES[record["id"]]

    name_key = normalize(record["name"])
    address_key = normalize(record["address"])

    candidates = [item for item in switch_records if normalize(item.get("name")) == name_key]
    for item in candidates:
        switch_address = normalize(item.get("address"))
        if address_key and (address_key in switch_address or switch_address in address_key):
            item["coordinate_match"] = "name_and_address"
            return item
    if len(candidates) == 1:
        candidates[0]["coordinate_match"] = "name_only"
        return candidates[0]

    for item in switch_records:
        switch_address = normalize(item.get("address"))
        if address_key and (address_key in switch_address or switch_address in address_key):
            item["coordinate_match"] = "address_only"
            return item

    return None


def infer_category(area: str, name: str) -> str:
    if "駅" in name:
        return "station"
    if any(token in name for token in ["百貨店", "モール", "ショッピング", "店", "プラザ"]):
        return "mall"
    if any(token in name for token in ["公園", "児童館", "保育園", "子ども", "こども", "支援センター"]):
        return "public_facility"
    return "public_facility"


def has_locked_nursing_room(lock_note: str) -> bool:
    return "施錠できる" in lock_note


def is_female_only(target_users: str) -> bool:
    return "女性のみ" in target_users


def strip_empty_values(values: dict) -> dict:
    return {key: value for key, value in values.items() if value not in (None, "")}


def build_geojson(records: list[dict[str, str]], switch_records: list[dict]) -> tuple[dict, list[dict]]:
    features = []
    pending = []

    for record in records:
        matched = match_coordinate(record, switch_records)
        properties = {
            "id": int(record["id"]),
            "name": record["name"],
            "category": infer_category(record["area"], record["name"]),
            "address": record["address"],
            "has_nursing_room": True,
            "has_diaper_table": True,
            "has_hot_water": False,
            "open_hours": record["open_hours"] or "確認 필요",
            "access_policy": "public_free",
            "access_note": "東京都の赤ちゃん・ふらっと届出施設です。授乳・おむつ替え等に利用できます。",
            "source_name": "東京都福祉局 赤ちゃん・ふらっと一覧",
            "source_url": SOURCE_URL,
            "last_verified_at": LAST_VERIFIED_AT,
            "verification_method": "geocoded" if matched and matched.get("coordinate_match") == "manual_geocode" else "official_csv",
            "confidence": "official",
            "geocode_status": "confirmed" if matched else "pending",
            "inside_of": record["operator"] or None,
            "location_note": record["note"] or None,
            "available_days": record["available_days"] or None,
            "target_users": record["target_users"] or None,
            "nearest_station": record["nearest_station"] or None,
            "nursing_room_lock": record["nursing_room_lock"] or None,
            "female_only": is_female_only(record["target_users"]),
            "key_required": has_locked_nursing_room(record["nursing_room_lock"]),
        }
        properties = strip_empty_values(properties)

        if not matched:
            pending.append(
                {
                    "type": "Feature",
                    "geometry": None,
                    "properties": properties,
                }
            )
            continue

        feature_properties = strip_empty_values(
            {
                **properties,
                "geocode_status": "confirmed",
                "coordinate_match": matched.get("coordinate_match"),
                "switch_url": matched.get("url") or None,
                "tel": matched.get("tel") or None,
            }
        )
        features.append(
            {
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [matched["lng"], matched["lat"]],
                },
                "properties": feature_properties,
            }
        )

    return {"type": "FeatureCollection", "features": features}, pending


def write_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main(argv=None) -> None:
    parser = argparse.ArgumentParser(description="Import Tokyo Akachan Flat official data.")
    parser.add_argument("--csv", type=Path, help="Use a downloaded official CSV instead of fetching it.")
    parser.add_argument("--output", type=Path, default=Path("frontend/public/data/baby-stations.json"))
    parser.add_argument("--pending-output", type=Path, default=Path("frontend/public/data/baby-stations.pending-geocode.json"))
    parser.add_argument("--delay", type=float, default=0.1, help="Delay between Tokyo Kosodate Switch API calls.")
    args = parser.parse_args(argv)

    records = load_csv_rows(args.csv)
    switch_records = fetch_switch_facilities(args.delay)
    geojson, pending = build_geojson(records, switch_records)

    write_json(args.output, geojson)
    write_json(args.pending_output, {"type": "FeatureCollection", "features": pending})

    print(f"official_csv_rows={len(records)}")
    print(f"switch_coordinate_candidates={len(switch_records)}")
    print(f"geojson_features={len(geojson['features'])}")
    print(f"pending_geocode={len(pending)}")
    if pending:
        print("Pending examples:")
        for item in pending[:10]:
            properties = item["properties"]
            print(f"- {properties['name']} / {properties['address']}")


if __name__ == "__main__":
    main(sys.argv[1:])
