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

export function normalizeDayCount(value: unknown) {
  const dayCount = Number(value);
  return Number.isInteger(dayCount) && dayCount >= 1 && dayCount <= 3
    ? dayCount
    : 3;
}
