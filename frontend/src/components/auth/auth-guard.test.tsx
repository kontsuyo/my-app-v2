import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthGuard } from "@/components/auth/auth-guard";
import { clearAuthTokens, setAuthTokens } from "@/lib/auth-tokens";

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

afterEach(() => {
  cleanup();
  clearAuthTokens();
  replace.mockClear();
});

describe("AuthGuard", () => {
  it("redirects unauthenticated visitors to login", async () => {
    /** 未認証時に保護対象を表示せず、ログイン画面へ誘導する。 */
    render(
      <AuthGuard>
        <p>保護されたコンテンツ</p>
      </AuthGuard>,
    );

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
    expect(screen.queryByText("保護されたコンテンツ")).not.toBeInTheDocument();
  });

  it("renders protected content for authenticated visitors", async () => {
    /** access tokenがある利用者には保護対象を表示する。 */
    setAuthTokens({ access: "access-token", refresh: "refresh-token" });
    render(
      <AuthGuard>
        <p>保護されたコンテンツ</p>
      </AuthGuard>,
    );

    expect(await screen.findByText("保護されたコンテンツ")).toBeVisible();
    expect(replace).not.toHaveBeenCalled();
  });
});
