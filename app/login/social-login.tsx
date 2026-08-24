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
      <p className="auth-eyebrow">WELCOME BACK, TRAVELER</p>
      <h1 id="auth-title">
        여행을 이어갈
        <br />
        계정을 선택하세요.
      </h1>
      <p className="auth-intro">
        자주 사용하는 계정으로 빠르고 안전하게 로그인할 수 있어요.
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
                {provider === "google" ? "G" : provider === "kakao" ? "K" : "N"}
              </span>
              <span>{pending ? "연결 중…" : providerLabels[provider]}</span>
              {unavailable && (
                <small id={`${provider}-status`}>연동 준비 중</small>
              )}
            </button>
          );
        })}
      </div>

      {!hasAvailableProvider && (
        <p className="provider-notice" role="status">
          로그인 제공자 설정이 완료되면 버튼이 활성화됩니다.
        </p>
      )}
      {error && <p className="auth-error" role="alert">{error}</p>}
      <Link className="auth-back" href="/">로그인 없이 둘러보기</Link>
    </section>
  );
}
