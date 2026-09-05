import { env } from "cloudflare:workers";
import type { TransportMode, TravelPlace } from "@/lib/travel-types";

type GoogleMapsEnvironment = {
  GOOGLE_MAPS_API_KEY?: string;
  GOOLE_MAPS_API_KEY?: string;
};

type RouteLeg = {
  duration?: string;
  distanceMeters?: number;
};

type ComputeRoutesResponse = {
  routes?: Array<{
    duration?: string;
    distanceMeters?: number;
    legs?: RouteLeg[];
    optimizedIntermediateWaypointIndex?: number[];
  }>;
  error?: { status?: string; message?: string };
};

type RouteMatrixElement = {
  originIndex?: number;
  destinationIndex?: number;
  duration?: string;
  distanceMeters?: number;
  condition?: string;
  status?: { code?: number; message?: string };
};

export type OptimizedDayRoute = {
  places: TravelPlace[];
  legMinutes: number[];
  legDistancesKm: number[];
  totalMinutes: number;
  totalDistanceKm: number;
};

const runtimeEnv = env as unknown as GoogleMapsEnvironment;

function apiKey() {
  return runtimeEnv.GOOGLE_MAPS_API_KEY || runtimeEnv.GOOLE_MAPS_API_KEY || "";
}

function waypoint(place: TravelPlace) {
  return {
    location: {
      latLng: {
        latitude: place.latitude,
        longitude: place.longitude,
      },
    },
  };
}

function secondsToMinutes(value?: string) {
  const seconds = Number(value?.replace(/s$/, ""));
  return Number.isFinite(seconds) ? Math.max(0, Math.round(seconds / 60)) : 0;
}

function travelMode(mode: TransportMode) {
  if (mode === "walking") return "WALK";
  if (mode === "driving") return "DRIVE";
  return "TRANSIT";
}

function transitDepartureTime(mode: TransportMode) {
  // Giving transit a small scheduling buffer avoids asking for a journey whose
  // first departure has already passed while the request is being processed.
  return mode === "transit"
    ? { departureTime: new Date(Date.now() + 5 * 60 * 1_000).toISOString() }
    : {};
}

export type RouteMatrixMatch = {
  placeId: string;
  originId: string;
  minutes: number;
  distanceKm: number;
};

export async function getNearestTravelTimes({
  origins,
  destinations,
  transport,
}: {
  origins: TravelPlace[];
  destinations: TravelPlace[];
  transport: TransportMode;
}): Promise<RouteMatrixMatch[] | null> {
  const key = apiKey();
  if (!key || origins.length === 0 || destinations.length === 0) return null;

  const limitedOrigins = origins.slice(0, 6);
  // Transit matrices support up to 100 origin-destination elements. Keeping the
  // same bound for every mode also makes the recommendation cost predictable.
  const maxDestinations = Math.max(1, Math.floor(96 / limitedOrigins.length));
  const limitedDestinations = destinations.slice(0, maxDestinations);
  const response = await fetch(
    "https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": [
          "originIndex",
          "destinationIndex",
          "duration",
          "distanceMeters",
          "status",
          "condition",
        ].join(","),
      },
      body: JSON.stringify({
        origins: limitedOrigins.map((place) => ({ waypoint: waypoint(place) })),
        destinations: limitedDestinations.map((place) => ({ waypoint: waypoint(place) })),
        travelMode: travelMode(transport),
        ...(transport === "driving" ? { routingPreference: "TRAFFIC_AWARE" } : {}),
        ...transitDepartureTime(transport),
        languageCode: "ko",
        regionCode: "JP",
        units: "METRIC",
      }),
    },
  );

  const data = (await response.json().catch(() => [])) as RouteMatrixElement[] | {
    error?: { status?: string };
  };
  if (!response.ok || !Array.isArray(data)) {
    const reason = !Array.isArray(data) && data.error?.status
      ? data.error.status
      : `HTTP_${response.status}`;
    throw new Error(`GOOGLE_ROUTE_MATRIX_${reason}`);
  }

  const bestByDestination = new Map<number, RouteMatrixElement>();
  data.forEach((element) => {
    if (
      element.condition !== "ROUTE_EXISTS" ||
      typeof element.originIndex !== "number" ||
      typeof element.destinationIndex !== "number"
    ) return;
    const current = bestByDestination.get(element.destinationIndex);
    if (!current || secondsToMinutes(element.duration) < secondsToMinutes(current.duration)) {
      bestByDestination.set(element.destinationIndex, element);
    }
  });

  return limitedDestinations.flatMap((place, destinationIndex) => {
    const best = bestByDestination.get(destinationIndex);
    if (!best || typeof best.originIndex !== "number") return [];
    const origin = limitedOrigins[best.originIndex];
    if (!origin) return [];
    return [{
      placeId: place.id,
      originId: origin.id,
      minutes: secondsToMinutes(best.duration),
      distanceKm: Number(((best.distanceMeters ?? 0) / 1_000).toFixed(1)),
    }];
  });
}

export async function optimizeDayWithGoogle({
  places,
  startLocation,
  transport,
}: {
  places: TravelPlace[];
  startLocation: string;
  transport: TransportMode;
}): Promise<OptimizedDayRoute | null> {
  const key = apiKey();
  if (!key || places.length === 0) return null;

  const hasStartLocation = startLocation.trim().length > 0;
  const origin = hasStartLocation
    ? { address: startLocation.trim() }
    : waypoint(places[0]);
  const destination = waypoint(places[places.length - 1]);
  const intermediatePlaces = hasStartLocation ? places.slice(0, -1) : places.slice(1, -1);
  const canOptimize = transport !== "transit" && intermediatePlaces.length > 1;

  const response = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": [
        "routes.duration",
        "routes.distanceMeters",
        "routes.legs.duration",
        "routes.legs.distanceMeters",
        "routes.optimizedIntermediateWaypointIndex",
      ].join(","),
    },
    body: JSON.stringify({
      origin,
      destination,
      intermediates: intermediatePlaces.map(waypoint),
      travelMode: travelMode(transport),
      optimizeWaypointOrder: canOptimize,
      ...transitDepartureTime(transport),
      languageCode: "ko",
      units: "METRIC",
    }),
  });

  const data = (await response.json().catch(() => ({}))) as ComputeRoutesResponse;
  if (!response.ok) {
    const reason = data.error?.status || `HTTP_${response.status}`;
    throw new Error(`GOOGLE_ROUTES_${reason}`);
  }
  const route = data.routes?.[0];
  if (!route) return null;

  const optimizedIntermediatePlaces = route.optimizedIntermediateWaypointIndex?.length
    ? route.optimizedIntermediateWaypointIndex.map((index) => intermediatePlaces[index])
    : intermediatePlaces;
  const orderedPlaces = hasStartLocation
    ? [...optimizedIntermediatePlaces, places[places.length - 1]]
    : [places[0], ...optimizedIntermediatePlaces, places[places.length - 1]].filter(
        (place, index, list) => index === 0 || place.id !== list[index - 1]?.id,
      );
  const routeLegs = route.legs ?? [];
  const legOffset = hasStartLocation ? 0 : 1;

  return {
    places: orderedPlaces,
    legMinutes: orderedPlaces.map((_, index) =>
      index === 0 && !hasStartLocation
        ? 0
        : secondsToMinutes(routeLegs[index - legOffset]?.duration),
    ),
    legDistancesKm: orderedPlaces.map((_, index) =>
      index === 0 && !hasStartLocation
        ? 0
        : Number(((routeLegs[index - legOffset]?.distanceMeters ?? 0) / 1_000).toFixed(1)),
    ),
    totalMinutes: secondsToMinutes(route.duration),
    totalDistanceKm: Number(((route.distanceMeters ?? 0) / 1_000).toFixed(1)),
  };
}
