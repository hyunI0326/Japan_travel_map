import { providerAvailability } from "@/lib/auth";
import SocialLogin from "./social-login";
import SiteLink from "../site-link";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <main className="auth-page">
      <header className="auth-header">
        <SiteLink className="auth-brand" href="/" aria-label="모모타비 홈">
          <span className="brand-mark">も</span>
          <span>MOMOTABI</span>
        </SiteLink>
        <SiteLink className="auth-home-link" href="/">
          여행 둘러보기 <span aria-hidden="true">↗</span>
        </SiteLink>
      </header>

      <div className="auth-content">
        <SocialLogin providers={providerAvailability} />
      </div>

      <p className="auth-footnote">
        로그인하면 <SiteLink href="/terms">이용약관</SiteLink> 및 <SiteLink href="/privacy">개인정보 처리방침</SiteLink>에
        동의하는 것으로 간주됩니다.
      </p>
    </main>
  );
}
