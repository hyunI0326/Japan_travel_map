import type { OptimizedDayRoute } from "./google-routes";
import type { ItineraryPlan, PlaceDetails, PlanPreferences, PlannedActivity, PlannedDay, TravelPlace } from "./travel-types";

export function minutesFromTime(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

export function timeFromMinutes(value: number) {
  const safe = Math.min(1439, Math.max(0, Math.round(value)));
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

export function visitDuration(place: TravelPlace, preferences: PlanPreferences) {
  const pace = preferences.pace === "relaxed" ? 1.15 : preferences.pace === "packed" ? 0.85 : 1;
  const companion = preferences.companion === "parents" ? 1.12 : preferences.companion === "family" ? 1.08 : 1;
  return Math.max(30, Math.round(place.durationMinutes * pace * companion / 5) * 5);
}

function isRestaurant(place: TravelPlace) {
  return /식당|음식점|레스토랑|라면|라멘|스시|초밥|우동|소바|야키니쿠|돈카츠|restaurant|ramen|sushi/i.test(place.category);
}

export function buildPlannedDay(
  dayNumber: number,
  date: string,
  route: OptimizedDayRoute & { provider: "google" | "estimate" },
  preferences: PlanPreferences,
): PlannedDay {
  const normalStart = preferences.pace === "packed" ? 510 : preferences.pace === "relaxed" ? 570 : 540;
  let cursor = dayNumber === 1 && preferences.firstDayStartTime ? minutesFromTime(preferences.firstDayStartTime) : normalStart;
  const endLimit = dayNumber === preferences.dayCount && preferences.lastDayEndTime ? minutesFromTime(preferences.lastDayEndTime) : 21 * 60;
  let mealAdded = false;
  const activities: PlannedActivity[] = [];
  route.places.forEach((place, index) => {
    const travelMinutes = route.legMinutes[index] ?? 0;
    cursor += travelMinutes;
    const fixedTime = preferences.placeSchedules?.[place.id]?.time;
    const suggested = minutesFromTime(place.suggestedTime || "09:00");
    let start = fixedTime ? minutesFromTime(fixedTime) : Math.max(cursor, suggested);
    const duration = visitDuration(place, preferences);
    const restaurantLunch = isRestaurant(place) && start < 15 * 60 && start + duration >= 11 * 60;
    const lunchComing = route.places.slice(index + 1).some(candidate => {
      const candidateTime = preferences.placeSchedules?.[candidate.id]?.time || candidate.suggestedTime;
      return isRestaurant(candidate) && minutesFromTime(candidateTime) < 15 * 60 && start + duration < 14 * 60;
    });
    // Do not add a meal before a lunch restaurant, or after the final stop.
    if (preferences.includeMeals && !mealAdded && !restaurantLunch && !lunchComing && index > 0 && cursor >= 11 * 60 + 45 && cursor < 15 * 60) {
      const mealStart = Math.max(cursor, 12 * 60);
      const mealEnd = mealStart + (preferences.budget === "premium" ? 75 : 60);
      if (!fixedTime || mealEnd <= start) {
        activities.push({ kind: "meal", id: `meal-${dayNumber}`, label: "점심 식사", scheduledTime: timeFromMinutes(mealStart), endTime: timeFromMinutes(mealEnd), nearPlaceName: place.name });
        cursor = mealEnd;
        start = fixedTime ? start : Math.max(cursor, suggested);
        mealAdded = true;
      }
    }
    if (restaurantLunch) mealAdded = true;
    const notes: string[] = [];
    if (fixedTime && start < cursor) notes.push("예약시간까지 이동·관람 시간이 부족해요. 앞 장소나 예약시간을 조정해 주세요.");
    if (start + duration > endLimit) notes.push(`${timeFromMinutes(endLimit)} 관광 종료 이후까지 이어져요. 다른 날로 옮기거나 체류시간을 확인해 주세요.`);
    if (start + duration > 1439) notes.push("자정을 넘는 일정이에요. 다음 날로 옮겨 주세요.");
    activities.push({
      kind: "place", place, scheduledTime: timeFromMinutes(start), endTime: timeFromMinutes(start + duration),
      travelMinutesFromPrevious: travelMinutes, distanceKmFromPrevious: route.legDistancesKm[index] ?? 0,
      routeProvider: route.provider, openingStatus: "unknown", timeLocked: Boolean(fixedTime),
      ...(notes.length ? { scheduleNote: notes.join(" ") } : {}),
    });
    cursor = Math.max(cursor, start + duration);
  });
  return { dayNumber, date, activities, totalTravelMinutes: route.totalMinutes, totalDistanceKm: route.totalDistanceKm, routeProvider: route.provider };
}

function openingWindows(details: PlaceDetails, date: string) {
  const day = new Date(`${date}T12:00:00+09:00`).getUTCDay();
  const dayStart = day * 1440;
  return details.periods.flatMap(period => {
    if (!period.close) return [{ start: 0, end: 1440 }];
    const start = period.open.day * 1440 + period.open.hour * 60 + period.open.minute;
    let end = period.close.day * 1440 + period.close.hour * 60 + period.close.minute;
    if (end <= start) end += 7 * 1440;
    return [-7 * 1440, 0, 7 * 1440].map(offset => ({ start: start + offset - dayStart, end: end + offset - dayStart }));
  });
}

export function openingStatus(details: PlaceDetails | undefined, date: string, time: string, endTime = time) {
  if (!details || !date || !Number.isFinite(new Date(`${date}T12:00:00+09:00`).getTime()) || !details.periods.length) return "unknown" as const;
  const start = minutesFromTime(time);
  const end = minutesFromTime(endTime);
  return openingWindows(details, date).some(window => start >= window.start && start < window.end && end <= window.end)
    ? "open" as const : "closed" as const;
}

export function adjustPlanForOpeningHours(plan: ItineraryPlan, detailsById: Record<string, PlaceDetails>): ItineraryPlan {
  const days = plan.days.map(day => {
    let previousEnd = 0;
    const activities = day.activities.map(activity => {
      const duration = Math.max(1, minutesFromTime(activity.endTime) - minutesFromTime(activity.scheduledTime));
      const earliest = previousEnd + (activity.kind === "place" ? activity.travelMinutesFromPrevious : 0);
      let start = activity.kind === "place" && activity.timeLocked
        ? minutesFromTime(activity.scheduledTime) : Math.max(minutesFromTime(activity.scheduledTime), earliest);
      if (activity.kind === "meal") {
        previousEnd = start + duration;
        return { ...activity, scheduledTime: timeFromMinutes(start), endTime: timeFromMinutes(previousEnd) };
      }
      const details = detailsById[activity.place.id];
      let note: string | undefined;
      let status = openingStatus(details, day.date, timeFromMinutes(start), timeFromMinutes(start + duration));
      if (status === "closed" && details && !activity.timeLocked) {
        const next = openingWindows(details, day.date)
          .map(window => Math.max(start, window.start) + duration <= window.end ? Math.max(start, window.start) : null)
          .filter((candidate): candidate is number => candidate !== null && candidate >= start && candidate + duration < 1440)
          .sort((a, b) => a - b)[0];
        if (next !== undefined) {
          start = next;
          status = "open";
          note = `등록된 영업시간에 맞춰 ${timeFromMinutes(start)}로 조정했어요.`;
        }
      }
      if (status === "closed") note = "등록된 영업시간과 맞지 않아요. 공식 사이트에서 휴무·마지막 입장을 확인해 주세요.";
      if (status === "unknown") note = day.date ? "영업시간 정보 미확인 · 공식 사이트에서 확인해 주세요." : "여행 시작일을 입력하면 요일별 영업시간을 확인할 수 있어요.";
      const conflict = activity.timeLocked && start < earliest ? "앞 장소에서 예약시간까지 이동할 시간이 부족해요." : undefined;
      previousEnd = Math.max(previousEnd, start + duration);
      return { ...activity, scheduledTime: timeFromMinutes(start), endTime: timeFromMinutes(start + duration), openingStatus: status, openingNote: note, scheduleNote: conflict || activity.scheduleNote };
    });
    return { ...day, activities };
  });
  return { ...plan, days };
}
