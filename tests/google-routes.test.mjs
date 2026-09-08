import assert from "node:assert/strict";
import test from "node:test";

globalThis.__testCloudflareEnv = { GOOGLE_MAPS_API_KEY: "test-key" };

const requestBodies = [];
globalThis.fetch = async (_url, init) => {
  requestBodies.push(JSON.parse(init.body));
  return new Response(JSON.stringify([{
    originIndex: 0,
    destinationIndex: 0,
    duration: "600s",
    distanceMeters: 1_000,
    condition: "ROUTE_EXISTS",
  }]));
};

const { getNearestTravelTimes } = await import("../lib/google-routes.ts");

const place = (id, latitude, longitude) => ({
  id,
  name: id,
  category: "관광지",
  description: "",
  suggestedTime: "09:00",
  durationMinutes: 60,
  latitude,
  longitude,
});

test("Google route matrix restricts subway and bus requests to the selected mode", async () => {
  const origin = place("origin", 35.7148, 139.7967);
  const destination = place("destination", 35.7142, 139.7774);

  await getNearestTravelTimes({ origins: [origin], destinations: [destination], transport: "subway" });
  await getNearestTravelTimes({ origins: [origin], destinations: [destination], transport: "bus" });

  assert.equal(requestBodies[0].travelMode, "TRANSIT");
  assert.deepEqual(requestBodies[0].transitPreferences.allowedTravelModes, ["SUBWAY"]);
  assert.equal(requestBodies[1].travelMode, "TRANSIT");
  assert.deepEqual(requestBodies[1].transitPreferences.allowedTravelModes, ["BUS"]);
});
