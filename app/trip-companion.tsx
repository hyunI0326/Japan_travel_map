"use client";
import { useEffect, useState } from "react";
import type { SharedPlan } from "@/lib/share-types";
import { emptyJournal, japanDate, offlineTripHtml, settleExpenses, type TripJournal } from "@/lib/trip-journal";
import { calculateBudgetSummary } from "@/lib/budget";
import { isPublicTransportMode } from "@/lib/travel-types";

const yen = (amount: number) => `¥${amount.toLocaleString("ja-JP")}`;
export default function TripCompanion({ plan, title, onChange }: { plan: SharedPlan; title: string; onChange: (journal: TripJournal) => void }) {
  const journal = plan.journal ?? emptyJournal();
  const [tab, setTab] = useState<"today" | "memos" | "expenses">("today");
  const [today, setToday] = useState("");
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [travelerName, setTravelerName] = useState("");
  const [message, setMessage] = useState("");
  const days = plan.itineraryPlan?.days ?? [];
  const day = days.find((d) => d.dayNumber === selectedDay) ?? days.find((d) => d.date === today) ?? days[0];
  const stops = day?.activities.filter((a) => a.kind === "place") ?? [];
  const next = stops.find((a) => !journal.visited.includes(a.place.id));
  const summary = settleExpenses(journal);
  const estimated = plan.budget ? calculateBudgetSummary(plan.budget, plan.preferences.dayCount).totalYen : null;
  useEffect(() => {
    const update = () => setToday(japanDate());
    update(); const timer = window.setInterval(update, 60_000);
    return () => window.clearInterval(timer);
  }, []);
  function downloadOffline() {
    try {
      const url = URL.createObjectURL(new Blob([offlineTripHtml(plan, title)], { type: "text/html;charset=utf-8" }));
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = `momotabi-${plan.regionId}-offline.html`;
      document.body.appendChild(anchor); anchor.click(); anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setMessage("오프라인 일정 파일을 내려받았어요. 파일 앱에 보관하고 출발 전에 한 번 열어보세요.");
    } catch { setMessage("파일을 만들지 못했어요. 인쇄·PDF 저장을 이용해 주세요."); }
  }
  return <section className="travel-tools" id="travel-companion" aria-labelledby="companion-title">
    <div className="tools-heading"><div><small>YOUR TRAVEL COMPANION</small><h2 id="companion-title">여행 중에도 모모타비</h2></div><button type="button" className="no-print" onClick={downloadOffline}>오프라인 일정 내려받기 ↓</button></div>
    <p className="tools-help">메모·예약·지출은 개인 보관용이며 공개 링크에 포함되지 않아요. 계정에 보관하려면 아래에서 일정을 저장해 주세요.</p>
    <p className="tools-help">내려받은 HTML 파일은 인터넷 없이 일정·메모를 볼 수 있어요. 지도·길찾기는 인터넷 연결이 필요해요.</p>
    <div className="tools-tabs no-print" role="group" aria-label="여행 도구 선택">{([['today', '여행 당일'], ['memos', '메모·예약'], ['expenses', '지출·정산']] as const).map(([id, label]) => <button type="button" key={id} aria-pressed={tab === id} onClick={() => { setTab(id); setMessage(""); }}>{label}</button>)}</div>
    <p role="status">{message}</p>
    {tab === "today" && <div>
      {days.length === 0 ? <p>위에서 일정을 자동 완성하면 하루별 방문 순서와 다음 장소가 표시돼요. 메모와 지출은 지금도 기록할 수 있어요.</p> : <>
        <label>확인할 날짜<select value={day?.dayNumber ?? 1} onChange={(event) => setSelectedDay(Number(event.target.value))}>{days.map((d) => <option key={d.dayNumber} value={d.dayNumber}>{d.dayNumber}일차 · {d.date || "날짜 미정"}{d.date === today ? " · 오늘" : ""}</option>)}</select></label>
        <p className="tools-help">일본 날짜 기준 · {stops.filter((a) => journal.visited.includes(a.place.id)).length}/{stops.length}곳 방문 완료</p>
        {next ? <div className="next-stop"><small>다음 장소</small><h3>{next.place.name}</h3><p>{next.scheduledTime}–{next.endTime}</p><a target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?${new URLSearchParams({ api: "1", destination: `${next.place.latitude},${next.place.longitude}`, travelmode: isPublicTransportMode(plan.preferences.transport) ? "transit" : plan.preferences.transport === "driving" ? "driving" : "walking" })}`}>현재 위치에서 길찾기 ↗</a></div> : <p>{stops.length ? "오늘의 장소를 모두 방문했어요!" : "여유롭게 보내는 자유 일정이에요."}</p>}
        <ol className="today-stops">{day?.activities.map((a) => a.kind === "meal" ? <li key={a.id}><time>{a.scheduledTime}</time><span>{a.label}</span></li> : <li key={a.place.id}><time>{a.scheduledTime}</time><div><label className="check-label"><input type="checkbox" checked={journal.visited.includes(a.place.id)} onChange={(event) => onChange({ ...journal, visited: event.target.checked ? [...new Set([...journal.visited, a.place.id])] : journal.visited.filter((id) => id !== a.place.id) })} />{a.place.name}</label>{journal.memos[a.place.id]?.reservation && <p>예약: {journal.memos[a.place.id].reservation}</p>}{journal.memos[a.place.id]?.note && <p>{journal.memos[a.place.id].note}</p>}{journal.memos[a.place.id]?.preparation && <p>준비물: {journal.memos[a.place.id].preparation}</p>}</div></li>)}</ol>
      </>}
    </div>}
    {tab === "memos" && <div className="memo-list">{plan.places.map((place) => {
      const memo = journal.memos[place.id] ?? { note: "", reservation: "", preparation: "" };
      return <details key={place.id}><summary>{place.name}{Object.values(memo).some(Boolean) ? " · 기록 있음" : ""}</summary><label>메모<textarea maxLength={2000} value={memo.note} onChange={(event) => onChange({ ...journal, memos: { ...journal.memos, [place.id]: { ...memo, note: event.target.value } } })} placeholder="먹고 싶은 메뉴, 입장 위치 등" /></label><label>예약 시간·예약번호<input maxLength={300} value={memo.reservation} onChange={(event) => onChange({ ...journal, memos: { ...journal.memos, [place.id]: { ...memo, reservation: event.target.value } } })} placeholder="13:00 / 예약번호 ABC123" /></label><label>준비물<input maxLength={500} value={memo.preparation} onChange={(event) => onChange({ ...journal, memos: { ...journal.memos, [place.id]: { ...memo, preparation: event.target.value } } })} placeholder="여권, 예약 확인서" /></label></details>;
    })}</div>}
    {tab === "expenses" && <div>
      <div className="expense-summary"><p>실제 지출<strong>{yen(summary.total)}</strong></p>{estimated !== null && <p>예상 {yen(estimated)} 대비<strong>{summary.total > estimated ? `${yen(summary.total - estimated)} 초과` : `${yen(estimated - summary.total)} 남음`}</strong></p>}</div>
      <p className="tools-help">엔화 정수로 기록하며 선택한 인원끼리 균등 분담해요. 나머지 1엔은 선택된 인원 순서대로 나눠요.</p>
      <form className="traveler-form" onSubmit={(event) => { event.preventDefault(); const name = travelerName.trim(); if (!name || journal.travelers.includes(name)) { setMessage("서로 다른 이름을 입력해 주세요."); return; } onChange({ ...journal, travelers: [...journal.travelers, name] }); setTravelerName(""); setMessage(""); }}><label>정산 인원 추가<input maxLength={30} value={travelerName} onChange={(event) => setTravelerName(event.target.value)} placeholder="동행자 이름" /></label><button type="submit" disabled={journal.travelers.length >= 10 || !travelerName.trim()}>추가</button></form>
      <div className="traveler-chips">{journal.travelers.map((name) => <span key={name}>{name}<button type="button" aria-label={`${name} 정산 인원에서 삭제`} disabled={journal.travelers.length === 1 || journal.expenses.some((expense) => expense.payer === name || expense.participants.includes(name))} onClick={() => onChange({ ...journal, travelers: journal.travelers.filter((n) => n !== name) })}>×</button></span>)}</div>
      <form className="expense-form" onSubmit={(event) => {
        event.preventDefault(); const form = event.currentTarget; const data = new FormData(form); const amount = Number(data.get("amount")); const participants = data.getAll("participants").map(String);
        if (!Number.isSafeInteger(amount) || amount <= 0 || !participants.length) { setMessage("금액과 분담 인원을 확인해 주세요."); return; }
        onChange({ ...journal, expenses: [...journal.expenses, { id: crypto.randomUUID(), label: String(data.get("label")).trim(), amount, payer: String(data.get("payer")), participants, date: String(data.get("date")) }] });
        form.reset(); setMessage("지출을 기록했어요.");
      }}>
        <label>지출 내역<input name="label" required maxLength={100} placeholder="예: 점심 라멘" /></label>
        <label>금액 (엔)<input name="amount" type="number" inputMode="numeric" required min={1} max={100000000} step={1} /></label>
        <label>결제한 사람<select name="payer">{journal.travelers.map((name) => <option key={name}>{name}</option>)}</select></label>
        <label>날짜<input name="date" type="date" required defaultValue={today} key={today} /></label>
        <fieldset><legend>함께 나눌 사람</legend>{journal.travelers.map((name) => <label className="check-label" key={name}><input name="participants" type="checkbox" value={name} defaultChecked />{name}</label>)}</fieldset>
        <button type="submit" disabled={journal.expenses.length >= 300}>지출 기록</button>
      </form>
      {journal.expenses.length === 0 ? <p className="tools-help">아직 기록한 지출이 없어요.</p> : <><ul className="expense-list">{journal.expenses.map((expense) => <li key={expense.id}><div><strong>{expense.label} · {yen(expense.amount)}</strong><small>{expense.date} · {expense.payer} 결제 · {expense.participants.join(", ")} 분담</small></div><button type="button" aria-label={`${expense.label} 지출 삭제`} onClick={() => onChange({ ...journal, expenses: journal.expenses.filter((e) => e.id !== expense.id) })}>삭제</button></li>)}</ul><h3>이렇게 보내면 정산 완료</h3>{summary.transfers.length ? <ul>{summary.transfers.map((transfer) => <li key={`${transfer.from}-${transfer.to}`}>{transfer.from} → {transfer.to} <strong>{yen(transfer.amount)}</strong></li>)}</ul> : <p>주고받을 금액이 없어요.</p>}</>}
    </div>}
  </section>;
}
