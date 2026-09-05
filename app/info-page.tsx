import type { ReactNode } from "react";
import PolicyLinks from "./policy-links";
import SiteLink from "./site-link";

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
        <SiteLink className="brand" href="/" aria-label="모모타비 홈">
          <span className="brand-mark">も</span>
          <span>MOMOTABI</span>
        </SiteLink>
        <nav aria-label="주요 메뉴">
          <SiteLink className="section-link" href="/#planner">코스 만들기</SiteLink>
          <SiteLink className="sign-in-link" href="/login">로그인</SiteLink>
        </nav>
      </header>

      <main className="info-main">
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
        <PolicyLinks />
        <small>© 2026 MOMOTABI</small>
      </footer>
    </div>
  );
}
