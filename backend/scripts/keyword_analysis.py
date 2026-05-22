import json
import os


def analyze_stroller_friendliness_ai(reviews: list) -> dict:
    """
    Evaluate stroller friendliness and detailed features using Gemini API if available.
    Falls back to keyword analysis if GEMINI_API_KEY is not set or fails.
    """
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key or api_key in ["your_gemini_api_key_here", ""]:
        return run_keyword_analysis(reviews)

    try:
        import google.generativeai as genai
        genai.configure(api_key=api_key)

        reviews_text = "\n---\n".join(reviews)

        prompt = f"""
You are an expert at evaluating places (restaurants, cafes, parks) for stroller-friendliness based on customer reviews.
Analyze the following customer reviews for a place and determine accessibility features.

Reviews:
\"\"\"
{reviews_text}
\"\"\"

Response MUST be a valid JSON object matching the following structure:
{{
  "stroller_score": 4, // Integer from 1 (terrible, stairs-only, narrow) to 5 (excellent, spacious, ramped, elevator)
  "reasoning": "한글로 작성된 짧은 요약 (최대 2문장). 예: '넓은 유모차 진입 공간과 친절한 서비스가 돋보입니다.'",
  "review_keywords": ["유모차", "넓음", "엘리베이터"], // Array of strings (in Korean) representing keywords mentioned in reviews.
  "has_ramp": true, // Boolean. True if ramp/slope is mentioned or implied, false otherwise.
  "doorway_width": "wide", // String. One of: "wide", "medium", "narrow" (default to "medium" if unclear).
  "has_baby_chair": true, // Boolean. True if baby chairs are available/mentioned.
  "has_stroller_parking": false, // Boolean. True if stroller parking or storage area is mentioned.
  "child_summary": "아이 동반 가족 관점에서 이 장소를 한 줄로 평가 (한글, 최대 1문장). 예: '경사로와 아기의자가 갖춰져 있어 아이와 함께 식사하기 좋은 곳이에요.'"
}}

Ensure the response is ONLY raw JSON. Do not include markdown code block formatting (like ```json ... ```) or any other text.
"""
        model = genai.GenerativeModel("gemini-2.5-flash")
        response = model.generate_content(prompt)
        text_response = response.text.strip()

        # Remove markdown fence if returned despite prompt instruction
        if text_response.startswith("```"):
            lines = text_response.splitlines()
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines[-1].startswith("```"):
                lines = lines[:-1]
            text_response = "\n".join(lines).strip()

        data = json.loads(text_response)
        return {
            "stroller_score": int(data.get("stroller_score", 3)),
            "reasoning": str(data.get("reasoning", "보통 수준의 유모차 이용 환경입니다.")),
            "review_keywords": list(data.get("review_keywords", [])),
            "has_ramp": bool(data.get("has_ramp", False)),
            "doorway_width": str(data.get("doorway_width", "medium")),
            "has_baby_chair": bool(data.get("has_baby_chair", False)),
            "has_stroller_parking": bool(data.get("has_stroller_parking", False)),
            "child_summary": str(data.get("child_summary", ""))
        }
    except Exception as e:
        print(f"Gemini API analysis failed: {e}. Falling back to keyword analysis.")
        return run_keyword_analysis(reviews)


def run_keyword_analysis(reviews: list) -> dict:
    keywords = {
        "ベビーカー": 2,  # stroller
        "広い": 1,  # wide/spacious
        "離乳食": 2,  # baby food friendly
        "スロープ": 1.5,  # ramp
        "エレベーター": 1.5,  # elevator
        "段差": -1,  # step/bump
        "狭い": -2,  # narrow
        "階段": -2  # stairs
    }

    score = 3.0  # default base rating
    matched_keywords = []

    text_content = " ".join(reviews)
    for kw, val in keywords.items():
        if kw in text_content:
            score += val
            matched_keywords.append(kw)

    # Clamp score to 1-5 range
    final_score = int(max(1, min(5, round(score))))

    # Simple rule-based reasoning
    reasoning = "리뷰 분석 결과: "
    if "階段" in text_content or "狭い" in text_content:
        reasoning += "계단 혹은 좁은 공간으로 인해 유모차 진입이 다소 불편할 수 있습니다."
    elif "ベビーカー" in text_content and "広い" in text_content:
        reasoning += "공간이 넓고 유모차 진입이 수월하다는 긍정적인 평이 많습니다."
    else:
        reasoning += "보통 수준의 유모차 이용 환경입니다."

    # Standard translation of keywords for UI tags
    tag_map = {
        "ベビーカー": "유모차",
        "広い": "넓은통로",
        "離乳食": "이유식",
        "スロープ": "경사로",
        "エレベーター": "엘리베이터",
        "段差": "턱있음",
        "狭い": "좁음",
        "階段": "계단있음"
    }
    korean_keywords = [tag_map[kw] for kw in matched_keywords if kw in tag_map]
    if not korean_keywords:
        korean_keywords = ["일반"]

    # Rule-based amenities
    has_ramp = "スロープ" in text_content or "エレベーター" in text_content or "elevator" in text_content or "slope" in text_content
    doorway_width = "narrow" if ("狭い" in text_content) else "wide" if ("広い" in text_content) else "medium"
    has_baby_chair = "離乳食" in text_content or "chair" in text_content or "椅" in text_content
    has_stroller_parking = "ベビーカー" in text_content and ("置" in text_content or "パーキング" in text_content)

    # Generate child_summary fallback for keyword analysis
    child_summary = ""
    if final_score >= 5:
        if has_ramp and has_baby_chair:
            child_summary = "경사로와 아기의자가 있어 유모차를 타는 아이와 함께 이용하기 아주 좋은 곳이에요."
        else:
            child_summary = "유모차 이동 공간이 넓고 쾌적하여 아이 동반 방문을 적극 추천해 드려요."
    elif final_score >= 4:
        if has_ramp:
            child_summary = "경사로가 있어 진입은 수월하지만 내부 공간에 약간의 제약이 있을 수 있어요."
        else:
            child_summary = "대체로 아이와 이용하기 괜찮으나, 일부 턱이나 좁은 입구에 유의하세요."
    else:
        child_summary = "유모차 진입 공간이 좁거나 턱이 있어 사전에 확인 후 방문하는 것을 권장해요."

    return {
        "stroller_score": final_score,
        "reasoning": reasoning,
        "review_keywords": korean_keywords,
        "has_ramp": has_ramp,
        "doorway_width": doorway_width,
        "has_baby_chair": has_baby_chair,
        "has_stroller_parking": has_stroller_parking,
        "child_summary": child_summary
    }
