import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import Map from "./Map";

vi.mock("leaflet", () => ({
  default: {
    divIcon: vi.fn((options) => ({ options })),
  },
}));

vi.mock("react-leaflet", () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="map-container">{children}</div>
  ),
  Marker: ({ children }: { children?: React.ReactNode }) => <div data-testid="map-marker">{children}</div>,
  Popup: ({ children }: { children: React.ReactNode }) => <div data-testid="map-popup">{children}</div>,
  TileLayer: () => null,
  useMap: () => ({
    getZoom: () => 15,
    setView: vi.fn(),
  }),
  useMapEvents: vi.fn(),
}));

describe("Map", () => {
  const registerServiceWorker = vi.fn(() =>
    Promise.resolve({
      scope: "/",
      update: vi.fn(() => Promise.resolve()),
    })
  );

  const stationCollection = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: [139.8174, 35.6728] },
        properties: {
          id: 1,
          name: "고토구청 본청사",
          category: "public_facility",
          address: "출발 주소",
          has_nursing_room: true,
          has_diaper_table: true,
          has_hot_water: false,
          open_hours: "09:00-18:00",
          access_policy: "public_free",
          access_note: "구매 없이 이용 가능한 편의공간입니다.",
        },
      },
    ],
  };

  const placeCollection = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: [139.8302, 35.6701] },
        properties: {
          id: 10,
          name: "도착 카페",
          category: "cafe",
          address: "도착 주소",
          google_rating: 4.2,
          stroller_score: 4,
          reasoning: "넓은 입구",
          review_keywords: ["유모차"],
          has_ramp: true,
          doorway_width: "wide",
          has_baby_chair: true,
          has_stroller_parking: false,
          access_policy: "customer_only",
          access_note: "매장 이용 시 제공됩니다.",
        },
      },
    ],
  };

  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/data/baby-stations.json")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(stationCollection),
          });
        }
        if (url.includes("/data/places.json")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(placeCollection),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
        });
      })
    );

    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        register: registerServiceWorker,
      },
    });
  });

  afterEach(() => {
    cleanup();
    registerServiceWorker.mockClear();
    vi.unstubAllGlobals();
  });

  it("renders MapContainer and loads static data", async () => {
    render(<Map />);

    expect(screen.getByTestId("map-container")).toBeInTheDocument();
    
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/data/baby-stations.json"));
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/data/places.json"));
    });
  });
});
