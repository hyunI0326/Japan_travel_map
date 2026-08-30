import TripPlanner from "./trip-planner";
import { getPlaceCatalog, getRegions, recommendCourse } from "@/lib/travel-service";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [regions, initialCourse, initialCatalog] = await Promise.all([
    getRegions(),
    recommendCourse({ regionId: "tokyo", style: "balanced", dayCount: 3 }),
    getPlaceCatalog("tokyo"),
  ]);

  return (
    <TripPlanner
      regions={regions}
      initialCourse={initialCourse}
      initialCatalog={initialCatalog}
    />
  );
}
