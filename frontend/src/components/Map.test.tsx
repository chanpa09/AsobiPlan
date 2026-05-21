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
});
