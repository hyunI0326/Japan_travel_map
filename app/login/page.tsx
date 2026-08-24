import Link from "next/link";
import { providerAvailability } from "@/lib/auth";
import SocialLogin from "./social-login";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <main className="auth-page">
      <Link className="auth-brand" href="/" aria-label="모모타비 홈">
        <span className="brand-mark">も</span>
        <span>MOMOTABI</span>
      </Link>
      <SocialLogin providers={providerAvailability} />
      <p className="auth-footnote">
        모모타비는 로그인 제공자의 비밀번호를 저장하지 않습니다.
      </p>
    </main>
  );
}
