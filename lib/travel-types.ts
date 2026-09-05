export const travelStyles = ["balanced", "culture", "food", "nature"] as const;
export type TravelStyle = (typeof travelStyles)[number];
export type RecommendationKind = "attractions" | "food";

export const companionTypes = ["solo", "couple", "family", "parents"] as const;
export type CompanionType = (typeof companionTypes)[number];

export const travelPaces = ["relaxed", "balanced", "packed"] as const;
export type TravelPace = (typeof travelPaces)[number];

export const travelBudgets = ["value", "standard", "premium"] as const;
export type TravelBudget = (typeof travelBudgets)[number];

export const transportModes = ["walking", "transit", "driving"] as const;
export type TransportMode = (typeof transportModes)[number];

export type PlanPreferences = {
  startDate: string;
  dayCount: number;
  startLocation: string;
  companion: CompanionType;
  pace: TravelPace;
  budget: TravelBudget;
  transport: TransportMode;
  includeMeals: boolean;
};

export type TravelRegion = {
  id: string;
  nameKo: string;
  nameEn: string;
  nameJp: string;
  eyebrow: string;
  headline: string;
  intro: string;
  tipTitle: string;
  tipText: string;
  centerLat: number;
  centerLon: number;
};

export type TravelPlace = {
  id: string;
  name: string;
  category: string;
  description: string;
  suggestedTime: string;
  durationMinutes: number;
  latitude: number;
  longitude: number;
  source?: "catalog" | "google";
  externalUrl?: string;
};

export type PlaceRecommendation = TravelPlace & {
  distanceKm: number;
  nearAnchorName: string;
  travelMinutes?: number;
  travelDistanceKm?: number;
  travelMode?: TransportMode;
  photoUrl?: string;
  photoAttribution?: { displayName: string; uri?: string };
  photoGoogleMapsUri?: string;
};

export type OpeningPeriodPoint = {
  day: number;
  hour: number;
  minute: number;
};

export type OpeningPeriod = {
  open: OpeningPeriodPoint;
  close?: OpeningPeriodPoint;
};

export type PlaceDetails = {
  googlePlaceId: string;
  name: string;
  address: string;
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  openNow?: boolean;
  weekdayDescriptions: string[];
  periods: OpeningPeriod[];
  websiteUri?: string;
  googleMapsUri?: string;
  photoUrl?: string;
  photoAttribution?: { displayName: string; uri?: string };
  photoGoogleMapsUri?: string;
};

export type PlannedPlaceActivity = {
  kind: "place";
  place: TravelPlace;
  scheduledTime: string;
  endTime: string;
  travelMinutesFromPrevious: number;
  distanceKmFromPrevious: number;
  openingNote?: string;
};

export type PlannedMealActivity = {
  kind: "meal";
  id: string;
  label: string;
  scheduledTime: string;
  endTime: string;
  nearPlaceName: string;
};

export type PlannedActivity = PlannedPlaceActivity | PlannedMealActivity;

export type PlannedDay = {
  dayNumber: number;
  date: string;
  activities: PlannedActivity[];
  totalTravelMinutes: number;
  totalDistanceKm: number;
};

export type ItineraryPlan = {
  days: PlannedDay[];
  provider: "google" | "estimate";
  warnings: string[];
};

export type PlaceCatalog = {
  region: TravelRegion;
  mustVisits: TravelPlace[];
  places: TravelPlace[];
};

export type CourseDay = {
  dayNumber: number;
  label: string;
  transit: string;
  places: TravelPlace[];
};

export type TravelCourse = {
  id?: string;
  title: string;
  style: TravelStyle;
  styleLabel: string;
  dayCount: number;
  region: TravelRegion;
  days: CourseDay[];
  savedAt?: number;
};

export const styleLabels: Record<TravelStyle, string> = {
  balanced: "균형 있게",
  culture: "문화·역사",
  food: "맛집 중심",
  nature: "자연·산책",
};

export const companionLabels: Record<CompanionType, string> = {
  solo: "혼자",
  couple: "연인·친구",
  family: "아이와 가족",
  parents: "부모님과",
};

export const paceLabels: Record<TravelPace, string> = {
  relaxed: "여유롭게",
  balanced: "적당히",
  packed: "알차게",
};

export const budgetLabels: Record<TravelBudget, string> = {
  value: "실속",
  standard: "보통",
  premium: "여유",
};

export const transportLabels: Record<TransportMode, string> = {
  walking: "도보 중심",
  transit: "대중교통",
  driving: "자동차",
};

export function isTravelStyle(value: unknown): value is TravelStyle {
  return typeof value === "string" && travelStyles.includes(value as TravelStyle);
}

export function isTransportMode(value: unknown): value is TransportMode {
  return typeof value === "string" && transportModes.includes(value as TransportMode);
}

export function isGooglePlaceSnapshot(value: unknown): value is TravelPlace {
  if (!value || typeof value !== "object") return false;
  const place = value as Record<string, unknown>;
  return (
    typeof place.id === "string" &&
    /^google:[A-Za-z0-9_-]{1,240}$/.test(place.id) &&
    typeof place.name === "string" &&
    place.name.trim().length > 0 &&
    place.name.length <= 160 &&
    typeof place.category === "string" &&
    place.category.length <= 100 &&
    typeof place.description === "string" &&
    place.description.length <= 400 &&
    typeof place.suggestedTime === "string" &&
    /^\d{2}:\d{2}$/.test(place.suggestedTime) &&
    typeof place.durationMinutes === "number" &&
    Number.isInteger(place.durationMinutes) &&
    place.durationMinutes >= 15 &&
    place.durationMinutes <= 720 &&
    typeof place.latitude === "number" &&
    Number.isFinite(place.latitude) &&
    place.latitude >= 24 &&
    place.latitude <= 46 &&
    typeof place.longitude === "number" &&
    Number.isFinite(place.longitude) &&
    place.longitude >= 122 &&
    place.longitude <= 154 &&
    (place.source === undefined || place.source === "google") &&
    (place.externalUrl === undefined ||
      typeof place.externalUrl === "string" && /^https:\/\//.test(place.externalUrl))
  );
}

export function isTravelPlaceSnapshot(value: unknown): value is TravelPlace {
  if (!value || typeof value !== "object") return false;
  const place = value as Record<string, unknown>;
  return (
    typeof place.id === "string" &&
    /^[A-Za-z0-9:_-]{1,240}$/.test(place.id) &&
    typeof place.name === "string" &&
    place.name.trim().length > 0 &&
    place.name.length <= 160 &&
    typeof place.category === "string" &&
    place.category.length <= 100 &&
    typeof place.description === "string" &&
    place.description.length <= 400 &&
    typeof place.suggestedTime === "string" &&
    /^\d{2}:\d{2}$/.test(place.suggestedTime) &&
    typeof place.durationMinutes === "number" &&
    Number.isInteger(place.durationMinutes) &&
    place.durationMinutes >= 15 &&
    place.durationMinutes <= 720 &&
    typeof place.latitude === "number" &&
    Number.isFinite(place.latitude) &&
    place.latitude >= 24 &&
    place.latitude <= 46 &&
    typeof place.longitude === "number" &&
    Number.isFinite(place.longitude) &&
    place.longitude >= 122 &&
    place.longitude <= 154 &&
    (place.source === undefined || place.source === "catalog" || place.source === "google") &&
    (place.externalUrl === undefined ||
      typeof place.externalUrl === "string" && /^https:\/\//.test(place.externalUrl))
  );
}

export function isPlanPreferences(value: unknown): value is PlanPreferences {
  if (!value || typeof value !== "object") return false;
  const preferences = value as Record<string, unknown>;
  return (
    typeof preferences.startDate === "string" &&
    (preferences.startDate === "" || /^\d{4}-\d{2}-\d{2}$/.test(preferences.startDate)) &&
    typeof preferences.dayCount === "number" &&
    Number.isInteger(preferences.dayCount) &&
    preferences.dayCount >= 1 &&
    preferences.dayCount <= 3 &&
    typeof preferences.startLocation === "string" &&
    preferences.startLocation.length <= 180 &&
    companionTypes.includes(preferences.companion as CompanionType) &&
    travelPaces.includes(preferences.pace as TravelPace) &&
    travelBudgets.includes(preferences.budget as TravelBudget) &&
    transportModes.includes(preferences.transport as TransportMode) &&
    typeof preferences.includeMeals === "boolean"
  );
}

export function normalizeDayCount(value: unknown) {
  const dayCount = Number(value);
  return Number.isInteger(dayCount) && dayCount >= 1 && dayCount <= 3
    ? dayCount
    : 3;
}

export function calculateDistanceKm(a: TravelPlace, b: TravelPlace) {
  const earthRadius = 6371;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const latDelta = ((b.latitude - a.latitude) * Math.PI) / 180;
  const lonDelta = ((b.longitude - a.longitude) * Math.PI) / 180;
  const h =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(lonDelta / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function routeDistanceLabel(places: TravelPlace[]) {
  const distance = places
    .slice(1)
    .reduce(
      (total, place, index) =>
        total + calculateDistanceKm(places[index], place),
      0,
    );
  const rounded = distance < 10 ? distance.toFixed(1) : Math.round(distance).toString();
  return `예상 이동거리 약 ${rounded}km · ${places.length}개 장소`;
}

export function buildCustomCourse({
  region,
  places,
  style,
  dayCount: requestedDayCount,
}: {
  region: TravelRegion;
  places: TravelPlace[];
  style: TravelStyle;
  dayCount?: number;
}): TravelCourse {
  const selectedPlaces = places.slice(0, 9);
  const dayCount = Math.max(
    1,
    Math.min(requestedDayCount ?? Math.ceil(selectedPlaces.length / 3), selectedPlaces.length || 1),
  );
  const baseCount = Math.floor(selectedPlaces.length / dayCount);
  let extra = selectedPlaces.length % dayCount;
  let cursor = 0;
  const days = Array.from({ length: dayCount }, (_, index) => {
    const placeCount = baseCount + (extra-- > 0 ? 1 : 0);
    const dayPlaces = selectedPlaces.slice(cursor, cursor + placeCount);
    cursor += placeCount;
    return {
      dayNumber: index + 1,
      label: `${region.nameKo} ${index + 1}일차 · 나만의 선택`,
      transit: routeDistanceLabel(dayPlaces),
      places: dayPlaces,
    };
  });

  return {
    title: `${region.nameKo} 나만의 여행 코스`,
    style,
    styleLabel: styleLabels[style],
    dayCount,
    region,
    days,
  };
}
