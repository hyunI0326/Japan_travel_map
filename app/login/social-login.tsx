"use client";

import { useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";

type Provider = "google" | "kakao" | "naver";

type SocialLoginProps = {
  providers: Record<Provider, boolean>;
};

const providerLabels: Record<Provider, string> = {
  google: "Google로 계속하기",
  kakao: "카카오로 계속하기",
  naver: "네이버로 계속하기",
};

const providerMarks: Record<Provider, string> = {
  google: "G",
  kakao: "K",
  naver: "N",
};

export default function SocialLogin({ providers }: SocialLoginProps) {
  const [pendingProvider, setPendingProvider] = useState<Provider | null>(null);
  const [error, setError] = useState("");
  const hasAvailableProvider = Object.values(providers).some(Boolean);

  async function handleSocial(provider: Provider) {
    if (!providers[provider]) return;
    setPendingProvider(provider);
    setError("");

    const result = await authClient.signIn.social({
      provider,
      callbackURL: "/",
      errorCallbackURL: "/login?error=oauth",
    });

    if (result.error) {
      setError("로그인을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.");
      setPendingProvider(null);
    }
  }

  return (
    <section className="auth-card" aria-labelledby="auth-title">
      <p className="auth-eyebrow"><span aria-hidden="true" /> WELCOME BACK</p>
      <h1 id="auth-title">
        나만의 일본 여행,
        <br />
        여기서 이어가세요.
      </h1>
      <p className="auth-intro">
        저장한 코스와 찜한 장소를 다시 만나보세요.
        <br />
        가입 없이 소셜 계정으로 바로 시작할 수 있어요.
      </p>

      <div className="social-login-list" aria-label="소셜 로그인">
        {(Object.keys(providerLabels) as Provider[]).map((provider) => {
          const unavailable = !providers[provider];
          const pending = pendingProvider === provider;
          return (
            <button
              key={provider}
              type="button"
              className={`social-login ${provider}`}
              onClick={() => handleSocial(provider)}
              disabled={Boolean(pendingProvider) || unavailable}
              aria-describedby={unavailable ? `${provider}-status` : undefined}
            >
              <span className="provider-mark" aria-hidden="true">
                {providerMarks[provider]}
              </span>
              <span className="provider-label">
                {pending ? "계정에 연결하는 중…" : providerLabels[provider]}
              </span>
              {unavailable && (
                <small id={`${provider}-status`}>준비 중</small>
              )}
              {!unavailable && !pending && <span className="provider-arrow" aria-hidden="true">→</span>}
              {pending && <span className="auth-spinner" aria-hidden="true" />}
            </button>
          );
        })}
      </div>

      {!hasAvailableProvider && (
        <p className="provider-notice" role="status">
          지금은 로그인 연결을 준비하고 있어요. 잠시 후 다시 확인해 주세요.
        </p>
      )}
      {error && <p className="auth-error" role="alert">{error}</p>}
      <div className="auth-divider" aria-hidden="true"><span>또는</span></div>
      <Link className="auth-back" href="/">
        로그인 없이 먼저 둘러보기 <span aria-hidden="true">→</span>
      </Link>

      <div className="auth-security-note">
        <span aria-hidden="true">✓</span>
        <p><strong>안전한 소셜 로그인</strong>모모타비는 로그인 제공자의 비밀번호를 저장하지 않아요.</p>
      </div>
    </section>
  );
}
