import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it } from "vitest";
import { apiRequest } from "@/lib/api-client";
import { clearAuthTokens, setAuthTokens } from "@/lib/auth-tokens";
import { server } from "@/test/server";

describe("API client", () => {
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
