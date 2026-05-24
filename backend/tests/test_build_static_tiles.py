import json

from scripts.build_static_tiles import build_static_tiles, has_baby_friendly_place_evidence


def feature(properties, coordinates=None):
    return {
        "type": "Feature",
        "geometry": {
            "type": "Point",
            "coordinates": coordinates or [139.8174, 35.6698],
        },
        "properties": properties,
    }


def write_collection(data_dir, file_name, features):
    (data_dir / file_name).write_text(
        json.dumps({"type": "FeatureCollection", "features": features}, ensure_ascii=False),
        encoding="utf-8",
    )


def place_properties(**overrides):
    base = {
        "id": 1,
        "name": "Candidate",
        "category": "park",
        "address": "Tokyo",
        "stroller_score": 4,
        "reasoning": "공개 지도 태그를 기준으로 산정했습니다.",
        "review_keywords": ["휠체어 접근"],
        "has_ramp": True,
        "doorway_width": "wide",
        "has_baby_chair": False,
        "has_stroller_parking": False,
        "access_policy": "public_free",
        "confidence": "manual_checked",
    }
    return {**base, **overrides}


def test_evidence_requires_non_unknown_confidence():
    assert has_baby_friendly_place_evidence(place_properties(confidence="manual_checked")) is True
    assert has_baby_friendly_place_evidence(place_properties(confidence="unknown")) is False


def test_restaurant_requires_baby_specific_evidence():
    restaurant = place_properties(category="restaurant", has_ramp=True, has_baby_chair=False)
    restaurant_with_chair = place_properties(category="restaurant", has_ramp=True, has_baby_chair=True)

    assert has_baby_friendly_place_evidence(restaurant) is False
    assert has_baby_friendly_place_evidence(restaurant_with_chair) is True


def test_build_static_tiles_keeps_baby_stations_and_filtered_places(tmp_path):
    data_dir = tmp_path / "data"
    out_dir = tmp_path / "spot-tiles"
    data_dir.mkdir()
    write_collection(
        data_dir,
        "baby-stations.json",
        [
            feature(
                {
                    "id": 10,
                    "name": "Baby Station",
                    "category": "public_facility",
                    "address": "Tokyo",
                    "has_nursing_room": True,
                    "has_diaper_table": True,
                    "has_hot_water": False,
                    "open_hours": "09:00-18:00",
                    "access_policy": "public_free",
                    "confidence": "official",
                }
            )
        ],
    )
    write_collection(
        data_dir,
        "places.json",
        [
            feature(place_properties(id=1, category="park")),
            feature(place_properties(id=2, category="cafe", has_ramp=True, has_baby_chair=False)),
            feature(place_properties(id=3, category="cafe", has_baby_chair=True)),
            feature(place_properties(id=4, confidence="unknown")),
        ],
    )

    result = build_static_tiles(data_dir, out_dir)

    assert result.total_source_features == 5
    assert result.included_features == 3
    assert result.excluded_features == 2

    manifest = json.loads((out_dir / "manifest.json").read_text(encoding="utf-8"))
    assert manifest["includedFeatures"] == 3

    tile_features = []
    for tile_path in (out_dir / str(manifest["tileZoom"])).glob("*.json"):
        tile_features.extend(json.loads(tile_path.read_text(encoding="utf-8"))["features"])

    ids = {tile_feature["properties"]["id"] for tile_feature in tile_features}
    assert ids == {"care-10", "place-1", "place-3"}
