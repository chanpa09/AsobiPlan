from app.database import BabyStation, StrollerFriendlyPlace, RouteCache
from app.main import haversine_distance

def test_haversine_distance():
    # Distance between Tokyo Station and Shibuya Station (approx 6.2 km)
    tokyo_lat, tokyo_lon = 35.6812, 139.7671
    shibuya_lat, shibuya_lon = 35.6580, 139.7016
    
    distance = haversine_distance(tokyo_lat, tokyo_lon, shibuya_lat, shibuya_lon)
    
    # Should be around 6.45 km, allow a reasonable margin of error.
    assert 6400 <= distance <= 6500

def test_create_baby_station(db):
    station = BabyStation(
        name="Test Baby Station",
        address="Test Address 123",
        latitude=35.6728,
        longitude=139.8174,
        has_nursing_room=True,
        has_diaper_table=True,
        has_hot_water=False,
        open_hours="09:00-18:00"
    )
    db.add(station)
    db.commit()
    
    saved_station = db.query(BabyStation).filter_by(name="Test Baby Station").first()
    assert saved_station is not None
    assert saved_station.latitude == 35.6728
    assert saved_station.has_nursing_room is True
    assert saved_station.has_hot_water is False

def test_create_stroller_friendly_place(db):
    place = StrollerFriendlyPlace(
        name="Stroller Friendly Cafe",
        category="cafe",
        address="Cafe Address 456",
        latitude=35.6701,
        longitude=139.8302,
        google_rating=4.5,
        stroller_score=4,
        reasoning="Spacious entrance, ramp available",
        review_keywords=["유모차", "유모차 입장", "친절"],
        has_ramp=True,
        doorway_width="wide",
        has_baby_chair=True,
        has_stroller_parking=True
    )
    db.add(place)
    db.commit()
    
    saved_place = db.query(StrollerFriendlyPlace).filter_by(name="Stroller Friendly Cafe").first()
    assert saved_place is not None
    assert saved_place.category == "cafe"
    assert saved_place.stroller_score == 4
    assert saved_place.has_ramp is True
    assert "유모차" in saved_place.review_keywords

def test_create_route_cache(db):
    route_data = {
        "routes": [
            {
                "duration": 600,
                "distance": 1200
            }
        ]
    }
    cache = RouteCache(
        start_lat=35.6728,
        start_lon=139.8174,
        end_lat=35.6701,
        end_lon=139.8302,
        route_data=route_data
    )
    db.add(cache)
    db.commit()
    
    saved_cache = db.query(RouteCache).filter_by(start_lat=35.6728).first()
    assert saved_cache is not None
    assert saved_cache.route_data["routes"][0]["duration"] == 600
