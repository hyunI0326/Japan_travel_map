import type { Metadata } from "next";
import { env } from "cloudflare:workers";
import { AuthProvider } from "./auth-context";
import { getSession } from "@/lib/auth";
import "./globals.css";

export const dynamic = "force-dynamic";

const origin = "https://joemechu.com";
const title = "모모타비 — 취향대로 만드는 일본 여행 코스";
const description =
  "지역과 여행 스타일을 고르면 관광지를 추천하고, 로그인한 계정에 코스를 저장해 지도에서 다시 보여주는 일본 여행 플래너.";

export const metadata: Metadata = {
  metadataBase: new URL(origin),
  title,
  description,
  openGraph: {
    title,
    description,
    type: "website",
    locale: "ko_KR",
    images: [
      {
        url: `${origin}/og-japan.png`,
        width: 1731,
        height: 909,
        alt: "모모타비 일본 5개 지역 여행 코스",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [`${origin}/og-japan.png`],
  },
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await getSession();
  const adsenseClientId = (env as unknown as { GOOGLE_ADSENSE_CLIENT_ID?: string })
    .GOOGLE_ADSENSE_CLIENT_ID?.trim();
  const verifiedAdsenseClientId = /^ca-pub-\d{16}$/.test(adsenseClientId || "")
    ? adsenseClientId
    : undefined;

  return (
    <html lang="ko">
      <head>
        {verifiedAdsenseClientId && (
          <meta name="google-adsense-account" content={verifiedAdsenseClientId} />
        )}
      </head>
      <body>
        <AuthProvider
          value={{
            user: session
              ? {
                  displayName: session.user.name || session.user.email,
                  email: session.user.email,
                }
              : null,
          }}
        >
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
