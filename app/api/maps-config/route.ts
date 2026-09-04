import { env } from "cloudflare:workers";

export const dynamic = "force-dynamic";

type MapsBrowserEnvironment = {
  GOOGLE_MAPS_BROWSER_KEY?: string;
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?: string;
};

export async function GET() {
  const runtimeEnv = env as unknown as MapsBrowserEnvironment;
  const apiKey =
    runtimeEnv.GOOGLE_MAPS_BROWSER_KEY ||
    runtimeEnv.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
    "";

  return Response.json(
    { apiKey },
    { headers: { "cache-control": "no-store" } },
  );
}
