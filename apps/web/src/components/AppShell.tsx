"use client";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { Logo, Spinner } from "./ui";
import { useAuth, useRequireAuth } from "@/lib/auth";

export function AppShell({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  const { user, loading } = useRequireAuth();
  const logout = useAuth((s) => s.logout);
  if (loading || !user) {
    return (
      <div className="min-h-screen grid place-items-center text-muted">
        <Spinner />
      </div>
    );
  }
  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-bg">
        <div className={`mx-auto ${wide ? "max-w-[1400px]" : "max-w-6xl"} px-6 h-14 flex items-center justify-between`}>
          <div className="flex items-center gap-8">
            <Link href="/app"><Logo /></Link>
            <nav className="flex items-center gap-6 text-[13.5px] text-ink-2">
              <Link href="/app" className="hover:text-ink">My events</Link>
              <Link href="/explore" className="hover:text-ink">Designs</Link>
            </nav>
          </div>
          <div className="flex items-center gap-3 text-[13px]">
            <span className="text-ink-2 hidden sm:inline">{user.name || user.email}</span>
            <button className="btn btn-ghost btn-sm" onClick={() => { logout(); location.href = "/"; }}>
              <LogOut size={14} /> Log out
            </button>
          </div>
        </div>
      </header>
      <main className={`mx-auto ${wide ? "max-w-[1400px]" : "max-w-6xl"} px-6 py-10`}>{children}</main>
    </div>
  );
}
