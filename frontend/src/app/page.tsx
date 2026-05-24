"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import SearchBar from "@/components/home/SearchBar";
import PlaceCard from "@/components/home/PlaceCard";
import {
  buildGoogleMapsUrl,
  CATEGORY_LABELS,
  DEFAULT_CENTER,
  filterSpots,
  getAvailableTileIdsForBounds,
  loadSpotTile,
  loadSpotTileManifest,
  tileIdsToCoordinates,
  type MapBounds,
  type MarkerPosition,
  type Spot,
  type SpotCategory,
  type SpotFilters,
} from "@/lib/spots";

const LeafletMap = dynamic(() => import("../components/Map"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center w-full h-full bg-surface-container-lowest">
      <h2 className="text-primary font-headline-md">지도 로드 중...</h2>
    </div>
  ),
});

const DEFAULT_FILTERS: SpotFilters = {
  minScore: 1,
  category: "",
  ramp: false,
  nursingRoom: false,
  diaperTable: false,
  hotWater: false,
  babyChair: false,
  freeOnly: false,
};

const formatPosition = (position: MarkerPosition | null) =>
  position ? `${position[0].toFixed(4)}, ${position[1].toFixed(4)}` : "미선택";

export default function Home() {
  const [mapCenter, setMapCenter] = useState<MarkerPosition>(DEFAULT_CENTER);
  const [listCenter, setListCenter] = useState<MarkerPosition>(DEFAULT_CENTER);
  const [mapBounds, setMapBounds] = useState<MapBounds | null>(null);
  const [spots, setSpots] = useState<Spot[]>([]);
  const [tileManifest, setTileManifest] = useState<Awaited<ReturnType<typeof loadSpotTileManifest>> | null>(null);
  const [activeSpotId, setActiveSpotId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<SpotFilters>(DEFAULT_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<MarkerPosition | null>(null);
  const [routeStart, setRouteStart] = useState<MarkerPosition | null>(null);
  const [routeEnd, setRouteEnd] = useState<MarkerPosition | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [dataError, setDataError] = useState<string | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const tileCacheRef = useRef(new Map<string, Spot[]>());
  const pendingTilesRef = useRef(new Map<string, Promise<Spot[]>>());
  const tileCoordinates = useMemo(() => (tileManifest ? tileIdsToCoordinates(tileManifest.tiles) : []), [tileManifest]);

  useEffect(() => {
    let alive = true;
    loadSpotTileManifest()
      .then((manifest) => {
        if (!alive) return;
        setTileManifest(manifest);
        setDataError(null);
      })
      .catch(() => {
        if (!alive) return;
        setDataError("장소 타일 정보를 불러오지 못했습니다.");
        setIsLoadingData(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!tileManifest || !mapBounds) return;

    let alive = true;
    const targetTileIds = getAvailableTileIdsForBounds(mapBounds, tileCoordinates, tileManifest.tileZoom);
    const missingTileIds = targetTileIds.filter((tileId) => !tileCacheRef.current.has(tileId));

    const publishTileSpots = () => {
      const dedupedSpots = new Map<string, Spot>();
      targetTileIds.forEach((tileId) => {
        tileCacheRef.current.get(tileId)?.forEach((spot) => {
          dedupedSpots.set(spot.id, spot);
        });
      });
      setSpots(Array.from(dedupedSpots.values()));
    };

    if (missingTileIds.length === 0) {
      publishTileSpots();
      setIsLoadingData(false);
      return;
    }

    setIsLoadingData(true);
    const tileLoads = missingTileIds.map((tileId) => {
      const existingLoad = pendingTilesRef.current.get(tileId);
      const load =
        existingLoad ||
        loadSpotTile(tileId, tileManifest.tileZoom).finally(() => {
          pendingTilesRef.current.delete(tileId);
        });
      pendingTilesRef.current.set(tileId, load);
      return load.then((spotsInTile) => [tileId, spotsInTile] as const);
    });

    Promise.all(tileLoads)
      .then((loadedTiles) => {
        loadedTiles.forEach(([tileId, spotsInTile]) => {
          tileCacheRef.current.set(tileId, spotsInTile);
        });
        if (!alive) return;
        setDataError(null);
        publishTileSpots();
      })
      .catch(() => {
        if (!alive) return;
        setDataError("현재 화면의 장소 데이터를 불러오지 못했습니다.");
      })
      .finally(() => {
        if (alive) setIsLoadingData(false);
      });

    return () => {
      alive = false;
    };
  }, [mapBounds, tileCoordinates, tileManifest]);

  const spotsInCurrentBounds = useMemo(() => {
    if (!mapBounds) return spots;
    return spots.filter(
      (spot) =>
        spot.latitude >= mapBounds.south &&
        spot.latitude <= mapBounds.north &&
        spot.longitude >= mapBounds.west &&
        spot.longitude <= mapBounds.east
    );
  }, [mapBounds, spots]);

  const visibleSpots = useMemo(
    () => filterSpots(spotsInCurrentBounds, listCenter, searchQuery, filters, Number.POSITIVE_INFINITY),
    [filters, listCenter, searchQuery, spotsInCurrentBounds]
  );

  const googleMapsRouteUrl = routeStart && routeEnd ? buildGoogleMapsUrl(routeStart, routeEnd) : null;
  const activeSpot = visibleSpots.find((spot) => spot.id === activeSpotId) || null;

  const updateFilter = <K extends keyof SpotFilters>(key: K, value: SpotFilters[K]) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const handleSelectSpot = (spot: Spot) => {
    setActiveSpotId(spot.id);
    setMapCenter([spot.latitude, spot.longitude]);
    setListCenter([spot.latitude, spot.longitude]);
  };

  const handleMapCenterChange = useCallback((center: MarkerPosition) => {
    setMapCenter(center);
    setListCenter(center);
  }, []);

  const handleMapBoundsChange = useCallback((bounds: MapBounds) => {
    setMapBounds(bounds);
  }, []);

  const findCurrentLocation = (options: { updateListCenter: boolean }) =>
    new Promise<MarkerPosition>((resolve, reject) => {
      if (typeof navigator === "undefined" || !navigator.geolocation?.getCurrentPosition) {
        setLocationError("이 브라우저에서는 현재 위치 기능을 사용할 수 없습니다.");
        reject(new Error("unsupported"));
        return;
      }

      setIsLocating(true);
      setLocationError(null);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const nextLocation: MarkerPosition = [position.coords.latitude, position.coords.longitude];
          setCurrentLocation(nextLocation);
          setMapCenter(nextLocation);
          if (options.updateListCenter) {
            setListCenter(nextLocation);
          }
          setIsLocating(false);
          resolve(nextLocation);
        },
        (error) => {
          setIsLocating(false);
          setLocationError(error.code === 1 ? "브라우저 위치 권한을 허용해야 현재 위치를 사용할 수 있습니다." : "현재 위치를 찾지 못했습니다.");
          reject(error);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 60_000,
          timeout: 10_000,
        }
      );
    });

  const handleFindCurrentLocation = () => {
    findCurrentLocation({ updateListCenter: true }).catch(() => {
      console.warn("Geolocation failed. Falling back to default center.");
      setCurrentLocation(DEFAULT_CENTER);
      setMapCenter(DEFAULT_CENTER);
      setListCenter(DEFAULT_CENTER);
    });
  };

  const handleCurrentLocationAsStart = () => {
    if (currentLocation) {
      setRouteStart(currentLocation);
      setMapCenter(currentLocation);
      return;
    }

    findCurrentLocation({ updateListCenter: false })
      .then((location) => setRouteStart(location))
      .catch(() => {
        console.warn("Geolocation failed. Falling back to default center for route start.");
        setRouteStart(DEFAULT_CENTER);
        setMapCenter(DEFAULT_CENTER);
        setCurrentLocation(DEFAULT_CENTER);
      });
  };

  const clearRoute = () => {
    setRouteStart(null);
    setRouteEnd(null);
  };

  const panelTitle = searchQuery || filters.category || filters.nursingRoom || filters.ramp ? "검색 결과" : "추천 장소";

  return (
    <div className="flex-1 flex flex-col md:flex-row relative h-full w-full">
      <SearchBar
        query={searchQuery}
        nursingRoom={filters.nursingRoom}
        ramp={filters.ramp}
        category={filters.category}
        onQueryChange={setSearchQuery}
        onNursingRoomToggle={() => updateFilter("nursingRoom", !filters.nursingRoom)}
        onRampToggle={() => updateFilter("ramp", !filters.ramp)}
        onCategoryChange={(category) => updateFilter("category", category)}
        onFilterToggle={() => setShowFilters((value) => !value)}
      />

      <div className="w-full md:flex-1 h-[50vh] md:h-full bg-surface-container-lowest relative z-0">
        <LeafletMap
          center={mapCenter}
          spots={visibleSpots}
          selectedSpotId={activeSpotId}
          currentLocation={currentLocation}
          routeStart={routeStart}
          routeEnd={routeEnd}
          onCenterChange={handleMapCenterChange}
          onBoundsChange={handleMapBoundsChange}
          onSpotSelect={setActiveSpotId}
          onRouteStartChange={setRouteStart}
          onRouteEndChange={setRouteEnd}
        />

        <div className="absolute bottom-margin-desktop right-margin-desktop flex flex-col gap-2 z-20 hidden md:flex pointer-events-auto">
          <button
            type="button"
            className="w-12 h-12 bg-surface shadow-md rounded-full flex items-center justify-center text-on-surface-variant hover:text-primary transition-colors disabled:opacity-60"
            onClick={handleFindCurrentLocation}
            disabled={isLocating}
            aria-label="현재 위치 찾기"
          >
            <span className="material-symbols-outlined">my_location</span>
          </button>
        </div>
      </div>

      <aside className="w-full md:w-[390px] md:shrink-0 h-[50vh] md:h-full bg-surface md:bg-surface/95 backdrop-blur-md shadow-[-4px_0_24px_rgba(0,0,0,0.05)] md:border-l border-outline-variant flex flex-col z-20">
        <div className="p-5 md:p-6 border-b border-surface-container-high bg-surface sticky top-0 z-10">
          <div className="md:hidden mb-4">
            <label className="bg-surface-container-lowest rounded-full px-4 py-2 flex items-center gap-2 border border-surface-container-high">
              <span className="material-symbols-outlined text-outline">search</span>
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="장소, 주소, 키워드 검색"
                className="w-full bg-transparent border-none outline-none text-on-surface placeholder:text-outline"
              />
            </label>
          </div>

          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-headline-lg text-headline-lg text-on-surface mb-1">{panelTitle}</h2>
              <p className="font-body-md text-body-md text-on-surface-variant">
                {isLoadingData ? "현재 화면 데이터를 불러오는 중입니다." : `현재 화면 주변 ${visibleSpots.length}곳`}
              </p>
            </div>
            <button
              type="button"
              className="rounded-full border border-outline-variant px-3 py-2 text-primary font-label-lg text-label-lg hover:bg-surface-container-low"
              onClick={() => setShowFilters((value) => !value)}
              aria-expanded={showFilters}
            >
              상세 필터 설정
            </button>
          </div>

          <div className="mt-4 rounded-2xl bg-surface-container-lowest border border-surface-container-high p-4 shadow-sm">
            {/* Timeline UI for Route Start/End */}
            <div className="flex flex-col relative pl-6 gap-4">
              {/* Vertical dashed line */}
              <div className="absolute left-2.5 top-2 bottom-2 w-[1px] border-l border-dashed border-outline/50" />

              {/* Start Point */}
              <div className="flex items-center justify-between gap-3 relative z-10">
                {/* Bullet */}
                <div className="absolute -left-6 top-1 w-3.5 h-3.5 rounded-full border-2 border-white bg-tertiary shadow-sm flex items-center justify-center">
                  <div className="w-1 h-1 rounded-full bg-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="block text-[10px] font-semibold text-tertiary leading-none uppercase tracking-wider mb-0.5">출발지</span>
                  <span className="block text-[12px] font-semibold text-on-surface truncate">
                    {routeStart ? formatPosition(routeStart) : "출발지를 선택해 주세요."}
                  </span>
                </div>
                {routeStart && (
                  <button
                    type="button"
                    className="text-[11px] text-primary hover:text-on-primary-container bg-primary-container/20 rounded-full px-2 py-0.5 font-semibold transition-colors cursor-pointer"
                    onClick={() => setRouteStart(null)}
                  >
                    초기화
                  </button>
                )}
              </div>

              {/* End Point */}
              <div className="flex items-center justify-between gap-3 relative z-10">
                {/* Bullet */}
                <div className="absolute -left-6 top-1 w-3.5 h-3.5 rounded-full border-2 border-white bg-error shadow-sm flex items-center justify-center">
                  <div className="w-1 h-1 rounded-full bg-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="block text-[10px] font-semibold text-error leading-none uppercase tracking-wider mb-0.5">도착지</span>
                  <span className="block text-[12px] font-semibold text-on-surface truncate">
                    {routeEnd ? formatPosition(routeEnd) : "도착지를 선택해 주세요."}
                  </span>
                </div>
                {routeEnd && (
                  <button
                    type="button"
                    className="text-[11px] text-primary hover:text-on-primary-container bg-primary-container/20 rounded-full px-2 py-0.5 font-semibold transition-colors cursor-pointer"
                    onClick={() => setRouteEnd(null)}
                  >
                    초기화
                  </button>
                )}
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className="shrink-0 rounded-full border border-outline-variant px-3 py-2 text-primary font-bold text-label-lg hover:bg-surface-container-low transition-colors cursor-pointer disabled:opacity-60"
                onClick={handleCurrentLocationAsStart}
                disabled={isLocating}
              >
                현재 위치를 출발지로
              </button>
              {googleMapsRouteUrl ? (
                <a
                  className="flex-1 rounded-full bg-primary px-3 py-2 text-center text-on-primary font-bold text-label-lg animate-pulse hover:animate-none hover:bg-primary-fixed-dim hover:text-on-primary-fixed shadow-md transition-all cursor-pointer"
                  href={googleMapsRouteUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Google Maps에서 선택한 출발지와 도착지 길찾기"
                >
                  Google Maps에서 길찾기
                </a>
              ) : (
                <div className="flex-1 rounded-full bg-surface-container-high px-3 py-2 text-center text-on-surface-variant font-medium text-label-lg border border-outline-variant/10">
                  출발/도착 선택
                </div>
              )}
            </div>

            {(routeStart || routeEnd) && (
              <button type="button" className="mt-2 text-[12px] font-semibold text-primary hover:underline cursor-pointer" onClick={clearRoute}>
                출발지와 도착지 모두 선택 해제
              </button>
            )}
            {currentLocation && <p className="mt-2 text-[11px] text-on-surface-variant">현재 위치: {formatPosition(currentLocation)}</p>}
            {locationError && <p className="mt-2 text-[11px] text-error font-medium">{locationError}</p>}
          </div>

          {showFilters && (
            <div className="mt-4 rounded-2xl border border-surface-container-high bg-surface-container-lowest p-4 flex flex-col gap-3 animate-slideDown">
              <label className="flex flex-col gap-1 text-[12px] text-on-surface-variant">
                최소 유모차 접근 점수: {filters.minScore}점 이상
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={filters.minScore}
                  onChange={(event) => updateFilter("minScore", Number(event.target.value))}
                  className="accent-primary"
                />
              </label>
              <select
                value={filters.category}
                onChange={(event) => updateFilter("category", event.target.value as SpotCategory | "")}
                className="rounded-xl border border-outline-variant bg-surface px-3 py-2 text-on-surface"
              >
                <option value="">모든 장소 유형</option>
                {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-2 text-[12px] text-on-surface">
                {[
                  ["nursingRoom", "수유실 있음"],
                  ["diaperTable", "기저귀 교환대 있음"],
                  ["hotWater", "온수 있음"],
                  ["freeOnly", "무료 개방만"],
                  ["ramp", "경사로 있음"],
                  ["babyChair", "아기의자 있음"],
                ].map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={Boolean(filters[key as keyof SpotFilters])}
                      onChange={(event) => updateFilter(key as keyof SpotFilters, event.target.checked as never)}
                      className="accent-primary"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-5 md:p-6 flex flex-col gap-stack-md pb-24">
          {dataError && <p className="rounded-2xl bg-error-container p-4 text-on-error-container">{dataError}</p>}
          {!dataError && visibleSpots.length === 0 && !isLoadingData && (
            <p className="rounded-2xl bg-surface-container-lowest border border-surface-container-high p-4 text-on-surface-variant">
              조건에 맞는 장소가 없습니다. 검색어나 필터를 줄여보세요.
            </p>
          )}
          {visibleSpots.map((spot) => (
            <PlaceCard
              key={spot.id}
              spot={spot}
              active={activeSpot?.id === spot.id}
              routeStart={routeStart}
              routeEnd={routeEnd}
              onSelect={handleSelectSpot}
              onSetStart={setRouteStart}
              onSetEnd={setRouteEnd}
            />
          ))}
        </div>
      </aside>
    </div>
  );
}
