import os
import sys
import requests
from sqlalchemy import text
from sqlalchemy.orm import Session

# Add app directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import engine, init_db, BabyStation, StrollerFriendlyPlace, IS_SQLITE

# Mock Google Places API Responses for Koto-ku for testing without API keys
MOCK_PLACES = [
    {
        "name": "라라포트 토요스 (LaLaport Toyosu)",
        "category": "mall",
        "address": "도쿄도 고토구 토요스 2-1-9",
        "latitude": 35.6548,
        "longitude": 139.7967,
        "google_rating": 4.2,
        "reviews": [
            "ベビーカーの貸出があり、通路も非常に広いです。授乳室が綺麗で大満足。",
            "離乳食の持ち込みも問題なし。赤ちゃん連れには最高のモール。",
            "海が見えるテラスもあり、ベビーカーでの移動もスロープが多くて楽です。"
        ]
    },
    {
        "name": "기바 공원 (Kiba Park)",
        "category": "park",
        "address": "도쿄도 고토구 히라노 4-6-1",
        "latitude": 35.6749,
        "longitude": 139.8079,
        "google_rating": 4.3,
        "reviews": [
            "スロープが整備されており、ベビーカーでの散歩がとてもスムーズです。",
            "広い公園で子供がのびのびと遊べます。多目的トイレもあります。"
        ]
    },
    {
        "name": "아리아케 가든 (Ariake Garden)",
        "category": "mall",
        "address": "도쿄도 고토구 아리아케 2-1-8",
        "latitude": 35.6385,
        "longitude": 139.7925,
        "google_rating": 4.1,
        "reviews": [
            "有明ガーデンはベビーカーでの移動が本当に楽。4階のベビールームがすごく広くて綺麗でした。",
            "エレベーターがすぐ来て、通路も広いのでストレスフリー。"
        ]
    },
    {
        "name": "도쿄 현대 미술관 (Museum of Contemporary Art Tokyo)",
        "category": "public_facility",
        "address": "도쿄도 고토구 히라노 4-1-1",
        "latitude": 35.6800,
        "longitude": 139.8080,
        "google_rating": 4.4,
        "reviews": [
            "館内が広くスロープやエレベーターが完璧。ベビーカーの貸出もあり、子供と一緒に快適に美術鑑賞が楽しめました。",
            "段差がほとんどなく、赤ちゃん連れでも安心して回れます。"
        ]
    },
    {
        "name": "토요스 공원 (Toyosu Park)",
        "category": "park",
        "address": "도쿄도 고토구 토요스 2-3-6",
        "latitude": 35.6535,
        "longitude": 139.7975,
        "google_rating": 4.3,
        "reviews": [
            "ららぽーとの隣にあり、スロープや平坦な芝生があり、ベビーカーでのお散歩にぴったり。",
            "バリアフリーで海風が気持ちいい素敵な公園です。"
        ]
    },
    {
        "name": "로얄 호스트 토요초점 (Royal Host)",
        "category": "restaurant",
        "address": "도쿄도 고토구 토요 4-1-1",
        "latitude": 35.6706,
        "longitude": 139.8165,
        "google_rating": 4.0,
        "reviews": [
            "店内が広くてベビーカーでの入店もスムーズでした。ベビーチェアがあり、子供連れに優しい。",
            "スタッフの方が親切で席の配置にも配慮してくれました。"
        ]
    },
    {
        "name": "블루보틀 커피 기요스미시라카와",
        "category": "cafe",
        "address": "도쿄도 고토구 히라노 1-4-8",
        "latitude": 35.6815,
        "longitude": 139.8000,
        "google_rating": 4.2,
        "reviews": [
            "段差がなくベビーカーでも入れますが、店内は少し狭い箇所もあり混雑時は大変かも。",
            "テイクアウトならベビーカーでも気兼ねなく利用できます。"
        ]
    },
    {
        "name": "100 스푼즈 도요스 (100 Spoons)",
        "category": "restaurant",
        "address": "도쿄도 고토구 토요스 2-1-9 라라포트 도요스 3 1층",
        "latitude": 35.6545,
        "longitude": 139.7962,
        "google_rating": 4.1,
        "reviews": [
            "離乳食が無料で提供されて感動。テーブルもベビーカーを横付けできるよう広くなっています。",
            "キッズメニューも大人顔負けのクオリティ。子連れには聖地。"
        ]
    },
    {
        "name": "스타벅스 커피 미나미스나점",
        "category": "cafe",
        "address": "도쿄도 고토구 미나미스나 3-12-1",
        "latitude": 35.6703,
        "longitude": 139.8290,
        "google_rating": 3.9,
        "reviews": [
            "テラス席はベビーカーを置きやすいですが、店内はやや狭いのでテラスがお勧めです。",
            "少し通路が狭いですが、親切に対応してもらえました。"
        ]
    },
    {
        "name": "토요초 야키니쿠 한류관",
        "category": "restaurant",
        "address": "도쿄도 고토구 토요 3-15-3",
        "latitude": 35.6696,
        "longitude": 139.8131,
        "google_rating": 3.7,
        "reviews": [
            "入り口に急な階段があり、ベビーカーを持ち上げるのは無理でした。店内も狭い。",
            "席が狭くカウンターメインなので赤ちゃん連れで行く場所ではないです。"
        ]
    }
]

# Mock Baby Stations in Koto-ku
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
        "name": "라라포트 토요스 수유실",
        "address": "도쿄도 고토구 토요스 2-1-9",
        "latitude": 35.6548,
        "longitude": 139.7967,
        "has_nursing_room": True,
        "has_diaper_table": True,
        "has_hot_water": True,
        "open_hours": "10:00 - 21:00"
    },
    {
        "name": "아리아케 가든 4층 유아 휴게실",
        "address": "도쿄도 고토구 아리아케 2-1-8",
        "latitude": 35.6385,
        "longitude": 139.7925,
        "has_nursing_room": True,
        "has_diaper_table": True,
        "has_hot_water": True,
        "open_hours": "10:00 - 21:00"
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
        "name": "도쿄 현대 미술관 수유실",
        "address": "도쿄도 고토구 히라노 4-1-1",
        "latitude": 35.6800,
        "longitude": 139.8080,
        "has_nursing_room": True,
        "has_diaper_table": True,
        "has_hot_water": True,
        "open_hours": "10:00 - 18:00"
    },
    {
        "name": "토요초역 아기 정거장",
        "address": "도쿄도 고토구 토요 4-1-2",
        "latitude": 35.6698,
        "longitude": 139.8174,
        "has_nursing_room": False,
        "has_diaper_table": True,
        "has_hot_water": False,
        "open_hours": "첫차 - 막차"
    },
    {
        "name": "기바역 아기 정거장",
        "address": "도쿄도 고토구 기바 5-1-1",
        "latitude": 35.6698,
        "longitude": 139.8071,
        "has_nursing_room": False,
        "has_diaper_table": True,
        "has_hot_water": False,
        "open_hours": "첫차 - 막차"
    },
    {
        "name": "토요스역 아기 정거장",
        "address": "도쿄도 고토구 토요스 2-1-1",
        "latitude": 35.6545,
        "longitude": 139.7960,
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
                print(f"Skipping database file deletion (database file might be locked): {type(e).__name__}")

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

