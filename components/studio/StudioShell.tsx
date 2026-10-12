"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";

export function StudioShell({ initialTheme, children }: { initialTheme: "light" | "dark"; children: ReactNode }) {
  const [theme, setTheme] = useState(initialTheme);
  const nextTheme = theme === "dark" ? "light" : "dark";
  function toggleTheme() {
    setTheme(nextTheme);
    document.cookie = `studio-theme=${nextTheme}; Path=/studio; Max-Age=31536000; SameSite=Lax`;
  }

  return <div className="studio" data-theme={theme}>
    <header className="studio-header">
      <Link href="/studio" className="studio-brand"><span className="studio-brand-symbol" aria-hidden="true">✳</span>Invitation <span>Studio</span></Link>
      <nav aria-label="Студия"><Link href="/studio">Проекты</Link><Link href="/demo">Примеры ↗</Link></nav>
      <div className="studio-header-actions">
        <button type="button" className="studio-theme-toggle" onClick={toggleTheme} aria-label={`Включить ${nextTheme === "dark" ? "тёмную" : "светлую"} тему`}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {theme === "dark" ? <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></> : <path d="M20.5 13A8.5 8.5 0 0 1 11 3.5 8.5 8.5 0 1 0 20.5 13Z" />}
          </svg><span>{nextTheme === "dark" ? "Тёмная тема" : "Светлая тема"}</span>
        </button>
      </div>
    </header>{children}
  </div>;
}
