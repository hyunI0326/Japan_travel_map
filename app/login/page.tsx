import Link from "next/link";
import { providerAvailability } from "@/lib/auth";
import SocialLogin from "./social-login";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <main className="auth-page">
      <section className="auth-main">
        <header className="auth-header">
          <Link className="auth-brand" href="/" aria-label="모모타비 홈">
            <span className="brand-mark">も</span>
            <span>MOMOTABI</span>
          </Link>
          <Link className="auth-home-link" href="/">
            여행 둘러보기 <span aria-hidden="true">↗</span>
          </Link>
        </header>

        <div className="auth-content">
          <SocialLogin providers={providerAvailability} />
        </div>

        <p className="auth-footnote">
          로그인하면 <strong>이용약관</strong> 및 <strong>개인정보 처리방침</strong>에
          동의하는 것으로 간주됩니다.
        </p>
      </section>

      <aside className="auth-visual" aria-label="일본 여행지 미리보기">
        <div className="auth-visual-shade" aria-hidden="true" />
        <div className="auth-visual-top">
          <span>JAPAN TRIP PLANNER</span>
          <span>01 — 05</span>
        </div>
        <div className="auth-visual-copy">
          <p>다음 여행을 위한 작은 시작</p>
          <h2>
            가고 싶은 곳을 고르면,
            <br />
            그다음 여정은 모모타비가 이어드려요.
          </h2>
        </div>
        <div className="auth-route-preview">
          <span className="auth-route-label">TODAY&apos;S ROUTE</span>
          <div className="auth-route-stops" aria-label="추천 일정 예시">
            <span><b>01</b> 아사쿠사</span>
            <i aria-hidden="true" />
            <span><b>02</b> 우에노</span>
            <i aria-hidden="true" />
            <span><b>03</b> 야네센</span>
          </div>
          <small>도보와 지하철로 이어지는 하루 코스</small>
        </div>
      </aside>
    </main>
  );
}
