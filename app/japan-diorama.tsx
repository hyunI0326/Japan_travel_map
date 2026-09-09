"use client";

/* This custom pan/zoom surface implements its own keyboard interaction and
 * exposes equivalent native buttons; there is no native image-viewer element. */
/* eslint-disable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */

import { useEffect, useRef, useState } from "react";

const initialView = { x: 0, y: 0, scale: 1 };
const clampScale = (scale: number) => Math.min(3, Math.max(0.6, scale));

export default function JapanDiorama() {
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
      const x = (event.clientX - rect.left - rect.width / 2) * element.clientWidth / rect.width;
      const y = (event.clientY - rect.top - rect.height / 2) * element.clientHeight / rect.height;
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
          if (!event.isPrimary || event.button !== 0) return;
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
        <img className="journey-object__image" src="/japan-archipelago-3d.png" alt="홋카이도, 혼슈, 시코쿠, 규슈가 이어지는 일본 열도 모양의 입체 미니어처" width={1254} height={1254} fetchPriority="high" decoding="async" draggable={false} style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }} />
      </div>
      <div className="journey-object__toolbar" aria-label="그림 보기 조절">
        <button type="button" onClick={() => zoom(1 / 1.2)} disabled={view.scale <= 0.6} aria-label="축소">−</button>
        <output aria-label="확대 비율">{Math.round(view.scale * 100)}%</output>
        <button type="button" onClick={() => zoom(1.2)} disabled={view.scale >= 3} aria-label="확대">+</button>
        <button type="button" onClick={() => setView(initialView)}>원위치</button>
      </div>
      <p id="diorama-help" className="journey-object__help">휠로 확대·축소 · 드래그로 이동<span>키보드: 방향키 이동 · + / − 확대·축소 · Home 초기화</span></p>
    </div>
  );
}
