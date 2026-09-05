import { recommendNearbyPlaces } from "@/lib/travel-service";
import { isTravelStyle } from "@/lib/travel-types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    regionId?: unknown;
    style?: unknown;
    anchorPlaceIds?: unknown;
    kind?: unknown;
  } | null;

  if (
    !body ||
    typeof body.regionId !== "string" ||
    !isTravelStyle(body.style) ||
    !Array.isArray(body.anchorPlaceIds) ||
    body.anchorPlaceIds.length === 0 ||
    body.anchorPlaceIds.some((id) => typeof id !== "string") ||
    (body.kind !== undefined && body.kind !== "attractions" && body.kind !== "food")
  ) {
    return Response.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }

  try {
    const result = await recommendNearbyPlaces({
      regionId: body.regionId,
      style: body.style,
      anchorPlaceIds: [...new Set(body.anchorPlaceIds)].slice(0, 6),
      kind: body.kind === "food" ? "food" : "attractions",
    });
    return Response.json(result);
  } catch (error) {
    if (
      error instanceof Error &&
      ["REGION_NOT_FOUND", "ANCHOR_NOT_FOUND"].includes(error.message)
    ) {
      return Response.json({ error: "REGION_NOT_FOUND" }, { status: 404 });
    }
    throw error;
  }
}
