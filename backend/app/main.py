import os
import math
from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import cast, func
import requests

from app.database import get_db, BabyStation, StrollerFriendlyPlace, RouteCache, IS_SQLITE

# Conditionally import Geography from GeoAlchemy2
if not IS_SQLITE:
    from geoalchemy2 import Geography
else:
    Geography = None

def safe_str(e) -> str:
    return str(e).encode('ascii', 'ignore').decode('ascii')

app = FastAPI(title="AsobiPlan API", description="Stroller-friendly routing and POI directory")

# Allow CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

OSRM_URL = os.getenv("OSRM_URL", "http://localhost:5000")

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the great circle distance between two points 
    on the earth (specified in decimal degrees) in meters.
    """
    R = 6371000  # Radius of Earth in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = math.sin(delta_phi / 2)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return R * c

@app.get("/")
def read_root():
    return {"message": "Welcome to AsobiPlan API (SQLite Fallback Enabled)" if IS_SQLITE else "Welcome to AsobiPlan API"}

@app.get("/api/baby-stations")
def get_baby_stations(
    lat: float = Query(..., description="Latitude of the center point"),
    lon: float = Query(..., description="Longitude of the center point"),
    radius: float = Query(500.0, description="Search radius in meters"),
    db: Session = Depends(get_db)
):
    """
    Get baby stations (nursing rooms) within a specific radius.
    Uses PostGIS spatial query if on PostgreSQL, otherwise Haversine fallback in Python for SQLite.
    """
    if IS_SQLITE:
        all_stations = db.query(BabyStation).all()
        stations = [
            s for s in all_stations
            if haversine_distance(lat, lon, s.latitude, s.longitude) <= radius
        ]
    else:
        # Create center point geometry
        center_point = func.ST_SetSRID(func.ST_MakePoint(lon, lat), 4326)
        
        # Query using PostGIS ST_DWithin on Geography for accurate meter distances
        stations = db.query(BabyStation).filter(
            func.ST_DWithin(
                cast(BabyStation.geom, Geography),
                cast(center_point, Geography),
                radius
            )
        ).all()
    
    return [
        {
            "id": s.id,
            "name": s.name,
            "address": s.address,
            "latitude": s.latitude,
            "longitude": s.longitude,
            "has_nursing_room": s.has_nursing_room,
            "has_diaper_table": s.has_diaper_table,
            "has_hot_water": s.has_hot_water,
            "open_hours": s.open_hours
        } for s in stations
    ]

@app.get("/api/places")
def get_places(
    lat: float = Query(..., description="Latitude of the center point"),
    lon: float = Query(..., description="Longitude of the center point"),
    radius: float = Query(1000.0, description="Search radius in meters"),
    min_score: int = Query(3, ge=1, le=5, description="Minimum stroller friendliness score"),
    category: str = Query(None, description="Category (restaurant, cafe, park)"),
    has_ramp: bool = Query(None, description="Filter: must have a ramp"),
    doorway_width: str = Query(None, description="Filter: doorway width ('wide', 'medium', 'narrow')"),
    has_baby_chair: bool = Query(None, description="Filter: must have baby chairs"),
    has_stroller_parking: bool = Query(None, description="Filter: must have stroller parking"),
    db: Session = Depends(get_db)
):
    """
    Get stroller friendly places within a specific radius.
    Uses PostGIS spatial query if on PostgreSQL, otherwise Haversine fallback in Python for SQLite.
    """
    if IS_SQLITE:
        query = db.query(StrollerFriendlyPlace).filter(
            StrollerFriendlyPlace.stroller_score >= min_score
        )
        if category:
            query = query.filter(StrollerFriendlyPlace.category == category)
        if has_ramp is not None:
            query = query.filter(StrollerFriendlyPlace.has_ramp == has_ramp)
        if doorway_width:
            query = query.filter(StrollerFriendlyPlace.doorway_width == doorway_width)
        if has_baby_chair is not None:
            query = query.filter(StrollerFriendlyPlace.has_baby_chair == has_baby_chair)
        if has_stroller_parking is not None:
            query = query.filter(StrollerFriendlyPlace.has_stroller_parking == has_stroller_parking)
            
        all_places = query.all()
        places = [
            p for p in all_places
            if haversine_distance(lat, lon, p.latitude, p.longitude) <= radius
        ]
    else:
        center_point = func.ST_SetSRID(func.ST_MakePoint(lon, lat), 4326)
        query = db.query(StrollerFriendlyPlace).filter(
            func.ST_DWithin(
                cast(StrollerFriendlyPlace.geom, Geography),
                cast(center_point, Geography),
                radius
            ),
            StrollerFriendlyPlace.stroller_score >= min_score
        )
        if category:
            query = query.filter(StrollerFriendlyPlace.category == category)
        if has_ramp is not None:
            query = query.filter(StrollerFriendlyPlace.has_ramp == has_ramp)
        if doorway_width:
            query = query.filter(StrollerFriendlyPlace.doorway_width == doorway_width)
        if has_baby_chair is not None:
            query = query.filter(StrollerFriendlyPlace.has_baby_chair == has_baby_chair)
        if has_stroller_parking is not None:
            query = query.filter(StrollerFriendlyPlace.has_stroller_parking == has_stroller_parking)
            
        places = query.all()
    
    return [
        {
            "id": p.id,
            "name": p.name,
            "category": p.category,
            "address": p.address,
            "latitude": p.latitude,
            "longitude": p.longitude,
            "google_rating": p.google_rating,
            "stroller_score": p.stroller_score,
            "reasoning": p.reasoning,
            "review_keywords": p.review_keywords,
            "has_ramp": p.has_ramp,
            "doorway_width": p.doorway_width,
            "has_baby_chair": p.has_baby_chair,
            "has_stroller_parking": p.has_stroller_parking
        } for p in places
    ]

@app.get("/api/route")
def get_route(
    start_lat: float = Query(..., description="Start latitude"),
    start_lon: float = Query(..., description="Start longitude"),
    end_lat: float = Query(..., description="End latitude"),
    end_lon: float = Query(..., description="End longitude"),
    db: Session = Depends(get_db)
):
    """
    Query custom OSRM engine for stroller-optimized routes (stairs-avoided).
    """
    r_start_lat = round(start_lat, 4)
    r_start_lon = round(start_lon, 4)
    r_end_lat = round(end_lat, 4)
    r_end_lon = round(end_lon, 4)
    
    try:
        cached_route = db.query(RouteCache).filter(
            RouteCache.start_lat == r_start_lat,
            RouteCache.start_lon == r_start_lon,
            RouteCache.end_lat == r_end_lat,
            RouteCache.end_lon == r_end_lon
        ).first()
        if cached_route:
            print("Route cache hit!")
            return cached_route.route_data
    except Exception as e:
        print(f"Error checking route cache: {safe_str(e)}")

    coordinates = f"{start_lon},{start_lat};{end_lon},{end_lat}"
    osrm_api_url = f"{OSRM_URL}/route/v1/foot/{coordinates}?steps=true&geometries=geojson&overview=full"
    
    route_data = None
    try:
        response = requests.get(osrm_api_url, timeout=5)
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail="OSRM Engine error")
        route_data = response.json()
    except requests.exceptions.RequestException as e:
        print(f"OSRM container connection failed: {safe_str(e)}. Returning fallback mockup route.")
        route_data = {
            "routes": [
                {
                    "geometry": {
                        "coordinates": [
                            [start_lon, start_lat],
                            [139.8210, 35.6715],
                            [139.8235, 35.6708],
                            [end_lon, end_lat]
                        ],
                        "type": "LineString"
                    },
                    "duration": 600,
                    "distance": 1200
                }
            ],
            "code": "Ok",
            "message": "Fallback route returned (OSRM container offline)"
        }

    if route_data:
        try:
            new_cache = RouteCache(
                start_lat=r_start_lat,
                start_lon=r_start_lon,
                end_lat=r_end_lat,
                end_lon=r_end_lon,
                route_data=route_data
            )
            db.add(new_cache)
            db.commit()
        except Exception as e:
            db.rollback()
            print(f"Error saving to route cache: {safe_str(e)}")
            
    return route_data
