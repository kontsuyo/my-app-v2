import { describe, expect, it } from "vitest";
import {
  clearAuthTokens,
  getAccessToken,
  getRefreshToken,
  setAuthTokens,
} from "@/lib/auth-tokens";

describe("authentication tokens", () => {
  // ログイン後のAPI呼び出しにアクセストークンを利用できることを確認する。
  it("returns the stored access token", () => {
    setAuthTokens({ access: "access-token", refresh: "refresh-token" });

    expect(getAccessToken()).toBe("access-token");
  });

  // ログアウト時に両方のトークンを破棄できることを確認する。
  it("clears both stored tokens", () => {
    setAuthTokens({ access: "access-token", refresh: "refresh-token" });

    clearAuthTokens();

    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });
});
