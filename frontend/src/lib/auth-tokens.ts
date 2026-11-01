"use client";

export type AuthTokens = {
  access: string;
  refresh: string;
};

// 暫定: localStorage に保存する。HttpOnly Cookie へ移行する際はこのモジュールだけ差し替える。
const STORAGE_KEY = "patina.auth-tokens";

function readTokens(): AuthTokens | null {
  if (typeof window === "undefined") {
    return null;
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(stored);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "access" in parsed &&
      "refresh" in parsed &&
      typeof parsed.access === "string" &&
      typeof parsed.refresh === "string"
    ) {
      return { access: parsed.access, refresh: parsed.refresh };
    }
  } catch {
    // 壊れた値は未ログインとして扱う。
  }

  return null;
}

export function setAuthTokens(tokens: AuthTokens): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
}

export function getAccessToken(): string | null {
  return readTokens()?.access ?? null;
}

export function getRefreshToken(): string | null {
  return readTokens()?.refresh ?? null;
}

export function clearAuthTokens(): void {
  window.localStorage.removeItem(STORAGE_KEY);
}
