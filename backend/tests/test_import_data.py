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
