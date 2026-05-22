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
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: [139.8240, 35.6710] },
        properties: {
          id: 11,
          name: "무료 공원",
          category: "park",
          address: "공원 주소",
          google_rating: 4.0,
          stroller_score: 4,
          reasoning: "평탄한 공원",
          review_keywords: ["공원"],
          has_ramp: true,
          doorway_width: "wide",
          has_baby_chair: false,
          has_stroller_parking: false,
          access_policy: "public_free",
          access_note: "무료 개방 공간입니다.",
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

  it("renders care facilities and normal places as one unified place list", async () => {
    render(<Map />);

    expect(screen.getByRole("heading", { name: "AsobiPlan" })).toBeInTheDocument();
    expect(screen.getByText("출발지와 도착지를 모두 선택한 뒤 Google Maps에서 도보 길찾기를 엽니다. 계단 회피는 보장되지 않습니다.")).toBeInTheDocument();
    expect(screen.getByText("출발지와 도착지를 선택하세요")).toBeInTheDocument();
    expect(screen.getByTestId("map-container")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getAllByText("고토구청 본청사").length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText("도착 카페").length).toBeGreaterThan(0);
    expect(screen.getAllByText("무료 개방").length).toBeGreaterThan(0);
    expect(screen.getAllByText("매장 이용 필요").length).toBeGreaterThan(0);
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/data/baby-stations.json"));
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/data/places.json"));
  });

  it("gives every listed place both start and destination actions", async () => {
    render(<Map />);

    await waitFor(() => {
      expect(screen.getAllByText("고토구청 본청사").length).toBeGreaterThan(0);
    });
    expect(screen.getAllByRole("button", { name: "출발" }).length).toBeGreaterThanOrEqual(3);
    expect(screen.getAllByRole("button", { name: "도착" }).length).toBeGreaterThanOrEqual(3);
  });

  it("filters by care amenities and free access policy", async () => {
    render(<Map />);

    await waitFor(() => {
      expect(screen.getAllByText("도착 카페").length).toBeGreaterThan(0);
    });
    fireEvent.click(screen.getByRole("button", { name: /상세 필터 설정/ }));
    fireEvent.click(screen.getByLabelText("수유실 있음"));

    await waitFor(() => {
      expect(screen.getAllByText("고토구청 본청사").length).toBeGreaterThan(0);
    });
    await waitFor(() => {
      expect(screen.queryByText("도착 카페")).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText("수유실 있음"));
    fireEvent.click(screen.getByLabelText("무료 개방만"));

    await waitFor(() => {
      expect(screen.getAllByText("고토구청 본청사").length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText("무료 공원").length).toBeGreaterThan(0);
    expect(screen.queryByText("도착 카페")).not.toBeInTheDocument();
  });

  it("opens Google Maps only after start and end are selected", async () => {
    render(<Map />);

    await waitFor(() => {
      expect(screen.getAllByText("고토구청 본청사").length).toBeGreaterThan(0);
    });
    expect(screen.queryByRole("link", { name: "Google Maps에서 선택한 출발지와 도착지 길찾기" })).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "출발" })[0]);
    expect(screen.queryByRole("link", { name: "Google Maps에서 선택한 출발지와 도착지 길찾기" })).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "도착" })[1]);

    const googleMapsLink = await screen.findByRole("link", { name: "Google Maps에서 선택한 출발지와 도착지 길찾기" });
    expect(googleMapsLink).toHaveAttribute("href", expect.stringContaining("origin=35.6728%2C139.8174"));
    expect(googleMapsLink).toHaveAttribute("href", expect.stringContaining("destination=35.6701%2C139.8302"));
    expect(googleMapsLink).toHaveAttribute("href", expect.stringContaining("travelmode=walking"));
    expect(googleMapsLink).toHaveAttribute("target", "_blank");
    expect(screen.getByText("선택한 좌표는 지도에서 드래그해 조정할 수 있습니다.")).toBeInTheDocument();
  });
});
