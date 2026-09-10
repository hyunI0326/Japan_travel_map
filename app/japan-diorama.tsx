"use client";

/* This custom pan/zoom surface implements its own keyboard interaction and
 * exposes equivalent native buttons; there is no native image-viewer element. */
/* eslint-disable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */

import { useEffect, useRef, useState } from "react";

const initialView = { x: 0, y: 0, scale: 1 };
const clampScale = (scale: number) => Math.min(3, Math.max(0.6, scale));

const destinations = [
  { id: "tokyo", name: "도쿄", en: "TOKYO", jp: "東京", title: "도시의 빛을 따라.", description: "골목의 작은 카페부터 잠들지 않는 거리까지. 익숙한 일상 너머, 나만의 도쿄를 발견하세요.", theme: "도시 · 미식 · 문화", x: 75, y: 50, coordinate: "35°40′ N 139°45′ E" },
  { id: "kyoto", name: "교토", en: "KYOTO", jp: "京都", title: "시간이 머무는 곳.", description: "고요한 정원과 오래된 골목, 계절이 스며든 풍경. 조금 느린 걸음으로 교토를 만나보세요.", theme: "정원 · 산책 · 전통", x: 61, y: 55, coordinate: "35°00′ N 135°46′ E" },
  { id: "osaka", name: "오사카", en: "OSAKA", jp: "大阪", title: "맛있는 순간 사이로.", description: "활기찬 시장에서 반짝이는 강변까지. 먹고 걷고 웃는 순간으로 오사카의 하루를 채워보세요.", theme: "미식 · 쇼핑 · 야경", x: 58, y: 61, coordinate: "34°41′ N 135°30′ E" },
  { id: "fukuoka", name: "후쿠오카", en: "FUKUOKA", jp: "福岡", title: "가볍게, 더 가까이.", description: "바다의 바람과 포장마차의 온기. 여유로운 동네 산책으로 시작하는 후쿠오카 여행.", theme: "미식 · 바다 · 휴식", x: 38, y: 67, coordinate: "33°35′ N 130°24′ E" },
  { id: "sapporo", name: "삿포로", en: "SAPPORO", jp: "札幌", title: "북쪽의 계절 속으로.", description: "넓은 하늘과 깊은 숲, 계절마다 새로운 풍경. 홋카이도에서 여행의 호흡을 바꿔보세요.", theme: "자연 · 계절 · 미식", x: 83, y: 17, coordinate: "43°03′ N 141°21′ E" },
];

export default function JapanDiorama({ onExplore }: { onExplore?: (regionId: string) => void }) {
  const [selected, setSelected] = useState(destinations[0]);
  const viewport = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; x: number; y: number } | null>(null);
  const [view, setView] = useState(initialView);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      const scene = element.querySelector<HTMLElement>(".journey-object__scene");
      const x = (event.clientX - rect.left) * element.clientWidth / rect.width - (scene?.offsetLeft ?? element.clientWidth / 2);
      const y = (event.clientY - rect.top) * element.clientHeight / rect.height - (scene?.offsetTop ?? element.clientHeight / 2);
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? element.clientHeight : 1);
      setView((current) => {
        const scale = clampScale(current.scale * Math.exp(-delta * 0.002));
        const ratio = scale / current.scale;
        return { scale, x: x - (x - current.x) * ratio, y: y - (y - current.y) * ratio };
      });
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, []);

  function zoom(factor: number) {
    setView((current) => {
      const scale = clampScale(current.scale * factor);
      const ratio = scale / current.scale;
      return { scale, x: current.x * ratio, y: current.y * ratio };
    });
  }

  return (
    <div className="terrain-explorer">
      <header className="explorer-header">
        <a className="explorer-brand" href="#top"><span aria-hidden="true">も</span> MOMOTABI<small>JAPAN, AT YOUR PACE.</small></a>
        <a className="explorer-header-link" href="#planner">나만의 여행 만들기 <span aria-hidden="true">↗</span></a>
      </header>
      <div className="journey-object">
      <div
        ref={viewport}
        className={`journey-object__viewport${dragging ? " is-dragging" : ""}`}
        role="application"
        aria-roledescription="확대 및 이동 가능한 그림"
        aria-label="일본 열도 3D 그림"
        aria-describedby="diorama-help"
        tabIndex={0}
        onKeyDown={(event) => {
          const moves: Record<string, [number, number]> = { ArrowLeft: [-30, 0], ArrowRight: [30, 0], ArrowUp: [0, -30], ArrowDown: [0, 30] };
          if (moves[event.key]) {
            event.preventDefault();
            const [x, y] = moves[event.key];
            setView((current) => ({ ...current, x: current.x + x, y: current.y + y }));
          } else if (event.key === "+" || event.key === "=") { event.preventDefault(); zoom(1.2); }
          else if (event.key === "-") { event.preventDefault(); zoom(1 / 1.2); }
          else if (event.key === "Home" || event.key === "0") { event.preventDefault(); setView(initialView); }
        }}
        onPointerDown={(event) => {
          if (!event.isPrimary || event.button !== 0 || (event.target instanceof Element && event.target.closest("button"))) return;
          event.currentTarget.focus({ preventScroll: true });
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
          setDragging(true);
        }}
        onPointerMove={(event) => {
          const previous = drag.current;
          if (!previous || previous.id !== event.pointerId) return;
          const rect = event.currentTarget.getBoundingClientRect();
          const x = (event.clientX - previous.x) * event.currentTarget.clientWidth / rect.width;
          const y = (event.clientY - previous.y) * event.currentTarget.clientHeight / rect.height;
          drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
          setView((current) => ({ ...current, x: current.x + x, y: current.y + y }));
        }}
        onPointerUp={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
          drag.current = null;
          setDragging(false);
        }}
        onPointerCancel={() => { drag.current = null; setDragging(false); }}
        onLostPointerCapture={() => { drag.current = null; setDragging(false); }}
      >
        <div className="journey-object__scene" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}>
          <img className="journey-object__image" src="/japan-terrain-cinematic.png" alt="짙은 바다 위에 금빛 산맥과 해안선이 드러나는 일본 열도 지형 일러스트" width={1536} height={1024} fetchPriority="high" decoding="async" draggable={false} />
          {destinations.map((destination) => (
            <button key={destination.id} data-destination={destination.id} className={`terrain-marker${selected.id === destination.id ? " is-selected" : ""}`} style={{ left: `${destination.x}%`, top: `${destination.y}%` }} type="button" onClick={() => setSelected(destination)} onKeyDown={(event) => event.stopPropagation()} aria-label={`${destination.name} 둘러보기`} aria-pressed={selected.id === destination.id}>
              <span className="terrain-marker__dot" /><span>{destination.en}<small>{destination.name}</small></span>
            </button>
          ))}
        </div>
      </div>
      <div className="journey-object__toolbar" aria-label="그림 보기 조절">
        <button type="button" data-zoom="out" onClick={() => zoom(1 / 1.2)} disabled={view.scale <= 0.6} aria-label="축소">−</button>
        <output aria-label="확대 비율">{Math.round(view.scale * 100)}%</output>
        <button type="button" data-zoom="in" onClick={() => zoom(1.2)} disabled={view.scale >= 3} aria-label="확대">+</button>
        <button type="button" data-zoom="reset" onClick={() => setView(initialView)}>원위치</button>
      </div>
      <div className="explorer-compass" aria-hidden="true"><span>N</span>↑<small>JAPAN</small></div>
      <p id="diorama-help" className="journey-object__help">휠로 확대·축소 · 드래그로 이동<span>키보드: 방향키 이동 · + / − 확대·축소 · Home 초기화</span></p>
      </div>
      <aside className="explorer-panel" aria-label="여행 지역 탐색">
        <p className="explorer-eyebrow"><span /> EXPLORE JAPAN / 01</p>
        <h1 id="landing-title">A little further.<br /><em>A little closer.</em></h1>
        <p className="explorer-intro">지도를 펼치고, 마음이 향하는 곳으로.</p>
        <div className="explorer-divider" />
        <p className="explorer-label">YOUR NEXT DESTINATION</p>
        <div className="explorer-destinations" aria-label="여행 도시 선택">
          {destinations.map((destination) => <button type="button" key={destination.id} data-destination={destination.id} onClick={() => setSelected(destination)} aria-pressed={selected.id === destination.id}>{destination.name}</button>)}
        </div>
        <div className="explorer-destination" key={selected.id}>
          <div className="explorer-city"><h2>{selected.name}<span>{selected.en}</span></h2><span aria-hidden="true">{selected.jp}</span></div>
          <h3>{selected.title}</h3>
          <p>{selected.description}</p>
          <span className="explorer-theme">{selected.theme}</span>
        </div>
        <a className="explorer-cta" href="#planner" onClick={() => onExplore?.(selected.id)}>{selected.name} 여행 계획하기 <span aria-hidden="true">↗</span></a>
        <p className="explorer-panel-note">장소를 고르면, 나만의 코스가 완성돼요.</p>
      </aside>
      <footer className="explorer-footer"><span><i /> JAPAN COLLECTION</span><span className="explorer-coordinate">{selected.coordinate}</span><a href="#planner">SCROLL TO PLAN <span aria-hidden="true">↓</span></a></footer>
    </div>
  );
}
