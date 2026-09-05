import {
  isPlanPreferences,
  isTravelPlaceSnapshot,
  isTravelStyle,
  type ItineraryPlan,
  type PlanPreferences,
  type TravelPlace,
  type TravelStyle,
} from "./travel-types";
import { isBudgetEstimate, type BudgetEstimate } from "./budget";

export type SharedPlan = {
  regionId: string;
  style: TravelStyle;
  places: TravelPlace[];
  preferences: PlanPreferences;
  lockedPlaceIds: string[];
  selectedLodging?: TravelPlace | null;
  itineraryPlan?: ItineraryPlan | null;
  budget?: BudgetEstimate | null;
};

function isItineraryPlan(value: unknown): value is ItineraryPlan {
  if (!value || typeof value !== "object") return false;
  const plan = value as Record<string, unknown>;
  if (
    !Array.isArray(plan.days) ||
    plan.days.length === 0 ||
    plan.days.length > 30 ||
    (plan.provider !== "google" && plan.provider !== "estimate") ||
    !Array.isArray(plan.warnings) ||
    plan.warnings.some((warning) => typeof warning !== "string" || warning.length > 300)
  ) return false;

  return plan.days.every((entry) => {
    if (!entry || typeof entry !== "object") return false;
    const day = entry as Record<string, unknown>;
    if (
      typeof day.dayNumber !== "number" ||
      typeof day.date !== "string" ||
      typeof day.totalTravelMinutes !== "number" ||
      typeof day.totalDistanceKm !== "number" ||
      !Array.isArray(day.activities) ||
      day.activities.length > 20
    ) return false;
    return day.activities.every((entryActivity) => {
      if (!entryActivity || typeof entryActivity !== "object") return false;
      const activity = entryActivity as Record<string, unknown>;
      if (activity.kind === "meal") {
        return (
          typeof activity.id === "string" &&
          typeof activity.label === "string" &&
          typeof activity.scheduledTime === "string" &&
          typeof activity.endTime === "string" &&
          typeof activity.nearPlaceName === "string"
        );
      }
      return (
        activity.kind === "place" &&
        isTravelPlaceSnapshot(activity.place) &&
        typeof activity.scheduledTime === "string" &&
        typeof activity.endTime === "string" &&
        typeof activity.travelMinutesFromPrevious === "number" &&
        typeof activity.distanceKmFromPrevious === "number" &&
        (activity.openingNote === undefined || typeof activity.openingNote === "string")
      );
    });
  });
}

export function parseSharedPlan(parsed: unknown): SharedPlan | null {
  if (!parsed || typeof parsed !== "object") return null;
  const value = parsed as Record<string, unknown>;
  if (
    typeof value.regionId !== "string" ||
    !/^[a-z0-9-]{1,40}$/.test(value.regionId) ||
    !isTravelStyle(value.style) ||
    !Array.isArray(value.places) ||
    value.places.length === 0 ||
    value.places.length > 9 ||
    value.places.some((place) => !isTravelPlaceSnapshot(place)) ||
    !isPlanPreferences(value.preferences) ||
    !Array.isArray(value.lockedPlaceIds) ||
    value.lockedPlaceIds.some((id) => typeof id !== "string") ||
    (value.selectedLodging !== undefined &&
      value.selectedLodging !== null &&
      !isTravelPlaceSnapshot(value.selectedLodging)) ||
    (value.itineraryPlan !== undefined &&
      value.itineraryPlan !== null &&
      !isItineraryPlan(value.itineraryPlan)) ||
    (value.budget !== undefined &&
      value.budget !== null &&
      !isBudgetEstimate(value.budget))
  ) return null;

  const places = value.places as TravelPlace[];
  return {
    regionId: value.regionId,
    style: value.style,
    places,
    preferences: value.preferences,
    lockedPlaceIds: (value.lockedPlaceIds as string[]).filter((id) =>
      places.some((place) => place.id === id),
    ),
    selectedLodging: value.selectedLodging as TravelPlace | null | undefined,
    itineraryPlan: value.itineraryPlan as ItineraryPlan | null | undefined,
    budget: value.budget as BudgetEstimate | null | undefined,
  };
}
