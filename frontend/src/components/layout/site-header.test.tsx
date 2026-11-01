import { cleanup, render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it } from "vitest";
import { AuthProvider } from "@/components/auth/auth-provider";
import { SiteHeader } from "@/components/layout/site-header";
import { clearAuthTokens, setAuthTokens } from "@/lib/auth-tokens";
import { server } from "@/test/server";

afterEach(() => {
  cleanup();
  clearAuthTokens();
});

function renderHeader() {
  return render(
    <AuthProvider>
      <SiteHeader />
    </AuthProvider>,
  );
}

describe("SiteHeader", () => {
  it("shows login and register links to visitors", async () => {
    /** 未ログイン利用者が認証画面へ移動できる導線をヘッダーに出す。 */
    renderHeader();

    expect(await screen.findByRole("link", { name: "ログイン" })).toHaveAttribute(
      "href",
      "/login",
    );
    expect(screen.getByRole("link", { name: "新規登録" })).toHaveAttribute(
      "href",
      "/register",
    );
  });

  it("shows only the username for a logged-in user", async () => {
    /** ログイン済みなら認証導線を隠し、公開名のusernameだけを表示してメールアドレスを常時露出しない。 */
    setAuthTokens({ access: "access-token", refresh: "refresh-token" });
    server.use(
      http.get("http://localhost:8000/api/v1/auth/me/", () =>
        HttpResponse.json({ id: 1, username: "bootslover", email: "boots@example.com" }),
      ),
    );

    renderHeader();

    expect(await screen.findByText("bootslover")).toBeVisible();
    expect(screen.queryByText("boots@example.com")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "ログイン" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "新規登録" })).not.toBeInTheDocument();
  });

  it("shows neither state while the session is being verified", async () => {
    /** 確認中に未ログイン表示を一瞬出すと、ログイン済み利用者の画面がちらつくため何も出さない。 */
    setAuthTokens({ access: "access-token", refresh: "refresh-token" });
    server.use(
      http.get("http://localhost:8000/api/v1/auth/me/", async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return HttpResponse.json({ id: 1, username: "bootslover", email: "boots@example.com" });
      }),
    );

    renderHeader();

    expect(screen.queryByRole("link", { name: "ログイン" })).not.toBeInTheDocument();
    expect(screen.queryByText("bootslover")).not.toBeInTheDocument();
    expect(await screen.findByText("bootslover")).toBeVisible();
  });
});
