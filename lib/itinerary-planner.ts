import { optimizeDayWithGoogle, type OptimizedDayRoute } from "@/lib/google-routes";
import { buildPlannedDay, visitDuration } from "@/lib/itinerary-schedule";
import {
  calculateDistanceKm,
  type ItineraryPlan,
  type PlanPreferences,
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

function distributeByDay(places: TravelPlace[], preferences: PlanPreferences) {
  const groups: TravelPlace[][] = Array.from({ length: preferences.dayCount }, () => []);
  const capacity = preferences.pace === "relaxed" ? 330 : preferences.pace === "packed" ? 570 : 450;
  // Explicit day choices take precedence. Fill unassigned places by nearby travel
  // and visit workload; do not spread a short afternoon over every requested day.
  for (const place of places) {
    const assignment = preferences.placeSchedules?.[place.id];
    if (assignment) groups[assignment.dayNumber - 1].push(place);
  }
  let index = 0;
  for (const place of places) {
    if (preferences.placeSchedules?.[place.id]) continue;
    while (index < groups.length - 1) {
      const group = groups[index];
      const previous = group.at(-1);
      const distance = previous ? calculateDistanceKm(previous, place) : 0;
      const workload = group.reduce((sum, item, i) => sum + visitDuration(item, preferences) +
        (i > 0 ? estimatedTravelMinutes(calculateDistanceKm(group[i - 1], item), preferences.transport) : 0), 0);
      const firstDayCapacity = index === 0 && preferences.firstDayStartTime
        ? Math.min(capacity, Math.max(60, 21 * 60 - Number(preferences.firstDayStartTime.slice(0, 2)) * 60 - Number(preferences.firstDayStartTime.slice(3))))
        : capacity;
      if (group.length && (workload + visitDuration(place, preferences) + estimatedTravelMinutes(distance, preferences.transport) > firstDayCapacity || distance > 12)) index += 1;
      else break;
    }
    groups[index].push(place);
  }
  return groups;
}

function orderForVisitTimes(places: TravelPlace[], preferences: PlanPreferences, locked: Set<string>) {
  const preferred = (place: TravelPlace) => preferences.placeSchedules?.[place.id]?.time || place.suggestedTime;
  const available = places.filter(place => !locked.has(place.id)).sort((a, b) => preferred(a).localeCompare(preferred(b)));
  return places.map(place => locked.has(place.id) ? place : available.shift()!);
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
  const dayGroups = distributeByDay(nearestOrder, preferences);
  let usedGoogle = false;
  let googleUnavailable = false;

  const routes = await Promise.all(
    dayGroups.map(async (group) => {
      const dayPlaces = orderForVisitTimes(group, preferences, locked);
      if (dayPlaces.length === 0 || (dayPlaces.length === 1 && !preferences.startLocation)) {
        return { ...fallbackRoute(dayPlaces, preferences.transport), provider: "estimate" as const };
      }
      try {
        const googleRoute = await optimizeDayWithGoogle({
          places: dayPlaces,
          startLocation: preferences.startLocation,
          transport: preferences.transport,
          preserveOrder: true,
        });
        if (googleRoute) {
          usedGoogle = true;
          return { ...googleRoute, provider: "google" as const };
        }
      } catch (error) {
        googleUnavailable = true;
        console.error(
          "Google Routes optimization failed; using distance estimate.",
          error instanceof Error ? error.message : "GOOGLE_ROUTES_UNKNOWN",
        );
      }
      return { ...fallbackRoute(dayPlaces, preferences.transport), provider: "estimate" as const };
    }),
  );

  const warnings: string[] = [];
  if (googleUnavailable) {
    warnings.push("Google Routes를 사용할 수 없어 장소 간 거리 기준으로 동선을 정리했어요.");
  }
  if (locked.size > 0) {
    warnings.push("고정한 장소의 순서는 유지하고 나머지 장소만 가까운 순서로 정리했어요.");
  }

  const days = routes.map((route, index) => buildPlannedDay(index + 1, addDays(preferences.startDate, index), route, preferences));
  const freeDays = days.filter(day => day.activities.length === 0).length;
  if (freeDays) warnings.push(`가까운 장소를 묶어 ${days.length - freeDays}일에 배치했어요. 남은 ${freeDays}일은 자유 일정이에요. 장소를 추가하거나 여행 일수를 줄일 수 있어요.`);
  const estimated = routes.some(route => route.places.length > 0 && route.provider === "estimate");
  if (estimated && !googleUnavailable) warnings.push("일부 이동시간은 직선거리로 추정했어요. 출발 전 지도에서 교통편을 확인해 주세요.");
  if (preferences.startLocation && estimated) warnings.push("추정 동선에는 숙소에서 첫 장소까지의 이동시간이 포함되지 않아요.");
  if (preferences.startLocation) warnings.push("마지막 장소에서 숙소로 돌아가는 시간은 별도로 확보해 주세요.");
  const conflicts = days.flatMap(day => day.activities).filter(activity => activity.kind === "place" && activity.scheduleNote);
  if (conflicts.length) warnings.push(`${conflicts.length}개 장소의 예약·이동·종료 시간 안내를 확인해 주세요.`);
  return { days, provider: usedGoogle ? (estimated ? "mixed" : "google") : "estimate", warnings };
}
