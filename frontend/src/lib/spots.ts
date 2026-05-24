"use client";

export type MarkerPosition = [number, number];
export type SpotSource = "care" | "place";
export type SpotCategory = "public_facility" | "mall" | "station" | "restaurant" | "cafe" | "park";
export type AccessPolicy = "public_free" | "customer_only" | "paid_entry" | "ask_staff" | "unknown";

export type MapBounds = {
  south: number;
  west: number;
  north: number;
  east: number;
};

export interface BabyStation {
  id: number;
  name: string;
  category?: SpotCategory;
  address: string;
  latitude: number;
  longitude: number;
  has_nursing_room: boolean;
  has_diaper_table: boolean;
  has_hot_water: boolean;
  open_hours: string;
  access_policy?: AccessPolicy;
  access_note?: string;
  source_name?: string;
  source_url?: string;
  last_verified_at?: string;
  verification_method?: "official_csv" | "manual_checked" | "geocoded";
  confidence?: "official" | "manual_checked" | "unknown";
  floor?: string;
  location_note?: string;
  inside_of?: string;
  geocode_status?: "confirmed" | "pending" | "failed";
  coordinate_match?: "name_and_address" | "name_only" | "address_only" | "manual_geocode";
  available_days?: string;
  target_users?: string;
  nearest_station?: string;
  nursing_room_lock?: string;
  switch_url?: string;
  tel?: string;
  female_only?: boolean;
  key_required?: boolean;
}

export interface Place {
  id: number;
  name: string;
  category: SpotCategory;
  address: string;
  latitude: number;
  longitude: number;
  google_rating?: number;
  stroller_score: number;
  reasoning: string;
  review_keywords: string[];
  has_ramp: boolean;
  doorway_width: string;
  has_baby_chair: boolean;
  has_stroller_parking: boolean;
  has_nursing_room?: boolean;
  has_diaper_table?: boolean;
  has_hot_water?: boolean;
  open_hours?: string;
  access_policy?: AccessPolicy;
  access_note?: string;
  child_summary?: string;
  google_place_id?: string;
  source_name?: string;
  source_url?: string;
  last_verified_at?: string;
  confidence?: "official" | "manual_checked" | "unknown";
  user_ratings_total?: number;
  osm_id?: string;
  osm_tags?: Record<string, string>;
}

export type PointFeature<T> = {
  type: "Feature";
  geometry: {
    type: "Point";
    coordinates: [number, number];
  };
  properties: Omit<T, "latitude" | "longitude">;
};

export type FeatureCollection<T> = {
  type: "FeatureCollection";
  features: PointFeature<T>[];
};

export type Spot = {
  id: string;
  source: SpotSource;
  name: string;
  category: SpotCategory;
  address: string;
  latitude: number;
  longitude: number;
  google_rating?: number;
  stroller_score: number;
  reasoning: string;
  review_keywords: string[];
  open_hours?: string;
  access_policy: AccessPolicy;
  access_note: string;
  doorway_width?: "wide" | "medium" | "narrow";
  child_summary: string;
  source_name?: string;
  source_url?: string;
  last_verified_at?: string;
  confidence?: "official" | "manual_checked" | "unknown";
  osm_id?: string;
  amenities: {
    nursing_room: boolean;
    diaper_table: boolean;
    hot_water: boolean;
    ramp: boolean;
    baby_chair: boolean;
    stroller_parking: boolean;
    wide_doorway: boolean;
  };
};

export type SpotTileFeature = {
  type: "Feature";
  geometry: {
    type: "Point";
    coordinates: [number, number];
  };
  properties: Omit<Spot, "latitude" | "longitude">;
};

export type SpotTileManifest = {
  tileZoom: number;
  tiles: string[];
  includedFeatures: number;
  excludedFeatures: number;
  sourceCounts: {
    babyStations: number;
    places: number;
    total: number;
  };
  criteria: string;
};

export type TileCoordinate = {
  id: string;
  x: number;
  y: number;
};

export type SpotFilters = {
  minScore: number;
  category: SpotCategory | "";
  ramp: boolean;
  nursingRoom: boolean;
  diaperTable: boolean;
  hotWater: boolean;
  babyChair: boolean;
  freeOnly: boolean;
};

export const DEFAULT_CENTER: MarkerPosition = [35.6698, 139.8174];
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

export const CATEGORY_LABELS: Record<SpotCategory, string> = {
  public_facility: "공공시설",
  mall: "상업시설",
  station: "역",
  restaurant: "음식점",
  cafe: "카페",
  park: "공원",
};

export const ACCESS_POLICY_LABELS: Record<AccessPolicy, string> = {
  public_free: "무료 개방",
  customer_only: "매장 이용 필요",
  paid_entry: "입장료 필요",
  ask_staff: "직원 문의",
  unknown: "확인 필요",
};

export const AMENITY_LABELS: Record<keyof Spot["amenities"], { label: string; icon: string }> = {
  nursing_room: { label: "수유실", icon: "baby_changing_station" },
  diaper_table: { label: "기저귀 교환대", icon: "crib" },
  hot_water: { label: "온수", icon: "water_drop" },
  ramp: { label: "경사로", icon: "accessible_forward" },
  baby_chair: { label: "아기의자", icon: "child_care" },
  stroller_parking: { label: "유모차주차", icon: "stroller" },
  wide_doorway: { label: "넓은출입문", icon: "sensor_door" },
};

export type MobilityLevel = {
  label: "좋음" | "보통" | "주의";
  description: "이동 편의 좋음" | "이동 편의 보통" | "이동 주의";
  tone: "positive" | "neutral" | "warning";
};

export type ReviewKeywordTone = "positive" | "warning" | "neutral";

export const getMobilityLevel = (score: number): MobilityLevel => {
  if (score >= 5) {
    return { label: "좋음", description: "이동 편의 좋음", tone: "positive" };
  }
  if (score >= 4) {
    return { label: "보통", description: "이동 편의 보통", tone: "neutral" };
  }
  return { label: "주의", description: "이동 주의", tone: "warning" };
};

export const getReviewKeywordTone = (keyword: string): ReviewKeywordTone => {
  if (["턱있음", "좁음", "계단있음"].includes(keyword)) return "warning";
  if (["경사로", "엘리베이터", "넓은통로", "유모차", "이유식"].includes(keyword)) return "positive";
  return "neutral";
};

export const getSpotPrimarySummary = (spot: Spot) => {
  if (spot.source === "care") {
    const hasNursing = spot.amenities.nursing_room;
    const hasDiaper = spot.amenities.diaper_table;
    if (hasNursing && hasDiaper) return "수유·기저귀 가능";
    if (hasNursing) return "수유 가능";
    if (hasDiaper) return "기저귀 교환 가능";
    return "돌봄 정보 확인 필요";
  }

  return getMobilityLevel(spot.stroller_score).description;
};

export const getGoogleRatingLabel = (spot: Spot) => {
  if (!spot.google_rating) return null;
  return `Google ${spot.google_rating.toFixed(1)}`;
};

const AMENITY_PRIORITY: Record<SpotSource, Array<keyof Spot["amenities"]>> = {
  care: ["nursing_room", "diaper_table", "hot_water", "ramp", "wide_doorway", "stroller_parking", "baby_chair"],
  place: ["ramp", "wide_doorway", "stroller_parking", "baby_chair", "nursing_room", "diaper_table", "hot_water"],
};

export const getVisibleAmenityTags = (spot: Spot, limit = 5) =>
  AMENITY_PRIORITY[spot.source]
    .filter((key) => spot.amenities[key])
    .slice(0, limit)
    .map((key) => ({ key, ...AMENITY_LABELS[key] }));

export const toDataUrl = (path: string) => `${BASE_PATH}${path}`;

export const featureToRecord = <T extends { latitude: number; longitude: number }>(feature: PointFeature<T>): T => {
  const [longitude, latitude] = feature.geometry.coordinates;
  return {
    ...feature.properties,
    latitude,
    longitude,
  } as T;
};

export const spotTileFeatureToSpot = (feature: SpotTileFeature): Spot => {
  const [longitude, latitude] = feature.geometry.coordinates;
  return {
    ...feature.properties,
    latitude,
    longitude,
  };
};

export const haversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const radius = 6371000;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(deltaPhi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export const buildGoogleMapsUrl = (origin: MarkerPosition, destination: MarkerPosition) => {
  const params = new URLSearchParams({
    api: "1",
    origin: `${origin[0]},${origin[1]}`,
    destination: `${destination[0]},${destination[1]}`,
    travelmode: "walking",
  });

  return `https://www.google.com/maps/dir/?${params.toString()}`;
};

export const toCareSpot = (station: BabyStation): Spot => ({
  id: `care-${station.id}`,
  source: "care",
  name: station.name,
  category: station.category || "public_facility",
  address: station.address,
  latitude: station.latitude,
  longitude: station.longitude,
  stroller_score: 5,
  reasoning: "수유실·기저귀 교환 등 아이 돌봄 편의공간입니다.",
  review_keywords: [],
  open_hours: station.open_hours,
  access_policy: station.access_policy || "unknown",
  access_note: station.access_note || "이용 조건을 현장에서 확인해 주세요.",
  doorway_width: "wide",
  child_summary: station.access_note || "수유실과 기저귀 교환대가 갖춰진 편리한 아기 돌봄 공간입니다.",
  source_name: station.source_name,
  source_url: station.source_url,
  last_verified_at: station.last_verified_at,
  confidence: station.confidence,
  amenities: {
    nursing_room: station.has_nursing_room,
    diaper_table: station.has_diaper_table,
    hot_water: station.has_hot_water,
    ramp: false,
    baby_chair: false,
    stroller_parking: false,
    wide_doorway: true,
  },
});

export const buildChildSummary = (place: Place): string => {
  const hasRamp = place.has_ramp;
  const hasBabyChair = place.has_baby_chair;
  const strollerScore = place.stroller_score;

  if (strollerScore >= 5) {
    if (hasRamp && hasBabyChair) {
      return "경사로와 아기의자가 있어 유모차를 타는 아이와 함께 이용하기 아주 좋은 곳이에요.";
    }
    return "유모차 이동 공간이 넓고 쾌적하여 아이 동반 방문을 적극 추천해 드려요.";
  } else if (strollerScore >= 4) {
    if (hasRamp) {
      return "경사로가 있어 진입은 수월하지만 내부 공간에 약간의 제약이 있을 수 있어요.";
    }
    return "대체로 아이와 이용하기 괜찮으나, 일부 턱이나 좁은 입구에 유의하세요.";
  } else {
    return "유모차 진입 공간이 좁거나 턱이 있어 사전에 확인 후 방문하는 것을 권장해요.";
  }
};

export const toPlaceSpot = (place: Place): Spot => ({
  id: `place-${place.id}`,
  source: "place",
  name: place.name,
  category: place.category,
  address: place.address,
  latitude: place.latitude,
  longitude: place.longitude,
  google_rating: place.google_rating,
  stroller_score: place.stroller_score,
  reasoning: place.reasoning,
  review_keywords: place.review_keywords,
  open_hours: place.open_hours,
  access_policy: place.access_policy || "unknown",
  access_note: place.access_note || "이용 조건을 현장에서 확인해 주세요.",
  doorway_width: place.doorway_width as Spot["doorway_width"],
  child_summary: place.child_summary || buildChildSummary(place),
  source_name: place.source_name,
  source_url: place.source_url,
  last_verified_at: place.last_verified_at,
  confidence: place.confidence,
  osm_id: place.osm_id,
  amenities: {
    nursing_room: Boolean(place.has_nursing_room),
    diaper_table: Boolean(place.has_diaper_table),
    hot_water: Boolean(place.has_hot_water),
    ramp: place.has_ramp,
    baby_chair: place.has_baby_chair,
    stroller_parking: place.has_stroller_parking,
    wide_doorway: place.doorway_width === "wide",
  },
});

export const filterSpots = (
  spots: Spot[],
  center: MarkerPosition,
  searchQuery: string,
  filters: SpotFilters,
  radiusMeters = 3500
) => {
  const query = searchQuery.trim().toLowerCase();

  return spots.filter((spot) => {
    if (haversineDistance(center[0], center[1], spot.latitude, spot.longitude) > radiusMeters) return false;
    if (spot.stroller_score < filters.minScore) return false;
    if (filters.category && spot.category !== filters.category) return false;
    if (filters.ramp && !spot.amenities.ramp) return false;
    if (filters.nursingRoom && !spot.amenities.nursing_room) return false;
    if (filters.diaperTable && !spot.amenities.diaper_table) return false;
    if (filters.hotWater && !spot.amenities.hot_water) return false;
    if (filters.babyChair && !spot.amenities.baby_chair) return false;
    if (filters.freeOnly && spot.access_policy !== "public_free") return false;

    if (query) {
      const matchesName = spot.name.toLowerCase().includes(query);
      const matchesAddress = spot.address.toLowerCase().includes(query);
      const matchesKeyword = spot.review_keywords.some((keyword) => keyword.toLowerCase().includes(query));
      if (!matchesName && !matchesAddress && !matchesKeyword) return false;
    }

    return true;
  });
};

export const lonToTileX = (longitude: number, zoom: number) => Math.floor(((longitude + 180) / 360) * 2 ** zoom);

export const latToTileY = (latitude: number, zoom: number) => {
  const latRad = (latitude * Math.PI) / 180;
  return Math.floor(((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2) * 2 ** zoom);
};

export const getTileIdsForBounds = (bounds: MapBounds, zoom: number, padding = 1) => {
  const minX = lonToTileX(bounds.west, zoom) - padding;
  const maxX = lonToTileX(bounds.east, zoom) + padding;
  const minY = latToTileY(bounds.north, zoom) - padding;
  const maxY = latToTileY(bounds.south, zoom) + padding;
  const tileIds: string[] = [];

  for (let x = minX; x <= maxX; x += 1) {
    for (let y = minY; y <= maxY; y += 1) {
      tileIds.push(`${x}-${y}`);
    }
  }

  return tileIds;
};

export const tileIdsToCoordinates = (tileIds: string[]): TileCoordinate[] =>
  tileIds.flatMap((id) => {
    const [xText, yText] = id.split("-");
    const x = Number(xText);
    const y = Number(yText);
    if (!Number.isInteger(x) || !Number.isInteger(y)) return [];
    return [{ id, x, y }];
  });

export const getAvailableTileIdsForBounds = (bounds: MapBounds, tileCoordinates: TileCoordinate[], zoom: number, padding = 1) => {
  const minX = lonToTileX(bounds.west, zoom) - padding;
  const maxX = lonToTileX(bounds.east, zoom) + padding;
  const minY = latToTileY(bounds.north, zoom) - padding;
  const maxY = latToTileY(bounds.south, zoom) + padding;

  return tileCoordinates
    .filter((tile) => tile.x >= minX && tile.x <= maxX && tile.y >= minY && tile.y <= maxY)
    .map((tile) => tile.id);
};

export const loadSpotTileManifest = async (): Promise<SpotTileManifest> => {
  const response = await fetch(toDataUrl("/data/spot-tiles/manifest.json"));
  if (!response.ok) {
    throw new Error("Spot tile manifest unavailable");
  }
  return (await response.json()) as SpotTileManifest;
};

export const loadSpotTile = async (tileId: string, zoom: number): Promise<Spot[]> => {
  const response = await fetch(toDataUrl(`/data/spot-tiles/${zoom}/${tileId}.json`));
  if (!response.ok) {
    throw new Error(`Spot tile unavailable: ${tileId}`);
  }
  const data = (await response.json()) as FeatureCollection<Spot>;
  return (data.features as unknown as SpotTileFeature[]).map(spotTileFeatureToSpot);
};
