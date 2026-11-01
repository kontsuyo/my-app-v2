import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest, onSessionExpired } from "@/lib/api-client";
import {
  clearAuthTokens,
  getAccessToken,
  getRefreshToken,
  setAuthTokens,
} from "@/lib/auth-tokens";
import { server } from "@/test/server";

describe("API client", () => {
  beforeEach(() => clearAuthTokens());
  afterEach(() => clearAuthTokens());

  // 認証済みAPIへ保存中のアクセストークンが送信されることを確認する。
  it("sends the access token as a bearer credential", async () => {
    let authorization: string | null = null;
    setAuthTokens({ access: "access-token", refresh: "refresh-token" });
    server.use(
      http.get("http://localhost:8000/api/v1/private/", ({ request }) => {
        authorization = request.headers.get("Authorization");
        return HttpResponse.json({ ok: true });
      }),
    );

    await expect(apiRequest<{ ok: boolean }>("private/")).resolves.toEqual({
      ok: true,
    });
    expect(authorization).toBe("Bearer access-token");
  });

  // JSONの送信データがAPIへ同じ内容で送られることを確認する。
  it("serializes JSON request bodies", async () => {
    let requestBody: unknown;
    let contentType: string | null = null;
    server.use(
      http.post("http://localhost:8000/api/v1/posts/", async ({ request }) => {
        requestBody = await request.json();
        contentType = request.headers.get("Content-Type");
        return HttpResponse.json({ id: 12 });
      }),
    );

    await expect(
      apiRequest<{ id: number }>("posts/", {
        method: "POST",
        body: { caption: "Patina" },
      }),
    ).resolves.toEqual({ id: 12 });
    expect(requestBody).toEqual({ caption: "Patina" });
    expect(contentType).toContain("application/json");
  });

  // APIのエラー詳細とHTTPステータスを呼び出し元へ返すことを確認する。
  it("surfaces API error details", async () => {
    server.use(
      http.get("http://localhost:8000/api/v1/private/", () =>
        HttpResponse.json({ detail: "Authentication credentials were not provided." }, {
          status: 401,
        }),
      ),
    );

    await expect(apiRequest("private/")).rejects.toMatchObject({
      name: "ApiError",
      status: 401,
      message: "Authentication credentials were not provided.",
    });
  });

  it("does not expose HTML error responses as API error messages", async () => {
    /** HTMLの内部エラー情報を登録画面へ表示せず、情報漏えいを防ぐ。 */
    server.use(
      http.post(
        "http://localhost:8000/api/v1/auth/register/",
        () =>
          new HttpResponse("<html><body>internal traceback</body></html>", {
            status: 500,
            headers: { "Content-Type": "text/html" },
          }),
      ),
    );

    await expect(
      apiRequest("auth/register/", { method: "POST", body: { username: "bootslover" } }),
    ).rejects.toMatchObject({
      name: "ApiError",
      status: 500,
      message: "API request failed with status 500",
    });
  });
});

describe("API client token refresh", () => {
  beforeEach(() => clearAuthTokens());
  afterEach(() => clearAuthTokens());

  // access期限切れの401後、refreshで新しいaccessを得て元のリクエストが成功することを確認する。
  it("refreshes the access token and retries the request once on 401", async () => {
    const authorizations: (string | null)[] = [];
    setAuthTokens({ access: "expired-access", refresh: "refresh-token" });
    server.use(
      http.get("http://localhost:8000/api/v1/private/", ({ request }) => {
        const authorization = request.headers.get("Authorization");
        authorizations.push(authorization);
        return authorization === "Bearer new-access"
          ? HttpResponse.json({ ok: true })
          : HttpResponse.json({ detail: "expired" }, { status: 401 });
      }),
      http.post(
        "http://localhost:8000/api/v1/auth/token/refresh/",
        async ({ request }) => {
          expect(await request.json()).toEqual({ refresh: "refresh-token" });
          return HttpResponse.json({ access: "new-access" });
        },
      ),
    );

    await expect(apiRequest<{ ok: boolean }>("private/")).resolves.toEqual({
      ok: true,
    });
    expect(authorizations).toEqual(["Bearer expired-access", "Bearer new-access"]);
    expect(getAccessToken()).toBe("new-access");
    expect(getRefreshToken()).toBe("refresh-token");
  });

  // refreshも失効している場合、トークンを破棄してセッション失効を通知し、401を呼び出し元へ返すことを確認する。
  it("clears tokens and notifies listeners when the refresh token is rejected", async () => {
    const listener = vi.fn();
    const unsubscribe = onSessionExpired(listener);
    setAuthTokens({ access: "expired-access", refresh: "expired-refresh" });
    server.use(
      http.get("http://localhost:8000/api/v1/private/", () =>
        HttpResponse.json({ detail: "expired" }, { status: 401 }),
      ),
      http.post("http://localhost:8000/api/v1/auth/token/refresh/", () =>
        HttpResponse.json({ detail: "Token is expired" }, { status: 401 }),
      ),
    );

    await expect(apiRequest("private/")).rejects.toMatchObject({ status: 401 });
    unsubscribe();

    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  // 複数リクエストが同時に401でも、refreshの重複実行でトークンを競合させないことを確認する。
  it("shares a single refresh request across concurrent 401 responses", async () => {
    let refreshCalls = 0;
    setAuthTokens({ access: "expired-access", refresh: "refresh-token" });
    server.use(
      http.get("http://localhost:8000/api/v1/private/:id/", ({ request }) =>
        request.headers.get("Authorization") === "Bearer new-access"
          ? HttpResponse.json({ ok: true })
          : HttpResponse.json({ detail: "expired" }, { status: 401 }),
      ),
      http.post("http://localhost:8000/api/v1/auth/token/refresh/", async () => {
        refreshCalls += 1;
        await new Promise((resolve) => setTimeout(resolve, 20));
        return HttpResponse.json({ access: "new-access" });
      }),
    );

    await Promise.all([
      apiRequest("private/1/"),
      apiRequest("private/2/"),
      apiRequest("private/3/"),
    ]);

    expect(refreshCalls).toBe(1);
  });

  // ログイン失敗の401でrefreshを試さず、別アカウントのトークンも破棄しないことを確認する。
  it("does not try to refresh when an auth endpoint returns 401", async () => {
    let refreshCalls = 0;
    setAuthTokens({ access: "access-token", refresh: "refresh-token" });
    server.use(
      http.post("http://localhost:8000/api/v1/auth/login/", () =>
        HttpResponse.json({ detail: "No active account" }, { status: 401 }),
      ),
      http.post("http://localhost:8000/api/v1/auth/token/refresh/", () => {
        refreshCalls += 1;
        return HttpResponse.json({ access: "new-access" });
      }),
    );

    await expect(
      apiRequest("auth/login/", { method: "POST", body: { email: "a@example.com" } }),
    ).rejects.toMatchObject({ status: 401 });

    expect(refreshCalls).toBe(0);
    expect(getAccessToken()).toBe("access-token");
  });

  // サーバー障害でrefreshできない場合は、認証が無効とは限らないためトークンを保持することを確認する。
  it("keeps the tokens when the refresh request fails with a server error", async () => {
    const listener = vi.fn();
    const unsubscribe = onSessionExpired(listener);
    setAuthTokens({ access: "expired-access", refresh: "refresh-token" });
    server.use(
      http.get("http://localhost:8000/api/v1/private/", () =>
        HttpResponse.json({ detail: "expired" }, { status: 401 }),
      ),
      http.post("http://localhost:8000/api/v1/auth/token/refresh/", () =>
        HttpResponse.json({ detail: "unavailable" }, { status: 503 }),
      ),
    );

    await expect(apiRequest("private/")).rejects.toMatchObject({ status: 401 });
    unsubscribe();

    expect(getRefreshToken()).toBe("refresh-token");
    expect(listener).not.toHaveBeenCalled();
  });

  // refresh後も401なら無限ループせず、再送は1回で打ち切ることを確認する。
  it("retries only once when the request is still unauthorized after refreshing", async () => {
    let requestCalls = 0;
    let refreshCalls = 0;
    setAuthTokens({ access: "expired-access", refresh: "refresh-token" });
    server.use(
      http.get("http://localhost:8000/api/v1/private/", () => {
        requestCalls += 1;
        return HttpResponse.json({ detail: "forbidden" }, { status: 401 });
      }),
      http.post("http://localhost:8000/api/v1/auth/token/refresh/", () => {
        refreshCalls += 1;
        return HttpResponse.json({ access: "new-access" });
      }),
    );

    await expect(apiRequest("private/")).rejects.toMatchObject({ status: 401 });

    expect(requestCalls).toBe(2);
    expect(refreshCalls).toBe(1);
  });

  // refreshローテーション有効時に、返された新しいrefreshへ保存し直すことを確認する。
  it("stores a rotated refresh token returned by the refresh endpoint", async () => {
    setAuthTokens({ access: "expired-access", refresh: "old-refresh" });
    server.use(
      http.get("http://localhost:8000/api/v1/private/", ({ request }) =>
        request.headers.get("Authorization") === "Bearer new-access"
          ? HttpResponse.json({ ok: true })
          : HttpResponse.json({ detail: "expired" }, { status: 401 }),
      ),
      http.post("http://localhost:8000/api/v1/auth/token/refresh/", () =>
        HttpResponse.json({ access: "new-access", refresh: "new-refresh" }),
      ),
    );

    await apiRequest("private/");

    expect(getRefreshToken()).toBe("new-refresh");
  });
});
