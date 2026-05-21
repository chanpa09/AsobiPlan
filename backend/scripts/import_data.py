import os
import sys
import requests
from sqlalchemy import text
from sqlalchemy.orm import Session

# Add app directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import engine, init_db, BabyStation, StrollerFriendlyPlace, IS_SQLITE

# Mock Google Places API Responses for Minamisuna/Toyocho for testing without API keys
MOCK_PLACES = [
    {
        "name": "로얄 호스트 토요초점 (Royal Host)",
        "category": "restaurant",
        "address": "도쿄도 고토구 토요 4-1-1",
        "latitude": 35.6725,
        "longitude": 139.8160,
        "google_rating": 4.1,
        "reviews": [
            "店内が広くてベビーカーでの入店もスムーズでした。キッズメニューも豊富です。",
            "離乳食の持ち込み도快く温めてくれました。赤ちゃん連れに最適です。",
            "少し混雑していましたが、ソファー席が広くて居心地が良かったです。"
        ]
    },
    {
        "name": "미나미스나 선스모크 공원 (Sunsun Park)",
        "category": "park",
        "address": "도쿄도 고토구 미나미스나 2-1",
        "latitude": 35.6705,
        "longitude": 139.8250,
        "google_rating": 4.3,
        "reviews": [
            "広くてベビーカーで散歩するのに最適。スロープも整備されています。",
            "授乳室やオムツ替えシートは近くの商業施設を利用する必要がありますが、公園自体は平坦です。"
        ]
    },
    {
        "name": "스타벅스 커피 미나미스나점",
        "category": "cafe",
        "address": "도쿄도 고토구 미나미스나 3-12-1",
        "latitude": 35.6695,
        "longitude": 139.8285,
        "google_rating": 3.9,
        "reviews": [
            "ベビーカーだと通路が少し狭い箇所がありますが、テラス席なら快適です。",
            "スタッフが親切でドアを開けてくれました。"
        ]
    },
    {
        "name": "토요초 라멘집 (Stairs Entrance)",
        "category": "restaurant",
        "address": "도쿄도 고토구 토요 3-15",
        "latitude": 35.6710,
        "longitude": 139.8145,
        "google_rating": 3.8,
        "reviews": [
            "入り口が階段のみで、店内もカウンター席のみ。ベビーカー連れには厳しいです。",
            "味は美味しいが、子供連れで行く場所ではない."
        ]
    }
]

# Mock Baby Stations in Minamisuna/Toyocho
MOCK_BABY_STATIONS = [
    {
        "name": "고토구청 본청사 아기 정거장",
        "address": "도쿄도 고토구 토요 4-11-28",
        "latitude": 35.6728,
        "longitude": 139.8174,
        "has_nursing_room": True,
        "has_diaper_table": True,
        "has_hot_water": True,
        "open_hours": "08:30 - 17:15"
    },
    {
        "name": "이온몰 미나미스나점 아기 정거장",
        "address": "도쿄도 고토구 미나미스나 6-7-15",
        "latitude": 35.6701,
        "longitude": 139.8302,
        "has_nursing_room": True,
        "has_diaper_table": True,
        "has_hot_water": True,
        "open_hours": "10:00 - 22:00"
    },
    {
        "name": "토요초역 아기 정거장 (지하 1층)",
        "address": "도쿄도 고토구 토요 4-1-2",
        "latitude": 35.6720,
        "longitude": 139.8167,
        "has_nursing_room": False,
        "has_diaper_table": True,
        "has_hot_water": False,
        "open_hours": "첫차 - 막차"
    }
]

import json

def analyze_stroller_friendliness_ai(reviews: list) -> dict:
    """
    Evaluate stroller friendliness and detailed features using Gemini API if available.
    Falls back to keyword analysis if GEMINI_API_KEY is not set or fails.
    """
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key or api_key == "your_gemini_api_key_here":
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
  "has_stroller_parking": false // Boolean. True if stroller parking or storage area is mentioned.
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
            "has_stroller_parking": bool(data.get("has_stroller_parking", False))
        }
    except Exception as e:
        print(f"Gemini API analysis failed: {e}. Falling back to keyword analysis.")
        return run_keyword_analysis(reviews)

def run_keyword_analysis(reviews: list) -> dict:
    keywords = {
        "ベビーカー": 2, # stroller
        "広い": 1,        # wide/spacious
        "離乳食": 2,      # baby food friendly
        "スロープ": 1.5,   # ramp
        "エレベーター": 1.5, # elevator
        "段差": -1,       # step/bump
        "狭い": -2,       # narrow
        "階段": -2        # stairs
    }
    
    score = 3.0 # default base rating
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
    has_ramp = "スロープ" in text_content or "엘리베이터" in text_content or "elevator" in text_content or "slope" in text_content
    doorway_width = "narrow" if ("狭い" in text_content) else "wide" if ("広い" in text_content) else "medium"
    has_baby_chair = "離乳食" in text_content or "chair" in text_content
    has_stroller_parking = "ベビーカー" in text_content and "置" in text_content
    
    return {
        "stroller_score": final_score,
        "reasoning": reasoning,
        "review_keywords": korean_keywords,
        "has_ramp": has_ramp,
        "doorway_width": doorway_width,
        "has_baby_chair": has_baby_chair,
        "has_stroller_parking": has_stroller_parking
    }

def run_import():
    if IS_SQLITE:
        db_file = "asobi.db"
        if os.path.exists(db_file):
            try:
                os.remove(db_file)
                print("Deleted existing SQLite database file to recreate schema.")
            except Exception as e:
                print(f"Could not delete database file: {e}")

    db = Session(bind=engine)
    
    try:
        if not IS_SQLITE:
            print("Connecting to PostgreSQL and checking PostGIS...")
            with engine.connect() as conn:
                conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis;"))
                conn.commit()
            print("PostGIS extension checked/enabled.")
        else:
            print("Running in SQLite Mode (No PostGIS required. Fallback enabled.)")

        print("Initializing Database tables...")
        init_db()
        
        # 1. Import Baby Stations (Nursing Rooms)
        print("Importing Baby Stations...")
        db.query(BabyStation).delete()
        for bs_data in MOCK_BABY_STATIONS:
            station = BabyStation(
                name=bs_data["name"],
                address=bs_data["address"],
                latitude=bs_data["latitude"],
                longitude=bs_data["longitude"],
                has_nursing_room=bs_data["has_nursing_room"],
                has_diaper_table=bs_data["has_diaper_table"],
                has_hot_water=bs_data["has_hot_water"],
                open_hours=bs_data["open_hours"]
            )
            if not IS_SQLITE:
                station.geom = f"POINT({bs_data['longitude']} {bs_data['latitude']})"
            db.add(station)
            
        # 2. Import Stroller Friendly Places
        print("Importing Places and Evaluating Stroller Friendliness...")
        db.query(StrollerFriendlyPlace).delete()
        
        places_to_process = MOCK_PLACES
        
        for place_data in places_to_process:
            analysis = analyze_stroller_friendliness_ai(place_data["reviews"])
            
            place = StrollerFriendlyPlace(
                name=place_data["name"],
                category=place_data["category"],
                address=place_data["address"],
                latitude=place_data["latitude"],
                longitude=place_data["longitude"],
                google_rating=place_data["google_rating"],
                stroller_score=analysis["stroller_score"],
                reasoning=analysis["reasoning"],
                review_keywords=analysis["review_keywords"],
                has_ramp=analysis["has_ramp"],
                doorway_width=analysis["doorway_width"],
                has_baby_chair=analysis["has_baby_chair"],
                has_stroller_parking=analysis["has_stroller_parking"]
            )
            if not IS_SQLITE:
                place.geom = f"POINT({place_data['longitude']} {place_data['latitude']})"
            db.add(place)
            
        db.commit()
        print("Data Import and Analysis completed successfully!")
        
    except Exception as e:
        db.rollback()
        print(f"Error during import: {e}")
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    run_import()

