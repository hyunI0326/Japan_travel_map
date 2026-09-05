import { optimizeDayWithGoogle, type OptimizedDayRoute } from "@/lib/google-routes";
import {
  calculateDistanceKm,
  type ItineraryPlan,
  type PlanPreferences,
  type PlannedActivity,
  type PlannedDay,
  type TransportMode,
  type TravelPlace,
} from "@/lib/travel-types";

function addDays(date: string, offset: number) {
  if (!date) return "";
  const base = new Date(`${date}T12:00:00+09:00`);
  if (Number.isNaN(base.getTime())) return "";
  base.setUTCDate(base.getUTCDate() + offset);
  return base.toISOString().slice(0, 10);
}

function timeLabel(minutes: number) {
  const safeMinutes = Math.max(0, minutes);
  const hour = Math.floor(safeMinutes / 60) % 24;
  const minute = Math.round(safeMinutes % 60);
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function visitDuration(place: TravelPlace, preferences: PlanPreferences) {
  const paceFactor = preferences.pace === "relaxed" ? 1.15 : preferences.pace === "packed" ? 0.85 : 1;
  const companionFactor = preferences.companion === "parents" ? 1.12 : preferences.companion === "family" ? 1.08 : 1;
  return Math.max(30, Math.round((place.durationMinutes * paceFactor * companionFactor) / 5) * 5);
}

function estimatedTravelMinutes(distanceKm: number, transport: TransportMode) {
  if (distanceKm <= 0) return 0;
  if (transport === "walking") return Math.max(5, Math.round(distanceKm * 12));
  if (transport === "driving") return Math.max(8, Math.round(distanceKm * 3 + 7));
  return Math.max(10, Math.round(distanceKm * 4 + 10));
}

function nearestNeighbor(places: TravelPlace[], lockedPlaceIds: Set<string>) {
  if (places.length < 3) return [...places];
  const lockedPositions = new Map<number, TravelPlace>();
  const unlocked = places.filter((place, index) => {
    if (!lockedPlaceIds.has(place.id)) return true;
    lockedPositions.set(index, place);
    return false;
  });
  const result: Array<TravelPlace | undefined> = Array.from({ length: places.length });
  lockedPositions.forEach((place, index) => {
    result[index] = place;
  });

  for (let index = 0; index < result.length; index += 1) {
    if (result[index]) continue;
    const previous = result.slice(0, index).reverse().find(Boolean);
    const nextLocked = result.slice(index + 1).find(Boolean);
    const scored = unlocked.map((place) => ({
      place,
      score:
        (previous ? calculateDistanceKm(previous, place) : 0) +
        (nextLocked ? calculateDistanceKm(place, nextLocked) * 0.35 : 0),
    }));
    scored.sort((a, b) => a.score - b.score);
    const chosen = scored[0]?.place;
    if (!chosen) break;
    result[index] = chosen;
    unlocked.splice(unlocked.findIndex((place) => place.id === chosen.id), 1);
  }
  return result.filter((place): place is TravelPlace => Boolean(place));
}

function distributeByDay(places: TravelPlace[], dayCount: number) {
  const safeDayCount = Math.max(1, Math.min(dayCount, places.length));
  const baseCount = Math.floor(places.length / safeDayCount);
  let extra = places.length % safeDayCount;
  let cursor = 0;
  return Array.from({ length: safeDayCount }, () => {
    const count = baseCount + (extra-- > 0 ? 1 : 0);
    const dayPlaces = places.slice(cursor, cursor + count);
    cursor += count;
    return dayPlaces;
  });
}

function fallbackRoute(places: TravelPlace[], transport: TransportMode): OptimizedDayRoute {
  const legDistancesKm = places.map((place, index) =>
    index === 0 ? 0 : Number(calculateDistanceKm(places[index - 1], place).toFixed(1)),
  );
  const legMinutes = legDistancesKm.map((distance) => estimatedTravelMinutes(distance, transport));
  return {
    places,
    legMinutes,
    legDistancesKm,
    totalMinutes: legMinutes.reduce((total, minutes) => total + minutes, 0),
    totalDistanceKm: Number(legDistancesKm.reduce((total, distance) => total + distance, 0).toFixed(1)),
  };
}

function buildDay(
  dayNumber: number,
  route: OptimizedDayRoute,
  preferences: PlanPreferences,
): PlannedDay {
  let cursor = preferences.pace === "packed" ? 8 * 60 + 30 : preferences.pace === "relaxed" ? 9 * 60 + 30 : 9 * 60;
  let mealAdded = false;
  const activities: PlannedActivity[] = [];

  route.places.forEach((place, index) => {
    const travelMinutes = route.legMinutes[index] ?? 0;
    cursor += travelMinutes;
    if (preferences.includeMeals && !mealAdded && cursor >= 11 * 60 + 45) {
      const mealStart = cursor;
      cursor += preferences.budget === "premium" ? 75 : 60;
      activities.push({
        kind: "meal",
        id: `meal-${dayNumber}`,
        label: "점심 식사",
        scheduledTime: timeLabel(mealStart),
        endTime: timeLabel(cursor),
        nearPlaceName: route.places[Math.max(0, index - 1)]?.name ?? place.name,
      });
      mealAdded = true;
    }

    const start = cursor;
    cursor += visitDuration(place, preferences);
    activities.push({
      kind: "place",
      place,
      scheduledTime: timeLabel(start),
      endTime: timeLabel(cursor),
      travelMinutesFromPrevious: travelMinutes,
      distanceKmFromPrevious: route.legDistancesKm[index] ?? 0,
    });

    if (preferences.includeMeals && !mealAdded && cursor >= 12 * 60) {
      const mealStart = cursor;
      cursor += preferences.budget === "premium" ? 75 : 60;
      activities.push({
        kind: "meal",
        id: `meal-${dayNumber}`,
        label: "점심 식사",
        scheduledTime: timeLabel(mealStart),
        endTime: timeLabel(cursor),
        nearPlaceName: place.name,
      });
      mealAdded = true;
    }
  });

  return {
    dayNumber,
    date: addDays(preferences.startDate, dayNumber - 1),
    activities,
    totalTravelMinutes: route.totalMinutes,
    totalDistanceKm: route.totalDistanceKm,
  };
}

export async function createItineraryPlan({
  places,
  preferences,
  lockedPlaceIds,
}: {
  places: TravelPlace[];
  preferences: PlanPreferences;
  lockedPlaceIds: string[];
}): Promise<ItineraryPlan> {
  const locked = new Set(lockedPlaceIds);
  const nearestOrder = nearestNeighbor(places, locked);
  const dayGroups = distributeByDay(nearestOrder, preferences.dayCount);
  let usedGoogle = false;
  let googleUnavailable = false;

  const routes = await Promise.all(
    dayGroups.map(async (dayPlaces) => {
      if (locked.size > 0 || dayPlaces.length < 2) {
        return fallbackRoute(dayPlaces, preferences.transport);
      }
      try {
        const googleRoute = await optimizeDayWithGoogle({
          places: dayPlaces,
          startLocation: preferences.startLocation,
          transport: preferences.transport,
        });
        if (googleRoute) {
          usedGoogle = true;
          return googleRoute;
        }
      } catch (error) {
        googleUnavailable = true;
        console.error(
          "Google Routes optimization failed; using distance estimate.",
          error instanceof Error ? error.message : "GOOGLE_ROUTES_UNKNOWN",
        );
      }
      return fallbackRoute(dayPlaces, preferences.transport);
    }),
  );

  const warnings: string[] = [];
  if (googleUnavailable) {
    warnings.push("Google Routes를 사용할 수 없어 장소 간 거리 기준으로 동선을 정리했어요.");
  }
  if (locked.size > 0) {
    warnings.push("고정한 장소의 순서는 유지하고 나머지 장소만 가까운 순서로 정리했어요.");
  }

  return {
    days: routes.map((route, index) => buildDay(index + 1, route, preferences)),
    provider: usedGoogle ? "google" : "estimate",
    warnings,
  };
}
