"use client";

import { useMemo, useState } from "react";
import { useAuth } from "./auth-context";
import { authClient } from "@/lib/auth-client";

type Stop = {
  time: string;
  type: string;
  name: string;
  note: string;
  duration: string;
  lat: number;
  lon: number;
};

const itinerary: { label: string; title: string; transit: string; stops: Stop[] }[] = [
  {
    label: "동쪽의 오래된 풍경",
    title: "아사쿠사에서 긴자까지",
    transit: "도보 5.2km · 지하철 2회",
    stops: [
      { time: "09:00", type: "산책", name: "아사쿠사 & 센소지", note: "붐비기 전 나카미세 골목과 오래된 절의 아침을 천천히 만나요.", duration: "2h", lat: 35.7148, lon: 139.7967 },
      { time: "12:30", type: "커피", name: "기요스미시라카와", note: "창고를 개조한 로스터리와 정원이 있는 동네에서 잠깐 쉬어가요.", duration: "2h", lat: 35.6797, lon: 139.8001 },
      { time: "17:00", type: "저녁", name: "긴자 골목", note: "화려한 대로 뒤편, 작은 식당과 오래된 바가 모인 골목을 걸어요.", duration: "3h", lat: 35.6717, lon: 139.7650 },
    ],
  },
  {
    label: "느긋한 도쿄의 오후",
    title: "다이칸야마에서 시부야까지",
    transit: "도보 6.1km · 전철 1회",
    stops: [
      { time: "10:00", type: "책과 건축", name: "다이칸야마 T-SITE", note: "햇살 좋은 테라스와 서가 사이에서 여행의 속도를 늦춰요.", duration: "2h", lat: 35.6489, lon: 139.6990 },
      { time: "13:00", type: "산책", name: "나카메구로 강변", note: "작은 숍과 카페를 지나 메구로강을 따라 남쪽으로 걸어요.", duration: "2.5h", lat: 35.6436, lon: 139.6987 },
      { time: "18:00", type: "야경", name: "시부야 스카이", note: "해가 지기 40분 전 도착해 도시의 낮과 밤을 함께 봐요.", duration: "2h", lat: 35.6585, lon: 139.7022 },
    ],
  },
  {
    label: "생활의 온도가 남은 곳",
    title: "야나카에서 가구라자카까지",
    transit: "도보 4.8km · 지하철 1회",
    stops: [
      { time: "09:30", type: "골목", name: "야나카 긴자", note: "고양이 조형물과 동네 간식이 반기는 낮은 골목을 걸어요.", duration: "2h", lat: 35.7274, lon: 139.7667 },
      { time: "12:30", type: "미술", name: "우에노 공원", note: "박물관 하나를 골라 깊게 보고, 연못가에서 늦은 점심을 즐겨요.", duration: "3h", lat: 35.7155, lon: 139.7731 },
      { time: "17:30", type: "저녁", name: "가구라자카", note: "돌계단과 작은 요정 골목 사이, 마지막 저녁을 여유롭게 마무리해요.", duration: "3h", lat: 35.7020, lon: 139.7404 },
    ],
  },
];

function mapUrl(stop: Stop) {
  const pad = 0.022;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${stop.lon - pad}%2C${stop.lat - pad}%2C${stop.lon + pad}%2C${stop.lat + pad}&layer=mapnik&marker=${stop.lat}%2C${stop.lon}`;
}

export default function Home() {
  const { user } = useAuth();
  const [day, setDay] = useState(0);
  const [stopIndex, setStopIndex] = useState(0);
  const [saved, setSaved] = useState(false);
  const current = itinerary[day];
  const activeStop = current.stops[stopIndex];
  const currentMap = useMemo(() => mapUrl(activeStop), [activeStop]);

  function chooseDay(index: number) {
    setDay(index);
    setStopIndex(0);
  }

  function toggleSaved() {
    if (!user) {
      window.location.assign("/login");
      return;
    }
    setSaved((value) => !value);
  }

  async function signOut() {
    await authClient.signOut();
    window.location.assign("/");
  }

  const userInitial = user?.displayName.trim().charAt(0).toUpperCase() || "M";

  return (
    <main className="app-shell" id="top">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="모모타비 홈">
          <span className="brand-mark">も</span>
          <span>MOMOTABI</span>
        </a>
        <nav aria-label="주요 메뉴">
          <a className="section-link active" href="#route">여행 코스</a>
          <a className="section-link" href="#tips">여행 팁</a>
          <button className={`save-button ${saved ? "is-saved" : ""}`} onClick={toggleSaved} aria-pressed={saved}>
            {!user ? "로그인 후 저장" : saved ? "저장됨 ✓" : "내 코스 저장"}
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
            <a className="sign-in-link" href="/login">소셜 로그인</a>
          )}
        </nav>
      </header>

      <section className="route-panel" id="route">
        <div className="route-heading">
          <div className="city-chip"><span className="city-dot" /> TOKYO <b>東京</b></div>
          <p className="eyebrow">CURATED ROUTE · 3 DAYS</p>
          <h1>도쿄의 결을<br />따라 걷는 3일</h1>
          <p className="intro">오래된 골목에서 반짝이는 야경까지.<br />하루에 세 곳, 여유롭게 만나는 도쿄.</p>
          <div className="route-meta" aria-label="코스 요약">
            <span>3일</span><i /> <span>9개 장소</span><i /> <span>걷기 좋은 코스</span>
          </div>
        </div>

        <div className="day-tabs" role="tablist" aria-label="여행 일자">
          {itinerary.map((item, index) => (
            <button key={item.title} className={day === index ? "selected" : ""} role="tab" aria-selected={day === index} onClick={() => chooseDay(index)}>
              DAY {index + 1}
            </button>
          ))}
        </div>

        <div className="day-summary">
          <div><span>{current.label}</span><strong>{current.title}</strong></div>
          <p>{current.transit}</p>
        </div>

        <div className="stops" role="list" aria-label={`${day + 1}일차 장소`}>
          {current.stops.map((stop, index) => (
            <div key={stop.name} role="listitem">
              <button className={`stop-card ${stopIndex === index ? "active" : ""}`} onClick={() => setStopIndex(index)} aria-label={`${stop.time} ${stop.name}, 지도에서 보기`}>
                <span className="stop-number">{String(index + 1).padStart(2, "0")}</span>
                <span className="stop-copy">
                  <span className="stop-time">{stop.time} · {stop.type}</span>
                  <strong>{stop.name}</strong>
                  <span className="stop-note">{stop.note}</span>
                </span>
                <span className="duration">{stop.duration}</span>
              </button>
            </div>
          ))}
        </div>

        <aside className="tip-card" id="tips">
          <span>LOCAL TIP</span>
          <p><strong>스이카 한 장이면 충분해요.</strong> 지하철과 버스는 물론 편의점에서도 쓸 수 있어 동선을 끊지 않아요.</p>
        </aside>
        <p className="disclaimer">운영 시간과 휴무일은 방문 전 공식 정보를 확인해 주세요.</p>
      </section>

      <section className="map-panel" aria-label="도쿄 여행 지도">
        <iframe key={currentMap} title={`${activeStop.name} 지도`} src={currentMap} loading="eager" />
        <div className="map-shade" aria-hidden="true" />
        <div className="map-label">TOKYO · 東京</div>
        <div className="map-float" aria-live="polite">
          <span>DAY {day + 1} · STOP {String(stopIndex + 1).padStart(2, "0")}</span>
          <strong>{activeStop.name}</strong>
          <small>{activeStop.time} 도착 추천 · {activeStop.duration} 머물기</small>
        </div>
        <a className="open-map" href={`https://www.openstreetmap.org/?mlat=${activeStop.lat}&mlon=${activeStop.lon}#map=16/${activeStop.lat}/${activeStop.lon}`} target="_blank" rel="noreferrer" aria-label={`${activeStop.name} 큰 지도 열기`}>
          큰 지도에서 보기 ↗
        </a>
      </section>
    </main>
  );
}
