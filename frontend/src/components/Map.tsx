"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";


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

const AMENITY_LABELS: Record<keyof Spot["amenities"], { label: string; icon: string }> = {
  nursing_room: { label: "수유실", icon: "baby_changing_station" },
  diaper_table: { label: "기저귀 교환대", icon: "crib" },
  hot_water: { label: "온수", icon: "water_drop" },
  ramp: { label: "경사로", icon: "accessible_forward" },
  baby_chair: { label: "아기의자", icon: "child_care" },
  stroller_parking: { label: "유모차주차", icon: "stroller" },
  wide_doorway: { label: "넓은출입문", icon: "sensor_door" },
};

const renderStars = (score: number) => {
  return (
    <div className="flex items-center gap-0.5 my-1.5" aria-label={`유모차 친화도 별점 5점 만점에 ${score}점`}>
      {Array.from({ length: 5 }).map((_, i) => {
        const isFilled = i < score;
        return (
          <span
            key={i}
            className={`material-symbols-outlined text-[16px] ${
              isFilled ? "text-secondary filled-icon" : "text-outline-variant"
            }`}
          >
            star
          </span>
        );
      })}
      <span className="text-[12px] font-bold text-on-surface-variant ml-1">{score}/5</span>
    </div>
  );
};

const renderAmenityTags = (amenities: Spot["amenities"]) => {
  return (
    <div className="flex flex-wrap gap-1 mt-2 mb-2">
      {Object.entries(amenities).map(([key, val]) => {
        if (!val) return null;
        const info = AMENITY_LABELS[key as keyof Spot["amenities"]];
        if (!info) return null;
        return (
          <span
            key={key}
            className="inline-flex items-center gap-1 bg-tertiary-container/20 text-on-tertiary-container text-[11px] px-2 py-0.5 rounded-full border border-tertiary-container/30"
          >
            <span className="material-symbols-outlined text-[12px]">{info.icon}</span>
            {info.label}
          </span>
        );
      })}
    </div>
  );
};

const toDataUrl = (path: string) => `${BASE_PATH}${path}`;

const createMarkerIcon = (type: MarkerType) => {
  let color = "#944748"; // default primary color matching Stitch theme
  let iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/></svg>`;

  if (type === "start") {
    color = "#2c6956"; // green-ish tertiary
    iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>`;
  } else if (type === "end") {
    color = "#ba1a1a"; // error red
    iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`;
  } else if (type === "current") {
    color = "#326690"; // blue
    iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>`;
  } else if (type === "care") {
    color = "#ff9e9e"; // primary container tint
    iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 12h.01M15 12h.01M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5M19 10A7 7 0 0 0 5 10v1a7 7 0 0 0 14 0Z"/></svg>`;
  } else if (type === "place") {
    color = "#fcd664"; // yellow accent
    iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#745c00" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
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
  onCenterChange: (position: [number, number]) => void;
  center: [number, number];
}

function MapEvents({ onContextMenu, onCenterChange, center }: MapEventsProps) {
  const map = useMapEvents({
    contextmenu(e) {
      onContextMenu([e.latlng.lat, e.latlng.lng]);
    },
    moveend() {
      const newCenter = map.getCenter();
      const latDiff = Math.abs(newCenter.lat - center[0]);
      const lngDiff = Math.abs(newCenter.lng - center[1]);
      // 소수점 5자리 미만(약 1미터 이내 오차)의 미세한 변화는 무시하여 무한 업데이트 루프를 방지합니다.
      if (latDiff > 0.0001 || lngDiff > 0.0001) {
        onCenterChange([newCenter.lat, newCenter.lng]);
      }
    },
  });
  return null;
}

interface MapProps {
  center?: [number, number];
  onCenterChange?: (center: [number, number]) => void;
  selectedSpotId?: string | null;
  onSpotSelect?: (id: string | null) => void;
}

export default function Map({
  center: propCenter,
  onCenterChange,
  selectedSpotId,
  onSpotSelect,
}: MapProps = {}) {
  const defaultCenter: [number, number] = [35.6620, 139.8100];
  const [internalCenter, setInternalCenter] = useState<[number, number]>(defaultCenter);
  
  const center = propCenter || internalCenter;
  const setCenter = (newCenter: [number, number]) => {
    if (onCenterChange) {
      onCenterChange(newCenter);
    } else {
      setInternalCenter(newCenter);
    }
  };

  const [allSpots, setAllSpots] = useState<Spot[]>([]);

  const [currentLocation, setCurrentLocation] = useState<[number, number] | null>(null);
  const [routeStart, setRouteStart] = useState<[number, number] | null>(null);
  const [routeEnd, setRouteEnd] = useState<[number, number] | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [filterMinScore, setFilterMinScore] = useState<number>(1);
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [filterRamp, setFilterRamp] = useState<boolean>(false);
  const [filterNursingRoom, setFilterNursingRoom] = useState<boolean>(false);
  const [filterDiaperTable, setFilterDiaperTable] = useState<boolean>(false);
  const [filterHotWater, setFilterHotWater] = useState<boolean>(false);
  const [filterBabyChair, setFilterBabyChair] = useState<boolean>(false);
  const [filterFreeOnly, setFilterFreeOnly] = useState<boolean>(false);

  const [internalSelectedSpotId, setInternalSelectedSpotId] = useState<string | null>(null);
  const activeSpotId = selectedSpotId !== undefined ? selectedSpotId : internalSelectedSpotId;
  const setActiveSpotId = (id: string | null) => {
    if (onSpotSelect) {
      onSpotSelect(id);
    } else {
      setInternalSelectedSpotId(id);
    }
  };

  const startMarkerRef = useRef<L.Marker | null>(null);
  const endMarkerRef = useRef<L.Marker | null>(null);
  const markerRefs = useRef<Record<string, L.Marker | null>>({});

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
      }
    };

    loadStaticData();
  }, []);

  useEffect(() => {
    if (activeSpotId && markerRefs.current[activeSpotId]) {
      const marker = markerRefs.current[activeSpotId];
      if (marker) {
        const latLng = marker.getLatLng();
        setCenter([latLng.lat, latLng.lng]);
        // Leaflet 마커가 렌더링되고 지도가 이동하는 타이밍을 배려해 약간의 딜레이를 주거나 즉시 호출합니다.
        setTimeout(() => {
          marker.openPopup();
        }, 100);
      }
    }
  }, [activeSpotId]);

  const spots = useMemo(() => {
    return allSpots.filter((spot) => {
      if (haversineDistance(center[0], center[1], spot.latitude, spot.longitude) > 3500) return false;
      if (spot.stroller_score < filterMinScore) return false;
      if (filterCategory && spot.category !== filterCategory) return false;
      if (filterRamp && !spot.amenities.ramp) return false;
      if (filterNursingRoom && !spot.amenities.nursing_room) return false;
      if (filterDiaperTable && !spot.amenities.diaper_table) return false;
      if (filterHotWater && !spot.amenities.hot_water) return false;
      if (filterBabyChair && !spot.amenities.baby_chair) return false;
      if (filterFreeOnly && spot.access_policy !== "public_free") return false;
      
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesName = spot.name.toLowerCase().includes(q);
        const matchesAddress = spot.address.toLowerCase().includes(q);
        if (!matchesName && !matchesAddress) return false;
      }
      
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
    searchQuery,
  ]);

  const findCurrentLocation = () =>
    new Promise<[number, number]>((resolve, reject) => {
      if (typeof navigator === "undefined" || !navigator.geolocation?.getCurrentPosition) {
        reject(new Error("unsupported"));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const nextLocation: [number, number] = [position.coords.latitude, position.coords.longitude];
          setCurrentLocation(nextLocation);
          setCenter(nextLocation);
          resolve(nextLocation);
        },
        (error) => {
          reject(error);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 60_000,
          timeout: 10_000,
        }
      );
    });

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
        // Handled inside findCurrentLocation
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

  return (
    <div className="w-full h-full relative z-0 bg-background text-on-background font-sans">
      <MapContainer
        center={center}
        zoom={14}
        style={{ width: "100%", height: "100%", zIndex: 0 }}
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
        <MapEvents onContextMenu={setRouteEnd} onCenterChange={setCenter} center={center} />

        {currentLocation && (
          <Marker position={currentLocation} icon={createMarkerIcon("current")}>
            <Popup>
              <div className="map-popup">
                <h4>현재 위치</h4>
                <p>{currentLocation[0].toFixed(4)}, {currentLocation[1].toFixed(4)}</p>
                <div className="popup-buttons">
                  <button onClick={() => setRouteStart(currentLocation)}>출발지로 설정</button>
                </div>
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
              <div className="map-popup">
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
              <div className="map-popup">
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
            ref={(ref) => {
              markerRefs.current[spot.id] = ref;
            }}
            eventHandlers={{
              click: () => {
                setActiveSpotId(spot.id);
              },
            }}
          >
            <Popup>
              <div className="map-popup max-w-[280px]">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h3 className="font-bold text-sm text-on-surface leading-tight m-0">{spot.name}</h3>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap font-medium ${
                    spot.source === "care" ? "bg-primary-container/20 text-primary" : "bg-secondary-container/20 text-on-secondary-container"
                  }`}>
                    {CATEGORY_LABELS[spot.category] || "장소"}
                  </span>
                </div>
                
                <p className="text-[11px] text-on-surface-variant m-0 mb-1 leading-snug">{spot.address}</p>
                
                {spot.source === "place" && renderStars(spot.stroller_score)}
                
                {spot.reasoning && (
                  <p className="text-[11px] text-on-surface-variant bg-surface-container-low p-2 rounded my-1.5 leading-relaxed font-body-md border border-surface-container-high">
                    {spot.reasoning}
                  </p>
                )}

                {spot.review_keywords && spot.review_keywords.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-1.5">
                    {spot.review_keywords.map((kw, i) => (
                      <span key={i} className="text-[10px] text-primary bg-primary-container/10 px-1 py-0.5 rounded">
                        #{kw}
                      </span>
                    ))}
                  </div>
                )}
                
                {renderAmenityTags(spot.amenities)}
                
                <div className="text-[10px] text-on-surface-variant flex flex-col gap-0.5 border-t border-surface-container-high pt-1.5 mt-1.5">
                  {spot.open_hours && (
                    <div className="flex gap-1">
                      <strong className="w-12 shrink-0">운영시간:</strong>
                      <span>{spot.open_hours}</span>
                    </div>
                  )}
                  <div className="flex gap-1">
                    <strong className="w-12 shrink-0">이용조건:</strong>
                    <span>{ACCESS_POLICY_LABELS[spot.access_policy]}</span>
                  </div>
                </div>
                
                <div className="popup-buttons mt-2 flex gap-1 border-t border-surface-container-high pt-2">
                  <button 
                    onClick={() => setRouteStart([spot.latitude, spot.longitude])}
                    className="flex-1 bg-surface-container-high text-on-surface hover:bg-surface-variant text-[11px] py-1 rounded text-center transition-colors font-medium"
                  >
                    출발지로 설정
                  </button>
                  <button 
                    onClick={() => setRouteEnd([spot.latitude, spot.longitude])}
                    className="flex-1 bg-primary text-white hover:bg-primary/95 text-[11px] py-1 rounded text-center transition-colors font-medium"
                  >
                    도착지로 설정
                  </button>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}