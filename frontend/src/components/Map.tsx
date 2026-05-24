"use client";

import { useEffect, useMemo, useRef } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  ACCESS_POLICY_LABELS,
  CATEGORY_LABELS,
  getGoogleRatingLabel,
  getMobilityLevel,
  getSpotPrimarySummary,
  getVisibleAmenityTags,
  getReviewKeywordTone,
  type MapBounds,
  type MarkerPosition,
  type Spot,
} from "@/lib/spots";

type MarkerType = "start" | "end" | "current" | "care" | "place";

interface MapProps {
  center: MarkerPosition;
  spots: Spot[];
  selectedSpotId: string | null;
  currentLocation: MarkerPosition | null;
  routeStart: MarkerPosition | null;
  routeEnd: MarkerPosition | null;
  onCenterChange: (center: MarkerPosition) => void;
  onBoundsChange: (bounds: MapBounds) => void;
  onSpotSelect: (id: string | null) => void;
  onRouteStartChange: (position: MarkerPosition | null) => void;
  onRouteEndChange: (position: MarkerPosition | null) => void;
}

const createMarkerIcon = (type: MarkerType) => {
  let color = "#944748";
  let iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/></svg>`;

  if (type === "start") {
    color = "#2c6956";
    iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>`;
  } else if (type === "end") {
    color = "#ba1a1a";
    iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`;
  } else if (type === "current") {
    color = "#326690";
    iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>`;
  } else if (type === "care") {
    color = "#ff9e9e";
    iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 12h.01M15 12h.01M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5M19 10A7 7 0 0 0 5 10v1a7 7 0 0 0 14 0Z"/></svg>`;
  } else if (type === "place") {
    color = "#fcd664";
    iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#745c00" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
  }

  return L.divIcon({
    html: `
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
      ">
        ${iconSvg}
      </div>
    `,
    className: "custom-leaflet-icon",
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });
};

function MapController({ center }: { center: MarkerPosition }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

const toMapBounds = (bounds: L.LatLngBounds): MapBounds => ({
  south: bounds.getSouth(),
  west: bounds.getWest(),
  north: bounds.getNorth(),
  east: bounds.getEast(),
});

function MapEvents({
  center,
  onCenterChange,
  onBoundsChange,
  onRouteEndChange,
}: {
  center: MarkerPosition;
  onCenterChange: (center: MarkerPosition) => void;
  onBoundsChange: (bounds: MapBounds) => void;
  onRouteEndChange: (position: MarkerPosition) => void;
}) {
  const map = useMapEvents({
    contextmenu(e) {
      onRouteEndChange([e.latlng.lat, e.latlng.lng]);
    },
    zoomend() {
      onBoundsChange(toMapBounds(map.getBounds()));
    },
    moveend() {
      const nextCenter = map.getCenter();
      const latDiff = Math.abs(nextCenter.lat - center[0]);
      const lngDiff = Math.abs(nextCenter.lng - center[1]);
      if (latDiff > 0.0001 || lngDiff > 0.0001) {
        onCenterChange([nextCenter.lat, nextCenter.lng]);
      }
      onBoundsChange(toMapBounds(map.getBounds()));
    },
  });

  useEffect(() => {
    onBoundsChange(toMapBounds(map.getBounds()));
  }, [map, onBoundsChange]);

  return null;
}

const mobilityToneClass = {
  positive: "text-primary",
  neutral: "text-on-surface",
  warning: "text-error",
};

const keywordToneClass = {
  positive: "bg-tertiary-container/25 text-on-tertiary-container",
  warning: "bg-error-container/30 text-error",
  neutral: "bg-surface-container-high text-on-surface-variant",
};

const renderAmenityTags = (spot: Spot) => (
  <div className="flex flex-wrap gap-1 my-2">
    {getVisibleAmenityTags(spot).map((info) => {
      return (
        <span
          key={info.key}
          className="inline-flex items-center gap-1 bg-tertiary-container/20 text-on-tertiary-container text-[11px] px-2 py-0.5 rounded-full border border-tertiary-container/30"
        >
          <span className="material-symbols-outlined text-[12px]">{info.icon}</span>
          {info.label}
        </span>
      );
    })}
  </div>
);

export default function Map({
  center,
  spots,
  selectedSpotId,
  currentLocation,
  routeStart,
  routeEnd,
  onCenterChange,
  onBoundsChange,
  onSpotSelect,
  onRouteStartChange,
  onRouteEndChange,
}: MapProps) {
  const startMarkerRef = useRef<L.Marker | null>(null);
  const endMarkerRef = useRef<L.Marker | null>(null);
  const markerRefs = useRef<Record<string, L.Marker | null>>({});

  useEffect(() => {
    if (!selectedSpotId) return;
    const marker = markerRefs.current[selectedSpotId];
    if (!marker) return;
    const latLng = marker.getLatLng();
    onCenterChange([latLng.lat, latLng.lng]);
    window.setTimeout(() => marker.openPopup(), 100);
  }, [selectedSpotId, onCenterChange]);

  const startEventHandlers = useMemo(
    () => ({
      dragend() {
        const marker = startMarkerRef.current;
        if (marker) {
          const latLng = marker.getLatLng();
          onRouteStartChange([latLng.lat, latLng.lng]);
        }
      },
    }),
    [onRouteStartChange]
  );

  const endEventHandlers = useMemo(
    () => ({
      dragend() {
        const marker = endMarkerRef.current;
        if (marker) {
          const latLng = marker.getLatLng();
          onRouteEndChange([latLng.lat, latLng.lng]);
        }
      },
    }),
    [onRouteEndChange]
  );

  return (
    <div className="w-full h-full relative z-0 bg-background text-on-background font-sans">
      <MapContainer center={center} zoom={14} style={{ width: "100%", height: "100%", zIndex: 0 }} zoomControl={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
        <MapController center={center} />
        <MapEvents center={center} onCenterChange={onCenterChange} onBoundsChange={onBoundsChange} onRouteEndChange={onRouteEndChange} />

        {currentLocation && (
          <Marker position={currentLocation} icon={createMarkerIcon("current")}>
            <Popup>
              <div className="map-popup max-w-[200px]">
                <h4 className="font-bold text-sm text-on-surface mb-1">현재 위치</h4>
                <p className="text-[11px] text-on-surface-variant m-0">
                  {currentLocation[0].toFixed(4)}, {currentLocation[1].toFixed(4)}
                </p>
                <div className="popup-buttons mt-2 border-t border-surface-container-high pt-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRouteStartChange(currentLocation);
                    }}
                    className="w-full bg-primary text-white hover:bg-primary/95 text-[11px] py-1.5 rounded text-center transition-colors font-medium cursor-pointer"
                  >
                    출발지로 설정
                  </button>
                </div>
              </div>
            </Popup>
          </Marker>
        )}

        {routeStart && (
          <Marker
            position={routeStart}
            icon={createMarkerIcon("start")}
            draggable
            eventHandlers={startEventHandlers}
            ref={startMarkerRef}
          >
            <Popup>
              <div className="map-popup">
                <h4>출발지 (드래그 가능)</h4>
                <p>
                  {routeStart[0].toFixed(4)}, {routeStart[1].toFixed(4)}
                </p>
              </div>
            </Popup>
          </Marker>
        )}

        {routeEnd && (
          <Marker
            position={routeEnd}
            icon={createMarkerIcon("end")}
            draggable
            eventHandlers={endEventHandlers}
            ref={endMarkerRef}
          >
            <Popup>
              <div className="map-popup">
                <h4>도착지 (드래그 가능)</h4>
                <p>
                  {routeEnd[0].toFixed(4)}, {routeEnd[1].toFixed(4)}
                </p>
              </div>
            </Popup>
          </Marker>
        )}

        {spots.map((spot) => {
          const mobility = getMobilityLevel(spot.stroller_score);
          const googleRating = getGoogleRatingLabel(spot);
          const primarySummary = getSpotPrimarySummary(spot);

          return (
            <Marker
              key={spot.id}
              position={[spot.latitude, spot.longitude]}
              icon={createMarkerIcon(spot.source === "care" ? "care" : "place")}
              ref={(ref) => {
                markerRefs.current[spot.id] = ref;
              }}
              eventHandlers={{ click: () => onSpotSelect(spot.id) }}
            >
              <Popup>
                <div className="map-popup max-w-[240px]">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="font-bold text-sm text-on-surface leading-tight m-0">{spot.name}</h3>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap font-medium ${
                        spot.source === "care"
                          ? "bg-primary-container/20 text-primary"
                          : "bg-secondary-container/20 text-on-secondary-container"
                      }`}
                    >
                      {CATEGORY_LABELS[spot.category]}
                    </span>
                  </div>
                  <p className="text-[11px] text-on-surface-variant m-0 leading-snug line-clamp-2">{spot.address}</p>
                  {renderAmenityTags(spot)}

                  {/* AI 아이 동반 한줄평 */}
                  {spot.child_summary && (
                    <div className="bg-surface-container-low p-2 rounded-xl border border-outline-variant/10 text-[11px] leading-relaxed my-2 text-on-surface-variant flex gap-1.5 items-start">
                      <span className="material-symbols-outlined text-[13px] text-primary shrink-0 mt-0.5">lightbulb</span>
                      <span>{spot.child_summary}</span>
                    </div>
                  )}

                  {/* 리뷰 키워드 태그 */}
                  {spot.review_keywords && spot.review_keywords.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {spot.review_keywords.slice(0, 4).map((keyword) => {
                        const tone = getReviewKeywordTone(keyword);
                        return (
                          <span
                            key={keyword}
                            className={`rounded-full px-2 py-0.5 text-[9px] font-medium leading-none ${keywordToneClass[tone]}`}
                          >
                            {keyword}
                          </span>
                        );
                      })}
                    </div>
                  )}

                  <div className="space-y-1 text-[11px] text-on-surface-variant border-t border-surface-container-high pt-2 mt-1">
                    <div className="flex items-center justify-between gap-2">
                      <span>{ACCESS_POLICY_LABELS[spot.access_policy]}</span>
                      {googleRating && <span>{googleRating}</span>}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span>{spot.source === "care" ? "돌봄 정보" : `유모차 접근 점수 ${spot.stroller_score}/5`}</span>
                      <strong className={spot.source === "care" ? "text-primary" : mobilityToneClass[mobility.tone]}>
                        {primarySummary}
                      </strong>
                    </div>
                  </div>
                  <div className="popup-buttons mt-2 flex gap-1 border-t border-surface-container-high pt-2">
                    <button
                      onClick={() => onRouteStartChange([spot.latitude, spot.longitude])}
                      className="flex-1 bg-surface-container-high text-on-surface hover:bg-surface-variant text-[11px] py-1 rounded text-center transition-colors font-medium"
                    >
                      출발지로 설정
                    </button>
                    <button
                      onClick={() => onRouteEndChange([spot.latitude, spot.longitude])}
                      className="flex-1 bg-primary text-white hover:bg-primary/95 text-[11px] py-1 rounded text-center transition-colors font-medium"
                    >
                      도착지로 설정
                    </button>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
