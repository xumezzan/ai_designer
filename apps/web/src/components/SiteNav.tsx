"use client";
import Link from "next/link";
import { useEffect } from "react";
import { Logo } from "./ui";
import { useAuth } from "@/lib/auth";

export function SiteNav() {
  const { user, load } = useAuth();
  useEffect(() => {
    load();
  }, [load]);
  return (
    <header className="sticky top-0 z-40 bg-bg/85 backdrop-blur border-b border-line">
      <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between">
        <Link href="/"><Logo /></Link>
        <nav className="hidden md:flex items-center gap-8 text-[13.5px] text-ink-2">
          <Link href="/explore" className="hover:text-ink">Designs</Link>
          <Link href="/#how" className="hover:text-ink">How it works</Link>
          <Link href="/#features" className="hover:text-ink">Features</Link>
        </nav>
        <div className="flex items-center gap-2">
          {user ? (
            <Link href="/app" className="btn btn-primary btn-sm">Open dashboard</Link>
          ) : (
            <>
              <Link href="/login" className="btn btn-ghost btn-sm">Log in</Link>
              <Link href="/signup" className="btn btn-primary btn-sm">Create your event</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
