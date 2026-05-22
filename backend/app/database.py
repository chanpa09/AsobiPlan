import os
from sqlalchemy import create_engine, Column, Integer, String, Float, Boolean, JSON, text, DateTime, func
from sqlalchemy.orm import declarative_base, sessionmaker
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./asobi.db")
IS_SQLITE = DATABASE_URL.startswith("sqlite")

if not IS_SQLITE:
    from geoalchemy2 import Geometry
else:
    # Dummy placeholder for SQLite
    Geometry = None

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if IS_SQLITE else {}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class BabyStation(Base):
    """
    Koto-ku Baby Station (Nursing Room / Diaper Changing Station) Model
    """
    __tablename__ = "baby_stations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    address = Column(String, nullable=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    
    # Amenities
    has_nursing_room = Column(Boolean, default=False)
    has_diaper_table = Column(Boolean, default=False)
    has_hot_water = Column(Boolean, default=False)
    open_hours = Column(String, nullable=True)
    additional_info = Column(JSON, nullable=True)

    # PostGIS geometry column (Only added for PostgreSQL)
    if not IS_SQLITE:
        geom = Column(Geometry(geometry_type='POINT', srid=4326))

class StrollerFriendlyPlace(Base):
    """
    Places (Restaurants, Cafes, Parks) with Stroller Friendliness Evaluation
    """
    __tablename__ = "stroller_friendly_places"

    id = Column(Integer, primary_key=True, index=True)
    google_place_id = Column(String, unique=True, index=True, nullable=True)
    name = Column(String, nullable=False, index=True)
    category = Column(String, nullable=True)  # restaurant, cafe, park, etc.
    address = Column(String, nullable=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    
    # Review & AI Score
    google_rating = Column(Float, nullable=True)
    stroller_score = Column(Integer, default=0) # 0 to 5 rating
    reasoning = Column(String, nullable=True) # AI analysis reasoning
    review_keywords = Column(JSON, nullable=True) # e.g. ["유모차", "이유식", "넓음"]
    child_summary = Column(String, nullable=True)
    
    # Detailed amenities
    has_ramp = Column(Boolean, default=False)
    doorway_width = Column(String, nullable=True) # "wide", "medium", "narrow"
    has_baby_chair = Column(Boolean, default=False)
    has_stroller_parking = Column(Boolean, default=False)
    
    additional_info = Column(JSON, nullable=True)

    # PostGIS geometry column (Only added for PostgreSQL)
    if not IS_SQLITE:
        geom = Column(Geometry(geometry_type='POINT', srid=4326))

class RouteCache(Base):
    """
    Cache for OSRM routes
    """
    __tablename__ = "route_caches"

    id = Column(Integer, primary_key=True, index=True)
    start_lat = Column(Float, nullable=False, index=True)
    start_lon = Column(Float, nullable=False, index=True)
    end_lat = Column(Float, nullable=False, index=True)
    end_lon = Column(Float, nullable=False, index=True)
    route_data = Column(JSON, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)


def init_db():
    if not IS_SQLITE:
        with engine.connect() as conn:
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis;"))
            conn.commit()
    Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
