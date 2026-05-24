import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import PlaceCard from "./PlaceCard";
import type { Spot } from "@/lib/spots";

const spot: Spot = {
  id: "place-1",
  source: "place",
  name: "Open Cafe",
  category: "cafe",
  address: "Tokyo",
  latitude: 35.6706,
  longitude: 139.8165,
  stroller_score: 4,
  reasoning: "공개 지도 접근성 정보상 유모차 진입이 비교적 수월한 장소예요.",
  review_keywords: ["휠체어 접근"],
  access_policy: "customer_only",
  access_note: "세부 이용 조건은 현장에서 확인해 주세요.",
  child_summary: "아이와 함께 방문 후보로 볼 수 있는 장소예요.",
  source_name: "OpenStreetMap",
  source_url: "https://www.openstreetmap.org/copyright",
  last_verified_at: "2026-05-23",
  confidence: "manual_checked",
  amenities: {
    nursing_room: false,
    diaper_table: false,
    hot_water: false,
    ramp: true,
    baby_chair: false,
    stroller_parking: false,
    wide_doorway: true,
  },
};

describe("PlaceCard", () => {
  afterEach(() => cleanup());

  it("shows source metadata when the card is active", () => {
    render(
      <PlaceCard
        spot={spot}
        active
        routeStart={null}
        routeEnd={null}
        onSelect={vi.fn()}
        onSetStart={vi.fn()}
        onSetEnd={vi.fn()}
      />
    );

    expect(screen.getByRole("link", { name: "OpenStreetMap" })).toHaveAttribute(
      "href",
      "https://www.openstreetmap.org/copyright"
    );
    expect(screen.getByText("검증일: 2026-05-23")).toBeInTheDocument();
    expect(screen.getByText("신뢰도: 수동 확인")).toBeInTheDocument();
  });
});
