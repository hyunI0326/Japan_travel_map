import { createItineraryPlan } from "@/lib/itinerary-planner";
import { isPlanPreferences, isTravelPlaceSnapshot } from "@/lib/travel-types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    places?: unknown;
    preferences?: unknown;
    lockedPlaceIds?: unknown;
  } | null;

  if (
    !body ||
    !Array.isArray(body.places) ||
    body.places.length === 0 ||
    body.places.length > 9 ||
    body.places.some((place) => !isTravelPlaceSnapshot(place)) ||
    !isPlanPreferences(body.preferences) ||
    !Array.isArray(body.lockedPlaceIds) ||
    body.lockedPlaceIds.some((id) => typeof id !== "string")
  ) {
    return Response.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }

  const placeIds = new Set(body.places.map((place) => place.id));
  const lockedPlaceIds = [...new Set(body.lockedPlaceIds)]
    .filter((id) => placeIds.has(id))
    .slice(0, 9);
  const plan = await createItineraryPlan({
    places: body.places,
    preferences: body.preferences,
    lockedPlaceIds,
  });
  return Response.json({ plan });
}
