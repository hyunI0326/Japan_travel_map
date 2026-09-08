import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { registerHooks } from "node:module";
import { emptyJournal, isTripJournal, japanDate, offlineTripHtml, publicPlan, settleExpenses } from "../lib/trip-journal.ts";
import { parseSharedPlan } from "../lib/share-types.ts";

// Real SQLite with the D1 result shape; auth is the only application boundary stubbed.
const sqlite = new DatabaseSync(":memory:");
sqlite.exec("PRAGMA foreign_keys = ON");
class Statement {
  constructor(sql, args = []) { this.sql = sql; this.args = args; }
  bind(...args) { return new Statement(this.sql, args); }
  async first() { return sqlite.prepare(this.sql).get(...this.args) ?? null; }
  async all() { return { results: sqlite.prepare(this.sql).all(...this.args) }; }
  async run() { const result = sqlite.prepare(this.sql).run(...this.args); return { meta: { changes: Number(result.changes) } }; }
}
globalThis.__testCloudflareEnv = { DB: {
  prepare: (sql) => new Statement(sql),
  async batch(statements) {
    sqlite.exec("BEGIN");
    try { const results = []; for (const statement of statements) results.push(await statement.run()); sqlite.exec("COMMIT"); return results; }
    catch (error) { sqlite.exec("ROLLBACK"); throw error; }
  },
} };
const authUrl = `data:text/javascript,${encodeURIComponent('export const state = { session: null }; export async function getSession() { return state.session; }')}`;
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === "@/lib/auth") return { url: authUrl, shortCircuit: true };
  return nextResolve(specifier, context);
} });
const { state: auth } = await import(authUrl);
const service = await import("../lib/travel-service.ts");
const trips = await import("../app/api/trips/route.ts");
const shares = await import("../app/api/share/route.ts");
const discussion = await import("../app/api/share/[slug]/discussion/route.ts");
const { getSharedTrip } = await import("../lib/shared-trips.ts");
const catalog = await service.getPlaceCatalog("tokyo");
for (const id of ["alice", "bob"]) sqlite.prepare('INSERT INTO "user" (id, name, email) VALUES (?, ?, ?)').run(id, id, `${id}@example.test`);
const login = (id) => { auth.session = id ? { user: { id, name: id } } : null; };
const request = (body, method = "POST") => new Request("http://localhost/api/trips", { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const place = catalog.places[0];
const plan = {
  regionId: "tokyo", style: "balanced", places: [place], lockedPlaceIds: [],
  preferences: { startDate: "2026-09-07", dayCount: 2, startLocation: "", companion: "couple", pace: "balanced", budget: "standard", transport: "walking", includeMeals: false },
  itineraryPlan: { provider: "estimate", warnings: [], days: [
    { dayNumber: 1, date: "2026-09-07", totalTravelMinutes: 0, totalDistanceKm: 0, activities: [] },
    { dayNumber: 2, date: "2026-09-08", totalTravelMinutes: 0, totalDistanceKm: 0, activities: [{ kind: "place", place, scheduledTime: "13:00", endTime: "14:00", travelMinutesFromPrevious: 0, distanceKmFromPrevious: 0 }] },
  ] },
  journal: { ...emptyJournal(), memos: { [place.id]: { note: "개인 메모", reservation: "secret-123", preparation: "여권" } } },
};

test("full plan creation, same-ID updates, duplication and ownership round trip through API and SQLite", async () => {
  login("alice");
  let response = await trips.POST(request({ plan }));
  assert.equal(response.status, 201);
  const { course } = await response.json();
  let saved = (await service.getSavedCourses("alice"))[0];
  assert.deepEqual(saved.savedPlan.journal, plan.journal);
  assert.equal(saved.days[0].dayNumber, 2);
  assert.equal(saved.days[0].places[0].suggestedTime, "13:00");
  await service.renameCourse({ userId: "alice", itineraryId: course.id, title: "가을 여행" });
  const edited = structuredClone(plan); edited.journal.visited = [place.id]; edited.journal.memos[place.id].note = "수정됨";
  response = await trips.POST(request({ id: course.id, plan: edited }));
  assert.equal(response.status, 200);
  saved = (await service.getSavedCourses("alice"))[0];
  assert.equal(saved.id, course.id); assert.equal(saved.title, "가을 여행"); assert.deepEqual(saved.savedPlan.journal, edited.journal);
  assert.equal((await service.getSavedCourses("alice")).length, 1);
  login("bob");
  assert.equal((await trips.POST(request({ id: course.id, plan }))).status, 404);
  assert.equal((await trips.DELETE(request({ id: course.id }, "DELETE"))).status, 404);
  assert.equal((await trips.PATCH(request({ id: course.id, title: "침입" }, "PATCH"))).status, 404);
  login("alice");
  const copy = await service.duplicateCourse({ userId: "alice", itineraryId: course.id });
  assert.deepEqual((await service.getSavedCourses("alice")).find((c) => c.id === copy).savedPlan.journal, edited.journal);
  await service.deleteCourse({ userId: "alice", itineraryId: copy });
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM "itineraryPlan" WHERE "itineraryId" = ?').get(copy).n, 0);
});

test("anonymous, malformed and inconsistent full plan saves are rejected", async () => {
  login(null); assert.equal((await trips.POST(request({ plan }))).status, 401);
  login("alice");
  assert.equal((await trips.POST(request({ id: "missing" }))).status, 400);
  const invalid = structuredClone(plan); invalid.itineraryPlan.days[1].activities = [];
  assert.equal((await trips.POST(request({ plan: invalid }))).status, 400);
  assert.equal((await trips.POST(request({ plan: { ...plan, journal: { expenses: [] } } }))).status, 400);
});

test("public shares omit reservations; discussions enforce login, room scope, one vote and author deletion", async () => {
  const shared = await shares.POST(request(plan)); assert.equal(shared.status, 201);
  const { slug } = await shared.json(); const context = { params: Promise.resolve({ slug }) };
  assert.equal((await getSharedTrip(slug)).plan.journal, undefined);
  login(null); assert.equal((await discussion.POST(request({ kind: "comment", body: "안녕" }), context)).status, 401);
  login("alice"); assert.equal((await discussion.POST(request({ kind: "suggestion", body: "우에노 공원" }), context)).status, 201);
  let data = await (await discussion.GET(new Request("http://localhost"), context)).json(); const id = data.entries[0].id;
  login("bob");
  for (let i = 0; i < 2; i++) assert.equal((await discussion.POST(request({ kind: "vote", id, voted: true }), context)).status, 200);
  data = await (await discussion.GET(new Request("http://localhost"), context)).json();
  assert.equal(data.entries[0].votes, 1); assert.equal(data.entries[0].mine, 0); assert.equal(data.entries[0].voted, 1);
  assert.equal((await discussion.DELETE(request({ id }, "DELETE"), context)).status, 404);
  const second = await (await shares.POST(request(plan))).json();
  assert.equal((await discussion.POST(request({ kind: "vote", id, voted: true }), { params: Promise.resolve({ slug: second.slug }) })).status, 404);
  await discussion.POST(request({ kind: "vote", id, voted: false }), context);
  assert.equal((await (await discussion.GET(new Request("http://localhost"), context)).json()).entries[0].votes, 0);
  login("alice"); assert.equal((await discussion.DELETE(request({ id }, "DELETE"), context)).status, 200);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM "tripVote" WHERE "discussionId" = ?').get(id).n, 0);
});

test("split expenses conserve every yen including remainders and partial groups", () => {
  const journal = { ...emptyJournal(), travelers: ["A", "B", "C"], expenses: [
    { id: "1", label: "점심", amount: 1000, payer: "A", participants: ["A", "B", "C"], date: "2026-09-07" },
    { id: "2", label: "택시", amount: 501, payer: "B", participants: ["A", "C"], date: "2026-09-07" },
  ] };
  assert.equal(isTripJournal(journal), true);
  const result = settleExpenses(journal); assert.equal(result.total, 1501);
  assert.equal(Object.values(result.balances).reduce((a, b) => a + b, 0), 0);
  const settled = { ...result.balances };
  for (const transfer of result.transfers) { settled[transfer.from] += transfer.amount; settled[transfer.to] -= transfer.amount; }
  assert.ok(Object.values(settled).every((n) => n === 0));
  assert.equal(isTripJournal({ ...journal, expenses: [{ ...journal.expenses[0], amount: 1.5 }] }), false);
  assert.equal(isTripJournal({ ...journal, expenses: [{ ...journal.expenses[0], participants: [] }] }), false);
  assert.equal(isTripJournal({ ...journal, travelers: ["A", "A"] }), false);
  assert.equal(isTripJournal({ ...journal, expenses: [null] }), false);
});

test("offline snapshot escapes user text, includes personal notes and needs no scripts or assets", () => {
  const input = structuredClone(plan); input.journal.memos[place.id].note = '<script>alert("x")</script>';
  const html = offlineTripHtml(input, "나의 여행");
  assert.ok(html.includes("secret-123")); assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(!html.includes("<script")); assert.ok(!html.includes("src=")); assert.ok(html.includes("13:00"));
  assert.equal(publicPlan(input).journal, undefined); assert.ok(input.journal);
  assert.ok(parseSharedPlan(input));
  assert.equal(japanDate(new Date("2026-09-07T16:00:00Z")), "2026-09-08");
});
