import { providerAvailability } from "@/lib/auth";
import SocialLogin from "./social-login";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <main className="auth-page">
      <header className="auth-header">
        <a className="auth-brand" href="/#top" aria-label="모모타비 홈">
          <span className="brand-mark">も</span>
          <span>MOMOTABI</span>
        </a>
        <a className="auth-home-link" href="/#top">
          여행 둘러보기 <span aria-hidden="true">↗</span>
        </a>
      </header>

      <div className="auth-content">
        <SocialLogin providers={providerAvailability} />
      </div>

      <p className="auth-footnote">
        로그인하면 <strong>이용약관</strong> 및 <strong>개인정보 처리방침</strong>에
        동의하는 것으로 간주됩니다.
      </p>
    </main>
  );
}
