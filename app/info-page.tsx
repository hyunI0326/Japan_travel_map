import Link from "next/link";
import type { ReactNode } from "react";

type InfoPageProps = {
  eyebrow: string;
  title: string;
  intro: string;
  children: ReactNode;
  updatedAt?: string;
};

export default function InfoPage({ eyebrow, title, intro, children, updatedAt }: InfoPageProps) {
  return (
    <div className="info-shell">
      <header className="topbar info-topbar">
        <Link className="brand" href="/#top" aria-label="모모타비 홈">
          <span className="brand-mark">も</span>
          <span>MOMOTABI</span>
        </Link>
        <nav aria-label="주요 메뉴">
          <Link className="section-link" href="/">코스 만들기</Link>
          <Link className="section-link" href="/guide">여행 가이드</Link>
          <Link className="section-link" href="/about">서비스 소개</Link>
          <Link className="sign-in-link" href="/login">로그인</Link>
        </nav>
      </header>

      <main className="info-main">
        <nav className="resource-nav info-resource-nav" aria-label="여행 정보와 운영 정책">
          <Link href="/guide">일본 여행 가이드</Link>
          <Link href="/about">서비스 소개</Link>
          <Link href="/about#contact">문의</Link>
          <Link href="/privacy">개인정보 처리방침</Link>
          <Link href="/terms">이용약관</Link>
        </nav>
        <header className="info-hero">
          <p>{eyebrow}</p>
          <h1>{title}</h1>
          <div>{intro}</div>
          {updatedAt && <small>시행·최종 업데이트: {updatedAt}</small>}
        </header>
        <article className="info-article">{children}</article>
      </main>

      <footer className="info-footer">
        <div>
          <strong>MOMOTABI</strong>
          <span>일본 여행의 출발점을 더 쉽게</span>
        </div>
        <nav aria-label="정책 및 안내">
          <Link href="/guide">여행 가이드</Link>
          <Link href="/about">서비스 소개·문의</Link>
          <Link href="/privacy">개인정보 처리방침</Link>
          <Link href="/terms">이용약관</Link>
        </nav>
        <small>© 2026 MOMOTABI</small>
      </footer>
    </div>
  );
}
