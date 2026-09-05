export type FunnelEvent =
  | "region_selected"
  | "place_added"
  | "recommendations_generated"
  | "itinerary_generated"
  | "share_created"
  | "trip_saved"
  | "budget_calculated"
  | "print_opened";

export function trackFunnelEvent(
  event: FunnelEvent,
  details: { regionId?: string; placeCount?: number; dayCount?: number } = {},
) {
  const body = JSON.stringify({ event, ...details });
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon(
        "/api/analytics",
        new Blob([body], { type: "application/json" }),
      );
      return;
    }
    void fetch("/api/analytics", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      keepalive: true,
    });
  } catch {
    // Analytics must never interrupt trip planning.
  }
}
