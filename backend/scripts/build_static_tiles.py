import argparse
import json
import math
import shutil
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any


TILE_ZOOM = 13
OPEN_DATA_ONLY_KEYWORDS = {"오픈데이터"}


@dataclass(frozen=True)
class TileBuildResult:
    total_source_features: int
    included_features: int
    excluded_features: int
    tile_count: int


def lon_to_tile_x(lon: float, zoom: int = TILE_ZOOM) -> int:
    return math.floor((lon + 180.0) / 360.0 * (2**zoom))


def lat_to_tile_y(lat: float, zoom: int = TILE_ZOOM) -> int:
    lat_rad = math.radians(lat)
    return math.floor((1.0 - math.asinh(math.tan(lat_rad)) / math.pi) / 2.0 * (2**zoom))


def tile_id_for_coordinates(lon: float, lat: float, zoom: int = TILE_ZOOM) -> str:
    return f"{lon_to_tile_x(lon, zoom)}-{lat_to_tile_y(lat, zoom)}"


def read_feature_collection(path: Path) -> list[dict[str, Any]]:
    with path.open(encoding="utf-8") as file:
        data = json.load(file)
    features = data.get("features")
    if not isinstance(features, list):
        raise ValueError(f"{path} must contain a GeoJSON FeatureCollection")
    return features


def point_coordinates(feature: dict[str, Any]) -> tuple[float, float]:
    coordinates = feature["geometry"]["coordinates"]
    return float(coordinates[0]), float(coordinates[1])


def feature_properties(feature: dict[str, Any]) -> dict[str, Any]:
    properties = feature.get("properties")
    if not isinstance(properties, dict):
        raise ValueError("feature properties must be an object")
    return properties


def has_baby_friendly_place_evidence(properties: dict[str, Any]) -> bool:
    keywords = set(properties.get("review_keywords") or [])
    has_care_amenity = any(
        bool(properties.get(field))
        for field in ("has_nursing_room", "has_diaper_table", "has_hot_water", "has_baby_chair", "has_stroller_parking")
    )
    has_access_evidence = bool(properties.get("has_ramp")) or properties.get("doorway_width") == "wide"
    has_nearby_official_station = "공식시설 근접" in keywords
    has_meaningful_keywords = bool(keywords - OPEN_DATA_ONLY_KEYWORDS)
    category = properties.get("category")
    score = properties.get("stroller_score") or 0

    if properties.get("confidence") == "unknown":
        return False
    if has_care_amenity or has_nearby_official_station:
        return True
    if category in {"restaurant", "cafe"}:
        return False
    return score >= 4 and has_access_evidence and has_meaningful_keywords


def to_tile_feature(feature: dict[str, Any], source: str) -> dict[str, Any]:
    lon, lat = point_coordinates(feature)
    properties = feature_properties(feature)

    if source == "care":
        tile_properties = {
            "id": f"care-{properties['id']}",
            "source": "care",
            "name": properties["name"],
            "category": properties.get("category") or "public_facility",
            "address": properties.get("address") or "주소 확인 필요",
            "stroller_score": 5,
            "reasoning": "수유실·기저귀 교환 등 아이 돌봄 편의공간입니다.",
            "review_keywords": [],
            "open_hours": properties.get("open_hours"),
            "access_policy": properties.get("access_policy") or "unknown",
            "access_note": properties.get("access_note") or "이용 조건을 현장에서 확인해 주세요.",
            "doorway_width": "wide",
            "child_summary": properties.get("access_note") or "수유실과 기저귀 교환대가 갖춰진 아기 돌봄 공간입니다.",
            "source_name": properties.get("source_name"),
            "source_url": properties.get("source_url"),
            "last_verified_at": properties.get("last_verified_at"),
            "confidence": properties.get("confidence"),
            "amenities": {
                "nursing_room": bool(properties.get("has_nursing_room")),
                "diaper_table": bool(properties.get("has_diaper_table")),
                "hot_water": bool(properties.get("has_hot_water")),
                "ramp": False,
                "baby_chair": False,
                "stroller_parking": False,
                "wide_doorway": True,
            },
        }
    else:
        tile_properties = {
            "id": f"place-{properties['id']}",
            "source": "place",
            "name": properties["name"],
            "category": properties["category"],
            "address": properties.get("address") or "주소 확인 필요",
            "google_rating": properties.get("google_rating"),
            "stroller_score": properties["stroller_score"],
            "reasoning": properties["reasoning"],
            "review_keywords": properties.get("review_keywords") or [],
            "open_hours": properties.get("open_hours"),
            "access_policy": properties.get("access_policy") or "unknown",
            "access_note": properties.get("access_note") or "이용 조건을 현장에서 확인해 주세요.",
            "doorway_width": properties["doorway_width"],
            "child_summary": properties.get("child_summary") or properties["reasoning"],
            "source_name": properties.get("source_name"),
            "source_url": properties.get("source_url"),
            "last_verified_at": properties.get("last_verified_at"),
            "confidence": properties.get("confidence"),
            "osm_id": properties.get("osm_id"),
            "amenities": {
                "nursing_room": bool(properties.get("has_nursing_room")),
                "diaper_table": bool(properties.get("has_diaper_table")),
                "hot_water": bool(properties.get("has_hot_water")),
                "ramp": bool(properties.get("has_ramp")),
                "baby_chair": bool(properties.get("has_baby_chair")),
                "stroller_parking": bool(properties.get("has_stroller_parking")),
                "wide_doorway": properties.get("doorway_width") == "wide",
            },
        }

    return {
        "type": "Feature",
        "geometry": {"type": "Point", "coordinates": [lon, lat]},
        "properties": {key: value for key, value in tile_properties.items() if value is not None},
    }


def build_tile_payload(features: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "type": "FeatureCollection",
        "features": sorted(features, key=lambda feature: feature["properties"]["id"]),
    }


def build_static_tiles(data_dir: Path, out_dir: Path, zoom: int = TILE_ZOOM) -> TileBuildResult:
    source_features: list[tuple[dict[str, Any], str]] = []
    station_features = read_feature_collection(data_dir / "baby-stations.json")
    place_features = read_feature_collection(data_dir / "places.json")
    source_features.extend((feature, "care") for feature in station_features)
    source_features.extend((feature, "place") for feature in place_features)

    tiles: dict[str, list[dict[str, Any]]] = {}
    included = 0
    for feature, source in source_features:
        properties = feature_properties(feature)
        if source == "place" and not has_baby_friendly_place_evidence(properties):
            continue
        lon, lat = point_coordinates(feature)
        tile_id = tile_id_for_coordinates(lon, lat, zoom)
        tiles.setdefault(tile_id, []).append(to_tile_feature(feature, source))
        included += 1

    if out_dir.exists():
        shutil.rmtree(out_dir)
    tile_root = out_dir / str(zoom)
    tile_root.mkdir(parents=True, exist_ok=True)

    for tile_id, features in sorted(tiles.items()):
        (tile_root / f"{tile_id}.json").write_text(
            json.dumps(build_tile_payload(features), ensure_ascii=False, separators=(",", ":")) + "\n",
            encoding="utf-8",
        )

    manifest = {
        "tileZoom": zoom,
        "tiles": sorted(tiles),
        "sourceCounts": {
            "babyStations": len(station_features),
            "places": len(place_features),
            "total": len(source_features),
        },
        "includedFeatures": included,
        "excludedFeatures": len(source_features) - included,
        "criteria": "official baby stations plus places with non-unknown confidence and concrete baby-friendly evidence",
    }
    (out_dir / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    return TileBuildResult(
        total_source_features=len(source_features),
        included_features=included,
        excluded_features=len(source_features) - included,
        tile_count=len(tiles),
    )


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build viewport-loadable static spot tiles.")
    parser.add_argument("--data-dir", default="frontend/public/data")
    parser.add_argument("--out-dir", default="frontend/public/data/spot-tiles")
    parser.add_argument("--zoom", type=int, default=TILE_ZOOM)
    parser.add_argument("--check", action="store_true", help="Fail if generated tiles differ from existing files.")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    data_dir = Path(args.data_dir)
    out_dir = Path(args.out_dir)

    if args.check:
        temp_dir = out_dir.parent / f".{out_dir.name}.check"
        if temp_dir.exists():
            shutil.rmtree(temp_dir)
        try:
            build_static_tiles(data_dir, temp_dir, args.zoom)
            existing_files = sorted(path.relative_to(out_dir) for path in out_dir.rglob("*") if path.is_file())
            generated_files = sorted(path.relative_to(temp_dir) for path in temp_dir.rglob("*") if path.is_file())
            if existing_files != generated_files:
                print("Static spot tiles are out of date: file list differs")
                return 1
            for relative_path in existing_files:
                if (out_dir / relative_path).read_text(encoding="utf-8") != (temp_dir / relative_path).read_text(encoding="utf-8"):
                    print(f"Static spot tiles are out of date: {relative_path}")
                    return 1
        finally:
            if temp_dir.exists():
                shutil.rmtree(temp_dir)
        print("Static spot tiles are up to date.")
        return 0

    result = build_static_tiles(data_dir, out_dir, args.zoom)
    print(
        "Built static spot tiles: "
        f"{result.included_features}/{result.total_source_features} included, "
        f"{result.excluded_features} excluded, {result.tile_count} tile(s)"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
