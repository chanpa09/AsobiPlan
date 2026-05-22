import Link from 'next/link';

export default function SideNavBar() {
  return (
    <nav className="hidden md:flex h-screen w-64 fixed left-0 top-0 bg-surface-container-low border-r border-outline-variant flex-col py-8 gap-2 z-40">
      <div className="px-margin-desktop">
        <h1 className="font-headline-md text-headline-md text-primary font-bold mb-8">AsobiPlan</h1>
      </div>
      <div className="px-margin-desktop mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-secondary-container flex items-center justify-center text-on-secondary-container">
            <span className="material-symbols-outlined">face</span>
          </div>
          <div>
            <p className="font-label-lg text-label-lg text-on-surface">안녕하세요!</p>
            <p className="font-label-sm text-label-sm text-on-surface-variant">고토구 육아 가이드</p>
          </div>
        </div>
      </div>
      
      <div className="flex flex-col gap-1 w-full">
        <Link href="/" className="flex items-center gap-4 bg-primary-container text-on-primary-container rounded-xl px-4 py-3 mx-2 active:scale-[0.98] transition-all group">
          <span className="material-symbols-outlined filled-icon">home</span>
          <span className="font-label-lg text-label-lg">홈</span>
        </Link>
        <Link href="#" className="flex items-center gap-4 text-on-surface-variant hover:bg-surface-variant rounded-xl px-4 py-3 mx-2 transition-colors active:scale-[0.98] group">
          <span className="material-symbols-outlined group-hover:text-primary transition-colors">map</span>
          <span className="font-label-lg text-label-lg group-hover:text-primary transition-colors">지도</span>
        </Link>
        <Link href="#" className="flex items-center gap-4 text-on-surface-variant hover:bg-surface-variant rounded-xl px-4 py-3 mx-2 transition-colors active:scale-[0.98] group">
          <span className="material-symbols-outlined group-hover:text-primary transition-colors">bookmark</span>
          <span className="font-label-lg text-label-lg group-hover:text-primary transition-colors">북마크</span>
        </Link>
        <Link href="#" className="flex items-center gap-4 text-on-surface-variant hover:bg-surface-variant rounded-xl px-4 py-3 mx-2 transition-colors active:scale-[0.98] group">
          <span className="material-symbols-outlined group-hover:text-primary transition-colors">person</span>
          <span className="font-label-lg text-label-lg group-hover:text-primary transition-colors">마이페이지</span>
        </Link>
      </div>

      <div className="mt-auto px-margin-desktop pb-4">
        <button className="w-full flex items-center justify-center gap-2 bg-surface shadow-sm rounded-full py-2 text-primary font-label-lg text-label-lg hover:bg-surface-container-low transition-colors border border-outline-variant">
          <span className="material-symbols-outlined text-[18px]">add</span>
          장소 제안하기
        </button>
      </div>
    </nav>
  );
}
