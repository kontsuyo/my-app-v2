import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AuthProvider, useAuth } from "@/components/auth/auth-provider";
import { apiRequest } from "@/lib/api-client";
import {
  clearAuthTokens,
  getAccessToken,
  getRefreshToken,
  setAuthTokens,
} from "@/lib/auth-tokens";
import { server } from "@/test/server";

const ME_URL = "http://localhost:8000/api/v1/auth/me/";

function Status() {
  const { status, user, login, logout, retry } = useAuth();

  return (
    <>
      <button
        onClick={() => login({ access: "new-access", refresh: "new-refresh" })}
        type="button"
      >
        do-login
      </button>
      <button onClick={logout} type="button">
        do-logout
      </button>
      <button onClick={retry} type="button">
        do-retry
      </button>
      <p data-testid="status">{status}</p>
      <p data-testid="username">{user?.username ?? "-"}</p>
    </>
  );
}

function renderProvider() {
  return render(
    <AuthProvider>
      <Status />
    </AuthProvider>,
  );
}

beforeEach(() => clearAuthTokens());
afterEach(() => {
  cleanup();
  clearAuthTokens();
});

describe("AuthProvider", () => {
  it("becomes unauthenticated without calling the API when no token is stored", async () => {
    /** 未ログイン利用者に無駄な本人確認リクエストを送らず、すぐ未ログインと判定する。 */
    renderProvider();

    expect(await screen.findByText("unauthenticated")).toBeVisible();
    expect(screen.getByTestId("username")).toHaveTextContent("-");
  });

  it("restores the current user from /auth/me/ when a token is stored", async () => {
    /** リロード後も保存済みトークンから本人確認し、ユーザー情報を全体へ共有する。 */
    setAuthTokens({ access: "access-token", refresh: "refresh-token" });
    server.use(
      http.get(ME_URL, () =>
        HttpResponse.json({ id: 1, username: "bootslover", email: "boots@example.com" }),
      ),
    );

    renderProvider();

    expect(screen.getByTestId("status")).toHaveTextContent("loading");
    expect(await screen.findByText("authenticated")).toBeVisible();
    expect(screen.getByTestId("username")).toHaveTextContent("bootslover");
  });

  it("becomes unauthenticated and clears tokens when the session is no longer valid", async () => {
    /** 失効済みトークンで保護画面を表示し続けないよう、refreshも拒否されたら未ログインへ戻す。 */
    setAuthTokens({ access: "expired-access", refresh: "expired-refresh" });
    server.use(
      http.get(ME_URL, () => HttpResponse.json({ detail: "expired" }, { status: 401 })),
      http.post("http://localhost:8000/api/v1/auth/token/refresh/", () =>
        HttpResponse.json({ detail: "expired" }, { status: 401 }),
      ),
    );

    renderProvider();

    expect(await screen.findByText("unauthenticated")).toBeVisible();
    expect(getRefreshToken()).toBeNull();
  });

  it("reports an error without logging out when the API is unavailable", async () => {
    /** 一時的なサーバー障害でトークンを捨てると、復旧後も再ログインを強いてしまうため保持する。 */
    setAuthTokens({ access: "access-token", refresh: "refresh-token" });
    server.use(
      http.get(ME_URL, () => HttpResponse.json({ detail: "down" }, { status: 503 })),
    );

    renderProvider();

    expect(await screen.findByText("error")).toBeVisible();
    expect(getRefreshToken()).toBe("refresh-token");
  });

  it("authenticates and shares the user after login", async () => {
    /** ログイン成功を画面全体へ即時反映し、ヘッダー等が古い未ログイン表示のまま残らないようにする。 */
    server.use(
      http.get(ME_URL, ({ request }) =>
        request.headers.get("Authorization") === "Bearer new-access"
          ? HttpResponse.json({ id: 2, username: "newuser", email: "new@example.com" })
          : HttpResponse.json({ detail: "no" }, { status: 401 }),
      ),
    );
    renderProvider();
    await screen.findByText("unauthenticated");

    await userEvent.click(screen.getByRole("button", { name: "do-login" }));

    expect(await screen.findByText("authenticated")).toBeVisible();
    expect(screen.getByTestId("username")).toHaveTextContent("newuser");
    expect(getAccessToken()).toBe("new-access");
  });

  it("clears the tokens and the user on logout", async () => {
    /** ログアウト後にリロードしても再ログイン状態へ戻らないよう、保存済みトークンも破棄する。 */
    setAuthTokens({ access: "access-token", refresh: "refresh-token" });
    server.use(
      http.get(ME_URL, () =>
        HttpResponse.json({ id: 1, username: "bootslover", email: "boots@example.com" }),
      ),
    );
    renderProvider();
    await screen.findByText("authenticated");

    await userEvent.click(screen.getByRole("button", { name: "do-logout" }));

    expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated");
    expect(screen.getByTestId("username")).toHaveTextContent("-");
    expect(getAccessToken()).toBeNull();
  });

  it("becomes unauthenticated when the API client reports an expired session", async () => {
    /** ログイン後の別APIでrefreshが失効した場合も、ヘッダー表示とルートガードを未ログインへ同期する。 */
    setAuthTokens({ access: "access-token", refresh: "refresh-token" });
    server.use(
      http.get(ME_URL, () =>
        HttpResponse.json({ id: 1, username: "bootslover", email: "boots@example.com" }),
      ),
      http.get("http://localhost:8000/api/v1/private/", () =>
        HttpResponse.json({ detail: "expired" }, { status: 401 }),
      ),
      http.post("http://localhost:8000/api/v1/auth/token/refresh/", () =>
        HttpResponse.json({ detail: "expired" }, { status: 401 }),
      ),
    );
    renderProvider();
    await screen.findByText("authenticated");

    await act(async () => {
      await apiRequest("private/").catch(() => undefined);
    });

    expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated");
  });

  it("recovers after the API becomes available again when retrying", async () => {
    /** 一時障害で確認できなかった場合に、再ログインではなく再確認で復帰できるようにする。 */
    setAuthTokens({ access: "access-token", refresh: "refresh-token" });
    let available = false;
    server.use(
      http.get(ME_URL, () =>
        available
          ? HttpResponse.json({ id: 1, username: "bootslover", email: "boots@example.com" })
          : HttpResponse.json({ detail: "down" }, { status: 503 }),
      ),
    );
    renderProvider();
    await screen.findByText("error");

    available = true;
    await userEvent.click(screen.getByRole("button", { name: "do-retry" }));

    expect(await screen.findByText("authenticated")).toBeVisible();
  });
});
