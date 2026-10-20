"use client";

export type AuthTokens = {
  access: string;
  refresh: string;
};

let authTokens: AuthTokens | null = null;

export function setAuthTokens(tokens: AuthTokens): void {
  authTokens = { ...tokens };
}

export function getAccessToken(): string | null {
  return authTokens?.access ?? null;
}

export function getRefreshToken(): string | null {
  return authTokens?.refresh ?? null;
}

export function clearAuthTokens(): void {
  authTokens = null;
}
