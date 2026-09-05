import { getSharedTrip } from "@/lib/shared-trips";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  const trip = await getSharedTrip(slug);
  if (!trip) {
    return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  return Response.json(
    { plan: trip.plan, title: trip.title },
    { headers: { "cache-control": "public, max-age=300" } },
  );
}
