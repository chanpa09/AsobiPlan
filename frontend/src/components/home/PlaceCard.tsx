import { useState } from "react";
import {
  ACCESS_POLICY_LABELS,
  CATEGORY_LABELS,
  getGoogleRatingLabel,
  getMobilityLevel,
  getReviewKeywordTone,
  getSpotPrimarySummary,
  getVisibleAmenityTags,
  type MarkerPosition,
  type Spot,
} from "@/lib/spots";

interface PlaceCardProps {
  spot: Spot;
  active: boolean;
  routeStart: MarkerPosition | null;
  routeEnd: MarkerPosition | null;
  onSelect: (spot: Spot) => void;
  onSetStart: (position: MarkerPosition) => void;
  onSetEnd: (position: MarkerPosition) => void;
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

const categoryGradients: Record<string, string> = {
  park: "bg-grad-park",
  restaurant: "bg-grad-dining",
  cafe: "bg-grad-dining",
  mall: "bg-grad-shopping",
  station: "bg-grad-facility",
  public_facility: "bg-grad-facility",
};

const categoryIcons: Record<string, string> = {
  park: "forest",
  restaurant: "restaurant",
  cafe: "local_cafe",
  mall: "shopping_bag",
  station: "directions_subway",
  public_facility: "domain",
};

const renderAmenityTags = (spot: Spot) =>
  getVisibleAmenityTags(spot).map((info) => {
    return (
      <span
        key={info.key}
        className="inline-flex items-center gap-1 text-tertiary bg-tertiary-container/20 rounded-full px-2 py-0.5"
        title={info.label}
      >
        <span className="material-symbols-outlined text-[15px]">{info.icon}</span>
        <span className="text-[11px]">{info.label}</span>
      </span>
    );
  });

const renderReviewKeywords = (spot: Spot) => {
  if (spot.source === "care" || spot.review_keywords.length === 0) return null;

  return (
    <div className="mb-3">
      <p className="font-label-sm text-[11px] font-semibold text-on-surface-variant mb-1">리뷰 단서</p>
      <div className="flex flex-wrap gap-1.5">
        {spot.review_keywords.slice(0, 6).map((keyword) => {
          const tone = getReviewKeywordTone(keyword);
          return (
            <span key={keyword} className={`rounded-full px-2 py-0.5 text-[11px] ${keywordToneClass[tone]}`}>
              {keyword}
            </span>
          );
        })}
      </div>
    </div>
  );
};

const samePosition = (a: MarkerPosition | null, b: MarkerPosition) =>
  Boolean(a && Math.abs(a[0] - b[0]) < 0.000001 && Math.abs(a[1] - b[1]) < 0.000001);

export default function PlaceCard({ spot, active, routeStart, routeEnd, onSelect, onSetStart, onSetEnd }: PlaceCardProps) {
  const [isFavorite, setIsFavorite] = useState(false);
  const position: MarkerPosition = [spot.latitude, spot.longitude];
  const isStart = samePosition(routeStart, position);
  const isEnd = samePosition(routeEnd, position);
  const mobility = getMobilityLevel(spot.stroller_score);
  const primarySummary = getSpotPrimarySummary(spot);
  const googleRating = getGoogleRatingLabel(spot);

  const gradientClass = categoryGradients[spot.category] || "bg-grad-facility";
  const iconName = categoryIcons[spot.category] || "place";

  return (
    <article
      className={`relative bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden border transition-all card-hover-lift cursor-pointer shrink-0 ${
        active ? "border-primary bg-primary-container/5 shadow-md ring-1 ring-primary" : "border-surface-container-high"
      }`}
      onClick={() => onSelect(spot)}
    >
      {/* Category Gradient Image Header */}
      <div className={`h-24 w-full ${gradientClass} flex items-center justify-center relative overflow-hidden transition-all duration-300 ${active ? "h-28" : "h-20"}`}>
        <div className="absolute inset-0 bg-black/10" />
        <span className="material-symbols-outlined text-white/30 text-[40px] filled-icon transition-all group-hover:scale-110">
          {iconName}
        </span>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setIsFavorite(!isFavorite);
          }}
          className={`absolute top-2.5 right-2.5 w-7.5 h-7.5 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-all ${
            isFavorite ? "bg-white/40! text-primary-fixed!" : ""
          }`}
          title="즐겨찾기"
        >
          <span className={`material-symbols-outlined text-[16px] ${isFavorite ? "filled-icon text-red-500" : ""}`}>
            favorite
          </span>
        </button>
      </div>

      <span className={`absolute left-0 top-0 h-full w-1 ${active ? "bg-primary" : "bg-transparent"}`} />
      
      <div className="p-4 pl-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap gap-1.5 mb-1.5">
              <span className="font-label-sm text-label-sm px-2 py-0.5 rounded-full bg-primary-container/25 text-primary whitespace-nowrap">
                {CATEGORY_LABELS[spot.category]}
              </span>
              <span className="font-label-sm text-label-sm px-2 py-0.5 rounded-full bg-secondary-container/30 text-on-secondary-container whitespace-nowrap">
                {ACCESS_POLICY_LABELS[spot.access_policy]}
              </span>
            </div>
            <h3 className="font-label-lg text-[15px] font-bold text-on-surface leading-tight line-clamp-2">{spot.name}</h3>
          </div>
          <div className="shrink-0 text-right">
            <span className="block text-[11px] text-on-surface-variant">{spot.source === "care" ? "돌봄 정보" : "AI 이동"}</span>
            {spot.source === "care" ? (
              <span className="block max-w-[76px] text-[12px] font-bold leading-snug text-primary">{primarySummary}</span>
            ) : (
              <>
                <span className={`block font-bold ${mobilityToneClass[mobility.tone]}`}>{spot.stroller_score}/5</span>
                <span className="block text-[11px] text-on-surface-variant">{mobility.label}</span>
              </>
            )}
          </div>
        </div>

        <p className="font-body-md text-[12px] leading-5 text-on-surface-variant line-clamp-1 mt-1 mb-2">{spot.address}</p>
        <div className="mb-2 flex flex-wrap gap-1.5 text-[11px] text-on-surface-variant">
          {googleRating && <span>{googleRating}</span>}
          <span>{ACCESS_POLICY_LABELS[spot.access_policy]}</span>
          <span>{primarySummary}</span>
        </div>
        
        <div className="flex flex-wrap gap-1.5 mb-2">{renderAmenityTags(spot)}</div>
        
        {/* Description Text: Collapse/Expand */}
        {!active && (spot.reasoning || spot.access_note) && (
          <p className="font-body-md text-[12px] leading-relaxed text-on-surface-variant line-clamp-2 mt-2 mb-1 bg-surface-container-low/40 rounded-xl p-2.5 border border-outline-variant/10">
            {spot.reasoning || spot.access_note}
          </p>
        )}

        {active && (
          <>
            <div className="font-body-md text-[12px] leading-5 text-on-surface-variant bg-surface-container-low rounded-xl p-3 mb-3 border border-outline-variant/20 animate-fadeIn">
              <p className="font-label-sm text-[11px] font-semibold text-on-surface mb-1">
                {spot.source === "care" ? "이용 안내" : "리뷰 기반 AI 요약"}
              </p>
              <p className="leading-relaxed">{spot.reasoning || spot.access_note}</p>
              {spot.access_note && spot.source === "place" && (
                <p className="mt-2 text-[11px] text-on-surface-variant border-t border-outline-variant/10 pt-2">{spot.access_note}</p>
              )}
            </div>
            {renderReviewKeywords(spot)}
            
            {/* Start/End buttons shown only when active */}
            <div className="flex gap-2 mt-3 animate-fadeIn">
              <button
                type="button"
                className={`flex-1 rounded-full px-3 py-2 font-label-lg text-label-lg transition-colors cursor-pointer ${
                  isStart ? "bg-tertiary text-on-tertiary font-bold" : "bg-tertiary-container/35 text-on-tertiary-container hover:bg-tertiary-container/60"
                }`}
                onClick={(event) => {
                  event.stopPropagation();
                  onSetStart(position);
                }}
              >
                {isStart ? "출발 선택됨" : "출발"}
              </button>
              <button
                type="button"
                className={`flex-1 rounded-full px-3 py-2 font-label-lg text-label-lg transition-colors cursor-pointer ${
                  isEnd ? "bg-primary text-on-primary font-bold" : "bg-primary-container/45 text-on-primary-container hover:bg-primary-container/70"
                }`}
                onClick={(event) => {
                  event.stopPropagation();
                  onSetEnd(position);
                }}
              >
                {isEnd ? "도착 선택됨" : "도착"}
              </button>
            </div>
          </>
        )}
      </div>
    </article>
  );
}

