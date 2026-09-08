import type { SharedPlan } from "./share-types";

export type PlaceMemo = { note: string; reservation: string; preparation: string };
export type Expense = { id: string; label: string; amount: number; payer: string; participants: string[]; date: string };
export type TripJournal = {
  memos: Record<string, PlaceMemo>;
  visited: string[];
  travelers: string[];
  expenses: Expense[];
};
export const emptyJournal = (): TripJournal => ({ memos: {}, visited: [], travelers: ["나"], expenses: [] });
const shortText = (value: unknown, max: number) => typeof value === "string" && value.length <= max;
export function isTripJournal(value: unknown): value is TripJournal {
  if (!value || typeof value !== "object") return false;
  const v = value as TripJournal;
  if (!Array.isArray(v.travelers) || !v.travelers.length || v.travelers.length > 10 ||
      v.travelers.some((name) => !shortText(name, 30) || !name.trim()) || new Set(v.travelers).size !== v.travelers.length ||
      !Array.isArray(v.visited) || v.visited.length > 21 || v.visited.some((id) => !shortText(id, 200)) ||
      !v.memos || typeof v.memos !== "object" || Array.isArray(v.memos) || Object.keys(v.memos).length > 21 ||
      !Array.isArray(v.expenses) || v.expenses.length > 300) return false;
  return Object.entries(v.memos).every(([id, memo]) => shortText(id, 200) && memo &&
    shortText(memo.note, 2000) && shortText(memo.reservation, 300) && shortText(memo.preparation, 500)) &&
    new Set(v.expenses.map((e) => e?.id)).size === v.expenses.length &&
    v.expenses.every((e) => e && shortText(e.id, 80) && shortText(e.label, 100) && !!e.label.trim() &&
      Number.isSafeInteger(e.amount) && e.amount > 0 && e.amount <= 100_000_000 &&
      v.travelers.includes(e.payer) && Array.isArray(e.participants) && e.participants.length > 0 &&
      new Set(e.participants).size === e.participants.length && e.participants.every((p) => v.travelers.includes(p)) &&
      typeof e.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(e.date));
}

// Integer yen: distribute the remainder in participant order so every yen balances.
export function settleExpenses(journal: TripJournal) {
  const balances = new Map(journal.travelers.map((name) => [name, 0]));
  let total = 0;
  for (const expense of journal.expenses) {
    total += expense.amount;
    balances.set(expense.payer, (balances.get(expense.payer) ?? 0) + expense.amount);
    const share = Math.floor(expense.amount / expense.participants.length);
    const remainder = expense.amount % expense.participants.length;
    expense.participants.forEach((name, index) => balances.set(name, (balances.get(name) ?? 0) - share - (index < remainder ? 1 : 0)));
  }
  const creditors = [...balances].filter(([, amount]) => amount > 0).map(([name, amount]) => ({ name, amount }));
  const debtors = [...balances].filter(([, amount]) => amount < 0).map(([name, amount]) => ({ name, amount: -amount }));
  const transfers: { from: string; to: string; amount: number }[] = [];
  for (const debtor of debtors) for (const creditor of creditors) {
    const amount = Math.min(debtor.amount, creditor.amount);
    if (amount) transfers.push({ from: debtor.name, to: creditor.name, amount });
    debtor.amount -= amount;
    creditor.amount -= amount;
  }
  return { total, balances: Object.fromEntries(balances), transfers };
}

export function japanDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function publicPlan(plan: SharedPlan): SharedPlan {
  // Journals contain private reservations and spending. Public links are snapshots.
  const publicFields = { ...plan };
  delete publicFields.journal;
  return publicFields;
}

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
export function offlineTripHtml(plan: SharedPlan, title: string) {
  const e = escapeHtml;
  const journal = plan.journal ?? emptyJournal();
  const days = plan.itineraryPlan?.days.map((day) => ({ label: `${day.dayNumber}일차 ${day.date}`, stops: day.activities.map((a) => ({
    name: a.kind === "place" ? a.place.name : a.label, time: `${a.scheduledTime}–${a.endTime}`,
    memo: a.kind === "place" ? journal.memos[a.place.id] : undefined,
    visited: a.kind === "place" && journal.visited.includes(a.place.id),
  })) })) ?? [{ label: "담아둔 장소 · 일정 생성 전", stops: plan.places.map((p) => ({ name: p.name, time: p.suggestedTime, memo: journal.memos[p.id], visited: journal.visited.includes(p.id) })) }];
  return `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(title)} · 오프라인</title><style>body{font:16px/1.65 system-ui,sans-serif;background:#f7f4ed;color:#293b32;max-width:720px;margin:auto;padding:24px}h1{font-size:28px}article{background:white;border:1px solid #dcded7;border-radius:16px;padding:20px;margin:14px 0}li{padding:14px 0;border-bottom:1px solid #eee}small{color:#626b62}p{white-space:pre-wrap;overflow-wrap:anywhere}time{display:block;color:#486b58}footer{margin-top:32px}</style><header><small>MOMOTABI · OFFLINE</small><h1>${e(title)}</h1><p>저장 시점: ${e(new Date().toLocaleString("ko-KR", { timeZone: "Asia/Tokyo" }))} (일본 시간)</p><p>이 파일은 인터넷 없이 열 수 있는 일정 사본입니다. 수정한 뒤에는 다시 내려받아 주세요.</p></header>${days.map((day) => `<article><h2>${e(day.label)}</h2><ol>${day.stops.map((stop) => `<li><time>${e(stop.time)}</time><strong>${stop.visited ? "✓ " : ""}${e(stop.name)}</strong>${stop.memo ? `<p>${e(stop.memo.note)}</p><p>예약: ${e(stop.memo.reservation || "없음")}</p><p>준비물: ${e(stop.memo.preparation || "없음")}</p>` : ""}</li>`).join("")}</ol></article>`).join("")}<footer>메모와 예약 정보가 포함된 개인 보관용 파일입니다.</footer></html>`;
}
