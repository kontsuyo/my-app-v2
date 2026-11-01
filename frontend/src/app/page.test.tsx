import { cleanup, render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it } from "vitest";
import Home from "@/app/page";
import { AuthProvider } from "@/components/auth/auth-provider";
import { clearAuthTokens, setAuthTokens } from "@/lib/auth-tokens";
import { server } from "@/test/server";

afterEach(() => {
  cleanup();
  clearAuthTokens();
});

function renderHome() {
  return render(
    <AuthProvider>
      <Home />
    </AuthProvider>,
  );
}

describe("Home", () => {
  it("provides links to register and login", async () => {
    /** トップページから認証画面へ移動できる導線を提供する。 */
    renderHome();

    expect(await screen.findByRole("link", { name: "新規登録" })).toHaveAttribute(
      "href",
      "/register",
    );
    expect(screen.getByRole("link", { name: "ログイン" })).toHaveAttribute(
      "href",
      "/login",
    );
  });

  it("hides the register and login calls to action for a logged-in user", async () => {
    /** ログイン済み利用者に不要な登録・ログイン導線を出さないようにする。 */
    setAuthTokens({ access: "access-token", refresh: "refresh-token" });
    server.use(
      http.get("http://localhost:8000/api/v1/auth/me/", () =>
        HttpResponse.json({ id: 1, username: "bootslover", email: "boots@example.com" }),
      ),
    );

    renderHome();

    expect(await screen.findByRole("heading", { name: "Patina Gallery" })).toBeVisible();
    await expect(
      screen.findByRole("link", { name: "新規登録" }, { timeout: 300 }),
    ).rejects.toThrow();
    expect(screen.queryByRole("link", { name: "ログイン" })).not.toBeInTheDocument();
  });
});
