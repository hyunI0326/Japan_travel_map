declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    BETTER_AUTH_SECRET?: string;
    GOOGLE_CLIENT_ID?: string;
    GOOGLE_CLIENT_SECRET?: string;
    KAKAO_CLIENT_ID?: string;
    KAKAO_CLIENT_SECRET?: string;
    NAVER_CLIENT_ID?: string;
    NAVER_CLIENT_SECRET?: string;
  }
}
