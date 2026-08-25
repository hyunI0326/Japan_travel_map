import TripPlanner from "./trip-planner";
import { getRegions, recommendCourse } from "@/lib/travel-service";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [regions, initialCourse] = await Promise.all([
    getRegions(),
    recommendCourse({ regionId: "tokyo", style: "balanced", dayCount: 3 }),
  ]);

  return <TripPlanner regions={regions} initialCourse={initialCourse} />;
}
