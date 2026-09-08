"use client";
import { useCallback, useEffect, useState } from "react";

type Entry = { id: string; author: string; kind: string; body: string; votes: number; voted: number; mine: number };
export default function TripDiscussion({ slug }: { slug: string }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [signedIn, setSignedIn] = useState(false);
  const [body, setBody] = useState("");
  const [kind, setKind] = useState("suggestion");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [loaded, setLoaded] = useState(false);
  const endpoint = `/api/share/${slug}/discussion`;
  const refresh = useCallback(async () => {
    const response = await fetch(endpoint);
    if (!response.ok) throw new Error("load");
    const data = await response.json() as { entries: Entry[]; signedIn: boolean };
    setEntries(data.entries); setSignedIn(data.signedIn); setLoaded(true);
  }, [endpoint]);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(endpoint, { signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error("load");
      return response.json() as Promise<{ entries: Entry[]; signedIn: boolean }>;
    }).then((data) => { setEntries(data.entries); setSignedIn(data.signedIn); setLoaded(true); })
      .catch(() => { if (!controller.signal.aborted) setMessage("의견을 불러오지 못했어요. 새로고침해 주세요."); });
    return () => controller.abort();
  }, [endpoint]);
  async function mutate(payload: object, method = "POST", clear = false) {
    if (busy) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch(endpoint, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      if (!response.ok) {
        setMessage(response.status === 429 ? "등록 한도에 도달했어요. 잠시 후 다시 시도하거나 내 의견을 정리해 주세요." : response.status === 401 ? "로그인 후 참여해 주세요." : "반영하지 못했어요. 다시 시도해 주세요.");
        return;
      }
      if (clear) setBody("");
      await refresh();
    } catch { setMessage("연결을 확인하고 다시 시도해 주세요."); }
    finally { setBusy(false); }
  }
  return <section className="travel-tools no-print" aria-labelledby="discussion-title">
    <div className="tools-heading"><div><small>PLAN TOGETHER</small><h2 id="discussion-title">동행자와 함께 결정하기</h2></div><button type="button" disabled={busy} onClick={() => { setMessage(""); void refresh().catch(() => setMessage("의견을 불러오지 못했어요.")); }}>새로고침</button></div>
    <p className="tools-help">링크를 가진 사람이 의견을 볼 수 있어요. 제안은 일정에 자동 추가되지 않으며, 코스 편집 화면에서 반영해 주세요.</p>
    {signedIn ? <form onSubmit={(event) => { event.preventDefault(); void mutate({ kind, body }, "POST", true); }}>
      <label>의견 종류<select value={kind} onChange={(event) => setKind(event.target.value)}><option value="suggestion">장소 제안</option><option value="comment">댓글</option></select></label>
      <label>장소 이름 또는 의견<textarea required maxLength={1000} value={body} onChange={(event) => setBody(event.target.value)} placeholder="예: 둘째 날 점심에 이치란 라멘은 어때요?" /></label>
      <button type="submit" disabled={busy || !body.trim()}>의견 등록</button>
    </form> : loaded ? <p><a href={`/login?returnTo=${encodeURIComponent(`/trip/${slug}`)}`}>로그인하고 제안·투표·댓글 남기기 →</a></p> : <p>의견을 불러오는 중…</p>}
    <p role="status">{message}</p>
    {loaded && entries.length === 0 && <p className="tools-help">첫 번째 장소를 제안해 보세요.</p>}
    <ul className="discussion-list">{entries.map((entry) => <li key={entry.id}><small>{entry.kind === "suggestion" ? "장소 제안" : "댓글"} · {entry.author}</small><p>{entry.body}</p><div className="tools-actions">{entry.kind === "suggestion" && <button type="button" aria-pressed={!!entry.voted} disabled={!signedIn || busy} onClick={() => void mutate({ kind: "vote", id: entry.id, voted: !entry.voted })}>{entry.voted ? "추천 취소" : "추천"} · {entry.votes}</button>}{!!entry.mine && <button type="button" disabled={busy} onClick={() => void mutate({ id: entry.id }, "DELETE")}>내 의견 삭제</button>}</div></li>)}</ul>
  </section>;
}
