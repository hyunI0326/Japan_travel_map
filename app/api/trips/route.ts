import { getSession } from "@/lib/auth";
import {
  getSavedCourses,
  saveCourse,
} from "@/lib/travel-service";
import { isTravelStyle, normalizeDayCount } from "@/lib/travel-types";

export const dynamic = "force-dynamic";

async function requireUser(request: Request) {
  const session = await getSession(request.headers);
  return session?.user ?? null;
}

export async function GET(request: Request) {
  const user = await requireUser(request);
  if (!user) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  return Response.json({ courses: await getSavedCourses(user.id) });
}

export async function POST(request: Request) {
  const user = await requireUser(request);
  if (!user) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as {
    regionId?: unknown;
    style?: unknown;
    dayCount?: unknown;
    placeIds?: unknown;
  } | null;
  if (!body || typeof body.regionId !== "string" || !isTravelStyle(body.style)) {
    return Response.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }
  if (
    body.placeIds !== undefined &&
    (!Array.isArray(body.placeIds) ||
      body.placeIds.length === 0 ||
      body.placeIds.length > 9 ||
      body.placeIds.some((id) => typeof id !== "string"))
  ) {
    return Response.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }

  try {
    const course = await saveCourse({
      userId: user.id,
      regionId: body.regionId,
      style: body.style,
      dayCount: normalizeDayCount(body.dayCount),
      placeIds: body.placeIds as string[] | undefined,
    });
    return Response.json({ course }, { status: 201 });
  } catch (error) {
    if (
      error instanceof Error &&
      ["REGION_NOT_FOUND", "PLACE_NOT_FOUND"].includes(error.message)
    ) {
      return Response.json({ error: "REGION_NOT_FOUND" }, { status: 404 });
    }
    throw error;
  }
}
