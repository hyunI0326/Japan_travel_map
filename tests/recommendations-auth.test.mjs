import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

// Stub the session boundary and recommendation service, exercising the real handler.
const authUrl = `data:text/javascript,${encodeURIComponent(`
  export const state = { session: null, headers: null };
  export async function getSession(headers) {
    state.headers = headers;
    return state.session;
  }
`)}`;
const serviceUrl = `data:text/javascript,${encodeURIComponent(`
  export const state = { calls: [] };
  export async function recommendNearbyPlaces(options) {
    state.calls.push(options);
    return { recommendations: [], provider: "catalog" };
  }
`)}`;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@/lib/auth") return { url: authUrl, shortCircuit: true };
    if (specifier === "@/lib/travel-service") return { url: serviceUrl, shortCircuit: true };
    return nextResolve(specifier, context);
  },
});
const { state: auth } = await import(authUrl);
const { state: service } = await import(serviceUrl);
const { POST } = await import("../app/api/recommendations/route.ts");
const body = {
  regionId: "tokyo", style: "balanced", anchorPlaceIds: ["tokyo-asakusa"],
  kind: "attractions", transport: "transit",
};
const request = (payload) => new Request("http://localhost/api/recommendations", {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload),
});

test("anonymous requests cannot generate either type of nearby recommendation", async () => {
  auth.session = null;
  service.calls.length = 0;
  for (const kind of ["attractions", "food"]) {
    const response = await POST(request({ ...body, kind }));
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: "UNAUTHORIZED" });
  }
  assert.equal(service.calls.length, 0);
});

test("authenticated requests reach the recommendation service", async () => {
  auth.session = { user: { id: "test-user" } };
  service.calls.length = 0;
  const input = request(body);
  const response = await POST(input);
  assert.equal(auth.headers, input.headers);
  assert.equal(response.status, 200);
  assert.deepEqual(service.calls, [body]);
  assert.deepEqual(await response.json(), { recommendations: [], provider: "catalog" });
});

test("authentication does not bypass request validation", async () => {
  auth.session = { user: { id: "test-user" } };
  service.calls.length = 0;
  const response = await POST(request({ ...body, anchorPlaceIds: [] }));
  assert.equal(response.status, 400);
  assert.equal(service.calls.length, 0);
});
