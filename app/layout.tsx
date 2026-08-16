import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  const title = "모모타비 — 도쿄의 결을 따라 걷는 3일";
  const description = "오래된 골목에서 반짝이는 야경까지, 하루 세 곳을 여유롭게 만나는 도쿄 여행 코스 지도.";

  return {
    metadataBase: new URL(origin),
    title,
    description,
    openGraph: { title, description, type: "website", locale: "ko_KR", images: [{ url: `${origin}/og.png`, width: 1736, height: 909, alt: "모모타비 도쿄 3일 여행 코스" }] },
    twitter: { card: "summary_large_image", title, description, images: [`${origin}/og.png`] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
