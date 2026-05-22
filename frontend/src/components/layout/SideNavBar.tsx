import Link from "next/link";

const navItems = [
  { href: "/", icon: "home", label: "홈", active: true },
  { href: "#", icon: "map", label: "지도", active: false },
  { href: "#", icon: "bookmark", label: "북마크", active: false },
  { href: "#", icon: "person", label: "마이페이지", active: false },
];

export default function SideNavBar() {
  return (
    <nav className="hidden md:flex h-screen w-56 fixed left-0 top-0 bg-surface-container-low border-r border-outline-variant flex-col py-6 gap-6 z-40">
      {/* Brand Logo & Info */}
      <div className="flex items-center gap-3 px-4">
        <div className="w-10 h-10 rounded-xl bg-primary-container text-primary flex items-center justify-center font-bold text-lg shrink-0" title="AsobiPlan">
          A
        </div>
        <div className="flex flex-col">
          <span className="font-bold text-base text-on-surface leading-tight">AsobiPlan</span>
          <span className="text-[10px] text-on-surface-variant font-semibold tracking-tight">고토구 유모차 지도</span>
        </div>
      </div>

      {/* Greeting Block */}
      <div className="bg-primary/5 rounded-2xl p-4 mx-4">
        <p className="text-xs font-bold text-primary">안녕하세요! 👋</p>
        <p className="text-[11px] text-on-surface-variant mt-1.5 leading-normal font-medium">
          고토구 육아 가이드입니다. 유모차로 이용하기 편리한 장소를 모았습니다.
        </p>
      </div>

      {/* Navigation Items */}
      <div className="flex flex-col gap-1 w-full px-2">
        {navItems.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            title={item.label}
            aria-label={item.label}
            className={`w-full h-11 flex items-center px-4 gap-3 rounded-xl active:scale-[0.98] transition-all group ${
              item.active
                ? "bg-primary-container text-on-primary-container font-semibold"
                : "text-on-surface-variant hover:bg-surface-variant/50 hover:text-on-surface"
            }`}
          >
            <span className={`material-symbols-outlined text-[20px] ${item.active ? "filled-icon" : "group-hover:text-primary transition-colors"}`}>
              {item.icon}
            </span>
            <span className="text-sm font-medium">{item.label}</span>
          </Link>
        ))}
      </div>

      {/* Suggest Location Button */}
      <div className="mt-auto px-4 w-full">
        <button
          type="button"
          className="w-full h-11 flex items-center justify-center gap-2 bg-surface shadow-sm rounded-xl text-primary hover:bg-surface-container-low transition-all border border-outline-variant font-bold text-sm cursor-pointer hover:shadow-md"
        >
          <span className="material-symbols-outlined text-[18px]">add_location</span>
          <span>장소 제안하기</span>
        </button>
      </div>
    </nav>
  );
}

