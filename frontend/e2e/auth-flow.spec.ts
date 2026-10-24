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
});

test("preserves trailing slashes on proxied API POST requests", async ({
  request,
}) => {
  // 空の登録データがAPIの入力エラーになり、スラッシュ除去による500にならないことを確認する。
  const response = await request.post("/api/v1/auth/register/", { data: {} });

  expect(response.status()).toBe(400);
  expect(response.headers()["content-type"]).toContain("application/json");
});
