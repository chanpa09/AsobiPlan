"use client";

import { useCallback, useEffect, useState, useRef, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { 
  Baby, Footprints, 
  RefreshCw, Star, Info, Sun, Moon, SlidersHorizontal, 
  ChevronDown, ChevronUp 
} from "lucide-react";

// Fix Leaflet marker icon issue by using inline SVG markers (DivIcon)
const createMarkerIcon = (type: "start" | "end" | "station" | "place") => {
  let color = "#4f46e5"; // Indigo
  let iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/></svg>`;

  if (type === "start") {
    color = "#10b981"; // Emerald Green
    iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>`;
  } else if (type === "end") {
    color = "#ef4444"; // Red
    iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`;
  } else if (type === "station") {
    color = "#ec4899"; // Pink
    iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 12h.01M15 12h.01M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5M19 10A7 7 0 0 0 5 10v1a7 7 0 0 0 14 0Z"/></svg>`;
  } else if (type === "place") {
    color = "#f59e0b"; // Amber/Orange
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

// Types
interface BabyStation {
  id: number;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  has_nursing_room: boolean;
  has_diaper_table: boolean;
  has_hot_water: boolean;
  open_hours: string;
}

interface Place {
  id: number;
  name: string;
  category: string;
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
}

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
      // Right click to set end
      onContextMenu([e.latlng.lat, e.latlng.lng]);
    },
  });
  return null;
}

export default function Map() {
  const [center, setCenter] = useState<[number, number]>([35.6715, 139.8210]); // Toyocho/Minamisuna default
  const [babyStations, setBabyStations] = useState<BabyStation[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  
  const [routeStart, setRouteStart] = useState<[number, number] | null>(null);
  const [routeEnd, setRouteEnd] = useState<[number, number] | null>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<[number, number][]>([]);
  const [routeInfo, setRouteInfo] = useState<{ distance: number; duration: number } | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);
  const [loading, setLoading] = useState(false);

  // Premium UI & Mode state
  const [darkMode, setDarkMode] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Search Filter state
  const [filterMinScore, setFilterMinScore] = useState<number>(1);
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [filterRamp, setFilterRamp] = useState<boolean>(false);
  const [filterDoorwayWidth, setFilterDoorwayWidth] = useState<string>("all");
  const [filterBabyChair, setFilterBabyChair] = useState<boolean>(false);
  const [filterStrollerParking, setFilterStrollerParking] = useState<boolean>(false);

  // Baby station client-side Filter state
  const [filterNursingRoom, setFilterNursingRoom] = useState<boolean>(false);
  const [filterDiaperTable, setFilterDiaperTable] = useState<boolean>(false);
  const [filterHotWater, setFilterHotWater] = useState<boolean>(false);

  // Highlight Synchronization state
  const [highlightedPlaceId, setHighlightedPlaceId] = useState<number | null>(null);
  const [highlightedStationId, setHighlightedStationId] = useState<number | null>(null);

  // Refs for draggable markers
  const startMarkerRef = useRef<L.Marker | null>(null);
  const endMarkerRef = useRef<L.Marker | null>(null);

  // Refs dictionary for sidebar cards
  const itemRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  // Sync dark mode class
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
      document.body.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
      document.body.classList.remove("dark");
    }
  }, [darkMode]);

  // Register Service Worker for offline PWA capabilities
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
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
          // Force update check to apply fixes immediately
          reg.update().catch((e) => console.warn("Failed to update SW:", e));
        })
        .catch((err) => {
          console.error("Service Worker registration failed:", err);
        });
    }
  }, []);

  // Fetch data from FastAPI backend
  const fetchData = useCallback(async (lat: number, lon: number) => {
    setLoading(true);
    try {
      const apiHost = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      
      const stationsRes = await fetch(`${apiHost}/api/baby-stations?lat=${lat}&lon=${lon}&radius=800`);
      
      // Dynamic query params matching database schema
      let placesUrl = `${apiHost}/api/places?lat=${lat}&lon=${lon}&radius=1200&min_score=${filterMinScore}`;
      if (filterCategory) placesUrl += `&category=${filterCategory}`;
      if (filterRamp) placesUrl += `&has_ramp=true`;
      if (filterDoorwayWidth && filterDoorwayWidth !== "all") placesUrl += `&doorway_width=${filterDoorwayWidth}`;
      if (filterBabyChair) placesUrl += `&has_baby_chair=true`;
      if (filterStrollerParking) placesUrl += `&has_stroller_parking=true`;

      const placesRes = await fetch(placesUrl);
      
      if (stationsRes.ok) setBabyStations(await stationsRes.json());
      if (placesRes.ok) setPlaces(await placesRes.json());
    } catch (error) {
      console.error("Error fetching markers:", error);
    } finally {
      setLoading(false);
    }
  }, [
    filterMinScore,
    filterCategory,
    filterRamp,
    filterDoorwayWidth,
    filterBabyChair,
    filterStrollerParking,
  ]);

  // Trigger data fetch on center or filters change
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData(center[0], center[1]);
  }, [center, fetchData]);

  // Client-side filtering for Baby Stations
  const filteredBabyStations = useMemo(() => {
    return babyStations.filter((station) => {
      if (filterNursingRoom && !station.has_nursing_room) return false;
      if (filterDiaperTable && !station.has_diaper_table) return false;
      if (filterHotWater && !station.has_hot_water) return false;
      return true;
    });
  }, [babyStations, filterNursingRoom, filterDiaperTable, filterHotWater]);

  // Request OSRM route from FastAPI backend
  const calculateRoute = useCallback(async (start: [number, number], end: [number, number]) => {
    setIsCalculatingRoute(true);
    setRouteError(null);
    setRouteCoordinates([]);
    setRouteInfo(null);
    try {
      const apiHost = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      const res = await fetch(
        `${apiHost}/api/route?start_lat=${start[0]}&start_lon=${start[1]}&end_lat=${end[0]}&end_lon=${end[1]}`
      );
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.detail || "Route calculation failed");
      }

      const data = await res.json();
      if (data.routes && data.routes[0]) {
        const route = data.routes[0];
        const coords = route.geometry.coordinates.map((coord: number[]) => [coord[1], coord[0]] as [number, number]);
        setRouteCoordinates(coords);
        setRouteInfo({
          distance: route.distance, // meters
          duration: route.duration, // seconds
        });
      }
    } catch (err) {
      console.error("Failed to compute stroller routing:", err);
      setRouteCoordinates([]);
      setRouteInfo(null);
      setRouteError(
        err instanceof Error && err.message === "Routing engine unavailable"
          ? "OSRM 라우팅 엔진이 꺼져 있어 실제 동선을 계산할 수 없습니다."
          : "유모차 동선을 찾을 수 없습니다. 출발지와 도착지를 조금 조정해 주세요."
      );
    } finally {
      setIsCalculatingRoute(false);
    }
  }, []);

  useEffect(() => {
    if (routeStart && routeEnd) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      calculateRoute(routeStart, routeEnd);
    } else {
      setRouteCoordinates([]);
      setRouteInfo(null);
      setRouteError(null);
    }
  }, [routeStart, routeEnd, calculateRoute]);

  // Clear current route
  const clearRoute = () => {
    setRouteStart(null);
    setRouteEnd(null);
    setRouteCoordinates([]);
    setRouteInfo(null);
    setRouteError(null);
  };

  // Handle draggable marker drag events
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

  return (
    <div className="app-container">
      {/* Sidebar Control Panel */}
      <div className="control-panel">
        <div className="panel-header">
          <div className="brand">
            <Baby className="brand-icon" />
            <h1>AsobiPlan</h1>
          </div>
          <span className="badge">Koto-ku Stroller Route</span>
        </div>

        <div className="panel-section">
          <h2>📍 출발지 & 도착지 설정</h2>
          <div className="route-picker">
            <div className="picker-input">
              <span className="dot green"></span>
              <input
                type="text"
                readOnly
                placeholder={routeStart ? `${routeStart[0].toFixed(4)}, ${routeStart[1].toFixed(4)}` : "지도 핀 클릭 또는 출발지 지정"}
                value={routeStart ? "출발지 지정 완료" : ""}
              />
              {routeStart && <button onClick={() => setRouteStart(null)}>초기화</button>}
            </div>
            <div className="picker-input mt-2">
              <span className="dot red"></span>
              <input
                type="text"
                readOnly
                placeholder={routeEnd ? `${routeEnd[0].toFixed(4)}, ${routeEnd[1].toFixed(4)}` : "지도를 우클릭하여 도착지 지정"}
                value={routeEnd ? "도착지 지정 완료" : ""}
              />
              {routeEnd && <button onClick={() => setRouteEnd(null)}>초기화</button>}
            </div>
          </div>

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
              <h3>유모차 친화도 및 편의시설</h3>
              
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

              <div>
                <select 
                  value={filterCategory} 
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="filter-select"
                >
                  <option value="">모든 카테고리</option>
                  <option value="cafe">카페</option>
                  <option value="restaurant">음식점</option>
                  <option value="park">공원</option>
                </select>
              </div>

              <div>
                <select 
                  value={filterDoorwayWidth} 
                  onChange={(e) => setFilterDoorwayWidth(e.target.value)}
                  className="filter-select"
                >
                  <option value="all">모든 출입구 너비</option>
                  <option value="wide">넓은 출입구 (유모차 용이)</option>
                  <option value="medium">중간 출입구</option>
                  <option value="narrow">좁은 출입구</option>
                </select>
              </div>

              <div className="filters-grid">
                <label className="filter-checkbox-label">
                  <input 
                    type="checkbox" 
                    checked={filterRamp} 
                    onChange={(e) => setFilterRamp(e.target.checked)}
                  />
                  경사로 보유
                </label>
                
                <label className="filter-checkbox-label">
                  <input 
                    type="checkbox" 
                    checked={filterBabyChair} 
                    onChange={(e) => setFilterBabyChair(e.target.checked)}
                  />
                  아기의자 보유
                </label>

                <label className="filter-checkbox-label">
                  <input 
                    type="checkbox" 
                    checked={filterStrollerParking} 
                    onChange={(e) => setFilterStrollerParking(e.target.checked)}
                  />
                  유모차 주차
                </label>
              </div>

              <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: "8px", marginTop: "4px" }}>
                <h3 style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "6px" }}>수유소(아기정거장) 필수 조건</h3>
                <div className="filters-grid">
                  <label className="filter-checkbox-label">
                    <input 
                      type="checkbox" 
                      checked={filterNursingRoom} 
                      onChange={(e) => setFilterNursingRoom(e.target.checked)}
                    />
                    수유실 보유
                  </label>
                  <label className="filter-checkbox-label">
                    <input 
                      type="checkbox" 
                      checked={filterDiaperTable} 
                      onChange={(e) => setFilterDiaperTable(e.target.checked)}
                    />
                    기저귀대 보유
                  </label>
                  <label className="filter-checkbox-label">
                    <input 
                      type="checkbox" 
                      checked={filterHotWater} 
                      onChange={(e) => setFilterHotWater(e.target.checked)}
                    />
                    온수 제공
                  </label>
                </div>
              </div>
            </div>
          )}

          {isCalculatingRoute && (
            <div className="route-info-box">
              <p className="safety-note">
                <RefreshCw size={14} className="inline mr-1 animate-spin" />
                실제 OSRM 도로망으로 유모차 동선을 계산 중입니다.
              </p>
            </div>
          )}

          {routeError && (
            <div className="route-info-box route-error-box">
              <p className="safety-note route-error-text">
                {routeError}
              </p>
              <button className="clear-btn" onClick={clearRoute}>
                동선 해제
              </button>
            </div>
          )}

          {routeInfo && !routeError && (
            <div className="route-info-box">
              <div className="route-source-badge">실제 OSRM 도로망 기반</div>
              <div className="route-stats">
                <div className="stat">
                  <span className="label">유모차 이동 거리</span>
                  <span className="val">{(routeInfo.distance / 1000).toFixed(2)} km</span>
                </div>
                <div className="stat">
                  <span className="label">예상 소요 시간</span>
                  <span className="val">{Math.round(routeInfo.duration / 60)}분</span>
                </div>
              </div>
              <p className="safety-note">
                <Footprints size={14} className="inline mr-1" />
                계단 회피와 유모차 친화 경로 가중치를 적용한 동선입니다.
              </p>
              <button className="clear-btn" onClick={clearRoute}>
                동선 해제
              </button>
            </div>
          )}
        </div>

        {/* Nearby Lists */}
        <div className="panel-section list-section">
          <h2>🍼 주변 수유소 (아기 정거장) ({filteredBabyStations.length})</h2>
          <div className="scroll-list">
            {filteredBabyStations.map((station) => (
              <div 
                key={station.id} 
                ref={(el) => { itemRefs.current[`station-${station.id}`] = el; }}
                className={`list-item station-item ${highlightedStationId === station.id ? "highlighted" : ""}`} 
                onClick={() => {
                  setCenter([station.latitude, station.longitude]);
                  setHighlightedStationId(station.id);
                  setHighlightedPlaceId(null);
                }}
              >
                <div className="item-header">
                  <h3>{station.name}</h3>
                  <button 
                    className="set-route-btn start" 
                    onClick={(e) => { e.stopPropagation(); setRouteStart([station.latitude, station.longitude]); }}
                  >
                    출발
                  </button>
                </div>
                <p className="item-address">{station.address}</p>
                <div className="amenity-tags">
                  {station.has_nursing_room && <span className="tag nursing">수유실</span>}
                  {station.has_diaper_table && <span className="tag diaper">기저귀 교환대</span>}
                  {station.has_hot_water && <span className="tag water">온수 제공</span>}
                </div>
              </div>
            ))}
            {filteredBabyStations.length === 0 && <p className="empty-text">주변에 알맞은 수유실 정보가 없습니다.</p>}
          </div>
        </div>

        <div className="panel-section list-section mt-4">
          <h2>☕ 유모차 친화 장소 ({places.length})</h2>
          <div className="scroll-list">
            {places.map((place) => (
              <div 
                key={place.id} 
                ref={(el) => { itemRefs.current[`place-${place.id}`] = el; }}
                className={`list-item place-item ${highlightedPlaceId === place.id ? "highlighted" : ""}`} 
                onClick={() => {
                  setCenter([place.latitude, place.longitude]);
                  setHighlightedPlaceId(place.id);
                  setHighlightedStationId(null);
                }}
              >
                <div className="item-header">
                  <h3>{place.name}</h3>
                  <div className="button-group">
                    <button 
                      className="set-route-btn end" 
                      onClick={(e) => { e.stopPropagation(); setRouteEnd([place.latitude, place.longitude]); }}
                    >
                      도착
                    </button>
                  </div>
                </div>
                <p className="item-address">{place.address}</p>
                
                <div className="score-row">
                  <div className="stars">
                    {Array.from({ length: place.stroller_score }).map((_, i) => (
                      <Star key={i} size={14} className="star-icon filled" />
                    ))}
                    {Array.from({ length: 5 - place.stroller_score }).map((_, i) => (
                      <Star key={i} size={14} className="star-icon" />
                    ))}
                  </div>
                  <span className="score-badge">유모차 친화도: {place.stroller_score}/5</span>
                </div>

                <p className="reasoning-text">{place.reasoning}</p>
                <div className="keywords">
                  {place.review_keywords.map((kw, i) => (
                    <span key={i} className="kw-tag">#{kw}</span>
                  ))}
                  {place.has_ramp && <span className="kw-tag">#경사로</span>}
                  {place.has_baby_chair && <span className="kw-tag">#아기의자</span>}
                  {place.has_stroller_parking && <span className="kw-tag">#유모차주차</span>}
                  {place.doorway_width === "wide" && <span className="kw-tag">#넓은출입문</span>}
                </div>
              </div>
            ))}
            {places.length === 0 && <p className="empty-text">유모차 친화 장소 정보가 없습니다.</p>}
          </div>
        </div>

        <button className="refresh-btn" onClick={() => fetchData(center[0], center[1])} disabled={loading}>
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          현 위치 기준 데이터 갱신
        </button>
      </div>

      {/* Main Leaflet Map View */}
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

          {/* Render Route Polyline */}
          {routeCoordinates.length > 0 && (
            <Polyline
              positions={routeCoordinates}
              color="#4f46e5"
              weight={6}
              opacity={0.8}
              lineCap="round"
              lineJoin="round"
            />
          )}

          {/* Render Start Marker */}
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

          {/* Render End Marker */}
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

          {/* Render Baby Station Markers */}
          {filteredBabyStations.map((station) => (
            <Marker
              key={`station-${station.id}`}
              position={[station.latitude, station.longitude]}
              icon={createMarkerIcon("station")}
              eventHandlers={{
                click: () => {
                  setHighlightedStationId(station.id);
                  setHighlightedPlaceId(null);
                  setTimeout(() => {
                    const el = itemRefs.current[`station-${station.id}`];
                    if (el) {
                      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
                    }
                  }, 100);
                }
              }}
            >
              <Popup>
                <div className="map-popup">
                  <h3>👶 {station.name}</h3>
                  <p>{station.address}</p>
                  <p><strong>운영시간:</strong> {station.open_hours}</p>
                  <div className="popup-buttons">
                    <button onClick={() => setRouteStart([station.latitude, station.longitude])}>출발지로 설정</button>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Render Places Markers */}
          {places.map((place) => (
            <Marker
              key={`place-${place.id}`}
              position={[place.latitude, place.longitude]}
              icon={createMarkerIcon("place")}
              eventHandlers={{
                click: () => {
                  setHighlightedPlaceId(place.id);
                  setHighlightedStationId(null);
                  setTimeout(() => {
                    const el = itemRefs.current[`place-${place.id}`];
                    if (el) {
                      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
                    }
                  }, 100);
                }
              }}
            >
              <Popup>
                <div className="map-popup">
                  <h3>
                    {place.category === "cafe" ? "☕" : place.category === "park" ? "🌳" : "🍴"} {place.name}
                  </h3>
                  <p>{place.address}</p>
                  <div className="score-row popup-score">
                    <span>친화도: {place.stroller_score}점</span>
                  </div>
                  <p className="popup-reasoning">{place.reasoning}</p>
                  <div className="popup-buttons">
                    <button onClick={() => setRouteEnd([place.latitude, place.longitude])}>도착지로 설정</button>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
        
        {/* Floating Quick Action Overlay */}
        <div className="floating-hint">
          <Info size={16} />
          <span>지도를 우클릭(Context Menu)하여 도착지를 임의 지정할 수 있습니다.</span>
        </div>

        {/* Floating Theme Switcher */}
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
