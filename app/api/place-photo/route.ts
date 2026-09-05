import { env } from "cloudflare:workers";

type GoogleMapsEnvironment = {
  GOOGLE_MAPS_API_KEY?: string;
  GOOLE_MAPS_API_KEY?: string;
};

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const name = new URL(request.url).searchParams.get("name") || "";
  if (!/^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$/.test(name)) {
    return Response.json({ error: "INVALID_PHOTO" }, { status: 400 });
  }
  const runtimeEnv = env as unknown as GoogleMapsEnvironment;
  const key = runtimeEnv.GOOGLE_MAPS_API_KEY || runtimeEnv.GOOLE_MAPS_API_KEY || "";
  if (!key) return Response.json({ error: "MAPS_KEY_MISSING" }, { status: 503 });

  const response = await fetch(
    `https://places.googleapis.com/v1/${name}/media?maxWidthPx=960&skipHttpRedirect=true&key=${encodeURIComponent(key)}`,
  );
  if (!response.ok) return Response.json({ error: "PHOTO_UNAVAILABLE" }, { status: 502 });
  const data = (await response.json()) as { photoUri?: unknown };
  if (typeof data.photoUri !== "string" || !data.photoUri.startsWith("https://")) {
    return Response.json({ error: "PHOTO_UNAVAILABLE" }, { status: 502 });
  }
  return Response.redirect(data.photoUri, 302);
}
