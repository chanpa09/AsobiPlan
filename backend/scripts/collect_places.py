import argparse
import os
import sys
import json

# Add backend directory to system path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scripts.keyword_analysis import analyze_stroller_friendliness_ai, run_keyword_analysis

# Center Coordinates: Toyocho Station (35.6698, 139.8174)
TOYOCHO_LAT = 35.6698
TOYOCHO_LNG = 139.8174
RADIUS = 1000 # 1km

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
    return parser.parse_args(argv)


def is_configured_api_key(api_key: str | None) -> bool:
    return bool(api_key) and api_key != "your_google_places_api_key_here"


def load_environment():
    try:
        from dotenv import load_dotenv
    except ImportError:
        return

    load_dotenv()

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
        
    # 3. Export to GeoJSON Format
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
                    "id": p["id"],
                    "name": p["name"],
                    "category": p["category"],
                    "address": p["address"],
                    "google_rating": p["google_rating"],
                    "stroller_score": p["stroller_score"],
                    "reasoning": p["reasoning"],
                    "review_keywords": p["review_keywords"],
                    "has_ramp": p["has_ramp"],
                    "doorway_width": p["doorway_width"],
                    "has_baby_chair": p["has_baby_chair"],
                    "has_stroller_parking": p["has_stroller_parking"],
                    "access_policy": p["access_policy"],
                    "access_note": p["access_note"],
                    "child_summary": p["child_summary"]
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
                    "id": s["id"],
                    "name": s["name"],
                    "category": s["category"],
                    "address": s["address"],
                    "has_nursing_room": s["has_nursing_room"],
                    "has_diaper_table": s["has_diaper_table"],
                    "has_hot_water": s["has_hot_water"],
                    "open_hours": s["open_hours"],
                    "access_policy": s["access_policy"],
                    "access_note": s["access_note"]
                }
            } for s in processed_stations
        ]
    }
    
    # Save files to frontend public path
    frontend_data_dir = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
        "frontend", "public", "data"
    )
    
    places_json_path = os.path.join(frontend_data_dir, "places.json")
    stations_json_path = os.path.join(frontend_data_dir, "baby-stations.json")
    
    os.makedirs(frontend_data_dir, exist_ok=True)
    
    with open(places_json_path, 'w', encoding='utf-8') as f:
        json.dump(places_geojson, f, ensure_ascii=False, indent=2)
        print(f"Successfully saved GeoJSON places data to {places_json_path}")
        
    with open(stations_json_path, 'w', encoding='utf-8') as f:
        json.dump(stations_geojson, f, ensure_ascii=False, indent=2)
        print(f"Successfully saved GeoJSON baby stations data to {stations_json_path}")
        
    # 4. Import to SQLite DB (asobi.db)
    print("Connecting to backend database for import...")
    from sqlalchemy.orm import Session

    from app.database import engine, init_db, BabyStation, StrollerFriendlyPlace, IS_SQLITE

    db = Session(bind=engine)
    try:
        # Reinitialize schemas
        init_db()
        
        # Clear table
        db.query(StrollerFriendlyPlace).delete()
        db.query(BabyStation).delete()
        
        # Insert stroller friendly places
        for p in processed_places:
            place_db = StrollerFriendlyPlace(
                name=p["name"],
                category=p["category"],
                address=p["address"],
                latitude=p["latitude"],
                longitude=p["longitude"],
                google_rating=p["google_rating"],
                stroller_score=p["stroller_score"],
                reasoning=p["reasoning"],
                review_keywords=p["review_keywords"],
                has_ramp=p["has_ramp"],
                doorway_width=p["doorway_width"],
                has_baby_chair=p["has_baby_chair"],
                has_stroller_parking=p["has_stroller_parking"],
                child_summary=p["child_summary"],
                additional_info={
                    "access_policy": p["access_policy"],
                    "access_note": p["access_note"]
                }
            )
            if not IS_SQLITE:
                place_db.geom = f"POINT({p['longitude']} {p['latitude']})"
            db.add(place_db)
            
        # Insert baby stations
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
                    "access_note": s["access_note"]
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

if __name__ == "__main__":
    main()
