"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api-client";

const registrationSchema = z.object({
  username: z.string().min(1, "ユーザー名を入力してください"),
  email: z
    .string()
    .min(1, "メールアドレスを入力してください")
    .email("有効なメールアドレスを入力してください"),
  password: z.string().min(1, "パスワードを入力してください"),
});

type RegistrationValues = z.infer<typeof registrationSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const form = useForm<RegistrationValues>({
    resolver: zodResolver(registrationSchema),
    defaultValues: { username: "", email: "", password: "" },
  });

  async function onSubmit(values: RegistrationValues) {
    try {
      await apiRequest("auth/register/", {
        method: "POST",
        body: values,
      });
      router.push("/login");
    } catch (error) {
      form.setError("root", {
        message:
          error instanceof Error ? error.message : "ユーザー登録に失敗しました。",
      });
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-6 py-16">
      <section className="w-full space-y-8">
        <header className="space-y-2 text-center">
          <p className="text-sm font-medium tracking-[0.2em] text-amber-700 uppercase">
            Boots · Stories · Patina
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">新規登録</h1>
          <p className="text-sm text-muted-foreground">
            アカウントを作成して、ブーツの物語を共有しましょう。
          </p>
        </header>

        <form
          className="space-y-5 rounded-xl border bg-card p-6 shadow-sm"
          noValidate
          onSubmit={form.handleSubmit(onSubmit)}
        >
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="username">
              ユーザー名
            </label>
            <input
              autoComplete="username"
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              id="username"
              {...form.register("username")}
              aria-invalid={Boolean(form.formState.errors.username)}
            />
            {form.formState.errors.username && (
              <p className="text-sm text-destructive" role="alert">
                {form.formState.errors.username.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="register-email">
              メールアドレス
            </label>
            <input
              autoComplete="email"
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              id="register-email"
              type="email"
              {...form.register("email")}
              aria-invalid={Boolean(form.formState.errors.email)}
            />
            {form.formState.errors.email && (
              <p className="text-sm text-destructive" role="alert">
                {form.formState.errors.email.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="register-password">
              パスワード
            </label>
            <input
              autoComplete="new-password"
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              id="register-password"
              type="password"
              {...form.register("password")}
              aria-invalid={Boolean(form.formState.errors.password)}
            />
            {form.formState.errors.password && (
              <p className="text-sm text-destructive" role="alert">
                {form.formState.errors.password.message}
              </p>
            )}
          </div>

          {form.formState.errors.root && (
            <p className="text-sm text-destructive" role="alert">
              {form.formState.errors.root.message}
            </p>
          )}

          <Button className="w-full" type="submit">
            アカウントを作成
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          すでにアカウントをお持ちですか？{" "}
          <Link className="font-medium text-foreground underline" href="/login">
            ログイン
          </Link>
        </p>
      </section>
    </main>
  );
}
