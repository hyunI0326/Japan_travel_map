import { getSession } from "@/lib/auth";
import {
  deleteCourse,
  duplicateCourse,
  getSavedCourses,
  renameCourse,
  saveCourse,
} from "@/lib/travel-service";
import {
  isGooglePlaceSnapshot,
  isTravelStyle,
  normalizeDayCount,
} from "@/lib/travel-types";

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
    placeSnapshots?: unknown;
    duplicateId?: unknown;
  } | null;
  if (body && typeof body.duplicateId === "string") {
    if (!/^[A-Za-z0-9-]{1,80}$/.test(body.duplicateId)) {
      return Response.json({ error: "INVALID_REQUEST" }, { status: 400 });
    }
    const id = await duplicateCourse({ userId: user.id, itineraryId: body.duplicateId });
    if (!id) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
    return Response.json({ id }, { status: 201 });
  }
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
  if (
    body.placeSnapshots !== undefined &&
    (!Array.isArray(body.placeSnapshots) ||
      body.placeSnapshots.length > 9 ||
      body.placeSnapshots.some((place) => !isGooglePlaceSnapshot(place)))
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
      externalPlaces: body.placeSnapshots,
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

export async function PATCH(request: Request) {
  const user = await requireUser(request);
  if (!user) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as {
    id?: unknown;
    title?: unknown;
  } | null;
  if (
    !body ||
    typeof body.id !== "string" ||
    !/^[A-Za-z0-9-]{1,80}$/.test(body.id) ||
    typeof body.title !== "string" ||
    body.title.trim().length === 0 ||
    body.title.length > 80
  ) {
    return Response.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }
  const updated = await renameCourse({
    userId: user.id,
    itineraryId: body.id,
    title: body.title,
  });
  return updated
    ? Response.json({ ok: true })
    : Response.json({ error: "NOT_FOUND" }, { status: 404 });
}

export async function DELETE(request: Request) {
  const user = await requireUser(request);
  if (!user) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { id?: unknown } | null;
  if (!body || typeof body.id !== "string" || !/^[A-Za-z0-9-]{1,80}$/.test(body.id)) {
    return Response.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }
  const deleted = await deleteCourse({ userId: user.id, itineraryId: body.id });
  return deleted
    ? Response.json({ ok: true })
    : Response.json({ error: "NOT_FOUND" }, { status: 404 });
}
