"use client";

import {
  clearAuthTokens,
  getAccessToken,
  getRefreshToken,
  setAuthTokens,
} from "@/lib/auth-tokens";

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api/v1"
).replace(/\/+$/, "");

type ApiRequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
};

type SendOptions = ApiRequestOptions & { skipAuth?: boolean };

export class ApiError extends Error {
  readonly status: number;
  readonly details: unknown;

  constructor(status: number, details: unknown) {
    const message =
      typeof details === "object" &&
        details !== null &&
        "detail" in details &&
        typeof details.detail === "string"
        ? details.detail
        : typeof details === "string" && details.length > 0
          ? details
          : `API request failed with status ${status}`;

    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

async function sendRequest(
  path: string,
  options: SendOptions,
): Promise<Response> {
  const { body, headers: requestHeaders, skipAuth, ...requestOptions } = options;
  const headers = new Headers(requestHeaders);
  const accessToken = getAccessToken();

  if (!skipAuth && accessToken && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  let requestBody: BodyInit | undefined;
  if (body !== undefined) {
    if (
      typeof body === "string" ||
      body instanceof Blob ||
      body instanceof FormData ||
      body instanceof URLSearchParams
    ) {
      requestBody = body;
    } else {
      headers.set("Content-Type", "application/json");
      requestBody = JSON.stringify(body);
    }
  }

  return fetch(`${API_BASE_URL}/${path.replace(/^\/+/, "")}`, {
    ...requestOptions,
    headers,
    body: requestBody,
  });
}

const sessionExpiredListeners = new Set<() => void>();

export function onSessionExpired(listener: () => void): () => void {
  sessionExpiredListeners.add(listener);
  return () => sessionExpiredListeners.delete(listener);
}

function expireSession(): void {
  clearAuthTokens();
  sessionExpiredListeners.forEach((listener) => listener());
}

async function requestNewTokens(): Promise<boolean> {
  const refresh = getRefreshToken();
  if (!refresh) {
    return false;
  }

  const response = await sendRequest("auth/token/refresh/", {
    method: "POST",
    body: { refresh },
    skipAuth: true,
  });
  if (!response.ok) {
    // 期限切れ・不正なrefreshだけを失効とみなし、一時的な障害ではセッションを維持する。
    if (response.status === 400 || response.status === 401) {
      expireSession();
    }
    return false;
  }

  const tokens = (await response.json()) as { access: string; refresh?: string };
  setAuthTokens({ access: tokens.access, refresh: tokens.refresh ?? refresh });
  return true;
}

// 資格情報の入力ミスによる401を「期限切れ」と誤認しないための除外対象。
const NO_REFRESH_PATHS = new Set([
  "auth/login/",
  "auth/register/",
  "auth/token/refresh/",
]);

function shouldRefreshOn401(path: string): boolean {
  return !NO_REFRESH_PATHS.has(path.replace(/^\/+/, ""));
}

let pendingRefresh: Promise<boolean> | null = null;

function refreshAccessToken(): Promise<boolean> {
  pendingRefresh ??= requestNewTokens().finally(() => {
    pendingRefresh = null;
  });
  return pendingRefresh;
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  let response = await sendRequest(path, options);

  if (response.status === 401 &&
    shouldRefreshOn401(path) &&
    (await refreshAccessToken())) {
    response = await sendRequest(path, options);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const responseText = await response.text();
  const contentType = response.headers.get("Content-Type") ?? "";
  const isHtmlResponse = contentType.toLowerCase().includes("html");
  const payload =
    responseText.length === 0
      ? null
      : contentType.includes("json")
        ? JSON.parse(responseText)
        : responseText;

  if (!response.ok) {
    throw new ApiError(response.status, isHtmlResponse ? null : payload);
  }

  return payload as T;
}
