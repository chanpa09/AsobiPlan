import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
  Marker: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Popup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Polyline: () => <div data-testid="route-polyline" />,
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
          name: "출발 수유소",
          address: "출발 주소",
          has_nursing_room: true,
          has_diaper_table: true,
          has_hot_water: false,
          open_hours: "09:00-18:00",
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
        },
      },
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: [139.8240, 35.6710] },
        properties: {
          id: 11,
          name: "계단 카페",
          category: "cafe",
          address: "제외 주소",
          google_rating: 4.0,
          stroller_score: 4,
          reasoning: "경사로 없음",
          review_keywords: ["계단"],
          has_ramp: false,
          doorway_width: "wide",
          has_baby_chair: true,
          has_stroller_parking: false,
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
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("renders the core stroller route panel and requests bundled data", async () => {
    render(<Map />);

    expect(screen.getByRole("heading", { name: "AsobiPlan" })).toBeInTheDocument();
    expect(screen.getByText("Koto-ku Stroller Route")).toBeInTheDocument();
    expect(screen.getByText("Google Maps 길찾기는 앱에서 열리며, 도보 계단 회피는 보장되지 않습니다.")).toBeInTheDocument();
    expect(screen.getByTestId("map-container")).toBeInTheDocument();
    expect(await screen.findByText("출발 수유소")).toBeInTheDocument();
    expect(screen.getByText("도착 카페")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/data/baby-stations.json"));
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/data/places.json"));
  });

  it("filters bundled place data when filters change", async () => {
    render(<Map />);

    expect(await screen.findByText("계단 카페")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /상세 필터 설정/ }));
    fireEvent.change(screen.getByRole("slider"), { target: { value: "3" } });
    fireEvent.click(screen.getByLabelText("경사로 보유"));

    expect(await screen.findByText("도착 카페")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText("계단 카페")).not.toBeInTheDocument();
    });
  });

  it("shows a route when the free route proxy succeeds", async () => {
    vi.stubEnv("NEXT_PUBLIC_ROUTE_API_URL", "https://route-proxy.test/route");
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
          json: () => Promise.resolve({
            code: "Ok",
            source: "ors",
            is_fallback: false,
            routes: [
              {
                geometry: {
                  coordinates: [
                    [139.8174, 35.6728],
                    [139.8302, 35.6701],
                  ],
                  type: "LineString",
                },
                duration: 500,
                distance: 1000,
              },
            ],
          }),
        });
      })
    );

    render(<Map />);

    await screen.findByText("출발 수유소");
    fireEvent.click(screen.getByRole("button", { name: "출발" }));
    await waitFor(() => {
      const googleMapsLink = screen.getAllByRole("link", { name: "Google Maps로 도착 카페 길찾기" })[0];
      expect(googleMapsLink).toHaveAttribute("href", expect.stringContaining("destination=35.6701%2C139.8302"));
      expect(googleMapsLink).toHaveAttribute("href", expect.stringContaining("origin=35.6728%2C139.8174"));
      expect(googleMapsLink).toHaveAttribute("target", "_blank");
    });
    fireEvent.click(screen.getAllByRole("button", { name: "도착" })[0]);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "https://route-proxy.test/route",
        expect.objectContaining({
          headers: { "Content-Type": "application/json" },
          method: "POST",
        })
      );
    });
    const routeCall = vi.mocked(fetch).mock.calls.find(([input]) => input === "https://route-proxy.test/route");
    expect(JSON.parse(routeCall?.[1]?.body as string)).toEqual({
      start: { lat: 35.6728, lon: 139.8174 },
      end: { lat: 35.6701, lon: 139.8302 },
    });
    expect(await screen.findByText("무료 라우팅 API 기반")).toBeInTheDocument();
    expect(screen.getByText("1.00 km")).toBeInTheDocument();
    expect(screen.getByTestId("route-polyline")).toBeInTheDocument();
  });

  it("does not draw a fake route when the route proxy is not configured", async () => {
    render(<Map />);

    await screen.findByText("출발 수유소");
    fireEvent.click(screen.getByRole("button", { name: "출발" }));
    fireEvent.click(screen.getAllByRole("button", { name: "도착" })[0]);

    expect(await screen.findByText("무료 라우팅 프록시가 아직 설정되지 않았습니다. GitHub Pages에서는 Cloudflare Worker URL을 연결해야 합니다.")).toBeInTheDocument();
    expect(screen.queryByTestId("route-polyline")).not.toBeInTheDocument();
  });
});
