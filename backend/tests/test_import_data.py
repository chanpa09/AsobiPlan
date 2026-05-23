import pytest

from scripts.collect_places import (
    build_open_data_places,
    infer_osm_category,
    infer_stroller_features,
    main as collect_places_main,
)
from scripts.import_data import run_keyword_analysis


def test_run_keyword_analysis_scores_positive_stroller_reviews():
    result = run_keyword_analysis([
        "店内が広いのでベビーカーでの入店もスムーズでした。",
        "スロープがあり、離乳食にも対応してくれました。",
    ])

    assert result["stroller_score"] == 5
    assert result["has_ramp"] is True
    assert result["doorway_width"] == "wide"
    assert "유모차" in result["review_keywords"]


def test_run_keyword_analysis_scores_stairs_and_narrow_space():
    result = run_keyword_analysis([
        "入り口が階段のみで、店内も狭いです。",
    ])

    assert result["stroller_score"] == 1
    assert result["has_ramp"] is False
    assert result["doorway_width"] == "narrow"
    assert "계단있음" in result["review_keywords"]


def test_collect_places_live_requires_google_places_api_key(monkeypatch):
    monkeypatch.delenv("GOOGLE_PLACES_API_KEY", raising=False)
    monkeypatch.setattr("scripts.collect_places.load_environment", lambda: None)

    with pytest.raises(RuntimeError, match="--live requires GOOGLE_PLACES_API_KEY"):
        collect_places_main(["--live"])


def test_infer_osm_category_maps_common_place_types():
    assert infer_osm_category({"amenity": "cafe"}) == "cafe"
    assert infer_osm_category({"amenity": "restaurant"}) == "restaurant"
    assert infer_osm_category({"leisure": "park"}) == "park"
    assert infer_osm_category({"shop": "supermarket"}) == "mall"
    assert infer_osm_category({"tourism": "museum"}) == "public_facility"


def test_infer_stroller_features_uses_osm_tags_and_nearby_station():
    result = infer_stroller_features(
        {"wheelchair": "yes", "changing_table": "yes", "highchair": "yes"},
        {"has_nursing_room": True, "has_diaper_table": True, "has_hot_water": True},
    )

    assert result["stroller_score"] == 5
    assert result["has_ramp"] is True
    assert result["doorway_width"] == "wide"
    assert result["has_baby_chair"] is True
    assert result["has_nursing_room"] is True
    assert result["has_diaper_table"] is True
    assert result["has_hot_water"] is True
    assert "공식시설 근접" in result["review_keywords"]


def test_build_open_data_places_deduplicates_and_preserves_source_metadata():
    elements = [
        {
            "type": "node",
            "id": 10,
            "lat": 35.6700,
            "lon": 139.8170,
            "tags": {"name": "Open Cafe", "amenity": "cafe", "wheelchair": "yes"},
        },
        {
            "type": "node",
            "id": 11,
            "lat": 35.67001,
            "lon": 139.81701,
            "tags": {"name": "Open Cafe", "amenity": "cafe", "wheelchair": "yes"},
        },
    ]

    places = build_open_data_places(
        elements,
        [{"name": "Nearby Station", "latitude": 35.6701, "longitude": 139.8171, "has_nursing_room": True, "has_diaper_table": True, "has_hot_water": False}],
    )

    assert len(places) == 1
    assert places[0]["category"] == "cafe"
    assert places[0]["access_policy"] == "customer_only"
    assert places[0]["source_name"] == "OpenStreetMap"
    assert places[0]["osm_id"] == "node/10"
    assert places[0]["google_rating"] is None
