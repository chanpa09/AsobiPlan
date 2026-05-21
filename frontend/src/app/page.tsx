"use client";

import dynamic from "next/dynamic";

const Map = dynamic(() => import("../components/Map"), {
  ssr: false,
  loading: () => (
    <div className="map-loading">
      <h2>지도 로드 중...</h2>
    </div>
  ),
});

export default function Home() {
  return (
    <main style={{ width: "100vw", height: "100vh", display: "flex" }}>
      <Map />
    </main>
  );
}
