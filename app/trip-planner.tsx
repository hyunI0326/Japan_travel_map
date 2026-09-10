"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "./auth-context";
import TripCompanion from "./trip-companion";
import { emptyJournal, publicPlan, type TripJournal } from "@/lib/trip-journal";
import BudgetCalculator from "./budget-calculator";
import PolicyLinks from "./policy-links";
import SiteLink from "./site-link";
import TravelMap from "./travel-map";
import JapanDiorama from "./japan-diorama";
import { authClient } from "@/lib/auth-client";
import { trackFunnelEvent } from "@/lib/analytics-client";
import {
  createBudgetEstimate,
  normalizeBudgetEstimate,
  type BudgetEstimate,
} from "@/lib/budget";
import { adjustPlanForOpeningHours, openingStatus } from "@/lib/itinerary-schedule";
import { parseSharedPlan, type SharedPlan } from "@/lib/share-types";
import {
  MAX_TRIP_DAYS,
  MAX_TRIP_PLACES,
  buildCustomCourse,
  budgetLabels,
  companionLabels,
  companionTypes,
  isPublicTransportMode,
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

const draftStorageKey = "momotabi:planner-draft:v1";

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
    return parseSharedPlan(JSON.parse(new TextDecoder().decode(bytes)));
  } catch {
    return null;
  }
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

function recommendationTravelLabel(place: PlaceRecommendation) {
  if (typeof place.travelMinutes === "number" && place.travelMode) {
    const mode = transportLabels[place.travelMode].replace(" 중심", "");
    const estimate = place.travelEstimate ? "약 " : "";
    return `${place.nearAnchorName}에서 ${mode} ${estimate}${formatDuration(place.travelMinutes)}`;
  }
  return `${place.nearAnchorName}에서 직선거리 ${place.distanceKm}km`;
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
  const [journal, setJournal] = useState<TripJournal>(emptyJournal);
  const [activeSavedId, setActiveSavedId] = useState("");
  const [sharePath, setSharePath] = useState("");
  const [draftError, setDraftError] = useState(false);
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
  const [placeSearchQuery, setPlaceSearchQuery] = useState("");
  const [placeSearchResults, setPlaceSearchResults] = useState<PlaceRecommendation[]>([]);
  const [placeSearchState, setPlaceSearchState] = useState<"idle" | "loading" | "error">("idle");
  const [selectedPlaces, setSelectedPlaces] = useState<TravelPlace[]>([]);
  const [lodgingQuery, setLodgingQuery] = useState("");
  const [lodgingResults, setLodgingResults] = useState<PlaceRecommendation[]>([]);
  const [lodgingSearchState, setLodgingSearchState] = useState<"idle" | "loading" | "error">("idle");
  const [selectedLodging, setSelectedLodging] = useState<TravelPlace | null>(null);
  const [activePlaceId, setActivePlaceId] = useState("");
  const [lockedPlaceIds, setLockedPlaceIds] = useState<string[]>([]);
  const [draggedPlaceId, setDraggedPlaceId] = useState("");
  const [preferences, setPreferences] = useState<PlanPreferences>(defaultPreferences);
  const [budgetEstimate, setBudgetEstimate] = useState<BudgetEstimate>(() =>
    createBudgetEstimate(defaultPreferences),
  );
  const [itineraryPlan, setItineraryPlan] = useState<ItineraryPlan | null>(null);
  const [itineraryState, setItineraryState] = useState<
    "idle" | "loading" | "checking" | "ready" | "error"
  >("idle");
  const [placeDetailsById, setPlaceDetailsById] = useState<Record<string, PlaceDetails>>({});
  const [detailErrorIds, setDetailErrorIds] = useState<string[]>([]);
  const [shareState, setShareState] = useState<"idle" | "creating" | "copied" | "error">("idle");
  const [savedCourses, setSavedCourses] = useState<TravelCourse[]>([]);
  const [catalogState, setCatalogState] = useState<"idle" | "loading" | "error">("idle");
  const [recommendationState, setRecommendationState] = useState<"idle" | "loading" | "error">("idle");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [draftReady, setDraftReady] = useState(false);
  const [regeneratingDay, setRegeneratingDay] = useState(0);
  const [editingSavedId, setEditingSavedId] = useState("");
  const [savedTitleDraft, setSavedTitleDraft] = useState("");
  const [savedActionState, setSavedActionState] = useState<"idle" | "loading" | "error">("idle");
  const generationRef = useRef(0);
  const stepTwoRef = useRef<HTMLDivElement>(null);
  const stepThreeRef = useRef<HTMLDivElement>(null);
  const sharedPlanLoadedRef = useRef(false);
  const draftMigrationRef = useRef(false);
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
  const draftSaved = draftReady && !draftError && hasChosenRegion && selectedPlaces.length > 0;

  useEffect(() => {
    const elements = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion || !("IntersectionObserver" in window)) {
      elements.forEach((element) => element.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -7% 0px" },
    );
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

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
    const search = new URLSearchParams(window.location.search);
    const encoded = search.get("plan");
    const sharedSlug = search.get("share");
    let initialPlan = encoded ? decodeSharedPlan(encoded) : null;
    if (!encoded && !sharedSlug) {
      try {
        const stored = window.localStorage.getItem(draftStorageKey);
        initialPlan = stored ? parseSharedPlan(JSON.parse(stored)) : null;
        if (stored && !initialPlan) window.localStorage.removeItem(draftStorageKey);
      } catch {
        try { window.localStorage.removeItem(draftStorageKey); } catch { /* Storage may be disabled. */ }
      }
    }
    if (!initialPlan && !sharedSlug) {
      queueMicrotask(() => {
        if (encoded) setShareState("error");
        setDraftReady(true);
      });
      return;
    }
    let cancelled = false;
    async function hydrateSharedPlan() {
      try {
        let sharedPlan = initialPlan;
        if (sharedSlug) {
          if (!/^[a-f0-9]{12}$/.test(sharedSlug)) throw new Error("share_invalid");
          const sharedResponse = await fetch(`/api/share/${sharedSlug}`);
          if (!sharedResponse.ok) throw new Error("share_failed");
          const sharedData = (await sharedResponse.json()) as { plan?: unknown };
          sharedPlan = parseSharedPlan(sharedData.plan);
        }
        if (!sharedPlan) throw new Error("share_invalid");
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
        setJournal(sharedPlan.journal ?? emptyJournal());
        if (!encoded && !sharedSlug) {
          try { setActiveSavedId(window.localStorage.getItem("momotabi:active-trip") ?? ""); } catch { /* Storage may be disabled. */ }
        }
        setPreferences(sharedPlan.preferences);
        setSelectedPlaces(sharedPlan.places);
        setMustVisitIds(
          sharedPlan.places
            .filter((place) => nextCatalog.mustVisits.some((mustVisit) => mustVisit.id === place.id))
            .map((place) => place.id),
        );
        setLockedPlaceIds(sharedPlan.lockedPlaceIds);
        setSelectedLodging(sharedPlan.selectedLodging ?? null);
        setLodgingQuery(sharedPlan.selectedLodging?.name ?? sharedPlan.preferences.startLocation);
        setActivePlaceId(sharedPlan.places[0]?.id ?? "");
        setItineraryPlan(sharedPlan.itineraryPlan ?? null);
        setItineraryState(sharedPlan.itineraryPlan ? "ready" : "idle");
        setBudgetEstimate(
          sharedPlan.budget
            ? normalizeBudgetEstimate(sharedPlan.budget)
            : createBudgetEstimate(sharedPlan.preferences),
        );
      } catch {
        if (!cancelled) setShareState("error");
      } finally {
        if (!cancelled) setDraftReady(true);
      }
    }
    void hydrateSharedPlan();
    return () => {
      cancelled = true;
    };
  }, [catalog]);

  useEffect(() => {
    if (!draftReady) return;
    if (!hasChosenRegion || selectedPlaces.length === 0) {
      try { window.localStorage.removeItem(draftStorageKey); } catch { queueMicrotask(() => setDraftError(true)); }
      return;
    }
    const draft: SharedPlan = {
      regionId,
      style,
      places: selectedPlaces,
      preferences,
      lockedPlaceIds,
      selectedLodging,
      itineraryPlan,
      budget: budgetEstimate,
      journal,
    };
    try {
      window.localStorage.setItem(draftStorageKey, JSON.stringify(draft));
      window.localStorage.setItem("momotabi:active-trip", activeSavedId);
      queueMicrotask(() => setDraftError(false));
    } catch { queueMicrotask(() => setDraftError(true)); }
  }, [
    draftReady,
    journal,
    activeSavedId,
    hasChosenRegion,
    budgetEstimate,
    itineraryPlan,
    lockedPlaceIds,
    preferences,
    regionId,
    selectedLodging,
    selectedPlaces,
    style,
  ]);

  const refreshSavedCourses = useCallback(async () => {
    const response = await fetch("/api/trips");
    if (!response.ok) throw new Error("saved_courses_failed");
    const data = (await response.json()) as { courses: TravelCourse[] };
    setSavedCourses(data.courses);
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void fetch("/api/trips")
      .then(async (response) => {
        if (!response.ok) throw new Error("saved_courses_failed");
        return response.json() as Promise<{ courses: TravelCourse[] }>;
      })
      .then((data) => {
        if (!cancelled) setSavedCourses(data.courses);
      })
      .catch(() => {
        if (!cancelled) setSavedCourses([]);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (
      !user ||
      !draftReady ||
      selectedPlaces.length === 0 ||
      draftMigrationRef.current ||
      window.sessionStorage.getItem("momotabi:sync-draft-on-login") !== "1"
    ) return;
    draftMigrationRef.current = true;
    setSaveState("saving");
    void fetch("/api/trips", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: activeSavedId || undefined,
        regionId,
        style,
        dayCount: course.dayCount,
        placeIds: selectedPlaces.map((place) => place.id),
        placeSnapshots: selectedPlaces.filter((place) => place.source === "google"),
        plan: { regionId, style, places: selectedPlaces, preferences, lockedPlaceIds, selectedLodging, itineraryPlan, budget: budgetEstimate, journal },
      }),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("draft_migration_failed");
        return response.json() as Promise<{ course: TravelCourse }>;
      })
      .then((data) => {
        window.sessionStorage.removeItem("momotabi:sync-draft-on-login");
        setSavedCourses((current) => [data.course, ...current.filter((saved) => saved.id !== data.course.id)]);
      setActiveSavedId(data.course.id ?? "");
        setSaveState("saved");
        trackFunnelEvent("trip_saved", {
          regionId,
          placeCount: selectedPlaces.length,
          dayCount: course.dayCount,
        });
      })
      .catch(() => setSaveState("error"));
  }, [course.dayCount, draftReady, regionId, selectedPlaces, style, user, preferences, lockedPlaceIds, selectedLodging, itineraryPlan, budgetEstimate, journal, activeSavedId]);

  function resetGeneratedPlan() {
    generationRef.current += 1;
    setItineraryPlan(null);
    setItineraryState("idle");
    setShareState("idle");
    setSaveState("idle");
  }

  async function loadCatalog(nextRegionId: string) {
    if (hasChosenRegion && nextRegionId === regionId) return;
    trackFunnelEvent("region_selected", {
      regionId: nextRegionId,
      dayCount: preferences.dayCount,
    });

    setHasChosenRegion(true);
    setActiveSavedId("");
    setJournal(emptyJournal());
    setSharePath("");
    setRegionId(nextRegionId);
    setMustVisitIds([]);
    setRecommendations([]);
    setRecommendationProvider(null);
    setRecommendationKind("attractions");
    setPlaceSearchQuery("");
    setPlaceSearchResults([]);
    setPlaceSearchState("idle");
    setSelectedPlaces([]);
    setLodgingQuery("");
    setLodgingResults([]);
    setLodgingSearchState("idle");
    setSelectedLodging(null);
    setPreferences((current) => ({ ...current, startLocation: "", placeSchedules: {} }));
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
    if (selected) { removeCoursePlace(place.id); return; }
    const unlocksNextStep = mustVisitIds.length === 0;
    setMustVisitIds((current) =>
      selected ? current.filter((id) => id !== place.id) : [...current, place.id],
    );
    setSelectedPlaces((current) =>
      selected
        ? current.filter((candidate) => candidate.id !== place.id)
        : current.some((candidate) => candidate.id === place.id) || current.length >= MAX_TRIP_PLACES
          ? current
          : [...current, place],
    );
    if (!selected) setActivePlaceId(place.id);
    if (!selected) {
      trackFunnelEvent("place_added", {
        regionId,
        placeCount: Math.min(MAX_TRIP_PLACES, selectedPlaces.length + 1),
        dayCount: preferences.dayCount,
      });
    }
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
    if (!user) {
      window.sessionStorage.setItem("momotabi:sync-draft-on-login", "1");
      window.location.assign("/login");
      return;
    }
    setRecommendationKind(kind);
    setRecommendationState("loading");
    setSaveState("idle");
    try {
      const response = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          regionId,
          style,
          anchorPlaceIds: mustVisitIds,
          kind,
          transport: preferences.transport,
        }),
      });
      if (response.status === 401) {
        window.sessionStorage.setItem("momotabi:sync-draft-on-login", "1");
        window.location.assign("/login");
        return;
      }
      if (!response.ok) throw new Error("recommendation_failed");
      const data = (await response.json()) as {
        recommendations: PlaceRecommendation[];
        provider: "google" | "catalog";
      };
      setRecommendations(data.recommendations);
      setRecommendationProvider(data.provider);
      setRecommendationState("idle");
      trackFunnelEvent("recommendations_generated", {
        regionId,
        placeCount: selectedPlaces.length,
        dayCount: preferences.dayCount,
      });
    } catch {
      setRecommendationState("error");
    }
  }

  async function searchGooglePlaces(purpose: "place" | "lodging") {
    const query = purpose === "lodging" ? lodgingQuery.trim() : placeSearchQuery.trim();
    if (query.length < 2) return;
    const setState = purpose === "lodging" ? setLodgingSearchState : setPlaceSearchState;
    setState("loading");
    try {
      const response = await fetch("/api/place-search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          regionId,
          query,
          anchorPlaceIds: mustVisitIds,
          purpose,
          transport: preferences.transport,
        }),
      });
      if (!response.ok) throw new Error("place_search_failed");
      const data = (await response.json()) as { results: PlaceRecommendation[] };
      if (purpose === "lodging") setLodgingResults(data.results);
      else setPlaceSearchResults(data.results);
      setState("idle");
    } catch {
      setState("error");
    }
  }

  function selectLodging(place: TravelPlace) {
    setSelectedLodging(place);
    setLodgingQuery(place.name);
    setLodgingResults([]);
    setPreferences((current) => ({
      ...current,
      startLocation: `${place.name}, ${place.description}`.slice(0, 180),
    }));
    resetGeneratedPlan();
  }

  function toggleRecommendedPlace(place: PlaceRecommendation) {
    const selected = selectedPlaces.some((candidate) => candidate.id === place.id);
    if (selected) { removeCoursePlace(place.id); return; }
    setSelectedPlaces((current) =>
      selected
        ? current.filter((candidate) => candidate.id !== place.id)
        : current.length >= MAX_TRIP_PLACES
          ? current
          : [...current, place],
    );
    if (!selected) setActivePlaceId(place.id);
    if (!selected && selectedPlaces.length < MAX_TRIP_PLACES) {
      trackFunnelEvent("place_added", {
        regionId,
        placeCount: selectedPlaces.length + 1,
        dayCount: preferences.dayCount,
      });
    }
    resetGeneratedPlan();
  }

  function removeCoursePlace(placeId: string) {
    setJournal((current) => ({ ...current, visited: current.visited.filter((id) => id !== placeId), memos: Object.fromEntries(Object.entries(current.memos).filter(([id]) => id !== placeId)) }));
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

  async function generateItinerary(nextPreferences = preferences) {
    if (selectedPlaces.length === 0) return;
    const generation = ++generationRef.current;
    setItineraryState("loading");
    setShareState("idle");
    try {
      const response = await fetch("/api/itinerary", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ places: selectedPlaces, preferences: nextPreferences, lockedPlaceIds }),
      });
      if (!response.ok) throw new Error("itinerary_failed");
      const data = (await response.json()) as { plan: ItineraryPlan };
      if (generation !== generationRef.current) return;
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
      if (generation !== generationRef.current) return;
      setItineraryPlan(adjustPlanForOpeningHours(data.plan, detailsMap));
      setSaveState("idle");
      if (data.plan.provider !== "google") trackFunnelEvent("route_estimate_used", { regionId });
      setItineraryState("ready");
      trackFunnelEvent("itinerary_generated", {
        regionId,
        placeCount: orderedPlaces.length,
        dayCount: data.plan.days.length,
      });
    } catch {
      if (generation !== generationRef.current) return;
      setItineraryState("error");
      trackFunnelEvent("itinerary_failed", { regionId });
    }
  }

  async function regenerateItineraryDay(dayNumber: number) {
    const currentDay = itineraryPlan?.days.find((day) => day.dayNumber === dayNumber);
    if (!currentDay || regeneratingDay) return;
    const dayPlaces = currentDay.activities.flatMap((activity) =>
      activity.kind === "place" ? [activity.place] : [],
    );
    if (dayPlaces.length === 0) return;
    setRegeneratingDay(dayNumber);
    try {
      const dayPreferences: PlanPreferences = {
        ...preferences,
        dayCount: 1,
        startDate: currentDay.date || preferences.startDate,
        firstDayStartTime: dayNumber === 1 ? preferences.firstDayStartTime : "",
        lastDayEndTime: dayNumber === preferences.dayCount ? preferences.lastDayEndTime : "",
        placeSchedules: Object.fromEntries(dayPlaces.map(place => [place.id, { dayNumber: 1, ...(preferences.placeSchedules?.[place.id]?.time ? { time: preferences.placeSchedules[place.id].time } : {}) }])),
      };
      const response = await fetch("/api/itinerary", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          places: dayPlaces,
          preferences: dayPreferences,
          lockedPlaceIds: lockedPlaceIds.filter((id) =>
            dayPlaces.some((place) => place.id === id),
          ),
        }),
      });
      if (!response.ok) throw new Error("day_regeneration_failed");
      const data = (await response.json()) as { plan: ItineraryPlan };
      const details = await Promise.all(
        dayPlaces.map(async (place) => [place.id, await requestPlaceDetails(place)] as const),
      );
      const detailsMap = Object.fromEntries(
        details.filter((entry): entry is readonly [string, PlaceDetails] => Boolean(entry[1])),
      );
      const adjusted = adjustPlanForOpeningHours(data.plan, detailsMap);
      const replacement = adjusted.days[0];
      if (!replacement || !itineraryPlan) throw new Error("day_regeneration_empty");
      const nextPlan: ItineraryPlan = {
        ...itineraryPlan,
        provider: itineraryPlan.days.every(day => day.dayNumber === dayNumber || day.routeProvider === adjusted.provider) ? adjusted.provider : "mixed",
        warnings: [
          ...itineraryPlan.warnings.filter((warning) => !warning.startsWith(`${dayNumber}일차`)),
          `${dayNumber}일차 동선을 새로 계산했어요.`,
          ...adjusted.warnings.map((warning) => `${dayNumber}일차 · ${warning}`),
        ],
        days: itineraryPlan.days.map((day) =>
          day.dayNumber === dayNumber
            ? { ...replacement, dayNumber, date: currentDay.date }
            : day,
        ),
      };
      setItineraryPlan(nextPlan);
      setSaveState("idle");
      setShareState("idle");
      trackFunnelEvent("itinerary_edited", { regionId });
      setSelectedPlaces(
        nextPlan.days.flatMap((day) =>
          day.activities.flatMap((activity) =>
            activity.kind === "place" ? [activity.place] : [],
          ),
        ),
      );
      setItineraryState("ready");
    } catch {
      setItineraryState("error");
    } finally {
      setRegeneratingDay(0);
    }
  }

  function changePlannedPlace(placeId: string, dayNumber: number, time?: string) {
    if (!itineraryPlan) return;
    const placeSchedules: NonNullable<PlanPreferences["placeSchedules"]> = {};
    for (const day of itineraryPlan.days) {
      for (const activity of day.activities) {
        if (activity.kind !== "place") continue;
        placeSchedules[activity.place.id] = { dayNumber: day.dayNumber,
          ...(preferences.placeSchedules?.[activity.place.id]?.time ? { time: preferences.placeSchedules[activity.place.id].time } : {}) };
      }
    }
    placeSchedules[placeId] = { dayNumber, ...(time ? { time } : {}) };
    const nextPreferences = { ...preferences, placeSchedules };
    setPreferences(nextPreferences);
    trackFunnelEvent("itinerary_edited", { regionId });
    void generateItinerary(nextPreferences);
  }

  function updatePreferences<Key extends keyof PlanPreferences>(key: Key, value: PlanPreferences[Key]) {
    const nextPreferences = { ...preferences, [key]: value };
    if (key === "dayCount") {
      nextPreferences.placeSchedules = Object.fromEntries(Object.entries(preferences.placeSchedules ?? {})
        .filter(([, schedule]) => schedule.dayNumber <= Number(value)));
    }
    setPreferences(nextPreferences);
    if (["budget", "companion", "dayCount", "transport"].includes(key)) {
      setBudgetEstimate(createBudgetEstimate(nextPreferences));
    }
    if (key === "startLocation") setSelectedLodging(null);
    if (key === "transport") {
      setRecommendations([]);
      setPlaceSearchResults([]);
      setRecommendationProvider(null);
    }
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
      isPublicTransportMode(preferences.transport) ? "transit" : preferences.transport === "driving" ? "driving" : "walking",
    );
    return `https://www.google.com/maps/dir/?${parameters.toString()}`;
  }

  async function shareCurrentPlan() {
    if (selectedPlaces.length === 0) return;
    const sharedPlan: SharedPlan = publicPlan({
      regionId,
      style,
      places: selectedPlaces,
      preferences,
      lockedPlaceIds,
      selectedLodging,
      itineraryPlan,
      budget: budgetEstimate,
      journal,
    });
    setShareState("creating");
    try {
      const response = await fetch("/api/share", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(sharedPlan),
      });
      if (!response.ok) throw new Error("share_failed");
      const data = (await response.json()) as { path: string };
      setSharePath(data.path);
      const url = new URL(data.path, window.location.origin);
      await navigator.clipboard.writeText(url.toString());
      setShareState("copied");
      trackFunnelEvent("share_created", {
        regionId,
        placeCount: selectedPlaces.length,
        dayCount: preferences.dayCount,
      });
    } catch {
      const fallbackUrl = new URL(window.location.origin);
      fallbackUrl.searchParams.set("plan", encodeSharedPlan(sharedPlan));
      try {
        await navigator.clipboard.writeText(fallbackUrl.toString());
        setShareState("copied");
      } catch {
        setShareState("error");
      }
    }
  }

  function printCurrentPlan() {
    trackFunnelEvent("print_opened", {
      regionId,
      placeCount: selectedPlaces.length,
      dayCount: preferences.dayCount,
    });
    window.print();
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
    setActiveSavedId(savedCourse.id ?? "");
    setJournal(savedCourse.savedPlan?.journal ?? emptyJournal());
    setSharePath("");
    setStyle(savedCourse.style);
    const nextPreferences = savedCourse.savedPlan?.preferences ?? { ...defaultPreferences, dayCount: savedCourse.dayCount };
    setPreferences(nextPreferences);
    setBudgetEstimate(createBudgetEstimate(nextPreferences));
    setRecommendations([]);
    setRecommendationProvider(null);
    setRecommendationKind("attractions");
    setPlaceSearchQuery("");
    setPlaceSearchResults([]);
    setSelectedLodging(savedCourse.savedPlan?.selectedLodging ?? null);
    setLodgingQuery(nextPreferences.startLocation);
    setLodgingResults([]);
    setSelectedPlaces(savedCourse.savedPlan?.places ?? places);
    setActivePlaceId(places[0]?.id ?? "");
    setLockedPlaceIds(savedCourse.savedPlan?.lockedPlaceIds ?? []);
    setItineraryPlan(savedCourse.savedPlan?.itineraryPlan ?? null);
    setItineraryState(savedCourse.savedPlan?.itineraryPlan ? "ready" : "idle");
    if (savedCourse.savedPlan?.budget) setBudgetEstimate(savedCourse.savedPlan.budget);
    setSaveState("saved");
  }

  async function saveCurrentCourse() {
    if (selectedPlaces.length === 0 || saveState === "saving") return;
    if (!user) {
      window.sessionStorage.setItem("momotabi:sync-draft-on-login", "1");
      window.location.assign("/login");
      return;
    }
    setSaveState("saving");
    try {
      const response = await fetch("/api/trips", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: activeSavedId || undefined,
          regionId,
          style,
          dayCount: course.dayCount,
          placeIds: selectedPlaces.map((place) => place.id),
          placeSnapshots: selectedPlaces.filter((place) => place.source === "google"),
          plan: { regionId, style, places: selectedPlaces, preferences, lockedPlaceIds, selectedLodging, itineraryPlan, budget: budgetEstimate, journal },
        }),
      });
      if (!response.ok) throw new Error("save_failed");
      const data = (await response.json()) as { course: TravelCourse };
      setSavedCourses((current) => [data.course, ...current.filter((saved) => saved.id !== data.course.id)]);
      setActiveSavedId(data.course.id ?? "");
      setSaveState("saved");
      trackFunnelEvent("trip_saved", {
        regionId,
        placeCount: selectedPlaces.length,
        dayCount: course.dayCount,
      });
    } catch {
      setSaveState("error");
    }
  }

  async function renameSavedCourse(itineraryId: string) {
    const title = savedTitleDraft.trim();
    if (!title || savedActionState === "loading") return;
    setSavedActionState("loading");
    try {
      const response = await fetch("/api/trips", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: itineraryId, title }),
      });
      if (!response.ok) throw new Error("rename_failed");
      setEditingSavedId("");
      await refreshSavedCourses();
      setSavedActionState("idle");
    } catch {
      setSavedActionState("error");
    }
  }

  async function duplicateSavedCourse(itineraryId: string) {
    if (savedActionState === "loading") return;
    setSavedActionState("loading");
    try {
      const response = await fetch("/api/trips", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ duplicateId: itineraryId }),
      });
      if (!response.ok) throw new Error("duplicate_failed");
      await refreshSavedCourses();
      setSavedActionState("idle");
    } catch {
      setSavedActionState("error");
    }
  }

  async function deleteSavedCourse(itineraryId: string, title: string) {
    if (
      savedActionState === "loading" ||
      !window.confirm(`“${title}” 코스를 삭제할까요?`)
    ) return;
    setSavedActionState("loading");
    try {
      const response = await fetch("/api/trips", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: itineraryId }),
      });
      if (!response.ok) throw new Error("delete_failed");
      setSavedCourses((current) => current.filter((course) => course.id !== itineraryId));
      if (activeSavedId === itineraryId) { setActiveSavedId(""); setSaveState("idle"); }
      setSavedActionState("idle");
    } catch {
      setSavedActionState("error");
    }
  }

  async function signOut() {
    await authClient.signOut();
    try { window.localStorage.removeItem("momotabi:active-trip"); } catch { /* Storage may be disabled. */ }
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
    ? openingStatus(activeDetails, activePlanEntry.day.date, activePlanEntry.activity.scheduledTime, activePlanEntry.activity.endTime)
    : "unknown";

  return (
    <main className="app-shell" id="top">
      <section className="landing-intro" aria-labelledby="landing-title">
        <JapanDiorama onExplore={(nextRegionId) => { void loadCatalog(nextRegionId); }} />
      </section>

      <div className="planner-experience">
        <header className="topbar">
          <a className="brand" href="#top" aria-label="모모타비 홈"><span className="brand-mark">も</span><span>MOMOTABI</span></a>
          <nav aria-label="주요 메뉴">
            <a className="section-link active" href="#planner">코스 만들기</a>
            <a className="section-link" href="#saved">내 코스</a>
            {user && (
              <button className={`save-button ${saveState === "saved" ? "is-saved" : ""}`} onClick={saveCurrentCourse} type="button" disabled={selectedPlaces.length === 0 || saveState === "saving"}>
                {saveState === "saving" ? "저장 중…" : saveState === "saved" ? "저장됨 ✓" : activeSavedId ? "코스 수정 저장" : "이 코스 저장"}
              </button>
            )}
            {user ? (
              <div className="account-control">
                <div className="account-chip" title={user.email} aria-label={`${user.displayName} 계정으로 로그인됨`}><span className="account-avatar" aria-hidden="true">{userInitial}</span><span className="account-copy"><strong>{user.displayName}</strong><small>로그인됨</small></span></div>
                <button className="sign-out-link" type="button" onClick={signOut}>로그아웃</button>
              </div>
            ) : <a className="sign-in-link" href="/login" onClick={() => window.sessionStorage.setItem("momotabi:sync-draft-on-login", "1")}>로그인</a>}
          </nav>
        </header>

        <section className="route-panel" id="planner">
        <div className="route-heading" key={catalog.region.id}>
          <div className="city-chip"><span className="city-dot" /> {catalog.region.nameEn} <b>{catalog.region.nameJp}</b></div>
          <p className="eyebrow">나만의 일본 여행 코스</p>
          <h1>가고 싶은 곳을 담아<br />나만의 일본 여행</h1>
          <p className="intro">필수 관광지를 고르면 가까이 함께 둘러보기 좋은 장소를 추천해 드려요.</p>
          <div className="route-meta" aria-label="코스 요약"><span>{selectedPlaces.length}개 장소</span><i /><span>{preferences.dayCount}일 여행</span><i /><span>{styleLabels[style]}</span></div>
        </div>

        <nav className="workflow-nav" aria-label="여행 계획 단계">
          <a href="#place-picker">1. 장소 담기</a><a href="#itinerary">2. 일정 완성</a><a href="#save-plan">3. 저장·공유</a>
        </nav>
        <section id="place-picker" className="planner-card guided-planner" aria-labelledby="planner-title" data-reveal>
          <div className="planner-title-row"><div><span>STEP BY STEP</span><h2 id="planner-title">여행 코스를 만들어 볼까요?</h2></div><strong>{String(currentStep).padStart(2, "0")} — 03</strong></div>
          <div className="planner-progress" role="progressbar" aria-label="여행 코스 설정 진행률" aria-valuemin={1} aria-valuemax={3} aria-valuenow={currentStep}><span style={{ width: `${(currentStep / 3) * 100}%` }} /></div>

          <div data-step="01" className={`planner-step ${hasChosenRegion ? "is-complete" : "is-active"}`}>
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

          <div data-step="02" ref={stepTwoRef} className={`planner-step ${!stepTwoUnlocked ? "is-locked" : stepThreeUnlocked ? "is-complete" : "is-active"}`} aria-disabled={!stepTwoUnlocked}>
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

          <div data-step="03" ref={stepThreeRef} className={`planner-step ${stepThreeUnlocked ? "is-active" : "is-locked"}`} aria-disabled={!stepThreeUnlocked}>
            <div className="step-heading">
              <b>03</b>
              <div><span>근교 추천</span><h3>선택한 곳 근처를 함께 둘러봐요</h3></div>
              <small className="step-state">{stepThreeUnlocked ? user ? styleLabels[style] : "로그인 후 추천" : "2단계 선택 후 열림"}</small>
            </div>
            {!stepThreeUnlocked ? (
              <div className="step-locked-message"><span aria-hidden="true">03</span><p>필수 관광지를 하나 이상 선택하면<br />근교 추천 설정이 열려요.</p></div>
            ) : (
              <div className="step-reveal">
                <div className="style-switcher compact" role="group" aria-label="여행 스타일 선택">
                  {travelStyles.map((item) => <button key={item} type="button" className={style === item ? "selected" : ""} aria-pressed={style === item} onClick={() => { setStyle(item); setRecommendations([]); setRecommendationProvider(null); resetGeneratedPlan(); }}>{styleLabels[item]}</button>)}
                </div>
                <div className="step-transport">
                  <span>근교 이동시간 기준 · 지하철/버스만 따로 선택 가능</span>
                  <div role="group" aria-label="근교 추천 이동 수단">
                    {transportModes.map((transport) => (
                      <button
                        key={transport}
                        type="button"
                        className={preferences.transport === transport ? "selected" : ""}
                        onClick={() => updatePreferences("transport", transport)}
                      >
                        {transportLabels[transport]}
                      </button>
                    ))}
                  </div>
                </div>
                <form className="place-search-panel" onSubmit={(event) => { event.preventDefault(); void searchGooglePlaces("place"); }}>
                  <div>
                    <span>추천 목록에 없는 장소</span>
                    <strong>관광지·맛집을 직접 검색해 담기</strong>
                  </div>
                  <div className="place-search-row">
                    <input
                      type="search"
                      value={placeSearchQuery}
                      maxLength={80}
                      onChange={(event) => setPlaceSearchQuery(event.target.value)}
                      placeholder={`예: ${catalog.region.nameKo} 전망대, 스시 맛집`}
                      aria-label="추가할 장소 검색"
                    />
                    <button type="submit" disabled={placeSearchQuery.trim().length < 2 || placeSearchState === "loading"}>
                      {placeSearchState === "loading" ? "검색 중…" : "검색"}
                    </button>
                  </div>
                  {placeSearchState === "error" && <p className="inline-error" role="alert">장소 검색 결과를 불러오지 못했어요.</p>}
                </form>
                {placeSearchResults.length > 0 && (
                  <div className="nearby-list search-result-list" aria-label="직접 검색한 장소">
                    <p className="nearby-summary"><strong>{placeSearchResults.length}곳</strong>을 찾았어요. 원하는 장소를 바로 담아보세요.</p>
                    {placeSearchResults.map((place, index) => {
                      const selected = selectedPlaces.some((candidate) => candidate.id === place.id);
                      return (
                        <article key={place.id} className={selected ? "selected" : ""} style={{ animationDelay: `${index * 45}ms` }}>
                          <PlaceCardPhoto name={place.name} photoUrl={place.photoUrl} photoAttribution={place.photoAttribution} photoLink={place.photoGoogleMapsUri || place.externalUrl} className="nearby-photo" />
                          <div className="nearby-copy"><span>{recommendationTravelLabel(place)}</span><strong>{place.name}</strong><small>{place.category} · {place.description}</small></div>
                          <button type="button" disabled={!selected && selectedPlaces.length >= MAX_TRIP_PLACES} onClick={() => toggleRecommendedPlace(place)}>{selected ? "담김 ✓" : "+ 담기"}</button>
                        </article>
                      );
                    })}
                  </div>
                )}
                {user ? <>
                  <div className="recommend-kind" role="group" aria-label="추천 종류">
                    <button type="button" className={recommendationKind === "attractions" ? "selected" : ""} onClick={() => { setRecommendationKind("attractions"); setRecommendations([]); }}>관광지</button>
                    <button type="button" className={recommendationKind === "food" ? "selected" : ""} onClick={() => { setRecommendationKind("food"); setRecommendations([]); }}>맛집·카페</button>
                  </div>
                  <button className="recommend-button" type="button" onClick={() => generateRecommendations()} disabled={recommendationState === "loading"}><span>{recommendationState === "loading" ? "가까운 장소를 찾는 중…" : recommendationKind === "food" ? "동선 근처 맛집 추천받기" : "근교 관광지 추천받기"}</span><b aria-hidden="true">→</b></button>
                  {recommendationState === "error" && <p className="inline-error" role="alert">근교 추천을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</p>}
                </> : (
                  <div className="recommend-login-gate" role="note">
                    <span aria-hidden="true">↗</span>
                    <div><strong>로그인 후 근교 추천을 받을 수 있어요.</strong><p>지금 고른 관광지는 이 기기에 임시저장되어 로그인 뒤에도 이어집니다.</p></div>
                    <a href="/login" onClick={() => window.sessionStorage.setItem("momotabi:sync-draft-on-login", "1")}>로그인하고 추천받기</a>
                  </div>
                )}
                {user && recommendations.length > 0 && (
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
                            <span>{recommendationTravelLabel(place)}</span>
                            <strong>{place.name}</strong>
                            <small>{place.category} · {place.description}</small>
                          </div>
                          <button type="button" disabled={!selected && selectedPlaces.length >= MAX_TRIP_PLACES} onClick={() => toggleRecommendedPlace(place)} aria-label={`${place.name} ${selected ? "코스에서 빼기" : "코스에 담기"}`}>{selected ? "담김 ✓" : "+ 담기"}</button>
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

        <section className="course-builder" aria-labelledby="course-title" data-reveal>
          <div className="saved-heading"><div><span>MY ROUTE</span><h2 id="course-title">내 여행 코스</h2></div><small>{selectedPlaces.length}/{MAX_TRIP_PLACES}개 장소</small></div>
          {draftSaved && <p className="draft-status"><span aria-hidden="true">✓</span> 작성 중인 코스는 이 기기에 자동 임시저장돼요.</p>}
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
                          ? `${activePlanEntry.day.date} 등록된 영업시간 내 방문`
                          : activeOpeningStatus === "closed"
                            ? "일정 시간과 영업시간이 겹치지 않아요"
                            : preferences.startDate ? "영업시간 정보 미확인" : "여행 시작일을 입력하면 영업시간을 확인해요"
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

        <section id="itinerary" className="itinerary-builder" aria-labelledby="itinerary-title" data-reveal>
          <div className="saved-heading"><div><span>SMART ITINERARY</span><h2 id="itinerary-title">여행 일정 자동 완성</h2></div><small>추천 시간대·이동시간 고려</small></div>
          <p className="itinerary-intro">가까운 장소와 체류시간을 기준으로 하루씩 묶어요. 날짜를 입력하면 등록된 영업시간도 확인해요. 예약시간은 따로 고정할 수 있어요.</p>
          <div className="preference-grid">
            <label><span>여행 시작일</span><input type="date" value={preferences.startDate} onChange={(event) => updatePreferences("startDate", event.target.value)} /></label>
            <label><span>여행 일수</span><select value={preferences.dayCount} onChange={(event) => updatePreferences("dayCount", Number(event.target.value))}>{Array.from({ length: MAX_TRIP_DAYS }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}일</option>)}</select></label>
            <label><span>첫날 관광 시작</span><input type="time" value={preferences.firstDayStartTime ?? ""} onChange={(event) => updatePreferences("firstDayStartTime", event.target.value)} /></label>
            <label><span>마지막 날 관광 종료</span><input type="time" value={preferences.lastDayEndTime ?? ""} onChange={(event) => updatePreferences("lastDayEndTime", event.target.value)} /></label>
            <p className="preference-help wide">일본 현지 시간 기준이에요. 공항 이동·입출국 수속 시간을 제외한 관광 가능 시간을 입력해 주세요.</p>
            <div className="lodging-field wide">
              <label htmlFor="lodging-search"><span>출발지 또는 숙소</span></label>
              <form className="lodging-search-row" onSubmit={(event) => { event.preventDefault(); void searchGooglePlaces("lodging"); }}>
                <input
                  id="lodging-search"
                  type="search"
                  maxLength={80}
                  value={lodgingQuery}
                  onChange={(event) => {
                    setLodgingQuery(event.target.value);
                    updatePreferences("startLocation", event.target.value);
                  }}
                  placeholder="예: 신주쿠역, 호텔 이름"
                />
                <button type="submit" disabled={lodgingQuery.trim().length < 2 || lodgingSearchState === "loading"}>
                  {lodgingSearchState === "loading" ? "찾는 중…" : "지도에서 찾기"}
                </button>
              </form>
              {selectedLodging && (
                <div className="selected-lodging">
                  <span aria-hidden="true">宿</span>
                  <div><strong>{selectedLodging.name}</strong><small>지도 출발점으로 설정됨</small></div>
                  <button type="button" onClick={() => { setSelectedLodging(null); setLodgingQuery(""); updatePreferences("startLocation", ""); }} aria-label="숙소 출발점 해제">×</button>
                </div>
              )}
              {lodgingSearchState === "error" && <p className="inline-error" role="alert">숙소 검색 결과를 불러오지 못했어요.</p>}
              {lodgingResults.length > 0 && (
                <div className="lodging-results" aria-label="숙소 검색 결과">
                  {lodgingResults.map((place) => (
                    <button key={place.id} type="button" onClick={() => selectLodging(place)}>
                      <span aria-hidden="true">宿</span><div><strong>{place.name}</strong><small>{place.description}</small></div><b>선택</b>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <label><span>여행 속도</span><select value={preferences.pace} onChange={(event) => updatePreferences("pace", event.target.value as PlanPreferences["pace"])}>{travelPaces.map((pace) => <option key={pace} value={pace}>{paceLabels[pace]}</option>)}</select></label>
            <label><span>예산</span><select value={preferences.budget} onChange={(event) => updatePreferences("budget", event.target.value as PlanPreferences["budget"])}>{travelBudgets.map((budget) => <option key={budget} value={budget}>{budgetLabels[budget]}</option>)}</select></label>
          </div>
          <fieldset className="preference-group"><legend>누구와 가나요?</legend><div>{companionTypes.map((companion) => <button key={companion} type="button" className={preferences.companion === companion ? "selected" : ""} onClick={() => updatePreferences("companion", companion)}>{companionLabels[companion]}</button>)}</div></fieldset>
          <fieldset className="preference-group"><legend>주요 이동 수단</legend><div>{transportModes.map((transport) => <button key={transport} type="button" className={preferences.transport === transport ? "selected" : ""} aria-pressed={preferences.transport === transport} onClick={() => updatePreferences("transport", transport)}>{transportLabels[transport]}</button>)}</div></fieldset>
          {isPublicTransportMode(preferences.transport) && <p className="transport-help">{preferences.transport === "subway" ? "Google 경로가 있는 구간은 지하철만 이용해 계산해요." : preferences.transport === "bus" ? "Google 경로가 있는 구간은 버스만 이용해 계산해요." : "전철·지하철·버스를 포함한 가장 알맞은 대중교통으로 계산해요."}</p>}
          <div className="meal-toggle"><input id="include-meals" type="checkbox" aria-label="식사 시간도 일정에 넣기" checked={preferences.includeMeals} onChange={(event) => updatePreferences("includeMeals", event.target.checked)} /><span><strong>식사 시간도 일정에 넣기</strong><small>점심 식당이 있으면 식사로 반영하고, 없으면 일정 중간에 여유를 확보해요.</small></span></div>
          <button className="itinerary-generate" type="button" onClick={() => void generateItinerary()} disabled={selectedPlaces.length === 0 || itineraryState === "loading" || itineraryState === "checking"}>
            <span>{itineraryState === "loading" ? "방문 순서와 이동시간을 계산하는 중…" : itineraryState === "checking" ? "영업시간을 확인하고 조정하는 중…" : "내 일정 자동 완성하기"}</span><b aria-hidden="true">↗</b>
          </button>
          {selectedPlaces.length === 0 && <p className="itinerary-help">먼저 필수 관광지를 하나 이상 선택해 주세요.</p>}
          {itineraryState === "error" && <p className="inline-error" role="alert">일정을 만들지 못했어요. 잠시 후 다시 시도해 주세요.</p>}

          {itineraryPlan && (
            <div className="itinerary-result" aria-live="polite">
              <div className="itinerary-result-head"><div><span>{itineraryState === "checking" ? "영업시간 확인 중" : "여행 일정 초안"}</span><strong>{itineraryPlan.days.length}일 여행 일정</strong></div><small>{itineraryPlan.provider === "google" ? "Google 경로 기준" : itineraryPlan.provider === "mixed" ? "실제 경로·추정 혼합" : "이동시간 추정"}</small></div>
              {itineraryPlan.warnings.length > 0 && <div className="plan-warnings">{itineraryPlan.warnings.map((warning, index) => <p key={`${index}-${warning}`}>ℹ {warning}</p>)}</div>}
              <div className="itinerary-days">
                {itineraryPlan.days.map((day) => (
                  <article className="itinerary-day" key={day.dayNumber}>
                    <header>
                      <div><span>DAY {String(day.dayNumber).padStart(2, "0")}</span><strong>{day.date || `${day.dayNumber}일차`}</strong></div>
                      <div className="itinerary-day-meta">
                        <small>{transportLabels[preferences.transport]} · {day.routeProvider === "google" ? "Google 경로" : "이동 추정"} · {formatDuration(day.totalTravelMinutes)} · {day.totalDistanceKm.toFixed(1)}km</small>
                        <button type="button" onClick={() => void regenerateItineraryDay(day.dayNumber)} disabled={regeneratingDay !== 0 || itineraryState === "loading" || itineraryState === "checking" || !day.activities.length}>
                          {regeneratingDay === day.dayNumber ? "다시 계산 중…" : "이 날만 다시 짜기"}
                        </button>
                      </div>
                    </header>
                    {day.activities.length === 0 && <div className="free-day"><strong>자유 일정</strong><p>다른 날의 장소를 옮기거나, 가까운 곳을 더 담아보세요.</p><a href="#place-picker">장소 더 담기 →</a></div>}
                    <div className="timeline">
                      {day.activities.map((activity) => activity.kind === "meal" ? (
                        <div className="timeline-item is-meal" key={activity.id}>
                          <time>{activity.scheduledTime}</time><i aria-hidden="true">餐</i><div><strong>{activity.label}</strong><small>{activity.nearPlaceName} 주변에서 맛집을 골라보세요.</small><button type="button" onClick={() => { void generateRecommendations("food"); if (user) stepThreeRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>{user ? "근처 맛집 찾기 →" : "로그인하고 근처 맛집 찾기 →"}</button></div>
                        </div>
                      ) : (
                        <div className={`timeline-item is-place ${activePlace?.id === activity.place.id ? "active" : ""}`} key={activity.place.id}>
                          <label className="timeline-time-editor">
                            <span>{activity.timeLocked ? "예약시간" : "방문시간"}</span>
                            <input type="time" value={activity.scheduledTime} onChange={(event) => { if (event.target.value) changePlannedPlace(activity.place.id, day.dayNumber, event.target.value); }} disabled={itineraryState === "loading" || itineraryState === "checking" || regeneratingDay !== 0} aria-label={`${activity.place.name} 방문시간`} />
                          </label>
                          <time className="print-only">{activity.scheduledTime}</time>
                          <i aria-hidden="true" />
                          <div className="timeline-place-content"><button className="timeline-place-select" type="button" onClick={() => setActivePlaceId(activity.place.id)}>
                            <strong>{activity.place.name}</strong><small>{activity.travelMinutesFromPrevious > 0 ? `이전 장소에서 ${transportLabels[preferences.transport]} ${formatDuration(activity.travelMinutesFromPrevious)} · ` : ""}{activity.endTime}까지</small>{activity.openingNote && <em>{activity.openingNote}</em>}{activity.scheduleNote && <em className="schedule-warning">{activity.scheduleNote}</em>}
                          </button>
                          <div className="schedule-status"><span>{activity.routeProvider === "google" ? "Google 경로" : "이동시간 추정"}</span><span>{activity.openingStatus === "open" ? "등록된 영업시간 내" : activity.openingStatus === "closed" ? "영업시간 확인 필요" : "영업시간 미확인"}</span></div>
                          <div className="place-schedule-controls no-print">
                            <label>방문일<select aria-label={`${activity.place.name} 방문일`} value={day.dayNumber} disabled={itineraryState === "loading" || itineraryState === "checking" || regeneratingDay !== 0} onChange={(event) => changePlannedPlace(activity.place.id, Number(event.target.value), preferences.placeSchedules?.[activity.place.id]?.time)}>{itineraryPlan.days.map(candidate => <option key={candidate.dayNumber} value={candidate.dayNumber}>{candidate.dayNumber}일차</option>)}</select></label>
                            <label><input type="checkbox" checked={Boolean(activity.timeLocked)} disabled={itineraryState === "loading" || itineraryState === "checking" || regeneratingDay !== 0} onChange={(event) => changePlannedPlace(activity.place.id, day.dayNumber, event.target.checked ? activity.scheduledTime : undefined)} />예약시간 고정</label>
                          </div></div>
                        </div>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}

          {selectedPlaces.length > 0 && <TripCompanion
            key={`${regionId}:${activeSavedId}`}
            title={course.title}
            plan={{ regionId, style, places: selectedPlaces, preferences, lockedPlaceIds, selectedLodging, itineraryPlan, budget: budgetEstimate, journal }}
            onChange={(next) => { setJournal(next); setSaveState("idle"); }}
          />}
          {draftError && <p className="inline-error" role="alert">기기에 임시저장하지 못했어요. 계정에 저장하거나 오프라인 파일을 내려받아 주세요.</p>}
          <div id="save-plan" className="save-plan-callout no-print">
            <div><strong>내 여행을 이어서 준비하세요</strong><p>{user ? "날짜·방문시간·경비까지 계정에 함께 저장해요." : "로그인하면 이 기기의 임시 일정을 계정에 이어서 저장해요."}</p></div>
            <button className="save-button" type="button" onClick={saveCurrentCourse} disabled={!selectedPlaces.length || saveState === "saving" || itineraryState === "loading" || itineraryState === "checking" || regeneratingDay !== 0}>{saveState === "saving" ? "저장 중…" : saveState === "saved" ? "저장됨 ✓" : user ? activeSavedId ? "일정 수정 저장" : "이 일정 저장" : "로그인하고 이 일정 저장"}</button>
          </div>
          {!preferences.startDate && <p className="itinerary-help no-print">여행 시작일을 입력하면 캘린더로 내보낼 수 있어요.</p>}
          <div className="export-actions no-print" aria-label="일정 공유와 내보내기">
            <button type="button" onClick={shareCurrentPlan} disabled={selectedPlaces.length === 0 || shareState === "creating"}>{shareState === "creating" ? "짧은 링크 만드는 중…" : shareState === "copied" ? "링크 복사됨 ✓" : "짧은 공유 링크"}</button>
            <a href={googleDirectionsUrl()} target="_blank" rel="noreferrer" aria-disabled={selectedPlaces.length === 0}>Google Maps에서 열기 ↗</a>
            <button type="button" onClick={exportCalendar} disabled={!itineraryPlan || !preferences.startDate}>캘린더로 내보내기</button>
            <button type="button" onClick={printCurrentPlan} disabled={selectedPlaces.length === 0}>인쇄·PDF 저장</button>
          </div>
          {sharePath && <p className="itinerary-help no-print"><a href={sharePath} target="_blank" rel="noreferrer">공유 페이지에서 동행자 제안·투표·댓글 보기 ↗</a><br />공유 링크는 생성 당시 일정 사본이에요. 수정한 일정은 새 링크로 공유해 주세요.</p>}
          {shareState === "error" && <p className="inline-error" role="alert">공유 링크를 복사하지 못했어요. 다시 시도해 주세요.</p>}
        </section>

        <BudgetCalculator
          value={budgetEstimate}
          dayCount={preferences.dayCount}
          regionId={regionId}
          onChange={(value) => { setBudgetEstimate(value); setSaveState("idle"); }}
        />

        <section className="saved-courses" id="saved" aria-labelledby="saved-title" data-reveal>
          <div className="saved-heading"><div><span>SAVED ROUTES</span><h2 id="saved-title">저장한 코스</h2></div>{user && <small>{savedCourses.length}개 저장됨</small>}</div>
          {!user ? <p className="saved-empty">로그인하면 여행 일정과 경비를 계정에 저장할 수 있어요. <a href="/login">로그인하기 →</a></p> : savedCourses.length === 0 ? <p className="saved-empty">아직 저장한 코스가 없어요. 관광지를 담고 첫 코스를 저장해 보세요.</p> : (
            <div className="saved-list">
              {savedCourses.map((saved) => saved.id ? (
                <article key={saved.id}>
                  {editingSavedId === saved.id ? (
                    <form className="saved-rename" onSubmit={(event) => { event.preventDefault(); void renameSavedCourse(saved.id!); }}>
                      <label htmlFor={`saved-title-${saved.id}`}>코스 이름</label>
                      <input id={`saved-title-${saved.id}`} value={savedTitleDraft} maxLength={80} onChange={(event) => setSavedTitleDraft(event.target.value)} />
                      <div><button type="submit" disabled={!savedTitleDraft.trim() || savedActionState === "loading"}>저장</button><button type="button" onClick={() => setEditingSavedId("")}>취소</button></div>
                    </form>
                  ) : (
                    <button className="saved-open" type="button" onClick={() => showSavedCourse(saved)}>
                      <span>{saved.region.nameKo} · {saved.days.flatMap((day) => day.places).length}곳</span><strong>{saved.title}</strong><small>지도에서 다시 보기 →</small>
                    </button>
                  )}
                  <div className="saved-actions" aria-label={`${saved.title} 관리`}>
                    <button type="button" onClick={() => { setEditingSavedId(saved.id!); setSavedTitleDraft(saved.title); setSavedActionState("idle"); }}>이름 변경</button>
                    <button type="button" onClick={() => void duplicateSavedCourse(saved.id!)} disabled={savedActionState === "loading"}>복제</button>
                    <button className="danger" type="button" onClick={() => void deleteSavedCourse(saved.id!, saved.title)} disabled={savedActionState === "loading"}>삭제</button>
                  </div>
                </article>
              ) : null)}
            </div>
          )}
          {savedActionState === "error" && <p className="inline-error" role="alert">저장한 코스를 변경하지 못했어요. 잠시 후 다시 시도해 주세요.</p>}
        </section>
        <aside className="tip-card" id="tips" data-reveal><span>LOCAL TIP</span><p><strong>{catalog.region.tipTitle}</strong> {catalog.region.tipText}</p></aside>
        <p className="disclaimer">Google 경로를 확인할 수 없는 장소만 직선거리 기준으로 표시돼요. 실제 운행 상황은 출발 전에 다시 확인해 주세요.</p>
        <footer className="site-footer" aria-label="사이트 정보">
          <div>
            <SiteLink className="footer-brand" href="/"><span className="brand-mark" aria-hidden="true">も</span><span><strong>MOMOTABI</strong><small>취향대로 만드는 일본 여행 코스</small></span></SiteLink>
            <p>관광지 선택을 출발점으로 가까운 장소와 이동 순서를 함께 살펴보는 여행 계획 도구입니다.</p>
          </div>
          <PolicyLinks />
          <small>© 2026 MOMOTABI. 여행 전 운영시간과 교통편을 다시 확인해 주세요.</small>
        </footer>
      </section>

        <section className="map-panel" aria-label={`${catalog.region.nameKo} 내 여행 코스 지도`}>
          <TravelMap apiKey={googleMapsApiKey} places={selectedPlaces} startPlace={selectedLodging} activePlaceId={activePlace?.id ?? ""} center={mapCenter} onSelect={setActivePlaceId} />
          <div className="map-shade" aria-hidden="true" />
          <div className="map-label" key={`${catalog.region.id}-${selectedPlaces.length}`}>{catalog.region.nameKo} · 내 코스 {selectedPlaces.length}곳</div>
          <div className="map-legend" aria-label="지도 범례"><span><i /> 내 이동 동선</span><span><b>01</b> 방문 순서</span>{selectedLodging && <span><b className="hotel-legend">宿</b> 숙소 출발점</span>}</div>
          {activePlace ? <><div className="map-float" key={activePlace.id} aria-live="polite"><span>MY ROUTE · STOP {String(selectedPlaces.indexOf(activePlace) + 1).padStart(2, "0")}</span><strong>{activePlace.name}</strong><small>{activePlace.suggestedTime} 추천 · {durationLabel}</small></div><a className="open-map" href={activePlaceMapUrl} target="_blank" rel="noreferrer" aria-label={`${activePlace.name} Google 지도에서 열기`}>Google 지도에서 보기 ↗</a></> : <div className="map-empty"><span>YOUR ROUTE MAP</span><strong>관광지를 선택하면<br />여기에 코스가 그려져요.</strong><small>선택한 순서대로 번호와 이동선이 표시됩니다.</small></div>}
        </section>
      </div>
    </main>
  );
}
