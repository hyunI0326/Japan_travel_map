import assert from "node:assert/strict";
import test from "node:test";
import { createItineraryPlan } from "../lib/itinerary-planner.ts";
import { isPlanPreferences, isPublicTransportMode, isTransportMode, transportLabels } from "../lib/travel-types.ts";

const preferences = {
  startDate: "2026-09-07", dayCount: 3, startLocation: "",
  companion: "couple", pace: "balanced", budget: "standard",
  transport: "walking", includeMeals: true,
};
const place = (id, overrides = {}) => ({
  id, name: id, category: "관광지", description: "", suggestedTime: "09:00",
  durationMinutes: 60, latitude: 35.66, longitude: 139.70, ...overrides,
});
const plan = (places, overrides = {}, lockedPlaceIds = []) => createItineraryPlan({
  places, preferences: { ...preferences, ...overrides }, lockedPlaceIds,
});

test("nearby short visits stay together, with remaining days explicitly free", async () => {
  const result = await plan([place("a"), place("b"), place("c"), place("d")]);
  assert.equal(result.days.filter(day => day.activities.length > 0).length, 1);
  assert.equal(result.days.length, 3);
  assert.ok(result.warnings.some(warning => warning.includes("자유")));
});

test("an evening viewpoint respects its recommended time", async () => {
  const result = await plan([place("sky", { category: "전망·야경", suggestedTime: "18:00", durationMinutes: 120 })]);
  const sky = result.days[0].activities.find(activity => activity.kind === "place");
  assert.equal(sky.scheduledTime, "18:00");
});

test("a lunch restaurant is not followed by a second lunch", async () => {
  const result = await plan([
    place("museum", { durationMinutes: 120 }),
    place("ramen", { category: "일본라면 전문식당", suggestedTime: "12:00" }),
  ], { dayCount: 1 });
  assert.equal(result.days[0].activities.filter(activity => activity.kind === "meal").length, 0);
});

test("subway and bus are valid public transport choices", () => {
  for (const transport of ["subway", "bus"]) {
    assert.equal(isTransportMode(transport), true);
    assert.equal(isPublicTransportMode(transport), true);
    assert.equal(isPlanPreferences({ ...preferences, transport }), true);
    assert.ok(transportLabels[transport]);
  }
});
