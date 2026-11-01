import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthGuard } from "@/components/auth/auth-guard";
import { AuthProvider } from "@/components/auth/auth-provider";
import { clearAuthTokens, setAuthTokens } from "@/lib/auth-tokens";
import { server } from "@/test/server";

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
const ME_URL = "http://localhost:8000/api/v1/auth/me/";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

afterEach(() => {
  cleanup();
  clearAuthTokens();
  replace.mockClear();
});

function renderGuard() {
  return render(
    <AuthProvider>
      <AuthGuard>
        <p>保護されたコンテンツ</p>
      </AuthGuard>
    </AuthProvider>,
  );
}

describe("AuthGuard", () => {
  it("redirects unauthenticated visitors to login", async () => {
    /** 未認証時に保護対象を表示せず、ログイン画面へ誘導する。 */
    renderGuard();

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
    expect(screen.queryByText("保護されたコンテンツ")).not.toBeInTheDocument();
  });

  it("renders protected content once the current user is confirmed", async () => {
    /** 保存済みトークンが/auth/me/で有効と確認できた利用者には保護対象を表示する。 */
    setAuthTokens({ access: "access-token", refresh: "refresh-token" });
    server.use(
      http.get(ME_URL, () =>
        HttpResponse.json({ id: 1, username: "bootslover", email: "boots@example.com" }),
      ),
    );

    renderGuard();

    expect(await screen.findByText("保護されたコンテンツ")).toBeVisible();
    expect(replace).not.toHaveBeenCalled();
  });

  it("does not redirect while the session is still being verified", async () => {
    /** リロード直後の本人確認中にログイン画面へ飛ばすと、ログイン済み利用者の操作を中断してしまう。 */
    setAuthTokens({ access: "access-token", refresh: "refresh-token" });
    server.use(
      http.get(ME_URL, async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return HttpResponse.json({ id: 1, username: "bootslover", email: "boots@example.com" });
      }),
    );

    renderGuard();

    expect(screen.getByRole("status")).toHaveTextContent("認証状態を確認しています");
    expect(replace).not.toHaveBeenCalled();
    expect(await screen.findByText("保護されたコンテンツ")).toBeVisible();
  });

  it("offers a retry instead of redirecting when verification fails temporarily", async () => {
    /** サーバー障害時に未ログイン扱いでリダイレクトせず、利用者が再確認できるようにする。 */
    setAuthTokens({ access: "access-token", refresh: "refresh-token" });
    let available = false;
    server.use(
      http.get(ME_URL, () =>
        available
          ? HttpResponse.json({ id: 1, username: "bootslover", email: "boots@example.com" })
          : HttpResponse.json({ detail: "down" }, { status: 503 }),
      ),
    );
    renderGuard();

    const retryButton = await screen.findByRole("button", { name: "再試行" });
    expect(replace).not.toHaveBeenCalled();

    available = true;
    await userEvent.click(retryButton);

    expect(await screen.findByText("保護されたコンテンツ")).toBeVisible();
  });
});
