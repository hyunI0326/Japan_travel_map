import { getD1 } from "@/db";
import { ensureDatabase } from "@/db/init";
import type { FunnelEvent } from "@/lib/analytics-client";

export const dynamic = "force-dynamic";

const allowedEvents = new Set<FunnelEvent>([
  "region_selected",
  "place_added",
  "recommendations_generated",
  "itinerary_generated",
  "share_created",
  "trip_saved",
  "budget_calculated",
  "print_opened",
]);
const allowedRegions = new Set(["tokyo", "kyoto", "osaka", "fukuoka", "sapporo"]);

function seoulDate() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((candidate) => candidate.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 2_000) return new Response(null, { status: 413 });
  const body = (await request.json().catch(() => null)) as {
    event?: unknown;
    regionId?: unknown;
  } | null;
  if (
    !body ||
    typeof body.event !== "string" ||
    !allowedEvents.has(body.event as FunnelEvent) ||
    (body.regionId !== undefined &&
      (typeof body.regionId !== "string" || !allowedRegions.has(body.regionId)))
  ) return new Response(null, { status: 400 });

  await ensureDatabase();
  const database = getD1();
  const date = seoulDate();
  const regionId = typeof body.regionId === "string" ? body.regionId : "";
  await database
    .prepare(
      `INSERT INTO "analyticsDaily" ("date", "event", "regionId", "count", "updatedAt")
       VALUES (?, ?, ?, 1, ?)
       ON CONFLICT("date", "event", "regionId") DO UPDATE SET
         "count" = "analyticsDaily"."count" + 1,
         "updatedAt" = excluded."updatedAt"`,
    )
    .bind(date, body.event, regionId, Date.now())
    .run();
  return new Response(null, { status: 204 });
}
