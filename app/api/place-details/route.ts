import { getGooglePlaceDetails } from "@/lib/google-places";
import { isTravelPlaceSnapshot } from "@/lib/travel-types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    place?: unknown;
    regionName?: unknown;
  } | null;
  if (
    !body ||
    !isTravelPlaceSnapshot(body.place) ||
    typeof body.regionName !== "string" ||
    body.regionName.length > 80
  ) {
    return Response.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }

  try {
    const details = await getGooglePlaceDetails({
      place: body.place,
      regionName: body.regionName,
    });
    if (!details) return Response.json({ error: "DETAILS_NOT_FOUND" }, { status: 404 });
    return Response.json(
      { details },
      { headers: { "cache-control": "private, no-store" } },
    );
  } catch (error) {
    console.error(
      "Google Place details failed.",
      error instanceof Error ? error.message : "GOOGLE_PLACE_DETAILS_UNKNOWN",
    );
    return Response.json({ error: "DETAILS_UNAVAILABLE" }, { status: 502 });
  }
}
