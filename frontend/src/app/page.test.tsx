import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import Home from "@/app/page";

afterEach(cleanup);

describe("Home", () => {
  it("provides links to register and login", () => {
    /** トップページから認証画面へ移動できる導線を提供する。 */
    render(<Home />);

    expect(screen.getByRole("link", { name: "新規登録" })).toHaveAttribute(
      "href",
      "/register",
    );
    expect(screen.getByRole("link", { name: "ログイン" })).toHaveAttribute(
      "href",
      "/login",
    );
  });
});
