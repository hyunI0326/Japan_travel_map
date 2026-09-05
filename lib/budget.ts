import type {
  CompanionType,
  PlanPreferences,
  TravelBudget,
  TransportMode,
} from "./travel-types";

export type BudgetEstimate = {
  travelers: number;
  nights: number;
  accommodationTotal: number;
  mealsPerPersonDay: number;
  transportPerPersonDay: number;
  activitiesPerPerson: number;
  shoppingAndOtherTotal: number;
  krwPerHundredYen: number;
};

const travelerDefaults: Record<CompanionType, number> = {
  solo: 1,
  couple: 2,
  family: 3,
  parents: 2,
};

const accommodationPerNight: Record<TravelBudget, number> = {
  value: 9_000,
  standard: 18_000,
  premium: 35_000,
};

const mealDefaults: Record<TravelBudget, number> = {
  value: 3_500,
  standard: 6_500,
  premium: 12_000,
};

const activityDefaults: Record<TravelBudget, number> = {
  value: 2_500,
  standard: 5_000,
  premium: 10_000,
};

const otherDefaults: Record<TravelBudget, number> = {
  value: 10_000,
  standard: 20_000,
  premium: 40_000,
};

const transportDefaults: Record<TransportMode, Record<TravelBudget, number>> = {
  walking: { value: 800, standard: 1_200, premium: 2_000 },
  transit: { value: 1_200, standard: 1_800, premium: 3_000 },
  driving: { value: 3_000, standard: 5_000, premium: 8_000 },
};

export function createBudgetEstimate(
  preferences: Pick<PlanPreferences, "budget" | "companion" | "dayCount" | "transport">,
): BudgetEstimate {
  const nights = Math.max(0, preferences.dayCount - 1);
  return {
    travelers: travelerDefaults[preferences.companion],
    nights,
    accommodationTotal: accommodationPerNight[preferences.budget] * nights,
    mealsPerPersonDay: mealDefaults[preferences.budget],
    transportPerPersonDay:
      transportDefaults[preferences.transport][preferences.budget],
    activitiesPerPerson: activityDefaults[preferences.budget],
    shoppingAndOtherTotal: otherDefaults[preferences.budget],
    krwPerHundredYen: 1_000,
  };
}

export function normalizeBudgetEstimate(value: BudgetEstimate): BudgetEstimate {
  const integer = (candidate: number, min: number, max: number) =>
    Math.min(max, Math.max(min, Math.round(Number.isFinite(candidate) ? candidate : min)));
  return {
    travelers: integer(value.travelers, 1, 10),
    nights: integer(value.nights, 0, 30),
    accommodationTotal: integer(value.accommodationTotal, 0, 10_000_000),
    mealsPerPersonDay: integer(value.mealsPerPersonDay, 0, 1_000_000),
    transportPerPersonDay: integer(value.transportPerPersonDay, 0, 1_000_000),
    activitiesPerPerson: integer(value.activitiesPerPerson, 0, 5_000_000),
    shoppingAndOtherTotal: integer(value.shoppingAndOtherTotal, 0, 10_000_000),
    krwPerHundredYen: integer(value.krwPerHundredYen, 1, 100_000),
  };
}

export function isBudgetEstimate(value: unknown): value is BudgetEstimate {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return [
    "travelers",
    "nights",
    "accommodationTotal",
    "mealsPerPersonDay",
    "transportPerPersonDay",
    "activitiesPerPerson",
    "shoppingAndOtherTotal",
    "krwPerHundredYen",
  ].every((key) => typeof candidate[key] === "number" && Number.isFinite(candidate[key]));
}

export function calculateBudgetSummary(estimate: BudgetEstimate, dayCount: number) {
  const safe = normalizeBudgetEstimate(estimate);
  const variablePerPerson =
    (safe.mealsPerPersonDay + safe.transportPerPersonDay) * dayCount +
    safe.activitiesPerPerson;
  const totalYen =
    safe.accommodationTotal +
    variablePerPerson * safe.travelers +
    safe.shoppingAndOtherTotal;
  return {
    totalYen,
    totalKrw: Math.round((totalYen / 100) * safe.krwPerHundredYen),
    perPersonYen: Math.round(totalYen / safe.travelers),
    perPersonKrw: Math.round(
      ((totalYen / safe.travelers) / 100) * safe.krwPerHundredYen,
    ),
  };
}
