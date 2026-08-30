import { getPlaceCatalog } from "@/lib/travel-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const regionId = new URL(request.url).searchParams.get("regionId");
  if (!regionId) {
    return Response.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }

  try {
    return Response.json({ catalog: await getPlaceCatalog(regionId) });
  } catch (error) {
    if (error instanceof Error && error.message === "REGION_NOT_FOUND") {
      return Response.json({ error: "REGION_NOT_FOUND" }, { status: 404 });
    }
    throw error;
  }
}
