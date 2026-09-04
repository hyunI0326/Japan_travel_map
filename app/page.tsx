import { env } from "cloudflare:workers";
import TripPlanner from "./trip-planner";
import { getPlaceCatalog, getRegions, recommendCourse } from "@/lib/travel-service";

export const dynamic = "force-dynamic";

type MapsBrowserEnvironment = {
  GOOGLE_MAPS_BROWSER_KEY?: string;
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?: string;
};

export default async function Home() {
  const runtimeEnv = env as unknown as MapsBrowserEnvironment;
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
      googleMapsApiKey={
        runtimeEnv.GOOGLE_MAPS_BROWSER_KEY ||
        runtimeEnv.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
        ""
      }
    />
  );
}
