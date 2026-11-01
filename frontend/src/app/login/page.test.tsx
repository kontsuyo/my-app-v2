import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import LoginPage from "@/app/login/page";
import { AuthProvider } from "@/components/auth/auth-provider";
import { clearAuthTokens, getAccessToken } from "@/lib/auth-tokens";
import { server } from "@/test/server";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

afterEach(() => {
  cleanup();
  clearAuthTokens();
  push.mockClear();
});

function renderLoginPage() {
  return render(
    <AuthProvider>
      <LoginPage />
    </AuthProvider>,
  );
}

describe("LoginPage", () => {
  it("shows validation errors when required fields are empty", async () => {
    /** 必須項目が空のままログイン処理へ進まないことを保証する。 */
    renderLoginPage();
    fireEvent.click(screen.getByRole("button", { name: "ログイン" }));

    expect(await screen.findByText("メールアドレスを入力してください")).toBeVisible();
    expect(screen.getByText("パスワードを入力してください")).toBeVisible();
  });

  it("stores received tokens and navigates home after login", async () => {
    /** ログイン成功でJWTを保持し、認証状態へ反映してからギャラリーへ遷移する。 */
    let requestBody: unknown;
    let meAuthorization: string | null = null;
    server.use(
      http.get("http://localhost:8000/api/v1/auth/me/", ({ request }) => {
        meAuthorization = request.headers.get("Authorization");
        return HttpResponse.json({ id: 1, username: "bootslover", email: "boots@example.com" });
      }),
      http.post(
        "http://localhost:8000/api/v1/auth/login/",
        async ({ request }) => {
          requestBody = await request.json();
          return HttpResponse.json({
            access: "access-token",
            refresh: "refresh-token",
          });
        },
      ),
    );

    renderLoginPage();
    fireEvent.change(screen.getByLabelText("メールアドレス"), {
      target: { value: "boots@example.com" },
    });
    fireEvent.change(screen.getByLabelText("パスワード"), {
      target: { value: "strong-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "ログイン" }));

    await waitFor(() => expect(getAccessToken()).toBe("access-token"));
    expect(requestBody).toEqual({
      email: "boots@example.com",
      password: "strong-password",
    });
    expect(push).toHaveBeenCalledWith("/");
    await waitFor(() => expect(meAuthorization).toBe("Bearer access-token"));
  });
});
