"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "./auth-context";
import TravelMap from "./travel-map";
import { authClient } from "@/lib/auth-client";
import {
  buildCustomCourse,
  styleLabels,
  travelStyles,
  type PlaceCatalog,
  type PlaceRecommendation,
  type TravelCourse,
  type TravelPlace,
  type TravelRegion,
  type TravelStyle,
} from "@/lib/travel-types";

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
  const [selectedPlaces, setSelectedPlaces] = useState<TravelPlace[]>([]);
  const [activePlaceId, setActivePlaceId] = useState("");
  const [savedCourses, setSavedCourses] = useState<TravelCourse[]>([]);
  const [catalogState, setCatalogState] = useState<"idle" | "loading" | "error">("idle");
  const [recommendationState, setRecommendationState] = useState<"idle" | "loading" | "error">("idle");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const stepTwoRef = useRef<HTMLDivElement>(null);
  const stepThreeRef = useRef<HTMLDivElement>(null);

  const course = useMemo(
    () => buildCustomCourse({ region: catalog.region, places: selectedPlaces, style }),
    [catalog.region, selectedPlaces, style],
  );
  const activePlace =
    selectedPlaces.find((place) => place.id === activePlaceId) ?? selectedPlaces[0] ?? null;
  const mapCenter = useMemo<[number, number]>(
    () => [catalog.region.centerLon, catalog.region.centerLat],
    [catalog.region.centerLat, catalog.region.centerLon],
  );
  const stepTwoUnlocked = hasChosenRegion;
  const stepThreeUnlocked = mustVisitIds.length > 0;
  const currentStep = !hasChosenRegion ? 1 : !stepThreeUnlocked ? 2 : 3;

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

  async function loadCatalog(nextRegionId: string) {
    if (hasChosenRegion && nextRegionId === regionId) return;

    setHasChosenRegion(true);
    setRegionId(nextRegionId);
    setMustVisitIds([]);
    setRecommendations([]);
    setRecommendationProvider(null);
    setSelectedPlaces([]);
    setActivePlaceId("");
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
    setSaveState("idle");
    if (unlocksNextStep) {
      window.setTimeout(
        () => stepThreeRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }),
        220,
      );
    }
  }

  async function generateRecommendations() {
    if (mustVisitIds.length === 0) return;
    setRecommendationState("loading");
    setSaveState("idle");
    try {
      const response = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ regionId, style, anchorPlaceIds: mustVisitIds }),
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
    setSaveState("idle");
  }

  function removeCoursePlace(placeId: string) {
    setSelectedPlaces((current) => current.filter((place) => place.id !== placeId));
    setMustVisitIds((current) => current.filter((id) => id !== placeId));
    if (mustVisitIds.includes(placeId)) {
      setRecommendations([]);
      setRecommendationProvider(null);
      setRecommendationState("idle");
    }
    setSaveState("idle");
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
    setRecommendations([]);
    setRecommendationProvider(null);
    setSelectedPlaces(places);
    setActivePlaceId(places[0]?.id ?? "");
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
              <small className="step-state">{!stepTwoUnlocked ? "1단계 선택 후 열림" : mustVisitIds.length > 0 ? `${mustVisitIds.length}곳 선택됨` : "하나 이상 골라주세요"}</small>
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
                      return (
                        <article key={place.id} className={selected ? "selected" : ""} style={{ animationDelay: `${index * 55}ms` }}>
                          <div>
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
                  {travelStyles.map((item) => <button key={item} type="button" className={style === item ? "selected" : ""} aria-pressed={style === item} onClick={() => { setStyle(item); setRecommendations([]); setRecommendationProvider(null); }}>{styleLabels[item]}</button>)}
                </div>
                <button className="recommend-button" type="button" onClick={generateRecommendations} disabled={recommendationState === "loading"}><span>{recommendationState === "loading" ? "가까운 장소를 찾는 중…" : "근교 관광지 추천받기"}</span><b aria-hidden="true">→</b></button>
                {recommendationState === "error" && <p className="inline-error" role="alert">근교 추천을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</p>}
                {recommendations.length > 0 && (
                  <div className="nearby-list" aria-label="근교 추천 관광지">
                    {recommendations.map((place, index) => {
                      const selected = selectedPlaces.some((candidate) => candidate.id === place.id);
                      return <article key={place.id} className={selected ? "selected" : ""} style={{ animationDelay: `${index * 45}ms` }}><div><span>{place.nearAnchorName}에서 {place.distanceKm}km</span><strong>{place.name}</strong><small>{place.category} · {place.description}</small></div><button type="button" onClick={() => toggleRecommendedPlace(place)} aria-label={`${place.name} ${selected ? "코스에서 빼기" : "코스에 담기"}`}>{selected ? "담김 ✓" : "+ 담기"}</button></article>;
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
              {selectedPlaces.map((place, index) => <div key={place.id} className={place.id === activePlace?.id ? "active" : ""} role="listitem"><button className="course-place-main" type="button" onClick={() => setActivePlaceId(place.id)}><span>{String(index + 1).padStart(2, "0")}</span><div><small>{place.category}</small><strong>{place.name}</strong></div></button><button className="course-place-remove" type="button" onClick={() => removeCoursePlace(place.id)} aria-label={`${place.name} 코스에서 빼기`}>×</button></div>)}
            </div>
          )}
          {saveState === "error" && <p className="inline-error" role="alert">코스를 저장하지 못했어요. 로그인 상태를 확인해 주세요.</p>}
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
