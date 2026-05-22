import type { SpotCategory } from "@/lib/spots";

interface SearchBarProps {
  query: string;
  nursingRoom: boolean;
  ramp: boolean;
  category: SpotCategory | "";
  onQueryChange: (query: string) => void;
  onNursingRoomToggle: () => void;
  onRampToggle: () => void;
  onCategoryChange: (category: SpotCategory | "") => void;
  onFilterToggle: () => void;
}

const chipClass = (active: boolean) =>
  `px-4 py-1.5 rounded-full border font-label-lg text-label-lg whitespace-nowrap flex items-center gap-1 transition-colors ${
    active
      ? "border-primary bg-primary-container text-on-primary-container"
      : "border-outline-variant bg-surface text-on-surface-variant hover:bg-surface-container-low"
  }`;

export default function SearchBar({
  query,
  nursingRoom,
  ramp,
  category,
  onQueryChange,
  onNursingRoomToggle,
  onRampToggle,
  onCategoryChange,
  onFilterToggle,
}: SearchBarProps) {
  return (
    <div className="hidden md:flex flex-col gap-3 p-6 pb-2 absolute top-0 left-0 right-0 z-30 pointer-events-none">
      <div className="flex gap-4 pointer-events-auto">
        <label className="flex-1 max-w-xl bg-surface/95 backdrop-blur-md shadow-md rounded-full px-5 py-3 flex items-center gap-3 border border-surface-container-high transition-all duration-300 hover:shadow-lg focus-within:shadow-[0_0_0_3px_rgba(148,71,72,0.2)] focus-within:border-primary">
          <span className="material-symbols-outlined text-outline">search</span>
          <input
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="고토구에서 어디로 가볼까요?"
            className="w-full bg-transparent border-none focus:ring-0 text-on-surface placeholder:text-outline font-body-md p-0 outline-none"
          />
          <button
            type="button"
            className="text-primary hover:text-on-primary-container transition-colors"
            onClick={onFilterToggle}
            aria-label="상세 필터 설정"
          >
            <span className="material-symbols-outlined">tune</span>
          </button>
        </label>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-2 pointer-events-auto hide-scrollbar max-w-2xl">
        <button type="button" className={chipClass(ramp)} onClick={onRampToggle}>
          <span className="material-symbols-outlined text-[16px]">stroller</span> 이동 편의 좋음
        </button>
        <button type="button" className={chipClass(nursingRoom)} onClick={onNursingRoomToggle}>
          <span className="material-symbols-outlined text-[16px]">baby_changing_station</span> 수유실 있음
        </button>
        <button
          type="button"
          className={chipClass(category === "park")}
          onClick={() => onCategoryChange(category === "park" ? "" : "park")}
        >
          <span className="material-symbols-outlined text-[16px]">park</span> 공원
        </button>
        <button
          type="button"
          className={chipClass(category === "restaurant" || category === "cafe")}
          onClick={() => onCategoryChange(category === "restaurant" || category === "cafe" ? "" : "restaurant")}
        >
          <span className="material-symbols-outlined text-[16px]">restaurant</span> 음식점
        </button>
      </div>
    </div>
  );
}
