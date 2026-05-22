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
    expect(screen.getByText("출발지와 도착지를 모두 선택한 뒤 Google Maps에서 도보 길찾기를 엽니다. 계단 회피는 보장되지 않습니다.")).toBeInTheDocument();
    expect(screen.getByText("출발지와 도착지를 선택하세요")).toBeInTheDocument();
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

  it("opens Google Maps only after start and end are selected", async () => {
    render(<Map />);

    await screen.findByText("출발 수유소");
    expect(screen.queryByRole("link", { name: "Google Maps에서 선택한 출발지와 도착지 길찾기" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "출발" }));
    expect(screen.queryByRole("link", { name: "Google Maps에서 선택한 출발지와 도착지 길찾기" })).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "도착" })[0]);

    const googleMapsLink = await screen.findByRole("link", { name: "Google Maps에서 선택한 출발지와 도착지 길찾기" });
    expect(googleMapsLink).toHaveAttribute("href", expect.stringContaining("origin=35.6728%2C139.8174"));
    expect(googleMapsLink).toHaveAttribute("href", expect.stringContaining("destination=35.6701%2C139.8302"));
    expect(googleMapsLink).toHaveAttribute("href", expect.stringContaining("travelmode=walking"));
    expect(googleMapsLink).toHaveAttribute("target", "_blank");
    expect(screen.getByText("선택한 좌표는 지도에서 드래그해 조정할 수 있습니다.")).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalledWith("https://route-proxy.test/route", expect.anything());
  });

  it("clears selected start and end without drawing an in-app route", async () => {
    render(<Map />);

    await screen.findByText("출발 수유소");
    fireEvent.click(screen.getByRole("button", { name: "출발" }));
    fireEvent.click(screen.getAllByRole("button", { name: "도착" })[0]);

    expect(await screen.findByRole("link", { name: "Google Maps에서 선택한 출발지와 도착지 길찾기" })).toBeInTheDocument();
    expect(screen.queryByTestId("route-polyline")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "선택 해제" }));
    expect(screen.queryByRole("link", { name: "Google Maps에서 선택한 출발지와 도착지 길찾기" })).not.toBeInTheDocument();
    expect(screen.getByText("출발지와 도착지를 선택하세요")).toBeInTheDocument();
  });
});
