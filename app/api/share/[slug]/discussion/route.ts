import { getSession } from "@/lib/auth";
import { getD1 } from "@/db";
import { getSharedTrip } from "@/lib/shared-trips";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ slug: string }> };

export async function GET(request: Request, context: Context) {
  const { slug } = await context.params;
  if (!await getSharedTrip(slug)) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  const session = await getSession(request.headers);
  const userId = session?.user.id ?? "";
  const rows = await getD1().prepare(`SELECT d."id", d."author", d."kind", d."body", d."createdAt",
    (d."userId" = ?) AS "mine", COUNT(v."userId") AS "votes",
    MAX(CASE WHEN v."userId" = ? THEN 1 ELSE 0 END) AS "voted"
    FROM "tripDiscussion" d LEFT JOIN "tripVote" v ON v."discussionId" = d."id"
    WHERE d."slug" = ? GROUP BY d."id" ORDER BY d."createdAt" DESC LIMIT 100`)
    .bind(userId, userId, slug).all();
  return Response.json({ entries: rows.results, signedIn: !!session }, { headers: { "cache-control": "private, no-store" } });
}

export async function POST(request: Request, context: Context) {
  const session = await getSession(request.headers);
  if (!session) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { slug } = await context.params;
  if (!await getSharedTrip(slug)) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  const body = await request.json().catch(() => null) as { kind?: unknown; id?: unknown; voted?: unknown; body?: unknown } | null;
  const db = getD1();
  if (body?.kind === "vote" && typeof body.id === "string" && typeof body.voted === "boolean") {
    const suggestion = await db.prepare('SELECT "id" FROM "tripDiscussion" WHERE "id" = ? AND "slug" = ? AND "kind" = ?').bind(body.id, slug, "suggestion").first();
    if (!suggestion) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
    if (body.voted) await db.prepare('INSERT OR IGNORE INTO "tripVote" ("discussionId", "userId") VALUES (?, ?)').bind(body.id, session.user.id).run();
    else await db.prepare('DELETE FROM "tripVote" WHERE "discussionId" = ? AND "userId" = ?').bind(body.id, session.user.id).run();
    return Response.json({ ok: true });
  }
  if (!body || (body.kind !== "comment" && body.kind !== "suggestion") || typeof body.body !== "string" || !body.body.trim() || body.body.length > 1000) {
    return Response.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }
  // Bound room growth and per-account posting in the insert itself.
  const result = await db.prepare(`INSERT INTO "tripDiscussion" ("id", "slug", "userId", "author", "kind", "body", "createdAt")
    SELECT ?, ?, ?, ?, ?, ?, ? WHERE
    (SELECT COUNT(*) FROM "tripDiscussion" WHERE "slug" = ?) < 100 AND
    (SELECT COUNT(*) FROM "tripDiscussion" WHERE "userId" = ? AND "createdAt" > ?) < 10`)
    .bind(crypto.randomUUID(), slug, session.user.id, session.user.name.slice(0, 80), body.kind, body.body.trim(), Date.now(), slug, session.user.id, Date.now() - 60_000).run();
  return result.meta.changes ? Response.json({ ok: true }, { status: 201 }) : Response.json({ error: "LIMIT_REACHED" }, { status: 429 });
}

export async function DELETE(request: Request, context: Context) {
  const session = await getSession(request.headers);
  if (!session) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { slug } = await context.params;
  if (!await getSharedTrip(slug)) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  const body = await request.json().catch(() => null) as { kind?: unknown; id?: unknown; voted?: unknown; body?: unknown } | null;
  if (typeof body?.id !== "string") return Response.json({ error: "INVALID_REQUEST" }, { status: 400 });
  const result = await getD1().prepare('DELETE FROM "tripDiscussion" WHERE "id" = ? AND "slug" = ? AND "userId" = ?').bind(body.id, slug, session.user.id).run();
  return result.meta.changes ? Response.json({ ok: true }) : Response.json({ error: "NOT_FOUND" }, { status: 404 });
}
