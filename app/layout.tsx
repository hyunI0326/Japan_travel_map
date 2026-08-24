import type { Metadata } from "next";
import { AuthProvider } from "./auth-context";
import { getSession } from "@/lib/auth";
import "./globals.css";

export const dynamic = "force-dynamic";

const origin = "https://momotabi-tokyo.hyunyoon2607.chatgpt.site";
const title = "모모타비 — 일본의 결을 따라 걷는 여행";
const description =
  "도쿄, 교토, 오사카, 후쿠오카, 삿포로를 하루 세 곳씩 여유롭게 만나는 일본 여행 코스 지도.";

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

  return (
    <html lang="ko">
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
