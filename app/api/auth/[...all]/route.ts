import { toNextJsHandler } from "better-auth/next-js";
import { ensureDatabase } from "@/db/init";
import { auth, ensureAuthReady } from "@/lib/auth";

export const dynamic = "force-dynamic";

const handlers = toNextJsHandler(auth);

export async function GET(request: Request) {
  ensureAuthReady(request.headers);
  await ensureDatabase();
  return handlers.GET(request);
}

export async function POST(request: Request) {
  ensureAuthReady(request.headers);
  await ensureDatabase();
  return handlers.POST(request);
}
