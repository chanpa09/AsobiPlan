type RouteRequest = {
  start: { lat: number; lon: number };
  end: { lat: number; lon: number };
};

type Env = {
  ORS_API_KEY: string;
  ALLOWED_ORIGIN?: string;
};

const corsHeaders = (origin: string) => ({
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Vary": "Origin",
});

const jsonResponse = (body: unknown, status: number, origin: string) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(origin),
    },
  });

const isFiniteCoordinate = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value);

const getAllowedOrigin = (request: Request, env: Env) => {
  if (!env.ALLOWED_ORIGIN) {
    return null;
  }

  const requestOrigin = request.headers.get("Origin");
  if (requestOrigin && requestOrigin !== env.ALLOWED_ORIGIN) {
    return null;
  }

  return env.ALLOWED_ORIGIN;
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = getAllowedOrigin(request, env);
    if (!origin) {
      return jsonResponse({ detail: "Allowed origin is not configured or not permitted" }, 403, "null");
    }

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (request.method !== "POST") {
      return jsonResponse({ detail: "Method not allowed" }, 405, origin);
    }

    if (!env.ORS_API_KEY) {
      return jsonResponse({ detail: "OpenRouteService API key is not configured" }, 500, origin);
    }

    const payload = await request.json().catch(() => null) as RouteRequest | null;
    if (
      !payload ||
      !isFiniteCoordinate(payload.start?.lat) ||
      !isFiniteCoordinate(payload.start?.lon) ||
      !isFiniteCoordinate(payload.end?.lat) ||
      !isFiniteCoordinate(payload.end?.lon)
    ) {
      return jsonResponse({ detail: "Invalid route coordinates" }, 400, origin);
    }

    const orsResponse = await fetch("https://api.openrouteservice.org/v2/directions/foot-walking/geojson", {
      method: "POST",
      headers: {
        "Authorization": env.ORS_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        coordinates: [
          [payload.start.lon, payload.start.lat],
          [payload.end.lon, payload.end.lat],
        ],
        instructions: true,
        preference: "recommended",
        options: {
          avoid_features: ["steps"],
        },
      }),
    });

    const orsData = await orsResponse.json().catch(() => null);
    if (!orsResponse.ok || !orsData?.features?.[0]) {
      return jsonResponse({ detail: "Route calculation failed", upstream: orsData }, 502, origin);
    }

    const feature = orsData.features[0];
    const summary = feature.properties?.summary || {};
    return jsonResponse({
      code: "Ok",
      source: "ors",
      is_fallback: false,
      routes: [
        {
          geometry: feature.geometry,
          duration: summary.duration ?? 0,
          distance: summary.distance ?? 0,
          segments: feature.properties?.segments || [],
        },
      ],
    }, 200, origin);
  },
};
