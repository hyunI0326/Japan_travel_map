import { env } from "cloudflare:workers";

export const dynamic = "force-dynamic";

export function GET() {
  const clientId = (env as unknown as { GOOGLE_ADSENSE_CLIENT_ID?: string })
    .GOOGLE_ADSENSE_CLIENT_ID?.trim();
  const publisherId = /^ca-pub-(\d{16})$/.exec(clientId || "")?.[1];

  if (!publisherId) {
    return new Response("AdSense publisher ID is not configured.\n", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  return new Response(`google.com, pub-${publisherId}, DIRECT, f08c47fec0942fa0\n`, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
