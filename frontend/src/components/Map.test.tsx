import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import Map from "./Map";
import {
  buildGoogleMapsUrl,
  filterSpots,
  getAvailableTileIdsForBounds,
  getTileIdsForBounds,
  loadSpotTile,
  tileIdsToCoordinates,
  type Spot,
} from "@/lib/spots";

vi.mock("leaflet", () => ({
  default: {
    divIcon: vi.fn((options) => ({ options })),
  },
}));

vi.mock("react-leaflet", () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="map-container">{children}</div>,
  Marker: ({ children }: { children?: React.ReactNode }) => <div data-testid="map-marker">{children}</div>,
  Popup: ({ children }: { children: React.ReactNode }) => <div data-testid="map-popup">{children}</div>,
  TileLayer: () => null,
  useMap: () => ({
    getZoom: () => 15,
    setView: vi.fn(),
  }),
  useMapEvents: vi.fn(() => ({
    getCenter: () => ({ lat: 35.6706, lng: 139.8165 }),
    getBounds: () => ({
      getSouth: () => 35.66,
      getWest: () => 139.8,
      getNorth: () => 35.68,
      getEast: () => 139.83,
    }),
  })),
}));

const spot: Spot = {
  id: "place-1",
  source: "place",
  name: "로얄 호스트 토요초점",
  category: "restaurant",
  address: "도쿄도 고토구 토요 4-1-1",
  latitude: 35.6706,
  longitude: 139.8165,
  google_rating: 4.0,
  stroller_score: 5,
  reasoning: "공간이 넓고 유모차 진입이 수월합니다.",
  review_keywords: ["유모차", "경사로"],
  access_policy: "customer_only",
  access_note: "매장 이용 시 제공됩니다.",
  child_summary: "경사로가 있어 유모차로 방문하기 좋습니다.",
  amenities: {
    nursing_room: false,
    diaper_table: false,
    hot_water: false,
    ramp: true,
    baby_chair: true,
    stroller_parking: false,
    wide_doorway: false,
  },
};

describe("spot utilities", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("builds a walking Google Maps route URL", () => {
    const url = buildGoogleMapsUrl([35.1, 139.1], [35.2, 139.2]);

    expect(url).toContain("https://www.google.com/maps/dir/");
    expect(url).toContain("origin=35.1%2C139.1");
    expect(url).toContain("destination=35.2%2C139.2");
    expect(url).toContain("travelmode=walking");
  });

  it("filters spots by search, category, and amenities", () => {
    const result = filterSpots([spot], [35.6706, 139.8165], "호스트", {
      minScore: 4,
      category: "restaurant",
      ramp: true,
      nursingRoom: false,
      diaperTable: false,
      hotWater: false,
      babyChair: true,
      freeOnly: false,
    });

    expect(result).toEqual([spot]);
  });

  it("calculates static tile ids for the current map bounds", () => {
    const tileIds = getTileIdsForBounds(
      {
        south: 35.66,
        west: 139.8,
        north: 35.68,
        east: 139.83,
      },
      13,
      0
    );

    expect(tileIds.length).toBeGreaterThan(0);
    expect(new Set(tileIds).size).toBe(tileIds.length);
  });

  it("filters available tile ids without expanding every possible tile in wide bounds", () => {
    const availableTiles = tileIdsToCoordinates(["1-1", "7275-3228", "7276-3228"]);
    const tileIds = getAvailableTileIdsForBounds(
      {
        south: -80,
        west: -170,
        north: 80,
        east: 170,
      },
      availableTiles,
      13,
      0
    );

    expect(tileIds).toEqual(["7275-3228", "7276-3228"]);
  });

  it("loads a spot tile without requesting the full static dataset", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: { type: "Point", coordinates: [139.8165, 35.6706] },
            properties: spot,
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const spots = await loadSpotTile("7275-3228", 13);

    expect(fetchMock).toHaveBeenCalledWith("/data/spot-tiles/13/7275-3228.json");
    expect(fetchMock).not.toHaveBeenCalledWith("/data/places.json");
    expect(spots[0]).toMatchObject({ id: spot.id, latitude: 35.6706, longitude: 139.8165 });
  });
});

describe("Map", () => {
  afterEach(() => cleanup());

  it("renders markers and popup actions from provided spots", () => {
    render(
      <Map
        center={[35.6706, 139.8165]}
        spots={[spot]}
        selectedSpotId={null}
        currentLocation={null}
        routeStart={null}
        routeEnd={null}
        onCenterChange={vi.fn()}
        onBoundsChange={vi.fn()}
        onSpotSelect={vi.fn()}
        onRouteStartChange={vi.fn()}
        onRouteEndChange={vi.fn()}
      />
    );

    expect(screen.getByTestId("map-container")).toBeInTheDocument();
    expect(screen.getByText("로얄 호스트 토요초점")).toBeInTheDocument();
    expect(screen.getByText("Google 4.0")).toBeInTheDocument();
    expect(screen.getByText("유모차 접근 점수 5/5")).toBeInTheDocument();
    expect(screen.getByText("이동 편의 좋음")).toBeInTheDocument();
    expect(screen.queryByText("유모차 5/5")).not.toBeInTheDocument();
    expect(screen.getByText("출발지로 설정")).toBeInTheDocument();
    expect(screen.getByText("도착지로 설정")).toBeInTheDocument();
  });
});
