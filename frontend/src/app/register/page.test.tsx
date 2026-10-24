import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import RegisterPage from "@/app/register/page";
import { server } from "@/test/server";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

afterEach(() => {
  cleanup();
  push.mockClear();
});

describe("RegisterPage", () => {
  it("shows validation errors and does not submit empty fields", async () => {
    /** 必須項目の未入力を知らせ、無効な登録リクエストを防ぐ。 */
    let requestSent = false;
    server.use(
      http.post("http://localhost:8000/api/v1/auth/register/", () => {
        requestSent = true;
        return HttpResponse.json({ id: 1 });
      }),
    );

    render(<RegisterPage />);
    fireEvent.click(screen.getByRole("button", { name: "アカウントを作成" }));

    expect(await screen.findByText("ユーザー名を入力してください")).toBeVisible();
    expect(screen.getByText("メールアドレスを入力してください")).toBeVisible();
    expect(screen.getByText("パスワードを入力してください")).toBeVisible();
    expect(requestSent).toBe(false);
  });

  it("registers the user and navigates to login", async () => {
    /** 登録情報をAPIへ送り、成功後にログイン画面へ進める。 */
    let requestBody: unknown;
    server.use(
      http.post(
        "http://localhost:8000/api/v1/auth/register/",
        async ({ request }) => {
          requestBody = await request.json();
          return HttpResponse.json({ id: 1 }, { status: 201 });
        },
      ),
    );

    render(<RegisterPage />);
    fireEvent.change(screen.getByLabelText("ユーザー名"), {
      target: { value: "bootslover" },
    });
    fireEvent.change(screen.getByLabelText("メールアドレス"), {
      target: { value: "boots@example.com" },
    });
    fireEvent.change(screen.getByLabelText("パスワード"), {
      target: { value: "strong-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "アカウントを作成" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/login"));
    expect(requestBody).toEqual({
      username: "bootslover",
      email: "boots@example.com",
      password: "strong-password",
    });
  });
});
