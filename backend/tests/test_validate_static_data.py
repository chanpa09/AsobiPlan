import json

from scripts.validate_static_data import StaticDataValidator, main


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


def write_minimal_valid_data(data_dir):
    write_collection(
        data_dir,
        "places.json",
        [
            feature(
                {
                    "id": 1,
                    "name": "Open Cafe",
                    "category": "cafe",
                    "address": "Tokyo",
                    "reasoning": "공개 지도 태그를 기준으로 산정했습니다.",
                    "stroller_score": 4,
                    "review_keywords": ["휠체어 접근"],
                    "has_ramp": True,
                    "doorway_width": "wide",
                    "has_baby_chair": False,
                    "has_stroller_parking": False,
                    "access_policy": "customer_only",
                    "source_name": "OpenStreetMap",
                    "source_url": "https://www.openstreetmap.org/copyright",
                    "last_verified_at": "2026-05-23",
                    "confidence": "manual_checked",
                }
            )
        ],
    )
    write_collection(
        data_dir,
        "baby-stations.json",
        [
            feature(
                {
                    "id": 1,
                    "name": "Baby Station",
                    "category": "public_facility",
                    "address": "Tokyo",
                    "has_nursing_room": True,
                    "has_diaper_table": True,
                    "has_hot_water": False,
                    "open_hours": "09:00-18:00",
                    "access_policy": "public_free",
                    "source_name": "Tokyo",
                    "source_url": "https://example.com",
                    "last_verified_at": "2026-05-23",
                    "confidence": "official",
                }
            )
        ],
    )
    write_collection(data_dir, "avoid-areas.json", [])


def message_text(messages):
    return "\n".join(message.message for message in messages)


def test_valid_static_data_passes(tmp_path):
    write_minimal_valid_data(tmp_path)

    messages = StaticDataValidator().validate_data_dir(tmp_path)

    assert [message for message in messages if message.level == "error"] == []


def test_empty_avoid_areas_collection_is_valid(tmp_path):
    write_minimal_valid_data(tmp_path)
    write_collection(tmp_path, "avoid-areas.json", [])

    assert main(["--data-dir", str(tmp_path), "--strict"]) == 0


def test_validation_fails_for_duplicate_id_and_bad_fields(tmp_path):
    write_minimal_valid_data(tmp_path)
    bad_properties = {
        "id": 1,
        "name": "",
        "category": "arcade",
        "address": "Tokyo",
        "reasoning": "",
        "stroller_score": 6,
        "review_keywords": "휠체어 접근",
        "has_ramp": "yes",
        "doorway_width": "huge",
        "has_baby_chair": False,
        "has_stroller_parking": False,
        "access_policy": "members_only",
    }
    write_collection(
        tmp_path,
        "places.json",
        [
            feature({**bad_properties, "name": "One"}, [35.6698, 139.8174]),
            feature(bad_properties),
        ],
    )

    messages = StaticDataValidator().validate_data_dir(tmp_path)
    errors = [message for message in messages if message.level == "error"]

    assert len(errors) >= 7
    assert "duplicate id" in message_text(errors)
    assert "coordinates look swapped" in message_text(errors)
    assert "stroller_score must be an integer from 1 to 5" in message_text(errors)
    assert main(["--data-dir", str(tmp_path), "--strict"]) == 1


def test_missing_source_metadata_is_warning_not_error(tmp_path):
    write_minimal_valid_data(tmp_path)
    write_collection(
        tmp_path,
        "places.json",
        [
            feature(
                {
                    "id": 1,
                    "name": "Unknown Source Park",
                    "category": "park",
                    "address": "Tokyo",
                    "reasoning": "공개 지도 태그를 기준으로 산정했습니다.",
                    "stroller_score": 3,
                    "review_keywords": [],
                    "has_ramp": False,
                    "doorway_width": "medium",
                    "has_baby_chair": False,
                    "has_stroller_parking": False,
                    "access_policy": "public_free",
                    "confidence": "unknown",
                }
            )
        ],
    )

    messages = StaticDataValidator().validate_data_dir(tmp_path)

    assert [message for message in messages if message.level == "error"] == []
    assert len([message for message in messages if message.level == "warning"]) >= 4
    assert main(["--data-dir", str(tmp_path), "--strict"]) == 0
