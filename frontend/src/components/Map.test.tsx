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

  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
        })
      )
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

  it("renders the core stroller route panel and requests nearby data", async () => {
    render(<Map />);

    expect(screen.getByRole("heading", { name: "AsobiPlan" })).toBeInTheDocument();
    expect(screen.getByText("Koto-ku Stroller Route")).toBeInTheDocument();
    expect(screen.getByTestId("map-container")).toBeInTheDocument();

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/api/baby-stations?lat=35.6715&lon=139.821"));
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/api/places?lat=35.6715&lon=139.821"));
    });
  });

  it("updates place query parameters when filters change", async () => {
    render(<Map />);

    fireEvent.click(screen.getByRole("button", { name: /상세 필터 설정/ }));
    fireEvent.change(screen.getByRole("slider"), { target: { value: "3" } });
    fireEvent.click(screen.getByLabelText("경사로 보유"));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining("min_score=3&has_ramp=true"));
    });
  });

  it("shows an OSRM route when route calculation succeeds", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/baby-stations")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([
              {
                id: 1,
                name: "출발 수유소",
                address: "출발 주소",
                latitude: 35.6728,
                longitude: 139.8174,
                has_nursing_room: true,
                has_diaper_table: true,
                has_hot_water: false,
                open_hours: "09:00-18:00",
              },
            ]),
          });
        }
        if (url.includes("/api/places")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([
              {
                id: 10,
                name: "도착 카페",
                category: "cafe",
                address: "도착 주소",
                latitude: 35.6701,
                longitude: 139.8302,
                google_rating: 4.2,
                stroller_score: 4,
                reasoning: "넓은 입구",
                review_keywords: ["유모차"],
                has_ramp: true,
                doorway_width: "wide",
                has_baby_chair: true,
                has_stroller_parking: false,
              },
            ]),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            code: "Ok",
            source: "osrm",
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
    fireEvent.click(screen.getByRole("button", { name: "도착" }));

    expect(await screen.findByText("실제 OSRM 도로망 기반")).toBeInTheDocument();
    expect(screen.getByText("1.00 km")).toBeInTheDocument();
    expect(screen.getByTestId("route-polyline")).toBeInTheDocument();
  });

  it("does not draw a fake route when OSRM is unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/baby-stations")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([
              {
                id: 1,
                name: "출발 수유소",
                address: "출발 주소",
                latitude: 35.6728,
                longitude: 139.8174,
                has_nursing_room: true,
                has_diaper_table: true,
                has_hot_water: false,
                open_hours: "09:00-18:00",
              },
            ]),
          });
        }
        if (url.includes("/api/places")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([
              {
                id: 10,
                name: "도착 카페",
                category: "cafe",
                address: "도착 주소",
                latitude: 35.6701,
                longitude: 139.8302,
                google_rating: 4.2,
                stroller_score: 4,
                reasoning: "넓은 입구",
                review_keywords: ["유모차"],
                has_ramp: true,
                doorway_width: "wide",
                has_baby_chair: true,
                has_stroller_parking: false,
              },
            ]),
          });
        }
        return Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ detail: "Routing engine unavailable" }),
        });
      })
    );

    render(<Map />);

    await screen.findByText("출발 수유소");
    fireEvent.click(screen.getByRole("button", { name: "출발" }));
    fireEvent.click(screen.getByRole("button", { name: "도착" }));

    expect(await screen.findByText("OSRM 라우팅 엔진이 꺼져 있어 실제 동선을 계산할 수 없습니다.")).toBeInTheDocument();
    expect(screen.queryByTestId("route-polyline")).not.toBeInTheDocument();
  });
});
