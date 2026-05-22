"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  Baby,
  ChevronDown,
  ChevronUp,
  Info,
  Moon,
  RefreshCw,
  SlidersHorizontal,
  Star,
  Sun,
} from "lucide-react";

type MarkerType = "start" | "end" | "current" | "care" | "place";
type SpotSource = "care" | "place";
type SpotCategory = "public_facility" | "mall" | "station" | "restaurant" | "cafe" | "park";
type AccessPolicy = "public_free" | "customer_only" | "paid_entry" | "ask_staff" | "unknown";

interface BabyStation {
  id: number;
  name: string;
  category?: SpotCategory;
  address: string;
  latitude: number;
  longitude: number;
  has_nursing_room: boolean;
  has_diaper_table: boolean;
  has_hot_water: boolean;
  open_hours: string;
  access_policy?: AccessPolicy;
  access_note?: string;
}

interface Place {
  id: number;
  name: string;
  category: SpotCategory;
  address: string;
  latitude: number;
  longitude: number;
  google_rating: number;
  stroller_score: number;
  reasoning: string;
  review_keywords: string[];
  has_ramp: boolean;
  doorway_width: string;
  has_baby_chair: boolean;
  has_stroller_parking: boolean;
  has_nursing_room?: boolean;
  has_diaper_table?: boolean;
  has_hot_water?: boolean;
  open_hours?: string;
  access_policy?: AccessPolicy;
  access_note?: string;
}

type PointFeature<T> = {
  type: "Feature";
  geometry: {
    type: "Point";
    coordinates: [number, number];
  };
  properties: Omit<T, "latitude" | "longitude">;
};

type FeatureCollection<T> = {
  type: "FeatureCollection";
  features: PointFeature<T>[];
};

type Spot = {
  id: string;
  source: SpotSource;
  name: string;
  category: SpotCategory;
  address: string;
  latitude: number;
  longitude: number;
  stroller_score: number;
  reasoning: string;
  review_keywords: string[];
  open_hours?: string;
  access_policy: AccessPolicy;
  access_note: string;
  amenities: {
    nursing_room: boolean;
    diaper_table: boolean;
    hot_water: boolean;
    ramp: boolean;
    baby_chair: boolean;
    stroller_parking: boolean;
    wide_doorway: boolean;
  };
};

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

const CATEGORY_LABELS: Record<SpotCategory, string> = {
  public_facility: "공공시설",
  mall: "상업시설",
  station: "역",
  restaurant: "음식점",
  cafe: "카페",
  park: "공원",
};

const ACCESS_POLICY_LABELS: Record<AccessPolicy, string> = {
  public_free: "무료 개방",
  customer_only: "매장 이용 필요",
  paid_entry: "입장료 필요",
  ask_staff: "직원 문의",
  unknown: "확인 필요",
};

const toDataUrl = (path: string) => `${BASE_PATH}${path}`;

const createMarkerIcon = (type: MarkerType) => {
  let color = "#4f46e5";
  let iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/></svg>`;

  if (type === "start") {
    color = "#10b981";
    iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>`;
  } else if (type === "end") {
    color = "#ef4444";
    iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`;
  } else if (type === "current") {
    color = "#2563eb";
    iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>`;
  } else if (type === "care") {
    color = "#ec4899";
    iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 12h.01M15 12h.01M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5M19 10A7 7 0 0 0 5 10v1a7 7 0 0 0 14 0Z"/></svg>`;
  } else if (type === "place") {
    color = "#f59e0b";
    iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
  }

  const html = `
    <div style="
      background-color: ${color};
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      border: 3px solid white;
      box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
      font-weight: bold;
      font-size: 11px;
    ">
      ${iconSvg}
    </div>
  `;

  return L.divIcon({
    html,
    className: "custom-leaflet-icon",
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });
};

const featureToRecord = <T extends { latitude: number; longitude: number }>(feature: PointFeature<T>): T => {
  const [longitude, latitude] = feature.geometry.coordinates;
  return {
    ...feature.properties,
    latitude,
    longitude,
  } as T;
};

const haversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const radius = 6371000;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(deltaPhi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const buildGoogleMapsUrl = (origin: [number, number], destination: [number, number]) => {
  const params = new URLSearchParams({
    api: "1",
    origin: `${origin[0]},${origin[1]}`,
    destination: `${destination[0]},${destination[1]}`,
    travelmode: "walking",
  });

  return `https://www.google.com/maps/dir/?${params.toString()}`;
};

const toCareSpot = (station: BabyStation): Spot => ({
  id: `care-${station.id}`,
  source: "care",
  name: station.name,
  category: station.category || "public_facility",
  address: station.address,
  latitude: station.latitude,
  longitude: station.longitude,
  stroller_score: 5,
  reasoning: "수유실·기저귀 교환 등 아이 돌봄 편의공간입니다.",
  review_keywords: [],
  open_hours: station.open_hours,
  access_policy: station.access_policy || "unknown",
  access_note: station.access_note || "이용 조건을 현장에서 확인해 주세요.",
  amenities: {
    nursing_room: station.has_nursing_room,
    diaper_table: station.has_diaper_table,
    hot_water: station.has_hot_water,
    ramp: false,
    baby_chair: false,
    stroller_parking: false,
    wide_doorway: true,
  },
});

const toPlaceSpot = (place: Place): Spot => ({
  id: `place-${place.id}`,
  source: "place",
  name: place.name,
  category: place.category,
  address: place.address,
  latitude: place.latitude,
  longitude: place.longitude,
  stroller_score: place.stroller_score,
  reasoning: place.reasoning,
  review_keywords: place.review_keywords,
  open_hours: place.open_hours,
  access_policy: place.access_policy || "unknown",
  access_note: place.access_note || "이용 조건을 현장에서 확인해 주세요.",
  amenities: {
    nursing_room: Boolean(place.has_nursing_room),
    diaper_table: Boolean(place.has_diaper_table),
    hot_water: Boolean(place.has_hot_water),
    ramp: place.has_ramp,
    baby_chair: place.has_baby_chair,
    stroller_parking: place.has_stroller_parking,
    wide_doorway: place.doorway_width === "wide",
  },
});

interface MapControllerProps {
  center: [number, number];
}

function MapController({ center }: MapControllerProps) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

interface MapEventsProps {
  onContextMenu: (position: [number, number]) => void;
}

function MapEvents({ onContextMenu }: MapEventsProps) {
  useMapEvents({
    contextmenu(e) {
      onContextMenu([e.latlng.lat, e.latlng.lng]);
    },
  });
  return null;
}

export default function Map() {
  const [center, setCenter] = useState<[number, number]>([35.6715, 139.8210]);
  const [allSpots, setAllSpots] = useState<Spot[]>([]);

  const [currentLocation, setCurrentLocation] = useState<[number, number] | null>(null);
  const [routeStart, setRouteStart] = useState<[number, number] | null>(null);
  const [routeEnd, setRouteEnd] = useState<[number, number] | null>(null);
  const [loading, setLoading] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const [filterMinScore, setFilterMinScore] = useState<number>(1);
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [filterRamp, setFilterRamp] = useState<boolean>(false);
  const [filterNursingRoom, setFilterNursingRoom] = useState<boolean>(false);
  const [filterDiaperTable, setFilterDiaperTable] = useState<boolean>(false);
  const [filterHotWater, setFilterHotWater] = useState<boolean>(false);
  const [filterBabyChair, setFilterBabyChair] = useState<boolean>(false);
  const [filterFreeOnly, setFilterFreeOnly] = useState<boolean>(false);

  const [highlightedSpotId, setHighlightedSpotId] = useState<string | null>(null);
  const startMarkerRef = useRef<L.Marker | null>(null);
  const endMarkerRef = useRef<L.Marker | null>(null);
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
      document.body.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
      document.body.classList.remove("dark");
    }
  }, [darkMode]);

  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      if (BASE_PATH) {
        return;
      }

      if (process.env.NODE_ENV !== "production") {
        if ("getRegistrations" in navigator.serviceWorker) {
          navigator.serviceWorker.getRegistrations()
            .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
            .catch((err) => {
              console.error("Service Worker cleanup failed:", err);
            });
        }

        if ("caches" in window) {
          caches.keys()
            .then((cacheNames) => Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName))))
            .catch((err) => {
              console.error("Cache cleanup failed:", err);
            });
        }
        return;
      }

      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          console.log("Service Worker registered successfully with scope:", reg.scope);
          reg.update().catch((e) => console.warn("Failed to update SW:", e));
        })
        .catch((err) => {
          console.error("Service Worker registration failed:", err);
        });
    }
  }, []);

  useEffect(() => {
    const loadStaticData = async () => {
      setLoading(true);
      try {
        const [stationsRes, placesRes] = await Promise.all([
          fetch(toDataUrl("/data/baby-stations.json")),
          fetch(toDataUrl("/data/places.json")),
        ]);
        if (!stationsRes.ok || !placesRes.ok) {
          throw new Error("Static data unavailable");
        }

        const stationsData = await stationsRes.json() as FeatureCollection<BabyStation>;
        const placesData = await placesRes.json() as FeatureCollection<Place>;
        setAllSpots([
          ...stationsData.features.map(featureToRecord).map(toCareSpot),
          ...placesData.features.map(featureToRecord).map(toPlaceSpot),
        ]);
      } catch (error) {
        console.error("Error loading static data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadStaticData();
  }, []);

  const spots = useMemo(() => {
    return allSpots.filter((spot) => {
      if (haversineDistance(center[0], center[1], spot.latitude, spot.longitude) > 1200) return false;
      if (spot.stroller_score < filterMinScore) return false;
      if (filterCategory && spot.category !== filterCategory) return false;
      if (filterRamp && !spot.amenities.ramp) return false;
      if (filterNursingRoom && !spot.amenities.nursing_room) return false;
      if (filterDiaperTable && !spot.amenities.diaper_table) return false;
      if (filterHotWater && !spot.amenities.hot_water) return false;
      if (filterBabyChair && !spot.amenities.baby_chair) return false;
      if (filterFreeOnly && spot.access_policy !== "public_free") return false;
      return true;
    });
  }, [
    allSpots,
    center,
    filterBabyChair,
    filterCategory,
    filterDiaperTable,
    filterFreeOnly,
    filterHotWater,
    filterMinScore,
    filterNursingRoom,
    filterRamp,
  ]);

  const clearRoute = () => {
    setRouteStart(null);
    setRouteEnd(null);
  };

  const googleMapsRouteUrl = routeStart && routeEnd ? buildGoogleMapsUrl(routeStart, routeEnd) : null;

  const findCurrentLocation = () =>
    new Promise<[number, number]>((resolve, reject) => {
      if (typeof navigator === "undefined" || !navigator.geolocation?.getCurrentPosition) {
        setLocationError("이 브라우저에서는 현재 위치 기능을 사용할 수 없습니다.");
        reject(new Error("unsupported"));
        return;
      }

      setIsLocating(true);
      setLocationError(null);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const nextLocation: [number, number] = [position.coords.latitude, position.coords.longitude];
          setCurrentLocation(nextLocation);
          setCenter(nextLocation);
          setIsLocating(false);
          resolve(nextLocation);
        },
        (error) => {
          setIsLocating(false);
          if (error.code === 1) {
            setLocationError("브라우저 위치 권한을 허용해야 현재 위치를 사용할 수 있습니다.");
          } else {
            setLocationError("현재 위치를 찾지 못했습니다.");
          }
          reject(error);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 60_000,
          timeout: 10_000,
        }
      );
    });

  const handleFindCurrentLocation = () => {
    findCurrentLocation().catch(() => {
      // The UI state is set inside findCurrentLocation.
    });
  };

  const setCurrentLocationAsStart = () => {
    if (currentLocation) {
      setRouteStart(currentLocation);
      setCenter(currentLocation);
      return;
    }

    findCurrentLocation()
      .then((location) => {
        setRouteStart(location);
      })
      .catch(() => {
        // The UI state is set inside findCurrentLocation.
      });
  };

  const startEventHandlers = useMemo(
    () => ({
      dragend() {
        const marker = startMarkerRef.current;
        if (marker != null) {
          const latLng = marker.getLatLng();
          setRouteStart([latLng.lat, latLng.lng]);
        }
      },
    }),
    []
  );

  const endEventHandlers = useMemo(
    () => ({
      dragend() {
        const marker = endMarkerRef.current;
        if (marker != null) {
          const latLng = marker.getLatLng();
          setRouteEnd([latLng.lat, latLng.lng]);
        }
      },
    }),
    []
  );

  const renderAmenityTags = (spot: Spot) => (
    <>
      {spot.amenities.nursing_room && <span className="tag nursing">수유실</span>}
      {spot.amenities.diaper_table && <span className="tag diaper">기저귀 교환대</span>}
      {spot.amenities.hot_water && <span className="tag water">온수</span>}
      {spot.amenities.baby_chair && <span className="tag baby-chair">아기의자</span>}
      {spot.amenities.ramp && <span className="tag ramp">경사로</span>}
      {spot.amenities.wide_doorway && <span className="tag doorway">넓은 출입문</span>}
    </>
  );

  return (
    <div className="app-container">
      <div className="control-panel">
        <div className="panel-header">
          <div className="brand">
            <Baby className="brand-icon" />
            <h1>AsobiPlan</h1>
          </div>
          <span className="badge">Koto-ku Stroller Route</span>
        </div>

        <div className="panel-section">
          <h2>출발지 & 도착지 설정</h2>
          <div className="route-picker">
            <div className="picker-input">
              <span className="dot green"></span>
              <input
                type="text"
                readOnly
                placeholder={routeStart ? `${routeStart[0].toFixed(4)}, ${routeStart[1].toFixed(4)}` : "장소 카드에서 출발 선택"}
                value={routeStart ? "출발지 지정 완료" : ""}
              />
              {routeStart && <button onClick={() => setRouteStart(null)}>초기화</button>}
            </div>
            <div className="picker-input mt-2">
              <span className="dot red"></span>
              <input
                type="text"
                readOnly
                placeholder={routeEnd ? `${routeEnd[0].toFixed(4)}, ${routeEnd[1].toFixed(4)}` : "장소 카드에서 도착 선택"}
                value={routeEnd ? "도착지 지정 완료" : ""}
              />
              {routeEnd && <button onClick={() => setRouteEnd(null)}>초기화</button>}
            </div>
          </div>
          <p className="google-route-note">
            출발지와 도착지를 모두 선택한 뒤 Google Maps에서 도보 길찾기를 엽니다. 계단 회피는 보장되지 않습니다.
          </p>
          {googleMapsRouteUrl ? (
            <a
              className="google-route-action"
              href={googleMapsRouteUrl}
              target="_blank"
              rel="noreferrer"
              aria-label="Google Maps에서 선택한 출발지와 도착지 길찾기"
            >
              Google Maps에서 길찾기
            </a>
          ) : (
            <div className="google-route-action disabled" aria-disabled="true">
              출발지와 도착지를 선택하세요
            </div>
          )}

          <div className="location-actions">
            <button className="location-btn" onClick={handleFindCurrentLocation} disabled={isLocating}>
              {isLocating ? "현재 위치 확인 중" : "현재 위치 찾기"}
            </button>
            <button className="location-btn primary" onClick={setCurrentLocationAsStart} disabled={isLocating}>
              현재 위치를 출발지로
            </button>
          </div>
          {currentLocation && (
            <p className="location-status">
              현재 위치: {currentLocation[0].toFixed(4)}, {currentLocation[1].toFixed(4)}
            </p>
          )}
          {locationError && <p className="location-error">{locationError}</p>}

          <button
            className="filters-toggle-btn"
            onClick={() => setShowFilters(!showFilters)}
          >
            <SlidersHorizontal size={14} />
            상세 필터 설정
            {showFilters ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {showFilters && (
            <div className="filters-panel">
              <h3>장소 유형과 편의시설</h3>

              <div className="filter-slider-container">
                <div className="filter-slider-header">
                  <span>최소 유모차 친화 점수</span>
                  <span>{filterMinScore}점 이상</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={filterMinScore}
                  onChange={(e) => setFilterMinScore(Number(e.target.value))}
                  className="filter-slider"
                />
              </div>

              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="filter-select"
              >
                <option value="">모든 장소 유형</option>
                <option value="public_facility">공공시설</option>
                <option value="mall">상업시설</option>
                <option value="station">역</option>
                <option value="cafe">카페</option>
                <option value="restaurant">음식점</option>
                <option value="park">공원</option>
              </select>

              <div className="filters-grid">
                <label className="filter-checkbox-label">
                  <input type="checkbox" checked={filterNursingRoom} onChange={(e) => setFilterNursingRoom(e.target.checked)} />
                  수유실 있음
                </label>
                <label className="filter-checkbox-label">
                  <input type="checkbox" checked={filterDiaperTable} onChange={(e) => setFilterDiaperTable(e.target.checked)} />
                  기저귀 교환대 있음
                </label>
                <label className="filter-checkbox-label">
                  <input type="checkbox" checked={filterHotWater} onChange={(e) => setFilterHotWater(e.target.checked)} />
                  온수 있음
                </label>
                <label className="filter-checkbox-label">
                  <input type="checkbox" checked={filterFreeOnly} onChange={(e) => setFilterFreeOnly(e.target.checked)} />
                  무료 개방만
                </label>
                <label className="filter-checkbox-label">
                  <input type="checkbox" checked={filterRamp} onChange={(e) => setFilterRamp(e.target.checked)} />
                  경사로 있음
                </label>
                <label className="filter-checkbox-label">
                  <input type="checkbox" checked={filterBabyChair} onChange={(e) => setFilterBabyChair(e.target.checked)} />
                  아기의자 있음
                </label>
              </div>
            </div>
          )}

          {(routeStart || routeEnd) && (
            <div className="route-info-box">
              <p className="safety-note">
                선택한 좌표는 지도에서 드래그해 조정할 수 있습니다.
              </p>
              <button className="clear-btn" onClick={clearRoute}>
                선택 해제
              </button>
            </div>
          )}
        </div>

        <div className="panel-section list-section">
          <h2>장소 목록 ({spots.length})</h2>
          <div className="scroll-list">
            {spots.map((spot) => (
              <div
                key={spot.id}
                ref={(el) => { itemRefs.current[spot.id] = el; }}
                className={`list-item ${highlightedSpotId === spot.id ? "highlighted" : ""}`}
                onClick={() => {
                  setCenter([spot.latitude, spot.longitude]);
                  setHighlightedSpotId(spot.id);
                }}
              >
                <div className="item-header">
                  <div>
                    <div className="item-meta-row">
                      <span className="category-badge">{CATEGORY_LABELS[spot.category]}</span>
                      <span className={`access-badge access-${spot.access_policy}`}>{ACCESS_POLICY_LABELS[spot.access_policy]}</span>
                    </div>
                    <h3>{spot.name}</h3>
                  </div>
                  <div className="button-group">
                    <button
                      className="set-route-btn start"
                      onClick={(e) => { e.stopPropagation(); setRouteStart([spot.latitude, spot.longitude]); }}
                    >
                      출발
                    </button>
                    <button
                      className="set-route-btn end"
                      onClick={(e) => { e.stopPropagation(); setRouteEnd([spot.latitude, spot.longitude]); }}
                    >
                      도착
                    </button>
                  </div>
                </div>
                <p className="item-address">{spot.address}</p>
                <div className="amenity-tags">{renderAmenityTags(spot)}</div>
                <p className="access-note">{spot.access_note}</p>
                {spot.source === "place" && (
                  <>
                    <div className="score-row">
                      <div className="stars">
                        {Array.from({ length: spot.stroller_score }).map((_, i) => (
                          <Star key={`filled-${i}`} size={14} className="star-icon filled" />
                        ))}
                        {Array.from({ length: 5 - spot.stroller_score }).map((_, i) => (
                          <Star key={`empty-${i}`} size={14} className="star-icon" />
                        ))}
                      </div>
                      <span className="score-badge">유모차 친화도: {spot.stroller_score}/5</span>
                    </div>
                    <p className="reasoning-text">{spot.reasoning}</p>
                  </>
                )}
              </div>
            ))}
            {spots.length === 0 && <p className="empty-text">조건에 맞는 장소가 없습니다.</p>}
          </div>
        </div>

        <button className="refresh-btn" onClick={() => setCenter([center[0], center[1]])} disabled={loading}>
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          현 위치 기준 데이터 갱신
        </button>
      </div>

      <div className="map-view">
        <MapContainer
          center={center}
          zoom={15}
          style={{ width: "100%", height: "100%" }}
          zoomControl={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url={darkMode
              ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            }
          />
          <MapController center={center} />
          <MapEvents onContextMenu={setRouteEnd} />

          {currentLocation && (
            <Marker
              position={currentLocation}
              icon={createMarkerIcon("current")}
            >
              <Popup>
                <div>
                  <h4>현재 위치</h4>
                  <p>{currentLocation[0].toFixed(4)}, {currentLocation[1].toFixed(4)}</p>
                  <button onClick={() => setRouteStart(currentLocation)}>출발지로 설정</button>
                </div>
              </Popup>
            </Marker>
          )}

          {routeStart && (
            <Marker
              position={routeStart}
              icon={createMarkerIcon("start")}
              draggable={true}
              eventHandlers={startEventHandlers}
              ref={startMarkerRef}
            >
              <Popup>
                <div>
                  <h4>출발지 (드래그 가능)</h4>
                  <p>{routeStart[0].toFixed(4)}, {routeStart[1].toFixed(4)}</p>
                </div>
              </Popup>
            </Marker>
          )}

          {routeEnd && (
            <Marker
              position={routeEnd}
              icon={createMarkerIcon("end")}
              draggable={true}
              eventHandlers={endEventHandlers}
              ref={endMarkerRef}
            >
              <Popup>
                <div>
                  <h4>도착지 (드래그 가능)</h4>
                  <p>{routeEnd[0].toFixed(4)}, {routeEnd[1].toFixed(4)}</p>
                </div>
              </Popup>
            </Marker>
          )}

          {spots.map((spot) => (
            <Marker
              key={spot.id}
              position={[spot.latitude, spot.longitude]}
              icon={createMarkerIcon(spot.source === "care" ? "care" : "place")}
              eventHandlers={{
                click: () => {
                  setHighlightedSpotId(spot.id);
                  setTimeout(() => {
                    const el = itemRefs.current[spot.id];
                    if (el) {
                      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
                    }
                  }, 100);
                },
              }}
            >
              <Popup>
                <div className="map-popup">
                  <h3>{spot.name}</h3>
                  <p>{spot.address}</p>
                  <p><strong>유형:</strong> {CATEGORY_LABELS[spot.category]}</p>
                  {spot.open_hours && <p><strong>운영시간:</strong> {spot.open_hours}</p>}
                  <p><strong>이용조건:</strong> {ACCESS_POLICY_LABELS[spot.access_policy]}</p>
                  <div className="amenity-tags popup-amenities">{renderAmenityTags(spot)}</div>
                  <div className="popup-buttons">
                    <button onClick={() => setRouteStart([spot.latitude, spot.longitude])}>출발지로 설정</button>
                    <button onClick={() => setRouteEnd([spot.latitude, spot.longitude])}>도착지로 설정</button>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        <div className="floating-hint">
          <Info size={16} />
          <span>장소 카드에서 출발지와 도착지를 선택하세요.</span>
        </div>

        <button
          className="dark-mode-toggle"
          onClick={() => setDarkMode(!darkMode)}
          aria-label="다크 모드 전환"
        >
          {darkMode ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </div>
    </div>
  );
}
