export default function TopNavBar() {
  return (
    <header className="md:hidden w-full sticky top-0 z-50 shadow-md bg-surface/80 backdrop-blur-md flex justify-between items-center px-margin-mobile py-4">
      <h1 className="font-headline-md text-headline-md text-primary font-bold">AsobiPlan</h1>
      <div className="flex gap-4">
        <button className="text-on-surface-variant">
          <span className="material-symbols-outlined">search</span>
        </button>
        <button className="text-on-surface-variant">
          <span className="material-symbols-outlined">menu</span>
        </button>
      </div>
    </header>
  );
}
