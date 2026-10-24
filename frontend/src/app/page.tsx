import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-6 py-16">
      <p className="mb-4 text-sm font-medium tracking-[0.2em] text-amber-700 uppercase">
        Boots · Stories · Patina
      </p>
      <h1 className="text-5xl font-semibold tracking-tight text-stone-950 sm:text-7xl">
        Patina Gallery
      </h1>
      <p className="mt-6 max-w-xl text-lg leading-8 text-stone-600">
        ブーツと、履き込むほどに刻まれる物語を共有するギャラリーです。
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/register">新規登録</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/login">ログイン</Link>
        </Button>
      </div>
    </main>
  );
}
