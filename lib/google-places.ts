import { env } from "cloudflare:workers";
import {
  calculateDistanceKm,
  type PlaceRecommendation,
  type TravelPlace,
  type TravelStyle,
} from "@/lib/travel-types";

type GoogleMapsEnvironment = {
  GOOGLE_MAPS_API_KEY?: string;
  // Keep the currently configured misspelling working while the secret is renamed.
  GOOLE_MAPS_API_KEY?: string;
};

type GooglePlace = {
  id?: string;
  displayName?: { text?: string };
  primaryType?: string;
  primaryTypeDisplayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  googleMapsUri?: string;
};

type GoogleNearbyResponse = {
  places?: GooglePlace[];
  error?: { message?: string; status?: string };
};

const runtimeEnv = env as unknown as GoogleMapsEnvironment;

const placeTypesByStyle: Record<TravelStyle, string[]> = {
  balanced: [
    "tourist_attraction",
    "historical_landmark",
    "museum",
    "park",
    "restaurant",
    "cafe",
  ],
  culture: [
    "tourist_attraction",
    "historical_landmark",
    "historical_place",
    "cultural_landmark",
    "museum",
    "art_gallery",
    "shinto_shrine",
    "buddhist_temple",
  ],
  food: [
    "restaurant",
    "japanese_restaurant",
    "ramen_restaurant",
    "sushi_restaurant",
    "cafe",
    "bakery",
  ],
  nature: [
    "park",
    "garden",
    "botanical_garden",
    "hiking_area",
    "nature_preserve",
    "scenic_spot",
  ],
};

function getApiKey() {
  return runtimeEnv.GOOGLE_MAPS_API_KEY || runtimeEnv.GOOLE_MAPS_API_KEY || "";
}

function searchCircle(anchors: TravelPlace[]) {
  const center = anchors.reduce(
    (point, place) => ({
      latitude: point.latitude + place.latitude / anchors.length,
      longitude: point.longitude + place.longitude / anchors.length,
    }),
    { latitude: 0, longitude: 0 },
  );
  const centerPlace: TravelPlace = {
    id: "search-center",
    name: "검색 중심",
    category: "",
    description: "",
    suggestedTime: "",
    durationMinutes: 0,
    latitude: center.latitude,
    longitude: center.longitude,
  };
  const farthestAnchorKm = Math.max(
    0,
    ...anchors.map((anchor) => calculateDistanceKm(anchor, centerPlace)),
  );

  return {
    center,
    // Cover all selected anchors while keeping one efficient Nearby Search call.
    radius: Math.min(20_000, Math.max(2_500, (farthestAnchorKm + 2.5) * 1_000)),
  };
}

function durationForStyle(style: TravelStyle) {
  return style === "food" ? 60 : 90;
}

function suggestedTimeForStyle(style: TravelStyle) {
  return style === "food" ? "12:00" : "10:00";
}

export async function searchGoogleNearbyPlaces({
  anchors,
  style,
}: {
  anchors: TravelPlace[];
  style: TravelStyle;
}): Promise<PlaceRecommendation[] | null> {
  const apiKey = getApiKey();
  if (!apiKey) return null;

  const { center, radius } = searchCircle(anchors);
  const response = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": [
        "places.id",
        "places.displayName",
        "places.primaryType",
        "places.primaryTypeDisplayName",
        "places.formattedAddress",
        "places.location",
        "places.googleMapsUri",
      ].join(","),
    },
    body: JSON.stringify({
      includedTypes: placeTypesByStyle[style],
      maxResultCount: 20,
      rankPreference: "POPULARITY",
      languageCode: "ko",
      regionCode: "JP",
      locationRestriction: { circle: { center, radius } },
    }),
  });

  const data = (await response.json().catch(() => ({}))) as GoogleNearbyResponse;
  if (!response.ok) {
    const reason = data.error?.status || `HTTP_${response.status}`;
    throw new Error(`GOOGLE_PLACES_${reason}`);
  }

  return (data.places ?? [])
    .flatMap((place) => {
      const id = place.id?.trim();
      const name = place.displayName?.text?.trim();
      const latitude = place.location?.latitude;
      const longitude = place.location?.longitude;
      if (
        !id ||
        !name ||
        typeof latitude !== "number" ||
        typeof longitude !== "number"
      ) {
        return [];
      }

      const candidate: TravelPlace = {
        id: `google:${id}`,
        name,
        category:
          place.primaryTypeDisplayName?.text?.trim() ||
          place.primaryType?.replaceAll("_", " ") ||
          "추천 장소",
        description: place.formattedAddress?.trim() || "Google Maps 장소 정보",
        suggestedTime: suggestedTimeForStyle(style),
        durationMinutes: durationForStyle(style),
        latitude,
        longitude,
        source: "google",
        externalUrl: place.googleMapsUri,
      };
      const nearest = anchors
        .map((anchor) => ({
          anchor,
          distance: calculateDistanceKm(candidate, anchor),
        }))
        .sort((a, b) => a.distance - b.distance)[0];

      // Avoid recommending the selected attraction back to the user.
      const normalizedName = name.replaceAll(/\s/g, "").toLocaleLowerCase();
      const duplicatesAnchor = anchors.some(
        (anchor) =>
          calculateDistanceKm(candidate, anchor) < 0.08 &&
          anchor.name.replaceAll(/\s/g, "").toLocaleLowerCase() === normalizedName,
      );
      if (duplicatesAnchor || nearest.distance > radius / 1_000) return [];

      return [
        {
          ...candidate,
          distanceKm: Number(nearest.distance.toFixed(1)),
          nearAnchorName: nearest.anchor.name,
        },
      ];
    })
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, 8);
}
