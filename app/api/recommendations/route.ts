import { recommendCourse } from "@/lib/travel-service";
import { isTravelStyle, normalizeDayCount } from "@/lib/travel-types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    regionId?: unknown;
    style?: unknown;
    dayCount?: unknown;
  } | null;

  if (!body || typeof body.regionId !== "string" || !isTravelStyle(body.style)) {
    return Response.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }

  try {
    const course = await recommendCourse({
      regionId: body.regionId,
      style: body.style,
      dayCount: normalizeDayCount(body.dayCount),
    });
    return Response.json({ course });
  } catch (error) {
    if (error instanceof Error && error.message === "REGION_NOT_FOUND") {
      return Response.json({ error: "REGION_NOT_FOUND" }, { status: 404 });
    }
    throw error;
  }
}
