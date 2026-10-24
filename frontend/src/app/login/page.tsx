"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api-client";
import { setAuthTokens, type AuthTokens } from "@/lib/auth-tokens";

const loginSchema = z.object({
  email: z
    .string()
    .min(1, "メールアドレスを入力してください")
    .email("有効なメールアドレスを入力してください"),
  password: z.string().min(1, "パスワードを入力してください"),
});

type LoginValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginValues) {
    try {
      const tokens = await apiRequest<AuthTokens>("auth/login/", {
        method: "POST",
        body: values,
      });
      setAuthTokens(tokens);
      router.push("/");
    } catch (error) {
      form.setError("root", {
        message:
          error instanceof Error ? error.message : "ログインに失敗しました。",
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
          <h1 className="text-3xl font-semibold tracking-tight">ログイン</h1>
          <p className="text-sm text-muted-foreground">
            アカウントにログインして、ギャラリーを楽しみましょう。
          </p>
        </header>

        <form
          className="space-y-5 rounded-xl border bg-card p-6 shadow-sm"
          noValidate
          onSubmit={form.handleSubmit(onSubmit)}
        >
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="login-email">
              メールアドレス
            </label>
            <input
              autoComplete="email"
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              id="login-email"
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
            <label className="text-sm font-medium" htmlFor="login-password">
              パスワード
            </label>
            <input
              autoComplete="current-password"
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              id="login-password"
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
            ログイン
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          アカウントをお持ちでないですか？{" "}
          <Link
            className="font-medium text-foreground underline"
            href="/register"
          >
            新規登録
          </Link>
        </p>
      </section>
    </main>
  );
}
