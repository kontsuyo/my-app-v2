"use client";

import Link from "next/link";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  const { status, user } = useAuth();

  return (
    <header className="border-b border-stone-200">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
        <Link className="font-semibold tracking-tight text-stone-950" href="/">
          Patina Gallery
        </Link>
        <nav aria-label="アカウント" className="flex items-center gap-2">
          {status === "authenticated" && user && (
            <span className="text-sm font-medium text-stone-700">
              {user.username}
            </span>
          )}
          {(status === "unauthenticated" || status === "error") && (
            <>
              <Button asChild size="sm" variant="ghost">
                <Link href="/login">ログイン</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/register">新規登録</Link>
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
