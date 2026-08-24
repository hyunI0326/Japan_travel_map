import { env } from "cloudflare:workers";
import { betterAuth } from "better-auth";
import { headers } from "next/headers";
import { ensureDatabase } from "@/db/init";

const LOCAL_ORIGIN = "http://localhost:3000";
const SITE_ORIGIN = "https://momotabi-tokyo.hyunyoon2607.chatgpt.site";
const CUSTOM_ORIGIN = "https://joemechu.com";
const LOCAL_SECRET = "momotabi-local-development-secret-not-for-production";

type AuthEnvironment = {
  DB: D1Database;
  BETTER_AUTH_SECRET?: string;
  BETTER_AUTH_URL?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  KAKAO_CLIENT_ID?: string;
  KAKAO_CLIENT_SECRET?: string;
  NAVER_CLIENT_ID?: string;
  NAVER_CLIENT_SECRET?: string;
};

const runtimeEnv = env as unknown as AuthEnvironment;

export const providerAvailability = {
  google: Boolean(
    runtimeEnv.GOOGLE_CLIENT_ID && runtimeEnv.GOOGLE_CLIENT_SECRET,
  ),
  kakao: Boolean(runtimeEnv.KAKAO_CLIENT_ID && runtimeEnv.KAKAO_CLIENT_SECRET),
  naver: Boolean(runtimeEnv.NAVER_CLIENT_ID && runtimeEnv.NAVER_CLIENT_SECRET),
};

export const auth = betterAuth({
  appName: "모모타비",
  database: runtimeEnv.DB,
  secret: runtimeEnv.BETTER_AUTH_SECRET || LOCAL_SECRET,
  baseURL: runtimeEnv.BETTER_AUTH_URL || LOCAL_ORIGIN,
  trustedOrigins: [LOCAL_ORIGIN, SITE_ORIGIN, CUSTOM_ORIGIN],
  socialProviders: {
    ...(providerAvailability.google
      ? {
          google: {
            clientId: runtimeEnv.GOOGLE_CLIENT_ID!,
            clientSecret: runtimeEnv.GOOGLE_CLIENT_SECRET!,
            prompt: "select_account" as const,
          },
        }
      : {}),
    ...(providerAvailability.kakao
      ? {
          kakao: {
            clientId: runtimeEnv.KAKAO_CLIENT_ID!,
            clientSecret: runtimeEnv.KAKAO_CLIENT_SECRET!,
          },
        }
      : {}),
    ...(providerAvailability.naver
      ? {
          naver: {
            clientId: runtimeEnv.NAVER_CLIENT_ID!,
            clientSecret: runtimeEnv.NAVER_CLIENT_SECRET!,
          },
        }
      : {}),
  },
  rateLimit: {
    enabled: true,
    storage: "database",
  },
  advanced: {
    trustedProxyHeaders: true,
  },
});

function isLocalRequest(requestHeaders: Headers) {
  const host =
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "";
  return host.startsWith("localhost") || host.startsWith("127.0.0.1");
}

export function ensureAuthReady(requestHeaders: Headers) {
  if (!runtimeEnv.BETTER_AUTH_SECRET && !isLocalRequest(requestHeaders)) {
    throw new Error("BETTER_AUTH_SECRET is required at runtime.");
  }
}

export async function getSession(requestHeaders?: Headers) {
  const currentHeaders = requestHeaders ?? (await headers());
  ensureAuthReady(currentHeaders);
  await ensureDatabase();
  return auth.api.getSession({ headers: currentHeaders });
}
