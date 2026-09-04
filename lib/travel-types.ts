export const travelStyles = ["balanced", "culture", "food", "nature"] as const;
export type TravelStyle = (typeof travelStyles)[number];

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

export function isTravelStyle(value: unknown): value is TravelStyle {
  return typeof value === "string" && travelStyles.includes(value as TravelStyle);
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
    place.longitude <= 154
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
}: {
  region: TravelRegion;
  places: TravelPlace[];
  style: TravelStyle;
}): TravelCourse {
  const selectedPlaces = places.slice(0, 9);
  const dayCount = Math.max(1, Math.ceil(selectedPlaces.length / 3));
  const days = Array.from({ length: dayCount }, (_, index) => {
    const dayPlaces = selectedPlaces.slice(index * 3, index * 3 + 3);
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
