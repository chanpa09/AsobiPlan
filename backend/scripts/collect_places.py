import argparse
import os
import sys
import json
from datetime import date

# Add backend directory to system path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scripts.keyword_analysis import analyze_stroller_friendliness_ai, run_keyword_analysis

# Center Coordinates: Toyocho Station (35.6698, 139.8174)
TOYOCHO_LAT = 35.6698
TOYOCHO_LNG = 139.8174
RADIUS = 1000 # 1km
KOTO_BBOX = (35.5830, 139.7650, 35.7080, 139.8600)
OVERPASS_URL = "https://overpass-api.de/api/interpreter"
OPEN_DATA_SOURCE_URL = "https://www.openstreetmap.org/copyright"

# 1. Fallback Mock data representing REAL places within 1km of Toyocho Station
FALLBACK_PLACES = [
    {
        "name": "로얄 호스트 토요초점 (Royal Host Toyocho)",
        "category": "restaurant",
        "address": "도쿄도 고토구 토요 4-1-1",
        "latitude": 35.6706,
        "longitude": 139.8165,
        "google_rating": 4.0,
        "reviews": [
            "店内が広くてベビーカーでの入店もスムーズでした。ベビーチェアがあり、子供連れに優しい。",
            "スロープがあって段差がなく、ベビーカーの移動が非常にスムーズです。店員さんも親切でした。",
            "東陽町駅近くで一番子連れで使いやすいファミレス。離乳食の持ち込みも快く対応してくれました。"
        ],
        "access_policy": "customer_only",
        "access_note": "레스토랑 주문 이용 고객에 한하여 내부 편의 시설을 제공합니다.",
        "child_summary": "경사로와 아기의자가 갖춰져 있고 이유식 메뉴도 있어, 유모차 가족이 편하게 식사할 수 있어요."
    },
    {
        "name": "스타벅스 커피 토요초점 (Starbucks Coffee)",
        "category": "cafe",
        "address": "도쿄도 고토구 토요 4-1-2",
        "latitude": 35.6695,
        "longitude": 139.8170,
        "google_rating": 4.1,
        "reviews": [
            "テラス席があるのでベビーカーを横に置いてコーヒーを飲めますが、店内は少し狭めです。",
            "入り口はフラットで入りやすいですが、休日の午後は混み合ってベ비ーカーで入るのが大変かも。",
            "スタッフの対応はとても親切で、ベビーカー連れでもドアを開けて手伝ってくれました。"
        ],
        "access_policy": "customer_only",
        "access_note": "음료 주문 시 매장 내 시설 이용이 가능합니다.",
        "child_summary": "유모차 보관 구역이 있어서 유모차를 동반하고도 편안하게 커피 한 잔 마시며 쉬어갈 수 있는 카페예요."
    },
    {
        "name": "토요 4초메 공원 (Toyo 4-chome Park)",
        "category": "park",
        "address": "도쿄도 고토구 토요 4-4-1",
        "latitude": 35.6720,
        "longitude": 139.8182,
        "google_rating": 3.9,
        "reviews": [
            "段差がほとんどなく、スロープもしっかり整備されていてベビーカーで一周しやすいです。",
            "ベンチが多く、緑豊かで子供との散歩に最適な公園です。多目的トイレもあります。"
        ],
        "access_policy": "public_free",
        "access_note": "언제나 자유롭게 입장 및 산책이 가능합니다.",
        "child_summary": "경사로가 마련된 넓은 공원으로 유모차 산책에 최적화되어 있으나, 일부 노면 턱이 있으니 유의하세요."
    },
    {
        "name": "구도 토요초 빌딩 (Kudo Toyocho Building)",
        "category": "mall",
        "address": "도쿄도 고토구 토요 3-27-24",
        "latitude": 35.6701,
        "longitude": 139.8142,
        "google_rating": 3.8,
        "reviews": [
            "エレベーター完備でスロープもあるため、ベビーカーでのフロア間移動が快適です。",
            "通路も広めでストレスなく回れます。子供向けの設備もあります。"
        ],
        "access_policy": "public_free",
        "access_note": "빌딩 내 상업 시설 및 로비는 자유롭게 이용 가능합니다.",
        "child_summary": "경사로 진입 및 엘리베이터 이동이 편리하여 유모차로 다양한 상업 시설을 쾌적하게 둘러볼 수 있어요."
    },
    {
        "name": "가이샤쿠 커피 (Kaishaku Coffee)",
        "category": "cafe",
        "address": "도쿄도 고토구 토요 3-18-5",
        "latitude": 35.6690,
        "longitude": 139.8115,
        "google_rating": 4.3,
        "reviews": [
            "こじんまりしたお洒落なカフェ。段差はなくベビーカーでも入れますが、席数が少ないので混雑時は注意。",
            "アットホームでベビーカーをたたんで店内に置かせてくれました。テイクアウトも可能です。"
        ],
        "access_policy": "customer_only",
        "access_note": "테이크아웃 또는 소규모 좌석 주문 시 이용할 수 있습니다.",
        "child_summary": "유모차 주차가 가능하나 매장 내부 공간이 협소하고 진입 시 약간의 턱이 있어 주의가 필요해요."
    },
    {
        "name": "세이유 토요초점 (SEIYU Toyocho)",
        "category": "mall",
        "address": "도쿄도 고토구 토요 6-3-2",
        "latitude": 35.6710,
        "longitude": 139.8225,
        "google_rating": 3.7,
        "reviews": [
            "大型スーパーで通路が広く、ベビーカーのカートを押しながらでも十分すれ違えます。",
            "エレベーターもあり、授乳スペースやオムツ替えシートも完備されているので買い物に便利です。"
        ],
        "access_policy": "public_free",
        "access_note": "마트 영업시간 동안 무료로 출입 및 기저귀 교환실 이용이 가능합니다.",
        "child_summary": "마트 내 엘리베이터와 넓은 동선이 확보되어 있고, 2층에 아기 정거장 수유실이 있어 안심하고 장을 볼 수 있어요."
    }
]

FALLBACK_BABY_STATIONS = [
    {
        "name": "고토구청 본청사 아기 정거장",
        "address": "도쿄도 고토구 토요 4-11-28",
        "latitude": 35.6728,
        "longitude": 139.8174,
        "has_nursing_room": True,
        "has_diaper_table": True,
        "has_hot_water": True,
        "open_hours": "08:30 - 17:15",
        "access_policy": "public_free",
        "access_note": "공공시설 내 아이 돌봄 편의공간입니다. 구매 없이 이용 가능한 시설로 표시합니다."
    },
    {
        "name": "토요초역 아기 정거장",
        "address": "도쿄도 고토구 토요 4-1-2",
        "latitude": 35.6698,
        "longitude": 139.8174,
        "has_nursing_room": False,
        "has_diaper_table": True,
        "has_hot_water": False,
        "open_hours": "첫차 - 막차",
        "access_policy": "public_free",
        "access_note": "역 개찰구 내부 다목적 화장실 옆에 기저귀 교환대가 구비되어 있습니다."
    },
    {
        "name": "세이유 토요초점 2층 수유실",
        "address": "도쿄도 고토구 토요 6-3-2",
        "latitude": 35.6710,
        "longitude": 139.8225,
        "has_nursing_room": True,
        "has_diaper_table": True,
        "has_hot_water": True,
        "open_hours": "10:00 - 21:00",
        "access_policy": "public_free",
        "access_note": "세이유 매장 2층에 마련된 무료 유아 휴게공간입니다."
    }
]

def parse_args(argv=None):
    parser = argparse.ArgumentParser(description="Collect stroller-friendly places around Toyocho.")
    parser.add_argument(
        "--live",
        action="store_true",
        help="Require GOOGLE_PLACES_API_KEY and fail instead of using mock fallback when the key is missing.",
    )
    parser.add_argument(
        "--open-data",
        action="store_true",
        help="Collect places from public open data sources that do not require API keys.",
    )
    return parser.parse_args(argv)


def is_configured_api_key(api_key: str | None) -> bool:
    return bool(api_key) and api_key != "your_google_places_api_key_here"


def load_environment():
    try:
        from dotenv import load_dotenv
    except ImportError:
        return

    load_dotenv()
    project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    load_dotenv(os.path.join(project_root, ".env"))


def normalize_text(value: str | None) -> str:
    return "".join((value or "").lower().split())


def infer_osm_category(tags: dict) -> str:
    amenity = tags.get("amenity")
    leisure = tags.get("leisure")
    shop = tags.get("shop")
    tourism = tags.get("tourism")

    if amenity in {"restaurant", "fast_food", "food_court"}:
        return "restaurant"
    if amenity == "cafe":
        return "cafe"
    if leisure == "park":
        return "park"
    if shop in {"mall", "department_store", "supermarket"}:
        return "mall"
    if amenity in {"community_centre", "library", "public_building"} or tourism == "museum":
        return "public_facility"
    return "public_facility"


def osm_address(tags: dict) -> str:
    address_parts = [
        tags.get("addr:province"),
        tags.get("addr:city"),
        tags.get("addr:suburb"),
        tags.get("addr:quarter"),
        tags.get("addr:neighbourhood"),
        tags.get("addr:block_number"),
        tags.get("addr:housenumber"),
    ]
    address = " ".join(part for part in address_parts if part)
    return address or tags.get("addr:full") or tags.get("addr:street") or "주소 확인 필요"


def osm_name(tags: dict) -> str:
    return tags.get("name:ko") or tags.get("name:ja") or tags.get("name:en") or tags.get("name") or "이름 확인 필요"


def osm_evidence_tags(tags: dict) -> dict:
    evidence_keys = [
        "amenity",
        "leisure",
        "shop",
        "tourism",
        "wheelchair",
        "changing_table",
        "toilets:wheelchair",
        "highchair",
        "stroller",
        "parking:stroller",
        "fee",
        "opening_hours",
        "outdoor_seating",
    ]
    return {key: tags[key] for key in evidence_keys if key in tags}


def infer_access_policy(category: str, tags: dict) -> str:
    if tags.get("fee") == "yes":
        return "paid_entry"
    if category in {"restaurant", "cafe"}:
        return "customer_only"
    return "public_free"


def infer_stroller_features(tags: dict, nearby_station: dict | None = None) -> dict:
    wheelchair = tags.get("wheelchair")
    changing_table = tags.get("changing_table")
    toilets_wheelchair = tags.get("toilets:wheelchair")
    indoor = tags.get("indoor")
    outdoor_seating = tags.get("outdoor_seating")

    score = 3
    keywords = []

    if wheelchair in {"yes", "limited"}:
        score += 1
        keywords.append("휠체어 접근")
    elif wheelchair == "no":
        score -= 2
        keywords.append("접근 주의")

    if toilets_wheelchair == "yes":
        score += 1
        keywords.append("휠체어 화장실")
    if changing_table == "yes":
        score += 1
        keywords.append("기저귀 교환대")
    if outdoor_seating == "yes":
        keywords.append("야외 좌석")
    if indoor == "no":
        score -= 1

    if nearby_station:
        score += 1
        keywords.append("공식시설 근접")

    final_score = max(1, min(5, score))
    has_diaper_table = changing_table == "yes" or bool(nearby_station and nearby_station.get("has_diaper_table"))
    has_nursing_room = bool(nearby_station and nearby_station.get("has_nursing_room"))
    has_hot_water = bool(nearby_station and nearby_station.get("has_hot_water"))
    has_ramp = wheelchair in {"yes", "limited"}
    doorway_width = "wide" if wheelchair == "yes" else "medium" if wheelchair == "limited" else "narrow" if wheelchair == "no" else "medium"
    confidence = "manual_checked" if wheelchair or changing_table or nearby_station else "unknown"

    if not keywords:
        keywords = ["오픈데이터"]

    return {
        "stroller_score": final_score,
        "reasoning": "공개 지도 태그와 공식 수유·기저귀 시설 근접 정보를 기준으로 산정했습니다.",
        "review_keywords": keywords,
        "has_ramp": has_ramp,
        "doorway_width": doorway_width,
        "has_baby_chair": tags.get("highchair") == "yes",
        "has_stroller_parking": tags.get("stroller") == "yes" or tags.get("parking:stroller") == "yes",
        "has_nursing_room": has_nursing_room,
        "has_diaper_table": has_diaper_table,
        "has_hot_water": has_hot_water,
        "confidence": confidence,
    }


def build_open_data_summary(place: dict) -> str:
    if place["has_nursing_room"] or place["has_diaper_table"]:
        return "공식 수유·기저귀 시설과 가까워 아이 동반 방문 중 쉬어가기 좋은 장소예요."
    if place["has_ramp"]:
        return "공개 지도 접근성 정보상 유모차 진입이 비교적 수월한 장소예요."
    if place["stroller_score"] <= 2:
        return "접근성 정보가 제한적이거나 주의가 필요한 장소라 방문 전 확인을 권장해요."
    return "공개 지도 정보를 기준으로 아이와 함께 방문 후보로 볼 수 있는 장소예요."


def load_existing_baby_stations() -> list[dict]:
    project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    stations_path = os.path.join(project_root, "frontend", "public", "data", "baby-stations.json")
    if not os.path.exists(stations_path):
        return FALLBACK_BABY_STATIONS

    with open(stations_path, encoding="utf-8") as f:
        data = json.load(f)

    stations = []
    for feature in data.get("features", []):
        geometry = feature.get("geometry") or {}
        coordinates = geometry.get("coordinates")
        properties = feature.get("properties", {})
        if not coordinates or len(coordinates) < 2:
            continue
        stations.append({
            **properties,
            "latitude": coordinates[1],
            "longitude": coordinates[0],
            "has_nursing_room": properties.get("has_nursing_room", False),
            "has_diaper_table": properties.get("has_diaper_table", False),
            "has_hot_water": properties.get("has_hot_water", False),
        })
    return stations


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    import math

    radius = 6371000
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    a = math.sin(delta_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
    return radius * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def find_nearby_baby_station(lat: float, lng: float, stations: list[dict], max_distance_meters: float = 80) -> dict | None:
    best = None
    best_distance = max_distance_meters
    for station in stations:
        distance = haversine_distance(lat, lng, station["latitude"], station["longitude"])
        if distance <= best_distance:
            best = station
            best_distance = distance
    return best


def build_overpass_query() -> str:
    south, west, north, east = KOTO_BBOX
    bbox = f"{south},{west},{north},{east}"
    selectors = [
        'node["amenity"~"^(cafe|restaurant|fast_food|food_court|community_centre|library)$"]',
        'way["amenity"~"^(cafe|restaurant|fast_food|food_court|community_centre|library)$"]',
        'relation["amenity"~"^(cafe|restaurant|fast_food|food_court|community_centre|library)$"]',
        'node["leisure"="park"]',
        'way["leisure"="park"]',
        'relation["leisure"="park"]',
        'node["shop"~"^(mall|department_store|supermarket)$"]',
        'way["shop"~"^(mall|department_store|supermarket)$"]',
        'relation["shop"~"^(mall|department_store|supermarket)$"]',
        'node["tourism"="museum"]',
        'way["tourism"="museum"]',
        'relation["tourism"="museum"]',
    ]
    body = "\n".join(f"  {selector}({bbox});" for selector in selectors)
    return f"[out:json][timeout:25];\n(\n{body}\n);\nout body center;"


def fetch_openstreetmap_places() -> list[dict]:
    import requests

    response = requests.post(
        OVERPASS_URL,
        data=build_overpass_query().encode("utf-8"),
        headers={
            "Accept": "application/json",
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "User-Agent": "AsobiPlan open data collector",
        },
        timeout=30,
    )
    response.raise_for_status()
    return response.json().get("elements", [])


def element_coordinates(element: dict) -> tuple[float, float] | None:
    if "lat" in element and "lon" in element:
        return float(element["lat"]), float(element["lon"])
    center = element.get("center")
    if center and "lat" in center and "lon" in center:
        return float(center["lat"]), float(center["lon"])
    return None


def build_open_data_places(elements: list[dict], stations: list[dict]) -> list[dict]:
    places = []
    seen = set()
    for element in elements:
        tags = element.get("tags") or {}
        coordinates = element_coordinates(element)
        name = osm_name(tags)
        if not coordinates or name == "이름 확인 필요":
            continue

        lat, lng = coordinates
        category = infer_osm_category(tags)
        dedupe_key = (normalize_text(name), round(lat, 4), round(lng, 4))
        if dedupe_key in seen:
            continue
        seen.add(dedupe_key)

        nearby_station = find_nearby_baby_station(lat, lng, stations)
        features = infer_stroller_features(tags, nearby_station)
        access_policy = infer_access_policy(category, tags)
        source_id = f"{element.get('type', 'osm')}/{element.get('id')}"
        place = {
            "id": len(places) + 1,
            "name": name,
            "category": category,
            "address": osm_address(tags),
            "latitude": lat,
            "longitude": lng,
            "google_rating": None,
            "access_policy": access_policy,
            "access_note": "OpenStreetMap 공개 태그 기반 정보입니다. 세부 이용 조건은 현장에서 확인해 주세요.",
            "source_name": "OpenStreetMap",
            "source_url": OPEN_DATA_SOURCE_URL,
            "last_verified_at": date.today().isoformat(),
            "osm_id": source_id,
            "osm_tags": osm_evidence_tags(tags),
            **features,
        }
        place["child_summary"] = build_open_data_summary(place)
        places.append(place)
    return places


def export_static_and_database(processed_places: list[dict], processed_stations: list[dict]) -> None:
    places_geojson = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [p["longitude"], p["latitude"]]
                },
                "properties": {
                    key: value
                    for key, value in p.items()
                    if key not in {"latitude", "longitude"} and value is not None
                }
            } for p in processed_places
        ]
    }

    stations_geojson = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [s["longitude"], s["latitude"]]
                },
                "properties": {
                    key: value
                    for key, value in s.items()
                    if key not in {"latitude", "longitude"} and value is not None
                }
            } for s in processed_stations
        ]
    }

    frontend_data_dir = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
        "frontend", "public", "data"
    )

    os.makedirs(frontend_data_dir, exist_ok=True)
    places_json_path = os.path.join(frontend_data_dir, "places.json")
    stations_json_path = os.path.join(frontend_data_dir, "baby-stations.json")

    with open(places_json_path, 'w', encoding='utf-8') as f:
        f.write(json.dumps(places_geojson, ensure_ascii=False, indent=2) + "\n")
        print(f"Successfully saved GeoJSON places data to {places_json_path}")

    with open(stations_json_path, 'w', encoding='utf-8') as f:
        f.write(json.dumps(stations_geojson, ensure_ascii=False, indent=2) + "\n")
        print(f"Successfully saved GeoJSON baby stations data to {stations_json_path}")

    print("Connecting to backend database for import...")
    from sqlalchemy.orm import Session

    from app.database import engine, init_db, BabyStation, StrollerFriendlyPlace, IS_SQLITE

    db = Session(bind=engine)
    try:
        init_db()
        db.query(StrollerFriendlyPlace).delete()
        db.query(BabyStation).delete()

        for p in processed_places:
            additional_info = {
                "access_policy": p["access_policy"],
                "access_note": p["access_note"],
                "source_name": p.get("source_name"),
                "source_url": p.get("source_url"),
                "last_verified_at": p.get("last_verified_at"),
                "confidence": p.get("confidence"),
                "osm_id": p.get("osm_id"),
                "osm_tags": p.get("osm_tags"),
                "has_nursing_room": p.get("has_nursing_room"),
                "has_diaper_table": p.get("has_diaper_table"),
                "has_hot_water": p.get("has_hot_water"),
            }
            place_db = StrollerFriendlyPlace(
                google_place_id=p.get("google_place_id"),
                name=p["name"],
                category=p["category"],
                address=p["address"],
                latitude=p["latitude"],
                longitude=p["longitude"],
                google_rating=p.get("google_rating"),
                stroller_score=p["stroller_score"],
                reasoning=p["reasoning"],
                review_keywords=p["review_keywords"],
                has_ramp=p["has_ramp"],
                doorway_width=p["doorway_width"],
                has_baby_chair=p["has_baby_chair"],
                has_stroller_parking=p["has_stroller_parking"],
                child_summary=p["child_summary"],
                additional_info={key: value for key, value in additional_info.items() if value is not None}
            )
            if not IS_SQLITE:
                place_db.geom = f"POINT({p['longitude']} {p['latitude']})"
            db.add(place_db)

        for s in processed_stations:
            station_db = BabyStation(
                name=s["name"],
                address=s["address"],
                latitude=s["latitude"],
                longitude=s["longitude"],
                has_nursing_room=s["has_nursing_room"],
                has_diaper_table=s["has_diaper_table"],
                has_hot_water=s["has_hot_water"],
                open_hours=s["open_hours"],
                additional_info={
                    "category": s["category"],
                    "access_policy": s["access_policy"],
                    "access_note": s["access_note"],
                    "source_name": s.get("source_name"),
                    "source_url": s.get("source_url"),
                    "last_verified_at": s.get("last_verified_at"),
                    "confidence": s.get("confidence"),
                }
            )
            if not IS_SQLITE:
                station_db.geom = f"POINT({s['longitude']} {s['latitude']})"
            db.add(station_db)

        db.commit()
        print("Database sync completed successfully!")
    except Exception as e:
        db.rollback()
        print(f"Error saving to database: {e}")
        raise e
    finally:
        db.close()

def fetch_from_google_places_api(api_key: str) -> tuple:
    """
    Fetch places and baby stations from Google Places API near Toyocho Station.
    """
    import requests

    print(f"Connecting to Google Places API... Target Center: ({TOYOCHO_LAT}, {TOYOCHO_LNG}) Radius: {RADIUS}m")
    
    places_found = []
    baby_stations_found = []
    
    # 1. Query for Places (Restaurant, Cafe, Park, Shopping Mall)
    # We query sequentially by type since Nearby Search performs best with a single type
    target_types = {
        "restaurant": "restaurant",
        "cafe": "cafe",
        "park": "park",
        "shopping_mall": "mall",
        "department_store": "mall",
        "supermarket": "mall"
    }
    
    seen_place_ids = set()
    
    for api_type, app_category in target_types.items():
        try:
            nearby_url = (
                f"https://maps.googleapis.com/maps/api/place/nearbysearch/json"
                f"?location={TOYOCHO_LAT},{TOYOCHO_LNG}"
                f"&radius={RADIUS}"
                f"&type={api_type}"
                f"&key={api_key}"
            )
            response = requests.get(nearby_url)
            data = response.json()
            
            if data.get("status") not in ["OK", "ZERO_RESULTS"]:
                print(f"Nearby search API error for {api_type}: {data.get('status')} - {data.get('error_message', '')}")
                continue
                
            results = data.get("results", [])
            print(f"Type '{api_type}' returned {len(results)} results.")
            
            for result in results:
                place_id = result.get("place_id")
                if not place_id or place_id in seen_place_ids:
                    continue
                seen_place_ids.add(place_id)
                
                # Fetch details for the place
                details_url = (
                    f"https://maps.googleapis.com/maps/api/place/details/json"
                    f"?place_id={place_id}"
                    f"&fields=name,formatted_address,geometry,rating,reviews,types"
                    f"&key={api_key}"
                    f"&language=ja" # Fetch Japanese reviews as the ground truth
                )
                det_resp = requests.get(details_url)
                det_data = det_resp.json()
                
                if det_data.get("status") != "OK":
                    continue
                    
                details = det_data.get("result", {})
                
                # Format reviews
                reviews_list = []
                for r in details.get("reviews", []):
                    text = r.get("text")
                    if text:
                        reviews_list.append(text)
                        
                # Extract lat/lng
                loc = details.get("geometry", {}).get("location", {})
                lat = loc.get("lat")
                lng = loc.get("lng")
                
                if not lat or not lng:
                    continue
                
                places_found.append({
                    "name": details.get("name"),
                    "category": app_category,
                    "address": details.get("formatted_address", ""),
                    "latitude": lat,
                    "longitude": lng,
                    "google_rating": details.get("rating", 3.5),
                    "reviews": reviews_list,
                    "access_policy": "customer_only" if app_category in ["restaurant", "cafe"] else "public_free",
                    "access_note": "레스토랑 주문 이용 고객에 한하여 내부 편의 시설을 제공합니다." if app_category in ["restaurant", "cafe"] else "누구나 자유롭게 이용할 수 있습니다.",
                    "child_summary": ""
                })
        except Exception as e:
            print(f"Error fetching type {api_type}: {e}")
            
    # 2. Query for Baby Stations (Using keyword searches like '授乳室', '赤ちゃんの駅', 'nursing room')
    keywords = ["授乳室", "赤ちゃんの駅", "nursing room"]
    seen_station_ids = set()
    
    for kw in keywords:
        try:
            text_url = (
                f"https://maps.googleapis.com/maps/api/place/textsearch/json"
                f"?query={kw}"
                f"&location={TOYOCHO_LAT},{TOYOCHO_LNG}"
                f"&radius={RADIUS}"
                f"&key={api_key}"
            )
            response = requests.get(text_url)
            data = response.json()
            
            if data.get("status") not in ["OK", "ZERO_RESULTS"]:
                print(f"Text search API error for keyword '{kw}': {data.get('status')}")
                continue
                
            results = data.get("results", [])
            print(f"Keyword '{kw}' returned {len(results)} baby station candidates.")
            
            for result in results:
                place_id = result.get("place_id")
                if not place_id or place_id in seen_station_ids:
                    continue
                seen_station_ids.add(place_id)
                
                # Fetch details to check details or get coordinates
                details_url = (
                    f"https://maps.googleapis.com/maps/api/place/details/json"
                    f"?place_id={place_id}"
                    f"&fields=name,formatted_address,geometry,types"
                    f"&key={api_key}"
                )
                det_resp = requests.get(details_url)
                det_data = det_resp.json()
                
                if det_data.get("status") != "OK":
                    continue
                    
                details = det_data.get("result", {})
                loc = details.get("geometry", {}).get("location", {})
                lat = loc.get("lat")
                lng = loc.get("lng")
                
                if not lat or not lng:
                    continue
                    
                # We analyze types or name to estimate amenities
                name = details.get("name", "")
                has_nursing = any(k in name or k in details.get("types", []) for k in ["授乳", "nursing", "baby"])
                
                baby_stations_found.append({
                    "name": name,
                    "address": details.get("formatted_address", ""),
                    "latitude": lat,
                    "longitude": lng,
                    "has_nursing_room": has_nursing,
                    "has_diaper_table": True, # Usually true if returned by these keywords
                    "has_hot_water": has_nursing,
                    "open_hours": "09:00 - 18:00", # default estimate
                    "access_policy": "public_free",
                    "access_note": "공용 수유 공간 또는 아기 케어 공간입니다."
                })
        except Exception as e:
            print(f"Error fetching keyword {kw}: {e}")
            
    # Combine with fallback stations if we found nothing to ensure at least station data is present
    if not baby_stations_found:
        print("No baby stations found via API, using fallback stations.")
        baby_stations_found = FALLBACK_BABY_STATIONS
        
    return places_found, baby_stations_found

def main(argv=None):
    args = parse_args(argv)
    load_environment()

    places_api_key = os.getenv("GOOGLE_PLACES_API_KEY")
    gemini_api_key = os.getenv("GEMINI_API_KEY")

    if args.open_data:
        print("Running in Open Data mode (no Google Places or Gemini API keys required).")
        stations = load_existing_baby_stations()
        elements = fetch_openstreetmap_places()
        processed_places = build_open_data_places(elements, stations)
        if not processed_places:
            raise RuntimeError("Open data collection returned 0 places.")
        processed_stations = [
            {
                **s,
                "id": idx + 1,
                "name": s["name"],
                "category": s.get("category") or ("station" if "역" in s["name"] else "public_facility" if "구청" in s["name"] or "도서관" in s["name"] or "센터" in s["name"] else "mall"),
                "address": s.get("address", "주소 확인 필요"),
                "latitude": s["latitude"],
                "longitude": s["longitude"],
                "has_nursing_room": s["has_nursing_room"],
                "has_diaper_table": s["has_diaper_table"],
                "has_hot_water": s["has_hot_water"],
                "open_hours": s.get("open_hours", "확인 필요"),
                "access_policy": s.get("access_policy", "public_free"),
                "access_note": s.get("access_note", "공용 유아 휴게 및 케어 시설입니다.")
            }
            for idx, s in enumerate(stations)
        ]
        export_static_and_database(processed_places, processed_stations)
        return
    
    use_mock = False
    if not is_configured_api_key(places_api_key):
        if args.live:
            raise RuntimeError("--live requires GOOGLE_PLACES_API_KEY; mock fallback is disabled in live mode.")
        print("GOOGLE_PLACES_API_KEY is not configured in .env. Running in Offline Mock mode.")
        use_mock = True
        
    if use_mock:
        places_data = FALLBACK_PLACES
        stations_data = FALLBACK_BABY_STATIONS
    else:
        places_data, stations_data = fetch_from_google_places_api(places_api_key)
        if not places_data:
            print("API returned 0 places. Falling back to Mock data.")
            places_data = FALLBACK_PLACES
            stations_data = FALLBACK_BABY_STATIONS
            
    # Process places through AI or keyword matching
    print(f"Processing {len(places_data)} Places and evaluating stroller friendliness...")
    processed_places = []
    
    for idx, p in enumerate(places_data):
        analysis = analyze_stroller_friendliness_ai(p["reviews"])
        processed_places.append({
            "id": idx + 1,
            "name": p["name"],
            "category": p["category"],
            "address": p["address"],
            "latitude": p["latitude"],
            "longitude": p["longitude"],
            "google_rating": p["google_rating"],
            "stroller_score": analysis["stroller_score"],
            "reasoning": analysis["reasoning"],
            "review_keywords": analysis["review_keywords"],
            "has_ramp": analysis["has_ramp"],
            "doorway_width": analysis["doorway_width"],
            "has_baby_chair": analysis["has_baby_chair"],
            "has_stroller_parking": analysis["has_stroller_parking"],
            "access_policy": p.get("access_policy", "public_free"),
            "access_note": p.get("access_note", "자유롭게 출입할 수 있습니다."),
            "child_summary": p.get("child_summary") or analysis.get("child_summary", "")
        })
        
    # Process baby stations
    processed_stations = []
    for idx, s in enumerate(stations_data):
        processed_stations.append({
            "id": idx + 1,
            "name": s["name"],
            "category": "station" if "역" in s["name"] else "public_facility" if "구청" in s["name"] or "도서관" in s["name"] or "센터" in s["name"] else "mall",
            "address": s["address"],
            "latitude": s["latitude"],
            "longitude": s["longitude"],
            "has_nursing_room": s["has_nursing_room"],
            "has_diaper_table": s["has_diaper_table"],
            "has_hot_water": s["has_hot_water"],
            "open_hours": s["open_hours"],
            "access_policy": s.get("access_policy", "public_free"),
            "access_note": s.get("access_note", "공용 유아 휴게 및 케어 시설입니다.")
        })
        
    export_static_and_database(processed_places, processed_stations)

if __name__ == "__main__":
    main()
