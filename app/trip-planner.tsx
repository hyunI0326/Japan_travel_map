"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "./auth-context";
import TravelMap from "./travel-map";
import { authClient } from "@/lib/auth-client";
import {
  styleLabels,
  travelStyles,
  type TravelCourse,
  type TravelRegion,
  type TravelStyle,
} from "@/lib/travel-types";

export default function TripPlanner({
  regions,
  initialCourse,
}: {
  regions: TravelRegion[];
  initialCourse: TravelCourse;
}) {
  const { user } = useAuth();
  const [regionId, setRegionId] = useState(initialCourse.region.id);
  const [style, setStyle] = useState<TravelStyle>(initialCourse.style);
  const [dayCount, setDayCount] = useState(initialCourse.dayCount);
  const [course, setCourse] = useState(initialCourse);
  const [activeDayIndex, setActiveDayIndex] = useState(0);
  const [activePlaceId, setActivePlaceId] = useState(initialCourse.days[0].places[0].id);
  const [savedCourses, setSavedCourses] = useState<TravelCourse[]>([]);
  const [recommendationState, setRecommendationState] = useState<"idle" | "loading" | "error">("idle");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const activeDay = course.days[activeDayIndex] ?? course.days[0];
  const activePlace =
    activeDay.places.find((place) => place.id === activePlaceId) ?? activeDay.places[0];
  const mapCenter = useMemo<[number, number]>(
    () => [course.region.centerLon, course.region.centerLat],
    [course.region.centerLat, course.region.centerLon],
  );

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

  function showCourse(nextCourse: TravelCourse) {
    setCourse(nextCourse);
    setRegionId(nextCourse.region.id);
    setStyle(nextCourse.style);
    setDayCount(nextCourse.dayCount);
    setActiveDayIndex(0);
    setActivePlaceId(nextCourse.days[0].places[0].id);
    setSaveState(nextCourse.id ? "saved" : "idle");
  }

  async function generateRecommendation() {
    setRecommendationState("loading");
    setSaveState("idle");
    try {
      const response = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ regionId, style, dayCount }),
      });
      if (!response.ok) throw new Error("recommendation_failed");
      const data = (await response.json()) as { course: TravelCourse };
      showCourse(data.course);
      setRecommendationState("idle");
    } catch {
      setRecommendationState("error");
    }
  }

  async function saveCurrentCourse() {
    if (!user) {
      window.location.assign("/login");
      return;
    }
    if (saveState === "saving") return;
    setSaveState("saving");
    try {
      const response = await fetch("/api/trips", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          regionId: course.region.id,
          style: course.style,
          dayCount: course.dayCount,
        }),
      });
      if (!response.ok) throw new Error("save_failed");
      const data = (await response.json()) as { course: TravelCourse };
      showCourse(data.course);
      setSavedCourses((current) => [
        data.course,
        ...current.filter((saved) => saved.id !== data.course.id),
      ]);
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }

  async function signOut() {
    await authClient.signOut();
    window.location.assign("/");
  }

  function selectDay(index: number) {
    const day = course.days[index];
    setActiveDayIndex(index);
    setActivePlaceId(day.places[0].id);
  }

  const userInitial = user?.displayName.trim().charAt(0).toUpperCase() || "M";
  const durationLabel = `${Math.max(1, Math.round(activePlace.durationMinutes / 60))}시간 추천`;

  return (
    <main className="app-shell" id="top">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="모모타비 홈">
          <span className="brand-mark">も</span>
          <span>MOMOTABI</span>
        </a>
        <nav aria-label="주요 메뉴">
          <a className="section-link active" href="#planner">코스 만들기</a>
          <a className="section-link" href="#saved">내 코스</a>
          <button
            className={`save-button ${saveState === "saved" ? "is-saved" : ""}`}
            onClick={saveCurrentCourse}
            type="button"
            disabled={saveState === "saving"}
          >
            {!user
              ? "로그인 후 저장"
              : saveState === "saving"
                ? "저장 중…"
                : saveState === "saved"
                  ? "저장됨 ✓"
                  : "이 코스 저장"}
          </button>
          {user ? (
            <div className="account-control">
              <div className="account-chip" title={user.email} aria-label={`${user.displayName} 계정으로 로그인됨`}>
                <span className="account-avatar" aria-hidden="true">{userInitial}</span>
                <span className="account-copy">
                  <strong>{user.displayName}</strong>
                  <small>로그인됨</small>
                </span>
              </div>
              <button className="sign-out-link" type="button" onClick={signOut}>로그아웃</button>
            </div>
          ) : (
            <Link className="sign-in-link" href="/login">소셜 로그인</Link>
          )}
        </nav>
      </header>

      <section className="route-panel" id="planner">
        <div className="route-heading">
          <div className="city-chip">
            <span className="city-dot" /> {course.region.nameEn} <b>{course.region.nameJp}</b>
          </div>
          <p className="eyebrow">{course.region.eyebrow} · PERSONAL ROUTE</p>
          <h1>{course.region.headline}</h1>
          <p className="intro">{course.region.intro}</p>
          <div className="route-meta" aria-label="코스 요약">
            <span>{course.dayCount}일</span><i />
            <span>{course.days.reduce((sum, day) => sum + day.places.length, 0)}개 장소</span><i />
            <span>{course.styleLabel}</span>
          </div>
        </div>

        <section className="planner-card" aria-labelledby="planner-title">
          <div className="planner-title-row">
            <div>
              <span>MAKE YOUR ROUTE</span>
              <h2 id="planner-title">어디로 떠나볼까요?</h2>
            </div>
            <strong>01 — 03</strong>
          </div>
          <div className="planner-field">
            <span className="planner-label">여행 지역</span>
            <div className="region-switcher" role="group" aria-label="여행 지역 선택">
              {regions.map((region) => (
                <button
                  key={region.id}
                  type="button"
                  className={regionId === region.id ? "selected" : ""}
                  aria-pressed={regionId === region.id}
                  onClick={() => setRegionId(region.id)}
                >
                  {region.nameKo}<small>{region.nameEn}</small>
                </button>
              ))}
            </div>
          </div>
          <div className="planner-options">
            <div className="planner-field">
              <span className="planner-label">여행 스타일</span>
              <div className="style-switcher" role="group" aria-label="여행 스타일 선택">
                {travelStyles.map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={style === item ? "selected" : ""}
                    aria-pressed={style === item}
                    onClick={() => setStyle(item)}
                  >
                    {styleLabels[item]}
                  </button>
                ))}
              </div>
            </div>
            <label className="day-count-field">
              <span className="planner-label">여행 기간</span>
              <select value={dayCount} onChange={(event) => setDayCount(Number(event.target.value))}>
                <option value={1}>1일</option>
                <option value={2}>2일</option>
                <option value={3}>3일</option>
              </select>
            </label>
          </div>
          <button className="recommend-button" type="button" onClick={generateRecommendation} disabled={recommendationState === "loading"}>
            <span>{recommendationState === "loading" ? "코스를 고르는 중…" : "이 조건으로 코스 추천받기"}</span>
            <b aria-hidden="true">→</b>
          </button>
          {recommendationState === "error" && <p className="inline-error" role="alert">추천 코스를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</p>}
        </section>

        <div className="day-tabs" role="tablist" aria-label="여행 일자">
          {course.days.map((day, index) => (
            <button
              key={day.dayNumber}
              className={activeDayIndex === index ? "selected" : ""}
              role="tab"
              aria-selected={activeDayIndex === index}
              onClick={() => selectDay(index)}
            >
              DAY {day.dayNumber}
            </button>
          ))}
        </div>

        <div className="day-summary">
          <div><span>{activeDay.label}</span><strong>{course.title}</strong></div>
          <p>{activeDay.transit}</p>
        </div>

        <div className="stops" role="list" aria-label={`${activeDay.dayNumber}일차 추천 장소`}>
          {activeDay.places.map((place, index) => (
            <div key={place.id} role="listitem">
              <button
                className={`stop-card ${activePlace.id === place.id ? "active" : ""}`}
                onClick={() => setActivePlaceId(place.id)}
                aria-label={`${place.suggestedTime} ${place.name}, 지도에서 보기`}
              >
                <span className="stop-number">{String(index + 1).padStart(2, "0")}</span>
                <span className="stop-copy">
                  <span className="stop-time">{place.suggestedTime} · {place.category}</span>
                  <strong>{place.name}</strong>
                  <span className="stop-note">{place.description}</span>
                </span>
                <span className="duration">{Math.max(1, Math.round(place.durationMinutes / 60))}H</span>
              </button>
            </div>
          ))}
        </div>

        <section className="saved-courses" id="saved" aria-labelledby="saved-title">
          <div className="saved-heading">
            <div><span>MY ROUTES</span><h2 id="saved-title">저장한 코스</h2></div>
            {user && <small>{savedCourses.length}개 저장됨</small>}
          </div>
          {!user ? (
            <p className="saved-empty">로그인하면 만든 코스를 계정에 저장하고 언제든 다시 지도에서 볼 수 있어요.</p>
          ) : savedCourses.length === 0 ? (
            <p className="saved-empty">아직 저장한 코스가 없어요. 마음에 드는 추천을 저장해 보세요.</p>
          ) : (
            <div className="saved-list">
              {savedCourses.map((saved) => (
                <button key={saved.id} type="button" onClick={() => showCourse(saved)} className={course.id === saved.id ? "active" : ""}>
                  <span>{saved.region.nameKo} · {saved.dayCount}일</span>
                  <strong>{saved.title}</strong>
                  <small>{saved.styleLabel} · 지도에서 다시 보기 →</small>
                </button>
              ))}
            </div>
          )}
          {saveState === "error" && <p className="inline-error" role="alert">코스를 저장하지 못했어요. 로그인 상태를 확인해 주세요.</p>}
        </section>

        <aside className="tip-card" id="tips">
          <span>LOCAL TIP</span>
          <p><strong>{course.region.tipTitle}</strong> {course.region.tipText}</p>
        </aside>
        <p className="disclaimer">운영 시간과 휴무일은 방문 전 공식 정보를 확인해 주세요.</p>
      </section>

      <section className="map-panel" aria-label={`${course.region.nameKo} 추천 여행 지도`}>
        <TravelMap
          places={activeDay.places}
          activePlaceId={activePlace.id}
          center={mapCenter}
          onSelect={setActivePlaceId}
        />
        <div className="map-shade" aria-hidden="true" />
        <div className="map-label">{course.region.nameKo} · {activeDay.dayNumber}일차 코스</div>
        <div className="map-legend" aria-label="지도 범례">
          <span><i /> 추천 이동선</span><span><b>01</b> 방문 순서</span>
        </div>
        <div className="map-float" aria-live="polite">
          <span>DAY {activeDay.dayNumber} · STOP {String(activeDay.places.indexOf(activePlace) + 1).padStart(2, "0")}</span>
          <strong>{activePlace.name}</strong>
          <small>{activePlace.suggestedTime} 도착 · {durationLabel}</small>
        </div>
        <a
          className="open-map"
          href={`https://www.openstreetmap.org/?mlat=${activePlace.latitude}&mlon=${activePlace.longitude}#map=16/${activePlace.latitude}/${activePlace.longitude}`}
          target="_blank"
          rel="noreferrer"
          aria-label={`${activePlace.name} 큰 지도 열기`}
        >
          큰 지도에서 보기 ↗
        </a>
      </section>
    </main>
  );
}
