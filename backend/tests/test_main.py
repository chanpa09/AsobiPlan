from unittest.mock import patch
from app.database import BabyStation, StrollerFriendlyPlace, RouteCache
import requests

def test_read_root(client):
    response = client.get("/")
    assert response.status_code == 200
    assert "Welcome to AsobiPlan API" in response.json()["message"]

def test_get_baby_stations_empty(client):
    response = client.get("/api/baby-stations?lat=35.6728&lon=139.8174")
    assert response.status_code == 200
    assert response.json() == []

def test_get_baby_stations_with_data(db, client):
    # Add baby stations: one inside radius (500m), one outside
    # Tokyo Toyocho Station: 35.6728, 139.8174
    # Station 1 (close, approx 150m): 35.6718, 139.8184
    # Station 2 (far, approx 2000m): 35.6900, 139.8300
    s1 = BabyStation(
        name="Close Station",
        latitude=35.6718,
        longitude=139.8184,
        has_nursing_room=True,
        has_diaper_table=True
    )
    s2 = BabyStation(
        name="Far Station",
        latitude=35.6900,
        longitude=139.8300,
        has_nursing_room=True,
        has_diaper_table=False
    )
    db.add_all([s1, s2])
    db.commit()

    response = client.get("/api/baby-stations?lat=35.6728&lon=139.8174&radius=500")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["name"] == "Close Station"
    assert data[0]["has_diaper_table"] is True

def test_get_places_filtering(db, client):
    # Create 3 stroller friendly places
    p1 = StrollerFriendlyPlace(
        name="Nice Cafe",
        category="cafe",
        latitude=35.6720,
        longitude=139.8170,
        stroller_score=4,
        has_ramp=True,
        doorway_width="wide",
        has_baby_chair=True,
        has_stroller_parking=True,
    )
    p2 = StrollerFriendlyPlace(
        name="So-so Restaurant",
        category="restaurant",
        latitude=35.6725,
        longitude=139.8175,
        stroller_score=2, # Score lower than default min_score=3
        has_ramp=False,
        doorway_width="narrow"
    )
    p3 = StrollerFriendlyPlace(
        name="Far Place",
        category="cafe",
        latitude=35.6900,
        longitude=139.8300,
        stroller_score=5,
        has_ramp=True,
        doorway_width="wide"
    )
    db.add_all([p1, p2, p3])
    db.commit()

    # 1. Test basic search (min_score=3, radius=1000) -> should only return p1
    response = client.get("/api/places?lat=35.6728&lon=139.8174")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["name"] == "Nice Cafe"

    # 2. Test min_score=1 -> should return p1 and p2 (since p3 is too far)
    response = client.get("/api/places?lat=35.6728&lon=139.8174&min_score=1")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    names = [p["name"] for p in data]
    assert "Nice Cafe" in names
    assert "So-so Restaurant" in names

    # 3. Test filtering by has_ramp=True
    response = client.get("/api/places?lat=35.6728&lon=139.8174&min_score=1&has_ramp=true")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["name"] == "Nice Cafe"

    # 4. Test category and doorway width filters
    response = client.get("/api/places?lat=35.6728&lon=139.8174&min_score=1&category=cafe&doorway_width=wide")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["name"] == "Nice Cafe"

    # 5. Test detailed amenity filters
    response = client.get(
        "/api/places?lat=35.6728&lon=139.8174&min_score=1&has_baby_chair=true&has_stroller_parking=true"
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["has_baby_chair"] is True
    assert data[0]["has_stroller_parking"] is True

def test_get_places_rejects_invalid_min_score(client):
    response = client.get("/api/places?lat=35.6728&lon=139.8174&min_score=0")
    assert response.status_code == 422

    response = client.get("/api/places?lat=35.6728&lon=139.8174&min_score=6")
    assert response.status_code == 422

def test_get_route_returns_503_when_osrm_unavailable(db, client):
    with patch("requests.get", side_effect=requests.exceptions.RequestException("OSRM offline")):
        response = client.get("/api/route?start_lat=35.6728&start_lon=139.8174&end_lat=35.6701&end_lon=139.8302")
        assert response.status_code == 503
        assert response.json()["detail"] == "Routing engine unavailable"
        assert db.query(RouteCache).first() is None

def test_get_route_returns_422_when_osrm_has_no_route(client):
    with patch("requests.get") as mock_get:
        mock_get.return_value.status_code = 200
        mock_get.return_value.json.return_value = {"code": "NoRoute", "routes": []}

        response = client.get("/api/route?start_lat=35.6728&start_lon=139.8174&end_lat=35.6701&end_lon=139.8302")
        assert response.status_code == 422
        assert response.json()["detail"] == "No stroller route found"

def test_get_route_success(db, client):
    # Mock a successful OSRM response
    mock_osrm_response = {
        "routes": [
            {
                "geometry": {
                    "coordinates": [
                        [139.8174, 35.6728],
                        [139.8302, 35.6701]
                    ],
                    "type": "LineString"
                },
                "duration": 500,
                "distance": 1000
            }
        ],
        "code": "Ok"
    }
    
    with patch("requests.get") as mock_get:
        mock_get.return_value.status_code = 200
        mock_get.return_value.json.return_value = mock_osrm_response
        
        # Test endpoint
        response = client.get("/api/route?start_lat=35.6728&start_lon=139.8174&end_lat=35.6701&end_lon=139.8302")
        assert response.status_code == 200
        data = response.json()
        assert data["code"] == "Ok"
        assert data["source"] == "osrm"
        assert data["is_fallback"] is False
        assert data["routes"][0]["duration"] == 500
        
        # Test if cache was populated
        cache = db.query(RouteCache).first()
        assert cache is not None
        assert cache.start_lat == 35.6728
        assert cache.route_data["source"] == "osrm"
        assert cache.route_data["routes"][0]["duration"] == 500
        
        # Next query should hit cache (mock requests should NOT be called again)
        mock_get.reset_mock()
        response2 = client.get("/api/route?start_lat=35.6728&start_lon=139.8174&end_lat=35.6701&end_lon=139.8302")
        assert response2.status_code == 200
        mock_get.assert_not_called()

def test_get_route_deletes_stale_fallback_caches(db, client):
    stale_route_data = {
        "routes": [{"duration": 600, "distance": 1200}],
        "code": "Ok",
        "message": "Fallback route returned (OSRM container offline)"
    }
    db.add_all([
        RouteCache(
            start_lat=35.6728,
            start_lon=139.8174,
            end_lat=35.6701,
            end_lon=139.8302,
            route_data=stale_route_data,
        ),
        RouteCache(
            start_lat=35.6728,
            start_lon=139.8174,
            end_lat=35.6701,
            end_lon=139.8302,
            route_data={**stale_route_data, "is_fallback": True},
        ),
    ])
    db.commit()

    mock_osrm_response = {
        "routes": [
            {
                "geometry": {
                    "coordinates": [
                        [139.8174, 35.6728],
                        [139.8302, 35.6701]
                    ],
                    "type": "LineString"
                },
                "duration": 500,
                "distance": 1000
            }
        ],
        "code": "Ok"
    }

    with patch("requests.get") as mock_get:
        mock_get.return_value.status_code = 200
        mock_get.return_value.json.return_value = mock_osrm_response

        response = client.get("/api/route?start_lat=35.6728&start_lon=139.8174&end_lat=35.6701&end_lon=139.8302")
        assert response.status_code == 200
        assert response.json()["source"] == "osrm"

    caches = db.query(RouteCache).all()
    assert len(caches) == 1
    assert caches[0].route_data["source"] == "osrm"
    assert caches[0].route_data["is_fallback"] is False

def test_get_route_deletes_stale_caches_before_returning_valid_cache(db, client):
    valid_route_data = {
        "routes": [{"duration": 500, "distance": 1000}],
        "code": "Ok",
        "source": "osrm",
        "is_fallback": False,
    }
    stale_route_data = {
        "routes": [{"duration": 600, "distance": 1200}],
        "code": "Ok",
        "is_fallback": True,
    }
    db.add_all([
        RouteCache(
            start_lat=35.6728,
            start_lon=139.8174,
            end_lat=35.6701,
            end_lon=139.8302,
            route_data=stale_route_data,
        ),
        RouteCache(
            start_lat=35.6728,
            start_lon=139.8174,
            end_lat=35.6701,
            end_lon=139.8302,
            route_data=valid_route_data,
        ),
    ])
    db.commit()

    with patch("requests.get") as mock_get:
        response = client.get("/api/route?start_lat=35.6728&start_lon=139.8174&end_lat=35.6701&end_lon=139.8302")

    assert response.status_code == 200
    assert response.json()["source"] == "osrm"
    mock_get.assert_not_called()

    caches = db.query(RouteCache).all()
    assert len(caches) == 1
    assert caches[0].route_data == valid_route_data
