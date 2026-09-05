import { searchPlaces } from "@/lib/travel-service";
import { isTransportMode } from "@/lib/travel-types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    regionId?: unknown;
    query?: unknown;
    anchorPlaceIds?: unknown;
    purpose?: unknown;
    transport?: unknown;
  } | null;

  if (
    !body ||
    typeof body.regionId !== "string" ||
    typeof body.query !== "string" ||
    body.query.trim().length < 2 ||
    body.query.length > 80 ||
    !Array.isArray(body.anchorPlaceIds) ||
    body.anchorPlaceIds.some((id) => typeof id !== "string") ||
    (body.purpose !== "place" && body.purpose !== "lodging") ||
    !isTransportMode(body.transport)
  ) {
    return Response.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }

  try {
    const results = await searchPlaces({
      regionId: body.regionId,
      query: body.query,
      anchorPlaceIds: [...new Set(body.anchorPlaceIds)].slice(0, 6),
      purpose: body.purpose,
      transport: body.transport,
    });
    return Response.json(
      { results },
      { headers: { "cache-control": "private, max-age=60" } },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "REGION_NOT_FOUND") {
      return Response.json({ error: "REGION_NOT_FOUND" }, { status: 404 });
    }
    console.error(
      "Google place text search failed.",
      error instanceof Error ? error.message : "GOOGLE_PLACE_SEARCH_UNKNOWN",
    );
    return Response.json({ error: "SEARCH_UNAVAILABLE" }, { status: 502 });
  }
}
