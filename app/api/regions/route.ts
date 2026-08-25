import { getRegions } from "@/lib/travel-service";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ regions: await getRegions() });
}
