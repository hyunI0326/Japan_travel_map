import { createSharedTrip } from "@/lib/shared-trips";
import { parseSharedPlan } from "@/lib/share-types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 70_000) {
    return Response.json({ error: "PAYLOAD_TOO_LARGE" }, { status: 413 });
  }
  const plan = parseSharedPlan(await request.json().catch(() => null));
  if (!plan) {
    return Response.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }

  try {
    const shared = await createSharedTrip(plan);
    return Response.json(
      { ...shared, path: `/trip/${shared.slug}` },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "REGION_NOT_FOUND") {
      return Response.json({ error: "REGION_NOT_FOUND" }, { status: 404 });
    }
    if (error instanceof Error && error.message === "PAYLOAD_TOO_LARGE") {
      return Response.json({ error: "PAYLOAD_TOO_LARGE" }, { status: 413 });
    }
    throw error;
  }
}
