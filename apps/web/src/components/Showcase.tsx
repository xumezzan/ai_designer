"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { DesignDocument } from "@/design/schema";
import { api } from "@/lib/api";
import { SiteThumbnail } from "./SiteThumbnail";

export function Showcase({ limit = 6, columns = 3, linkTo }: { limit?: number; columns?: 2 | 3; linkTo?: string }) {
  const [docs, setDocs] = useState<DesignDocument[] | null>(null);
  useEffect(() => {
    api.public.showcase().then(setDocs).catch(() => setDocs([]));
  }, []);
  const items = docs ? docs.slice(0, limit) : Array.from({ length: limit }).map(() => null);
  return (
    <div className={`grid gap-6 ${columns === 3 ? "md:grid-cols-3 sm:grid-cols-2" : "md:grid-cols-2"}`}>
      {items.map((d, i) => (
        <div key={i} className="group">
          <div className="card overflow-hidden card-hover">
            {d ? (
              <SiteThumbnail doc={d} width={1280} />
            ) : (
              <div className="aspect-[4/3] bg-surface-2 animate-pulse" />
            )}
          </div>
          {d && (
            <div className="flex items-baseline justify-between mt-3 px-0.5">
              <div>
                <p className="font-medium text-[13.5px]">{d.sections[0]?.props.heading as string}</p>
                <p className="text-muted text-xs">{d.meta.direction} · {d.theme.typography.headingFont}</p>
              </div>
              {linkTo && (
                <Link href={linkTo} className="text-xs text-ink-2 underline underline-offset-4 decoration-line-strong hover:decoration-ink">
                  Start from this
                </Link>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
