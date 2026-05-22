export default function SearchBar() {
  return (
    <div className="hidden md:flex flex-col gap-4 p-margin-desktop pb-2 absolute top-0 left-0 right-0 z-30 pointer-events-none">
      <div className="flex gap-4 pointer-events-auto">
        <div className="flex-1 max-w-2xl bg-surface shadow-md rounded-full px-6 py-3 flex items-center gap-3 border border-surface-container-high transition-shadow hover:shadow-lg">
          <span className="material-symbols-outlined text-outline">search</span>
          <input 
            type="text" 
            placeholder="고토구에서 어디로 가볼까요?" 
            className="w-full bg-transparent border-none focus:ring-0 text-on-surface placeholder:text-outline font-body-md p-0 outline-none" 
          />
          <button className="text-primary hover:text-primary-container transition-colors">
            <span className="material-symbols-outlined">tune</span>
          </button>
        </div>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-2 pointer-events-auto hide-scrollbar">
        <button className="px-4 py-1.5 rounded-full border border-outline-variant bg-surface text-on-surface-variant font-label-lg text-label-lg hover:bg-surface-container-low transition-colors whitespace-nowrap flex items-center gap-1">
          <span className="material-symbols-outlined text-[16px]">stroller</span> 유모차 접근성
        </button>
        <button className="px-4 py-1.5 rounded-full border border-primary bg-primary-container text-on-primary-container font-label-lg text-label-lg whitespace-nowrap flex items-center gap-1">
          <span className="material-symbols-outlined text-[16px]">baby_changing_station</span> 수유실 있음
        </button>
        <button className="px-4 py-1.5 rounded-full border border-outline-variant bg-surface text-on-surface-variant font-label-lg text-label-lg hover:bg-surface-container-low transition-colors whitespace-nowrap flex items-center gap-1">
          <span className="material-symbols-outlined text-[16px]">park</span> 실외 놀이터
        </button>
        <button className="px-4 py-1.5 rounded-full border border-outline-variant bg-surface text-on-surface-variant font-label-lg text-label-lg hover:bg-surface-container-low transition-colors whitespace-nowrap flex items-center gap-1">
          <span className="material-symbols-outlined text-[16px]">restaurant</span> 키즈 메뉴
        </button>
      </div>
    </div>
  );
}
