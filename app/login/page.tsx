import { providerAvailability } from "@/lib/auth";
import Link from "next/link";
import SocialLogin from "./social-login";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <main className="auth-page">
      <header className="auth-header">
        <Link className="auth-brand" href="/#top" aria-label="모모타비 홈">
          <span className="brand-mark">も</span>
          <span>MOMOTABI</span>
        </Link>
        <Link className="auth-home-link" href="/#top">
          여행 둘러보기 <span aria-hidden="true">↗</span>
        </Link>
      </header>

      <div className="auth-content">
        <SocialLogin providers={providerAvailability} />
      </div>

      <p className="auth-footnote">
        로그인하면 <Link href="/terms">이용약관</Link> 및 <Link href="/privacy">개인정보 처리방침</Link>에
        동의하는 것으로 간주됩니다.
      </p>
    </main>
  );
}
