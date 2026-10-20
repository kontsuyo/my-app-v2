import { expect, test } from "@playwright/test";

test("renders the Patina Gallery application shell", async ({ page }) => {
  // ブラウザーでアプリのエントリーページが表示できることを確認する。
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Patina Gallery" }),
  ).toBeVisible();
});
