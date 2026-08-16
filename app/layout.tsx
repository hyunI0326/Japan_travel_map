import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  const title = "모모타비 — 일본의 결을 따라 걷는 여행";
  const description = "도쿄, 교토, 오사카, 후쿠오카, 삿포로를 하루 세 곳씩 여유롭게 만나는 일본 여행 코스 지도.";

  return {
    metadataBase: new URL(origin),
    title,
    description,
    openGraph: { title, description, type: "website", locale: "ko_KR", images: [{ url: `${origin}/og-japan.png`, width: 1731, height: 909, alt: "모모타비 일본 5개 지역 여행 코스" }] },
    twitter: { card: "summary_large_image", title, description, images: [`${origin}/og-japan.png`] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
