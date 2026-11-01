"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";

export function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { status, retry } = useAuth();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  if (status === "authenticated") {
    return children;
  }

  if (status === "error") {
    return (
      <div className="flex flex-col items-center gap-3 p-6" role="alert">
        <p className="text-sm text-muted-foreground">
          認証状態を確認できませんでした。通信状況を確認して、もう一度お試しください。
        </p>
        <Button onClick={retry} type="button" variant="outline">
          再試行
        </Button>
      </div>
    );
  }

  return (
    <p className="p-6 text-center text-sm text-muted-foreground" role="status">
      認証状態を確認しています。
    </p>
  );
}
