import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";
import { Form } from "@/components/ui/form";

type FormValues = {
  email: string;
};

describe("Form", () => {
  // React Hook Formの値を送信時にハンドラーへ渡せることを確認する。
  it("submits registered field values", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    function TestForm() {
      const form = useForm<FormValues>({ defaultValues: { email: "" } });

      return (
        <Form form={form} onSubmit={form.handleSubmit(onSubmit)}>
          <label htmlFor="email">Email</label>
          <input id="email" {...form.register("email")} />
          <button type="submit">Continue</button>
        </Form>
      );
    }

    render(<TestForm />);
    await user.type(screen.getByLabelText("Email"), "hello@example.com");
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(onSubmit).toHaveBeenCalledWith(
      { email: "hello@example.com" },
      expect.anything(),
    );
  });
});
