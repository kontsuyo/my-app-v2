import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearAuthTokens,
  getAccessToken,
  getRefreshToken,
  setAuthTokens,
} from "@/lib/auth-tokens";

describe("authentication tokens", () => {
  beforeEach(() => {
    clearAuthTokens();
    window.localStorage.clear();
  });

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

  // リロード(モジュール再読み込み)後もログイン状態を復元できることを確認する。
  it("restores tokens from localStorage after a reload", async () => {
    setAuthTokens({ access: "access-token", refresh: "refresh-token" });

    vi.resetModules();
    const reloaded = await import("@/lib/auth-tokens");

    expect(reloaded.getAccessToken()).toBe("access-token");
    expect(reloaded.getRefreshToken()).toBe("refresh-token");
  });

  // 壊れた保存値でアプリが落ちず、未ログイン扱いになることを確認する。
  it.each(["not-json", '{"access":"only-access"}', '{"access":1,"refresh":2}'])(
    "treats the invalid stored value %s as logged out",
    (stored) => {
      window.localStorage.setItem("patina.auth-tokens", stored);

      expect(getAccessToken()).toBeNull();
      expect(getRefreshToken()).toBeNull();
    },
  );

  // ログアウト後のリロードでトークンが復活しないよう、保存領域からも削除されることを確認する。
  it("removes the persisted tokens when cleared", () => {
    setAuthTokens({ access: "access-token", refresh: "refresh-token" });

    clearAuthTokens();

    expect(window.localStorage.getItem("patina.auth-tokens")).toBeNull();
  });
});
