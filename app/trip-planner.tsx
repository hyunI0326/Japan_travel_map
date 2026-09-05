"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "./auth-context";
import TravelMap from "./travel-map";
import { authClient } from "@/lib/auth-client";
import {
  buildCustomCourse,
  budgetLabels,
  companionLabels,
  companionTypes,
  isPlanPreferences,
  isTravelPlaceSnapshot,
  isTravelStyle,
  paceLabels,
  styleLabels,
  transportLabels,
  transportModes,
  travelBudgets,
  travelPaces,
  travelStyles,
  type ItineraryPlan,
  type PlaceDetails,
  type PlaceCatalog,
  type PlaceRecommendation,
  type PlanPreferences,
  type RecommendationKind,
  type TravelCourse,
  type TravelPlace,
  type TravelRegion,
  type TravelStyle,
} from "@/lib/travel-types";

const defaultPreferences: PlanPreferences = {
  startDate: "",
  dayCount: 3,
  startLocation: "",
  companion: "couple",
  pace: "balanced",
  budget: "standard",
  transport: "transit",
  includeMeals: true,
};

type SharedPlan = {
  regionId: string;
  style: TravelStyle;
  places: TravelPlace[];
  preferences: PlanPreferences;
  lockedPlaceIds: string[];
};

function encodeSharedPlan(plan: SharedPlan) {
  const bytes = new TextEncoder().encode(JSON.stringify(plan));
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function decodeSharedPlan(value: string): SharedPlan | null {
  try {
    const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
    if (
      typeof parsed.regionId !== "string" ||
      !isTravelStyle(parsed.style) ||
      !Array.isArray(parsed.places) ||
      parsed.places.length === 0 ||
      parsed.places.length > 9 ||
      parsed.places.some((place) => !isTravelPlaceSnapshot(place)) ||
      !isPlanPreferences(parsed.preferences) ||
      !Array.isArray(parsed.lockedPlaceIds) ||
      parsed.lockedPlaceIds.some((id) => typeof id !== "string")
    ) {
      return null;
    }
    const places = parsed.places as TravelPlace[];
    return {
      regionId: parsed.regionId,
      style: parsed.style,
      places,
      preferences: parsed.preferences,
      lockedPlaceIds: parsed.lockedPlaceIds.filter((id) =>
        places.some((place) => place.id === id),
      ),
    };
  } catch {
    return null;
  }
}

function minutesFromTime(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function timeFromMinutes(value: number) {
  const safe = Math.max(0, Math.round(value));
  return `${String(Math.floor(safe / 60) % 24).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

function japanWeekday(date: string) {
  return new Date(`${date}T12:00:00+09:00`).getUTCDay();
}

function openingStatus(details: PlaceDetails | undefined, date: string, time: string) {
  if (!details || !date || details.periods.length === 0) return "unknown" as const;
  const target = japanWeekday(date) * 24 * 60 + minutesFromTime(time);
  const week = 7 * 24 * 60;
  const open = details.periods.some((period) => {
    const start = period.open.day * 24 * 60 + period.open.hour * 60 + period.open.minute;
    if (!period.close) return true;
    let end = period.close.day * 24 * 60 + period.close.hour * 60 + period.close.minute;
    if (end <= start) end += week;
    return (target >= start && target < end) || target + week < end && target + week >= start;
  });
  return open ? "open" as const : "closed" as const;
}

function nextOpeningMinutes(details: PlaceDetails, date: string, currentMinutes: number) {
  const weekday = japanWeekday(date);
  const candidates = details.periods
    .filter((period) => period.open.day === weekday)
    .map((period) => period.open.hour * 60 + period.open.minute)
    .filter((minutes) => minutes >= currentMinutes)
    .sort((a, b) => a - b);
  return candidates[0] ?? null;
}

function adjustPlanForOpeningHours(
  plan: ItineraryPlan,
  detailsById: Record<string, PlaceDetails>,
): ItineraryPlan {
  let adjustedCount = 0;
  let conflictCount = 0;
  const days = plan.days.map((day) => {
    let shift = 0;
    const activities = day.activities.map((activity) => {
      const scheduled = minutesFromTime(activity.scheduledTime) + shift;
      const end = minutesFromTime(activity.endTime) + shift;
      if (activity.kind === "meal") {
        return { ...activity, scheduledTime: timeFromMinutes(scheduled), endTime: timeFromMinutes(end) };
      }
      const details = detailsById[activity.place.id];
      const status = openingStatus(details, day.date, timeFromMinutes(scheduled));
      if (status !== "closed" || !details) {
        return { ...activity, scheduledTime: timeFromMinutes(scheduled), endTime: timeFromMinutes(end) };
      }
      const nextOpening = nextOpeningMinutes(details, day.date, scheduled);
      if (nextOpening !== null && nextOpening - scheduled <= 240) {
        const delay = nextOpening - scheduled;
        shift += delay;
        adjustedCount += 1;
        return {
          ...activity,
          scheduledTime: timeFromMinutes(scheduled + delay),
          endTime: timeFromMinutes(end + delay),
          openingNote: `영업 시작에 맞춰 ${timeFromMinutes(scheduled + delay)}로 자동 조정했어요.`,
        };
      }
      conflictCount += 1;
      return {
        ...activity,
        scheduledTime: timeFromMinutes(scheduled),
        endTime: timeFromMinutes(end),
        openingNote: "이 시간에는 휴무일 수 있어 영업시간 확인이 필요해요.",
      };
    });
    return { ...day, activities };
  });
  const warnings = [...plan.warnings];
  if (adjustedCount > 0) warnings.push(`${adjustedCount}개 장소를 영업 시작 시간에 맞춰 자동 조정했어요.`);
  if (conflictCount > 0) warnings.push(`${conflictCount}개 장소는 영업시간을 다시 확인해 주세요.`);
  return { ...plan, days, warnings };
}

function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes}분`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}시간 ${remainder}분` : `${hours}시간`;
}

function priceLabel(priceLevel?: string) {
  if (!priceLevel || priceLevel === "PRICE_LEVEL_UNSPECIFIED") return "가격 정보 없음";
  const levels: Record<string, string> = {
    PRICE_LEVEL_FREE: "무료",
    PRICE_LEVEL_INEXPENSIVE: "¥",
    PRICE_LEVEL_MODERATE: "¥¥",
    PRICE_LEVEL_EXPENSIVE: "¥¥¥",
    PRICE_LEVEL_VERY_EXPENSIVE: "¥¥¥¥",
  };
  return levels[priceLevel] ?? "가격 정보 없음";
}

function PlaceCardPhoto({
  name,
  photoUrl,
  photoAttribution,
  photoLink,
  className,
}: {
  name: string;
  photoUrl?: string;
  photoAttribution?: { displayName: string; uri?: string };
  photoLink?: string;
  className: string;
}) {
  const [failedUrl, setFailedUrl] = useState("");
  const showPhoto = Boolean(photoUrl && failedUrl !== photoUrl);
  const image = showPhoto ? (
    // Google Places supplies a short-lived, resized photo URL through our API proxy.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={photoUrl}
      alt={`${name} 장소 사진`}
      width="240"
      height="180"
      loading="lazy"
      onError={() => setFailedUrl(photoUrl || "")}
    />
  ) : null;

  return (
    <div className={`place-card-photo ${className} ${showPhoto ? "has-photo" : "is-placeholder"}`}>
      {image ? (
        photoLink ? (
          <a href={photoLink} target="_blank" rel="noreferrer" aria-label={`${name} 사진을 Google Maps에서 크게 보기`}>
            {image}
          </a>
        ) : image
      ) : (
        <span aria-hidden="true">旅</span>
      )}
      {showPhoto && photoAttribution && (
        photoAttribution.uri || photoLink ? (
          <a className="place-card-photo-credit" href={photoAttribution.uri || photoLink} target="_blank" rel="noreferrer">
            사진: {photoAttribution.displayName}
          </a>
        ) : (
          <small className="place-card-photo-credit">사진: {photoAttribution.displayName}</small>
        )
      )}
    </div>
  );
}

export default function TripPlanner({
  regions,
  initialCourse,
  initialCatalog,
  googleMapsApiKey,
}: {
  regions: TravelRegion[];
  initialCourse: TravelCourse;
  initialCatalog: PlaceCatalog;
  googleMapsApiKey: string;
}) {
  const { user } = useAuth();
  const [regionId, setRegionId] = useState(initialCatalog.region.id);
  const [catalog, setCatalog] = useState(initialCatalog);
  const [hasChosenRegion, setHasChosenRegion] = useState(false);
  const [style, setStyle] = useState<TravelStyle>(initialCourse.style);
  const [mustVisitIds, setMustVisitIds] = useState<string[]>([]);
  const [recommendations, setRecommendations] = useState<PlaceRecommendation[]>([]);
  const [recommendationProvider, setRecommendationProvider] = useState<
    "google" | "catalog" | null
  >(null);
  const [recommendationKind, setRecommendationKind] = useState<RecommendationKind>("attractions");
  const [selectedPlaces, setSelectedPlaces] = useState<TravelPlace[]>([]);
  const [activePlaceId, setActivePlaceId] = useState("");
  const [lockedPlaceIds, setLockedPlaceIds] = useState<string[]>([]);
  const [draggedPlaceId, setDraggedPlaceId] = useState("");
  const [preferences, setPreferences] = useState<PlanPreferences>(defaultPreferences);
  const [itineraryPlan, setItineraryPlan] = useState<ItineraryPlan | null>(null);
  const [itineraryState, setItineraryState] = useState<
    "idle" | "loading" | "checking" | "ready" | "error"
  >("idle");
  const [placeDetailsById, setPlaceDetailsById] = useState<Record<string, PlaceDetails>>({});
  const [detailErrorIds, setDetailErrorIds] = useState<string[]>([]);
  const [shareState, setShareState] = useState<"idle" | "copied" | "error">("idle");
  const [savedCourses, setSavedCourses] = useState<TravelCourse[]>([]);
  const [catalogState, setCatalogState] = useState<"idle" | "loading" | "error">("idle");
  const [recommendationState, setRecommendationState] = useState<"idle" | "loading" | "error">("idle");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const stepTwoRef = useRef<HTMLDivElement>(null);
  const stepThreeRef = useRef<HTMLDivElement>(null);
  const sharedPlanLoadedRef = useRef(false);
  const detailsCacheRef = useRef<Record<string, PlaceDetails>>({});
  const detailsPromiseRef = useRef<Partial<Record<string, Promise<PlaceDetails | null>>>>({});

  const course = useMemo(
    () => buildCustomCourse({ region: catalog.region, places: selectedPlaces, style, dayCount: preferences.dayCount }),
    [catalog.region, preferences.dayCount, selectedPlaces, style],
  );
  const activePlace =
    selectedPlaces.find((place) => place.id === activePlaceId) ?? selectedPlaces[0] ?? null;
  const activeDetails = activePlace ? placeDetailsById[activePlace.id] : undefined;
  const detailsState = !activePlace
    ? "idle"
    : activeDetails
      ? "ready"
      : detailErrorIds.includes(activePlace.id)
        ? "error"
        : "loading";
  const mapCenter = useMemo<[number, number]>(
    () => [catalog.region.centerLon, catalog.region.centerLat],
    [catalog.region.centerLat, catalog.region.centerLon],
  );
  const stepTwoUnlocked = hasChosenRegion;
  const stepThreeUnlocked = mustVisitIds.length > 0;
  const currentStep = !hasChosenRegion ? 1 : !stepThreeUnlocked ? 2 : 3;

  const requestPlaceDetails = useCallback(async (place: TravelPlace) => {
    const cached = detailsCacheRef.current[place.id];
    if (cached) return cached;
    if (detailsPromiseRef.current[place.id]) return detailsPromiseRef.current[place.id];

    const request = fetch("/api/place-details", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ place, regionName: catalog.region.nameKo }),
    })
      .then(async (response) => {
        if (!response.ok) return null;
        const data = (await response.json()) as { details?: PlaceDetails };
        if (!data.details) return null;
        detailsCacheRef.current[place.id] = data.details;
        setPlaceDetailsById((current) => ({ ...current, [place.id]: data.details! }));
        return data.details;
      })
      .catch(() => null)
      .finally(() => {
        delete detailsPromiseRef.current[place.id];
      });
    detailsPromiseRef.current[place.id] = request;
    return request;
  }, [catalog.region.nameKo]);

  useEffect(() => {
    if (!activePlace || detailsCacheRef.current[activePlace.id]) return;
    let cancelled = false;
    void requestPlaceDetails(activePlace).then((details) => {
      if (cancelled) return;
      setDetailErrorIds((current) =>
        details
          ? current.filter((id) => id !== activePlace.id)
          : current.includes(activePlace.id)
            ? current
            : [...current, activePlace.id],
      );
    });
    return () => {
      cancelled = true;
    };
  }, [activePlace, requestPlaceDetails]);

  useEffect(() => {
    if (!stepTwoUnlocked) return;
    let cancelled = false;
    void (async () => {
      for (const place of catalog.mustVisits) {
        if (cancelled) break;
        await requestPlaceDetails(place);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [catalog.mustVisits, requestPlaceDetails, stepTwoUnlocked]);

  useEffect(() => {
    if (sharedPlanLoadedRef.current) return;
    sharedPlanLoadedRef.current = true;
    const encoded = new URLSearchParams(window.location.search).get("plan");
    if (!encoded) return;
    const shared = decodeSharedPlan(encoded);
    if (!shared) return;
    const sharedPlan = shared;
    let cancelled = false;
    async function hydrateSharedPlan() {
      try {
        let nextCatalog = catalog;
        if (sharedPlan.regionId !== catalog.region.id) {
          const response = await fetch(`/api/places?regionId=${encodeURIComponent(sharedPlan.regionId)}`);
          if (!response.ok) throw new Error("catalog_failed");
          const data = (await response.json()) as { catalog: PlaceCatalog };
          nextCatalog = data.catalog;
        }
        if (cancelled) return;
        setCatalog(nextCatalog);
        setRegionId(sharedPlan.regionId);
        setHasChosenRegion(true);
        setStyle(sharedPlan.style);
        setPreferences(sharedPlan.preferences);
        setSelectedPlaces(sharedPlan.places);
        setMustVisitIds(
          sharedPlan.places
            .filter((place) => nextCatalog.mustVisits.some((mustVisit) => mustVisit.id === place.id))
            .map((place) => place.id),
        );
        setLockedPlaceIds(sharedPlan.lockedPlaceIds);
        setActivePlaceId(sharedPlan.places[0]?.id ?? "");
      } catch {
        if (!cancelled) setShareState("error");
      }
    }
    void hydrateSharedPlan();
    return () => {
      cancelled = true;
    };
  }, [catalog]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    async function loadSavedCourses() {
      try {
        const response = await fetch("/api/trips");
        if (!response.ok) throw new Error("saved_courses_failed");
        const data = (await response.json()) as { courses: TravelCourse[] };
        if (!cancelled) setSavedCourses(data.courses);
      } catch {
        if (!cancelled) setSavedCourses([]);
      }
    }
    loadSavedCourses();
    return () => {
      cancelled = true;
    };
  }, [user]);

  function resetGeneratedPlan() {
    setItineraryPlan(null);
    setItineraryState("idle");
    setShareState("idle");
    setSaveState("idle");
  }

  async function loadCatalog(nextRegionId: string) {
    if (hasChosenRegion && nextRegionId === regionId) return;

    setHasChosenRegion(true);
    setRegionId(nextRegionId);
    setMustVisitIds([]);
    setRecommendations([]);
    setRecommendationProvider(null);
    setRecommendationKind("attractions");
    setSelectedPlaces([]);
    setActivePlaceId("");
    setLockedPlaceIds([]);
    setItineraryPlan(null);
    setItineraryState("idle");
    setPlaceDetailsById({});
    setDetailErrorIds([]);
    detailsCacheRef.current = {};
    setSaveState("idle");

    if (nextRegionId === catalog.region.id) {
      setCatalogState("idle");
      window.setTimeout(
        () => stepTwoRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }),
        180,
      );
      return;
    }

    setCatalogState("loading");
    try {
      const response = await fetch(`/api/places?regionId=${encodeURIComponent(nextRegionId)}`);
      if (!response.ok) throw new Error("catalog_failed");
      const data = (await response.json()) as { catalog: PlaceCatalog };
      setCatalog(data.catalog);
      setCatalogState("idle");
      window.setTimeout(
        () => stepTwoRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }),
        180,
      );
    } catch {
      setCatalogState("error");
    }
  }

  function toggleMustVisit(place: TravelPlace) {
    const selected = mustVisitIds.includes(place.id);
    const unlocksNextStep = !selected && mustVisitIds.length === 0;
    setMustVisitIds((current) =>
      selected ? current.filter((id) => id !== place.id) : [...current, place.id],
    );
    setSelectedPlaces((current) =>
      selected
        ? current.filter((candidate) => candidate.id !== place.id)
        : current.some((candidate) => candidate.id === place.id) || current.length >= 9
          ? current
          : [...current, place],
    );
    if (!selected) setActivePlaceId(place.id);
    setRecommendations([]);
    setRecommendationProvider(null);
    setRecommendationState("idle");
    resetGeneratedPlan();
    if (unlocksNextStep) {
      window.setTimeout(
        () => stepThreeRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }),
        220,
      );
    }
  }

  async function generateRecommendations(kind: RecommendationKind = recommendationKind) {
    if (mustVisitIds.length === 0) return;
    setRecommendationKind(kind);
    setRecommendationState("loading");
    setSaveState("idle");
    try {
      const response = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ regionId, style, anchorPlaceIds: mustVisitIds, kind }),
      });
      if (!response.ok) throw new Error("recommendation_failed");
      const data = (await response.json()) as {
        recommendations: PlaceRecommendation[];
        provider: "google" | "catalog";
      };
      setRecommendations(data.recommendations);
      setRecommendationProvider(data.provider);
      setRecommendationState("idle");
    } catch {
      setRecommendationState("error");
    }
  }

  function toggleRecommendedPlace(place: PlaceRecommendation) {
    const selected = selectedPlaces.some((candidate) => candidate.id === place.id);
    setSelectedPlaces((current) =>
      selected
        ? current.filter((candidate) => candidate.id !== place.id)
        : current.length >= 9
          ? current
          : [...current, place],
    );
    if (!selected) setActivePlaceId(place.id);
    resetGeneratedPlan();
  }

  function removeCoursePlace(placeId: string) {
    setSelectedPlaces((current) => current.filter((place) => place.id !== placeId));
    setMustVisitIds((current) => current.filter((id) => id !== placeId));
    if (mustVisitIds.includes(placeId)) {
      setRecommendations([]);
      setRecommendationProvider(null);
      setRecommendationState("idle");
    }
    setLockedPlaceIds((current) => current.filter((id) => id !== placeId));
    resetGeneratedPlan();
  }

  function moveCoursePlace(placeId: string, direction: -1 | 1) {
    setSelectedPlaces((current) => {
      const index = current.findIndex((place) => place.id === placeId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
    resetGeneratedPlan();
  }

  function dropCoursePlace(targetPlaceId: string) {
    if (!draggedPlaceId || draggedPlaceId === targetPlaceId) return;
    setSelectedPlaces((current) => {
      const from = current.findIndex((place) => place.id === draggedPlaceId);
      const to = current.findIndex((place) => place.id === targetPlaceId);
      if (from < 0 || to < 0) return current;
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    setDraggedPlaceId("");
    resetGeneratedPlan();
  }

  function togglePlaceLock(placeId: string) {
    setLockedPlaceIds((current) =>
      current.includes(placeId)
        ? current.filter((id) => id !== placeId)
        : [...current, placeId],
    );
    resetGeneratedPlan();
  }

  async function generateItinerary() {
    if (selectedPlaces.length === 0 || itineraryState === "loading") return;
    setItineraryState("loading");
    setShareState("idle");
    try {
      const response = await fetch("/api/itinerary", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ places: selectedPlaces, preferences, lockedPlaceIds }),
      });
      if (!response.ok) throw new Error("itinerary_failed");
      const data = (await response.json()) as { plan: ItineraryPlan };
      setItineraryPlan(data.plan);
      const orderedPlaces = data.plan.days.flatMap((day) =>
        day.activities.flatMap((activity) => activity.kind === "place" ? [activity.place] : []),
      );
      setSelectedPlaces(orderedPlaces);
      setActivePlaceId((current) => current || orderedPlaces[0]?.id || "");
      setItineraryState("checking");
      const details = await Promise.all(
        orderedPlaces.map(async (place) => [place.id, await requestPlaceDetails(place)] as const),
      );
      const detailsMap = Object.fromEntries(
        details.filter((entry): entry is readonly [string, PlaceDetails] => Boolean(entry[1])),
      );
      setItineraryPlan(adjustPlanForOpeningHours(data.plan, detailsMap));
      setItineraryState("ready");
    } catch {
      setItineraryState("error");
    }
  }

  function updatePreferences<Key extends keyof PlanPreferences>(key: Key, value: PlanPreferences[Key]) {
    setPreferences((current) => ({ ...current, [key]: value }));
    resetGeneratedPlan();
  }

  function googleDirectionsUrl() {
    if (selectedPlaces.length === 0) return "https://www.google.com/maps/dir/?api=1";
    if (selectedPlaces.length === 1) return selectedPlaces[0].externalUrl ||
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${selectedPlaces[0].latitude},${selectedPlaces[0].longitude}`)}`;
    const parameters = new URLSearchParams({ api: "1" });
    const coordinate = (place: TravelPlace) => `${place.latitude},${place.longitude}`;
    parameters.set("origin", preferences.startLocation.trim() || coordinate(selectedPlaces[0]));
    parameters.set("destination", coordinate(selectedPlaces[selectedPlaces.length - 1]));
    const waypoints = preferences.startLocation.trim()
      ? selectedPlaces.slice(0, -1)
      : selectedPlaces.slice(1, -1);
    if (waypoints.length) parameters.set("waypoints", waypoints.map(coordinate).join("|"));
    parameters.set(
      "travelmode",
      preferences.transport === "transit" ? "transit" : preferences.transport === "driving" ? "driving" : "walking",
    );
    return `https://www.google.com/maps/dir/?${parameters.toString()}`;
  }

  async function shareCurrentPlan() {
    if (selectedPlaces.length === 0) return;
    const encoded = encodeSharedPlan({ regionId, style, places: selectedPlaces, preferences, lockedPlaceIds });
    const url = new URL(window.location.href);
    url.searchParams.set("plan", encoded);
    try {
      await navigator.clipboard.writeText(url.toString());
      window.history.replaceState(null, "", url);
      setShareState("copied");
    } catch {
      setShareState("error");
    }
  }

  function exportCalendar() {
    if (!itineraryPlan || !preferences.startDate) return;
    const escapeText = (value: string) => value.replaceAll("\\", "\\\\").replaceAll(",", "\\,").replaceAll(";", "\\;").replaceAll("\n", "\\n");
    const events = itineraryPlan.days.flatMap((day) =>
      day.activities.flatMap((activity) => {
        if (activity.kind !== "place" || !day.date) return [];
        const date = day.date.replaceAll("-", "");
        return [
          "BEGIN:VEVENT",
          `UID:${crypto.randomUUID()}@momotabi`,
          `DTSTAMP:${new Date().toISOString().replaceAll(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")}`,
          `DTSTART;TZID=Asia/Tokyo:${date}T${activity.scheduledTime.replace(":", "")}00`,
          `DTEND;TZID=Asia/Tokyo:${date}T${activity.endTime.replace(":", "")}00`,
          `SUMMARY:${escapeText(activity.place.name)}`,
          `DESCRIPTION:${escapeText(activity.place.description)}`,
          `LOCATION:${activity.place.latitude},${activity.place.longitude}`,
          "END:VEVENT",
        ];
      }),
    );
    const calendar = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//MOMOTABI//Travel Plan//KO", "CALSCALE:GREGORIAN", ...events, "END:VCALENDAR"].join("\r\n");
    const href = URL.createObjectURL(new Blob([calendar], { type: "text/calendar;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = href;
    link.download = `momotabi-${regionId}-${preferences.startDate}.ics`;
    link.click();
    URL.revokeObjectURL(href);
  }

  async function showSavedCourse(savedCourse: TravelCourse) {
    const places = savedCourse.days.flatMap((day) => day.places);
    setHasChosenRegion(true);
    setRegionId(savedCourse.region.id);
    setCatalogState("loading");
    try {
      const response = await fetch(`/api/places?regionId=${encodeURIComponent(savedCourse.region.id)}`);
      if (!response.ok) throw new Error("catalog_failed");
      const data = (await response.json()) as { catalog: PlaceCatalog };
      setCatalog(data.catalog);
      setMustVisitIds(
        places
          .filter((place) => data.catalog.mustVisits.some((mustVisit) => mustVisit.id === place.id))
          .map((place) => place.id),
      );
      setCatalogState("idle");
    } catch {
      setCatalog({ region: savedCourse.region, mustVisits: [], places });
      setMustVisitIds([]);
      setCatalogState("error");
    }
    setStyle(savedCourse.style);
    setPreferences((current) => ({ ...current, dayCount: savedCourse.dayCount }));
    setRecommendations([]);
    setRecommendationProvider(null);
    setRecommendationKind("attractions");
    setSelectedPlaces(places);
    setActivePlaceId(places[0]?.id ?? "");
    setLockedPlaceIds([]);
    setItineraryPlan(null);
    setItineraryState("idle");
    setSaveState("saved");
  }

  async function saveCurrentCourse() {
    if (selectedPlaces.length === 0 || saveState === "saving") return;
    if (!user) {
      window.location.assign("/login");
      return;
    }
    setSaveState("saving");
    try {
      const response = await fetch("/api/trips", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          regionId,
          style,
          dayCount: course.dayCount,
          placeIds: selectedPlaces.map((place) => place.id),
          placeSnapshots: selectedPlaces.filter((place) => place.source === "google"),
        }),
      });
      if (!response.ok) throw new Error("save_failed");
      const data = (await response.json()) as { course: TravelCourse };
      setSavedCourses((current) => [data.course, ...current.filter((saved) => saved.id !== data.course.id)]);
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }

  async function signOut() {
    await authClient.signOut();
    window.location.assign("/");
  }

  const userInitial = user?.displayName.trim().charAt(0).toUpperCase() || "M";
  const durationLabel = activePlace
    ? `${Math.max(1, Math.round(activePlace.durationMinutes / 60))}시간 추천`
    : "";
  const activePlaceMapUrl = activePlace
    ? activePlace.externalUrl ||
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        `${activePlace.latitude},${activePlace.longitude}`,
      )}`
    : "";
  const activePlanEntry = activePlace
    ? itineraryPlan?.days.flatMap((day) =>
        day.activities.flatMap((activity) =>
          activity.kind === "place" && activity.place.id === activePlace.id
            ? [{ day, activity }]
            : [],
        ),
      )[0]
    : undefined;
  const activeOpeningStatus = activePlanEntry
    ? openingStatus(activeDetails, activePlanEntry.day.date, activePlanEntry.activity.scheduledTime)
    : "unknown";

  return (
    <main className="app-shell" id="top">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="모모타비 홈"><span className="brand-mark">も</span><span>MOMOTABI</span></a>
        <nav aria-label="주요 메뉴">
          <a className="section-link active" href="#planner">코스 만들기</a>
          <a className="section-link" href="#saved">내 코스</a>
          <button className={`save-button ${saveState === "saved" ? "is-saved" : ""}`} onClick={saveCurrentCourse} type="button" disabled={selectedPlaces.length === 0 || saveState === "saving"}>
            {!user ? "로그인 후 저장" : saveState === "saving" ? "저장 중…" : saveState === "saved" ? "저장됨 ✓" : "이 코스 저장"}
          </button>
          {user ? (
            <div className="account-control">
              <div className="account-chip" title={user.email} aria-label={`${user.displayName} 계정으로 로그인됨`}><span className="account-avatar" aria-hidden="true">{userInitial}</span><span className="account-copy"><strong>{user.displayName}</strong><small>로그인됨</small></span></div>
              <button className="sign-out-link" type="button" onClick={signOut}>로그아웃</button>
            </div>
          ) : <a className="sign-in-link" href="/login">로그인</a>}
        </nav>
      </header>

      <section className="route-panel" id="planner">
        <div className="route-heading">
          <div className="city-chip"><span className="city-dot" /> {catalog.region.nameEn} <b>{catalog.region.nameJp}</b></div>
          <p className="eyebrow">BUILD YOUR OWN ROUTE · {catalog.region.eyebrow}</p>
          <h1>꼭 가고 싶은 곳부터<br />나만의 코스로</h1>
          <p className="intro">필수 관광지를 고르면 가까이 함께 둘러보기 좋은 장소를 추천해 드려요.</p>
          <div className="route-meta" aria-label="코스 요약"><span>{selectedPlaces.length}개 장소</span><i /><span>{course.dayCount}일 예상</span><i /><span>{styleLabels[style]}</span></div>
        </div>

        <section className="planner-card guided-planner" aria-labelledby="planner-title">
          <div className="planner-title-row"><div><span>STEP BY STEP</span><h2 id="planner-title">여행 코스를 만들어 볼까요?</h2></div><strong>{String(currentStep).padStart(2, "0")} — 03</strong></div>

          <div className={`planner-step ${hasChosenRegion ? "is-complete" : "is-active"}`}>
            <div className="step-heading">
              <b>{hasChosenRegion ? "✓" : "01"}</b>
              <div><span>여행 지역</span><h3>어디로 떠나나요?</h3></div>
              <small className="step-state">{hasChosenRegion ? `${catalog.region.nameKo} 선택됨` : "지금 선택해 주세요"}</small>
            </div>
            <div className="region-switcher" role="group" aria-label="여행 지역 선택">
              {regions.map((region) => <button key={region.id} type="button" className={hasChosenRegion && regionId === region.id ? "selected" : ""} aria-pressed={hasChosenRegion && regionId === region.id} onClick={() => loadCatalog(region.id)} disabled={catalogState === "loading"}>{region.nameKo}<small>{region.nameEn}</small></button>)}
            </div>
            {catalogState === "error" && <p className="inline-error" role="alert">지역 관광지를 불러오지 못했어요.</p>}
          </div>

          <div ref={stepTwoRef} className={`planner-step ${!stepTwoUnlocked ? "is-locked" : stepThreeUnlocked ? "is-complete" : "is-active"}`} aria-disabled={!stepTwoUnlocked}>
            <div className="step-heading">
              <b>{stepThreeUnlocked ? "✓" : "02"}</b>
              <div><span>필수 관광지</span><h3>놓치고 싶지 않은 곳을 골라주세요</h3></div>
              <small className="step-state">{!stepTwoUnlocked ? "1단계 선택 후 열림" : mustVisitIds.length > 0 ? `${mustVisitIds.length}/${catalog.mustVisits.length}곳 선택됨` : `${catalog.mustVisits.length}곳 중 골라주세요`}</small>
            </div>
            {!stepTwoUnlocked ? (
              <div className="step-locked-message"><span aria-hidden="true">02</span><p>먼저 여행 지역을 선택하면<br />필수 관광지 목록이 열려요.</p></div>
            ) : (
              <div className="step-reveal">
                {catalogState === "loading" ? (
                  <div className="step-loading" role="status"><i /><span>이 지역의 필수 관광지를 불러오고 있어요.</span></div>
                ) : catalogState === "error" ? (
                  <p className="inline-error" role="alert">필수 관광지 목록을 불러오지 못했어요. 지역을 다시 선택해 주세요.</p>
                ) : (
                  <div className="must-visit-list" role="group" aria-label="필수 관광지 선택">
                    {catalog.mustVisits.map((place, index) => {
                      const selected = mustVisitIds.includes(place.id);
                      const details = placeDetailsById[place.id];
                      return (
                        <article key={place.id} className={selected ? "selected" : ""} style={{ animationDelay: `${index * 55}ms` }}>
                          <PlaceCardPhoto
                            name={place.name}
                            photoUrl={details?.photoUrl}
                            photoAttribution={details?.photoAttribution}
                            photoLink={details?.photoGoogleMapsUri || details?.googleMapsUri}
                            className="must-visit-photo"
                          />
                          <div className="must-visit-copy">
                            <span>{selected ? "코스에 포함됨" : place.category}</span>
                            <strong>{place.name}</strong>
                            <small>{place.description}</small>
                            <em>약 {Math.max(1, Math.round(place.durationMinutes / 60))}시간 · {place.suggestedTime} 추천</em>
                          </div>
                          <button type="button" aria-pressed={selected} onClick={() => toggleMustVisit(place)} aria-label={`${place.name} ${selected ? "선택 해제" : "선택"}`}>{selected ? "선택됨 ✓" : "+ 선택"}</button>
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          <div ref={stepThreeRef} className={`planner-step ${stepThreeUnlocked ? "is-active" : "is-locked"}`} aria-disabled={!stepThreeUnlocked}>
            <div className="step-heading">
              <b>03</b>
              <div><span>근교 추천</span><h3>선택한 곳 근처를 함께 둘러봐요</h3></div>
              <small className="step-state">{stepThreeUnlocked ? styleLabels[style] : "2단계 선택 후 열림"}</small>
            </div>
            {!stepThreeUnlocked ? (
              <div className="step-locked-message"><span aria-hidden="true">03</span><p>필수 관광지를 하나 이상 선택하면<br />근교 추천 설정이 열려요.</p></div>
            ) : (
              <div className="step-reveal">
                <div className="style-switcher compact" role="group" aria-label="여행 스타일 선택">
                  {travelStyles.map((item) => <button key={item} type="button" className={style === item ? "selected" : ""} aria-pressed={style === item} onClick={() => { setStyle(item); setRecommendations([]); setRecommendationProvider(null); resetGeneratedPlan(); }}>{styleLabels[item]}</button>)}
                </div>
                <div className="recommend-kind" role="group" aria-label="추천 종류">
                  <button type="button" className={recommendationKind === "attractions" ? "selected" : ""} onClick={() => { setRecommendationKind("attractions"); setRecommendations([]); }}>관광지</button>
                  <button type="button" className={recommendationKind === "food" ? "selected" : ""} onClick={() => { setRecommendationKind("food"); setRecommendations([]); }}>맛집·카페</button>
                </div>
                <button className="recommend-button" type="button" onClick={() => generateRecommendations()} disabled={recommendationState === "loading"}><span>{recommendationState === "loading" ? "가까운 장소를 찾는 중…" : recommendationKind === "food" ? "동선 근처 맛집 추천받기" : "근교 관광지 추천받기"}</span><b aria-hidden="true">→</b></button>
                {recommendationState === "error" && <p className="inline-error" role="alert">근교 추천을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</p>}
                {recommendations.length > 0 && (
                  <div className="nearby-list" aria-label={recommendationKind === "food" ? "근처 맛집 추천" : "근교 추천 관광지"}>
                    <p className="nearby-summary"><strong>{recommendations.length}곳</strong>을 찾았어요. 마음에 드는 장소를 코스에 담아보세요.</p>
                    {recommendations.map((place, index) => {
                      const selected = selectedPlaces.some((candidate) => candidate.id === place.id);
                      return (
                        <article key={place.id} className={selected ? "selected" : ""} style={{ animationDelay: `${index * 45}ms` }}>
                          <PlaceCardPhoto
                            name={place.name}
                            photoUrl={place.photoUrl}
                            photoAttribution={place.photoAttribution}
                            photoLink={place.photoGoogleMapsUri || place.externalUrl}
                            className="nearby-photo"
                          />
                          <div className="nearby-copy">
                            <span>{place.nearAnchorName}에서 {place.distanceKm}km</span>
                            <strong>{place.name}</strong>
                            <small>{place.category} · {place.description}</small>
                          </div>
                          <button type="button" onClick={() => toggleRecommendedPlace(place)} aria-label={`${place.name} ${selected ? "코스에서 빼기" : "코스에 담기"}`}>{selected ? "담김 ✓" : "+ 담기"}</button>
                        </article>
                      );
                    })}
                    <p className={`places-source ${recommendationProvider === "google" ? "is-google" : ""}`}>
                      {recommendationProvider === "google"
                        ? "Google Maps의 최신 장소 정보를 바탕으로 추천했어요."
                        : "Google Places를 사용할 수 없어 저장된 관광지 목록으로 추천했어요."}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        <section className="course-builder" aria-labelledby="course-title">
          <div className="saved-heading"><div><span>MY ROUTE</span><h2 id="course-title">내 여행 코스</h2></div><small>{selectedPlaces.length}/9개 장소</small></div>
          {selectedPlaces.length === 0 ? <p className="saved-empty">필수 관광지를 선택하면 지도와 코스에 바로 표시됩니다.</p> : (
            <div className="course-place-list" role="list" aria-label="내 여행 코스에 담긴 관광지">
              {selectedPlaces.map((place, index) => {
                const locked = lockedPlaceIds.includes(place.id);
                return (
                  <div
                    key={place.id}
                    className={`${place.id === activePlace?.id ? "active" : ""} ${locked ? "is-locked" : ""} ${draggedPlaceId === place.id ? "is-dragging" : ""}`}
                    role="listitem"
                    draggable
                    onDragStart={() => setDraggedPlaceId(place.id)}
                    onDragEnd={() => setDraggedPlaceId("")}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => dropCoursePlace(place.id)}
                  >
                    <span className="course-drag" aria-hidden="true">⠿</span>
                    <button className="course-place-main" type="button" onClick={() => setActivePlaceId(place.id)}>
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <div><small>{place.category}</small><strong>{place.name}</strong></div>
                    </button>
                    <div className="course-place-actions">
                      <button type="button" className={locked ? "selected" : ""} onClick={() => togglePlaceLock(place.id)} aria-label={`${place.name} ${locked ? "고정 해제" : "순서 고정"}`} title={locked ? "순서 고정 해제" : "순서 고정"}>{locked ? "●" : "○"}</button>
                      <button type="button" onClick={() => moveCoursePlace(place.id, -1)} disabled={index === 0} aria-label={`${place.name} 위로 이동`}>↑</button>
                      <button type="button" onClick={() => moveCoursePlace(place.id, 1)} disabled={index === selectedPlaces.length - 1} aria-label={`${place.name} 아래로 이동`}>↓</button>
                      <button type="button" className="course-place-remove" onClick={() => removeCoursePlace(place.id)} aria-label={`${place.name} 코스에서 빼기`}>×</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {selectedPlaces.length > 1 && <p className="course-edit-tip">⠿를 끌거나 화살표로 순서를 바꾸고, ○를 눌러 꼭 유지할 장소를 고정하세요.</p>}
          {activePlace && (
            <section className="place-detail-card" aria-labelledby="active-place-title">
              {detailsState === "loading" && <div className="detail-loading" role="status"><i /><span>평점과 영업시간을 확인하고 있어요.</span></div>}
              {detailsState === "error" && <div className="detail-unavailable"><strong id="active-place-title">{activePlace.name}</strong><span>상세 정보를 불러오지 못했지만 코스에는 그대로 사용할 수 있어요.</span></div>}
              {activeDetails && (
                <div className="place-detail-copy">
                    <span>PLACE DETAILS</span>
                    <h3 id="active-place-title">{activeDetails.name}</h3>
                    <div className="place-detail-stats">
                      <strong>{activeDetails.rating ? `★ ${activeDetails.rating.toFixed(1)}` : "평점 정보 없음"}</strong>
                      {activeDetails.userRatingCount ? <small>리뷰 {activeDetails.userRatingCount.toLocaleString("ko-KR")}개</small> : null}
                      <small>{priceLabel(activeDetails.priceLevel)}</small>
                    </div>
                    <p>{activeDetails.address}</p>
                    <div className={`opening-badge ${activeOpeningStatus === "closed" ? "is-warning" : ""}`}>
                      {activePlanEntry
                        ? activeOpeningStatus === "open"
                          ? `${activePlanEntry.day.date} ${activePlanEntry.activity.scheduledTime} 방문 가능`
                          : activeOpeningStatus === "closed"
                            ? "일정 시간과 영업시간이 겹치지 않아요"
                            : "일정 생성 후 영업시간을 함께 확인해 드려요"
                        : activeDetails.openNow === true
                          ? "현재 영업 중"
                          : activeDetails.openNow === false
                            ? "현재 영업 종료"
                            : "영업시간 정보 없음"}
                    </div>
                    {activeDetails.weekdayDescriptions.length > 0 && (
                      <details><summary>요일별 영업시간</summary><ul>{activeDetails.weekdayDescriptions.map((description) => <li key={description}>{description}</li>)}</ul></details>
                    )}
                    <div className="place-detail-links">
                      <a href={activeDetails.googleMapsUri || activePlaceMapUrl} target="_blank" rel="noreferrer">Google 지도 ↗</a>
                      {activeDetails.websiteUri && <a href={activeDetails.websiteUri} target="_blank" rel="noreferrer">공식 사이트 ↗</a>}
                    </div>
                  </div>
              )}
            </section>
          )}
          {saveState === "error" && <p className="inline-error" role="alert">코스를 저장하지 못했어요. 로그인 상태를 확인해 주세요.</p>}
        </section>

        <section className="itinerary-builder" aria-labelledby="itinerary-title">
          <div className="saved-heading"><div><span>SMART ITINERARY</span><h2 id="itinerary-title">여행 일정 자동 완성</h2></div><small>동선·영업시간 반영</small></div>
          <p className="itinerary-intro">여행 조건을 알려주면 가까운 장소끼리 묶고, 영업시간과 식사 시간을 확인해 하루별 일정을 만들어요.</p>
          <div className="preference-grid">
            <label><span>여행 시작일</span><input type="date" value={preferences.startDate} onChange={(event) => updatePreferences("startDate", event.target.value)} /></label>
            <label><span>여행 일수</span><select value={preferences.dayCount} onChange={(event) => updatePreferences("dayCount", Number(event.target.value))}><option value={1}>1일</option><option value={2}>2일</option><option value={3}>3일</option></select></label>
            <label className="wide"><span>출발지 또는 숙소</span><input type="text" maxLength={180} value={preferences.startLocation} onChange={(event) => updatePreferences("startLocation", event.target.value)} placeholder="예: 신주쿠역, 호텔 이름 (선택)" /></label>
            <label><span>여행 속도</span><select value={preferences.pace} onChange={(event) => updatePreferences("pace", event.target.value as PlanPreferences["pace"])}>{travelPaces.map((pace) => <option key={pace} value={pace}>{paceLabels[pace]}</option>)}</select></label>
            <label><span>예산</span><select value={preferences.budget} onChange={(event) => updatePreferences("budget", event.target.value as PlanPreferences["budget"])}>{travelBudgets.map((budget) => <option key={budget} value={budget}>{budgetLabels[budget]}</option>)}</select></label>
          </div>
          <fieldset className="preference-group"><legend>누구와 가나요?</legend><div>{companionTypes.map((companion) => <button key={companion} type="button" className={preferences.companion === companion ? "selected" : ""} onClick={() => updatePreferences("companion", companion)}>{companionLabels[companion]}</button>)}</div></fieldset>
          <fieldset className="preference-group"><legend>주요 이동 수단</legend><div>{transportModes.map((transport) => <button key={transport} type="button" className={preferences.transport === transport ? "selected" : ""} onClick={() => updatePreferences("transport", transport)}>{transportLabels[transport]}</button>)}</div></fieldset>
          <div className="meal-toggle"><input id="include-meals" type="checkbox" aria-label="식사 시간도 일정에 넣기" checked={preferences.includeMeals} onChange={(event) => updatePreferences("includeMeals", event.target.checked)} /><span><strong>식사 시간도 일정에 넣기</strong><small>동선 중간에 60~75분의 점심 시간을 자동으로 확보해요.</small></span></div>
          <button className="itinerary-generate" type="button" onClick={generateItinerary} disabled={selectedPlaces.length === 0 || itineraryState === "loading" || itineraryState === "checking"}>
            <span>{itineraryState === "loading" ? "Google 경로를 계산하는 중…" : itineraryState === "checking" ? "영업시간을 확인하고 조정하는 중…" : "내 일정 자동 완성하기"}</span><b aria-hidden="true">↗</b>
          </button>
          {selectedPlaces.length === 0 && <p className="itinerary-help">먼저 필수 관광지를 하나 이상 선택해 주세요.</p>}
          {itineraryState === "error" && <p className="inline-error" role="alert">일정을 만들지 못했어요. 잠시 후 다시 시도해 주세요.</p>}

          {itineraryPlan && (
            <div className="itinerary-result" aria-live="polite">
              <div className="itinerary-result-head"><div><span>{itineraryPlan.provider === "google" ? "GOOGLE ROUTES" : "DISTANCE ESTIMATE"}</span><strong>{itineraryPlan.days.length}일 일정이 완성됐어요</strong></div><small>{itineraryPlan.provider === "google" ? "실제 이동 경로 기준" : "장소 간 거리 기준"}</small></div>
              {itineraryPlan.warnings.length > 0 && <div className="plan-warnings">{itineraryPlan.warnings.map((warning) => <p key={warning}>ℹ {warning}</p>)}</div>}
              <div className="itinerary-days">
                {itineraryPlan.days.map((day) => (
                  <article className="itinerary-day" key={day.dayNumber}>
                    <header><div><span>DAY {String(day.dayNumber).padStart(2, "0")}</span><strong>{day.date || `${day.dayNumber}일차`}</strong></div><small>이동 {formatDuration(day.totalTravelMinutes)} · {day.totalDistanceKm.toFixed(1)}km</small></header>
                    <div className="timeline">
                      {day.activities.map((activity) => activity.kind === "meal" ? (
                        <div className="timeline-item is-meal" key={activity.id}>
                          <time>{activity.scheduledTime}</time><i aria-hidden="true">餐</i><div><strong>{activity.label}</strong><small>{activity.nearPlaceName} 주변에서 맛집을 골라보세요.</small><button type="button" onClick={() => { void generateRecommendations("food"); stepThreeRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>근처 맛집 찾기 →</button></div>
                        </div>
                      ) : (
                        <button className={`timeline-item ${activePlace?.id === activity.place.id ? "active" : ""}`} key={activity.place.id} type="button" onClick={() => setActivePlaceId(activity.place.id)}>
                          <time>{activity.scheduledTime}</time><i aria-hidden="true" /><div><strong>{activity.place.name}</strong><small>{activity.travelMinutesFromPrevious > 0 ? `이전 장소에서 ${formatDuration(activity.travelMinutesFromPrevious)} · ` : ""}{activity.endTime}까지</small>{activity.openingNote && <em>{activity.openingNote}</em>}</div>
                        </button>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}

          <div className="export-actions" aria-label="일정 공유와 내보내기">
            <button type="button" onClick={shareCurrentPlan} disabled={selectedPlaces.length === 0}>{shareState === "copied" ? "링크 복사됨 ✓" : "공유 링크 복사"}</button>
            <a href={googleDirectionsUrl()} target="_blank" rel="noreferrer" aria-disabled={selectedPlaces.length === 0}>Google Maps에서 열기 ↗</a>
            <button type="button" onClick={exportCalendar} disabled={!itineraryPlan || !preferences.startDate}>캘린더로 내보내기</button>
          </div>
          {shareState === "error" && <p className="inline-error" role="alert">공유 링크를 복사하지 못했어요. 주소창의 링크를 직접 복사해 주세요.</p>}
        </section>

        <section className="saved-courses" id="saved" aria-labelledby="saved-title">
          <div className="saved-heading"><div><span>SAVED ROUTES</span><h2 id="saved-title">저장한 코스</h2></div>{user && <small>{savedCourses.length}개 저장됨</small>}</div>
          {!user ? <p className="saved-empty">로그인하면 직접 담은 관광지와 순서를 계정에 저장할 수 있어요.</p> : savedCourses.length === 0 ? <p className="saved-empty">아직 저장한 코스가 없어요. 관광지를 담고 첫 코스를 저장해 보세요.</p> : (
            <div className="saved-list">{savedCourses.map((saved) => <button key={saved.id} type="button" onClick={() => showSavedCourse(saved)}><span>{saved.region.nameKo} · {saved.days.flatMap((day) => day.places).length}곳</span><strong>{saved.title}</strong><small>지도에서 다시 보기 →</small></button>)}</div>
          )}
        </section>
        <aside className="tip-card" id="tips"><span>LOCAL TIP</span><p><strong>{catalog.region.tipTitle}</strong> {catalog.region.tipText}</p></aside>
        <p className="disclaimer">거리 추천은 관광지 좌표의 직선거리를 기준으로 하며 실제 이동 시간과 다를 수 있어요.</p>
      </section>

      <section className="map-panel" aria-label={`${catalog.region.nameKo} 내 여행 코스 지도`}>
        <TravelMap apiKey={googleMapsApiKey} places={selectedPlaces} activePlaceId={activePlace?.id ?? ""} center={mapCenter} onSelect={setActivePlaceId} />
        <div className="map-shade" aria-hidden="true" />
        <div className="map-label">{catalog.region.nameKo} · 내 코스 {selectedPlaces.length}곳</div>
        <div className="map-legend" aria-label="지도 범례"><span><i /> 내 이동 동선</span><span><b>01</b> 방문 순서</span></div>
        {activePlace ? <><div className="map-float" aria-live="polite"><span>MY ROUTE · STOP {String(selectedPlaces.indexOf(activePlace) + 1).padStart(2, "0")}</span><strong>{activePlace.name}</strong><small>{activePlace.suggestedTime} 추천 · {durationLabel}</small></div><a className="open-map" href={activePlaceMapUrl} target="_blank" rel="noreferrer" aria-label={`${activePlace.name} Google 지도에서 열기`}>Google 지도에서 보기 ↗</a></> : <div className="map-empty"><span>YOUR ROUTE MAP</span><strong>관광지를 선택하면<br />여기에 코스가 그려져요.</strong><small>선택한 순서대로 번호와 이동선이 표시됩니다.</small></div>}
      </section>
    </main>
  );
}
