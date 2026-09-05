import { ensureDatabase } from "@/db/init";
import { getD1 } from "@/db";
import { parseSharedPlan, type SharedPlan } from "./share-types";

export type PublicSharedTrip = {
  slug: string;
  title: string;
  regionName: string;
  placeCount: number;
  dayCount: number;
  createdAt: number;
  plan: SharedPlan;
};

function createSlug() {
  return crypto.randomUUID().replaceAll("-", "").slice(0, 12);
}

export async function createSharedTrip(plan: SharedPlan) {
  await ensureDatabase();
  const database = getD1();
  const region = await database
    .prepare(`SELECT "nameKo" FROM "region" WHERE "id" = ? LIMIT 1`)
    .bind(plan.regionId)
    .first<{ nameKo: string }>();
  if (!region) throw new Error("REGION_NOT_FOUND");

  const title = `${region.nameKo} ${plan.preferences.dayCount}일 여행 코스`;
  const payload = JSON.stringify(plan);
  if (payload.length > 60_000) throw new Error("PAYLOAD_TOO_LARGE");

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const slug = createSlug();
    try {
      await database
        .prepare(
          `INSERT INTO "sharedTrip"
            ("slug", "regionId", "title", "payload", "placeCount", "dayCount", "createdAt")
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          slug,
          plan.regionId,
          title,
          payload,
          plan.places.length,
          plan.preferences.dayCount,
          Date.now(),
        )
        .run();
      return { slug, title };
    } catch (error) {
      if (!String(error).includes("UNIQUE")) throw error;
    }
  }
  throw new Error("SHARE_ID_UNAVAILABLE");
}

export async function getSharedTrip(slug: string): Promise<PublicSharedTrip | null> {
  if (!/^[a-f0-9]{12}$/.test(slug)) return null;
  await ensureDatabase();
  const row = await getD1()
    .prepare(
      `SELECT s."slug", s."title", s."placeCount", s."dayCount", s."createdAt",
              s."payload", r."nameKo" AS "regionName"
       FROM "sharedTrip" s
       JOIN "region" r ON r."id" = s."regionId"
       WHERE s."slug" = ? LIMIT 1`,
    )
    .bind(slug)
    .first<{
      slug: string;
      title: string;
      regionName: string;
      placeCount: number;
      dayCount: number;
      createdAt: number;
      payload: string;
    }>();
  if (!row) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(row.payload);
  } catch {
    return null;
  }
  const plan = parseSharedPlan(parsed);
  if (!plan) return null;
  return {
    slug: row.slug,
    title: row.title,
    regionName: row.regionName,
    placeCount: row.placeCount,
    dayCount: row.dayCount,
    createdAt: row.createdAt,
    plan,
  };
}
