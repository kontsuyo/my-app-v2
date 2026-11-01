import { expect, test } from "@playwright/test";

test("registers and logs in through the authentication screens", async ({
  page,
}) => {
  // API応答をモックし、登録からログイン完了までを実ブラウザーで確認する。
  await page.route("**/api/v1/auth/register/", async (route) => {
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ id: 1 }),
    });
  });
  await page.route("**/api/v1/auth/me/", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: 1,
        username: "bootslover",
        email: "boots@example.com",
      }),
    });
  });
  await page.route("**/api/v1/auth/login/", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        access: "access-token",
        refresh: "refresh-token",
      }),
    });
  });

  await page.goto("/register");
  await page.getByLabel("ユーザー名").fill("bootslover");
  await page.getByLabel("メールアドレス").fill("boots@example.com");
  await page.getByLabel("パスワード").fill("strong-password");
  await page.getByRole("button", { name: "アカウントを作成" }).click();

  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("メールアドレス").fill("boots@example.com");
  await page.getByLabel("パスワード").fill("strong-password");
  await page.getByRole("button", { name: "ログイン" }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("heading", { name: "Patina Gallery" }),
  ).toBeVisible();
  await expect(page.getByText("bootslover")).toBeVisible();

  // リロードしても保存済みトークンからセッションが復元されることを確認する。
  await page.reload();
  await expect(page.getByText("bootslover")).toBeVisible();
  await expect(page.getByRole("link", { name: "ログイン" })).toHaveCount(0);
});

test("refreshes an expired access token on load and keeps the session", async ({
  page,
}) => {
  // 期限切れのaccessでも401→refresh→再送でログイン状態が維持されることを確認する。
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "patina.auth-tokens",
      JSON.stringify({ access: "expired-access", refresh: "refresh-token" }),
    );
  });
  await page.route("**/api/v1/auth/me/", async (route) => {
    const authorization = route.request().headers()["authorization"];
    if (authorization === "Bearer new-access") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: 1,
          username: "bootslover",
          email: "boots@example.com",
        }),
      });
      return;
    }
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ detail: "Token is expired" }),
    });
  });
  await page.route("**/api/v1/auth/token/refresh/", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ access: "new-access" }),
    });
  });

  await page.goto("/");

  await expect(page.getByText("bootslover")).toBeVisible();
});

test("shows login links when the stored session is no longer valid", async ({
  page,
}) => {
  // refreshも拒否された場合は未ログイン表示へ戻ることを確認する。
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "patina.auth-tokens",
      JSON.stringify({ access: "expired-access", refresh: "expired-refresh" }),
    );
  });
  await page.route("**/api/v1/auth/me/", async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ detail: "Token is expired" }),
    });
  });
  await page.route("**/api/v1/auth/token/refresh/", async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ detail: "Token is expired" }),
    });
  });

  await page.goto("/");

  await expect(page.getByRole("link", { name: "ログイン" }).first()).toBeVisible();
});

test("preserves trailing slashes on proxied API POST requests", async ({
  request,
}) => {
  // 空の登録データがAPIの入力エラーになり、スラッシュ除去による500にならないことを確認する。
  const response = await request.post("/api/v1/auth/register/", { data: {} });

  expect(response.status()).toBe(400);
  expect(response.headers()["content-type"]).toContain("application/json");
});
