"use client";
import { use, useEffect, useState } from "react";
import type { DesignDocument } from "@/design/schema";
import { SiteRenderer } from "@/renderer/SiteRenderer";
import { api, ApiError } from "@/lib/api";
import { Logo, Spinner } from "@/components/ui";

/** Public event website. Guests land here from the link or the QR code. */
export default function PublicSite({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [doc, setDoc] = useState<DesignDocument | null>(null);
  const [state, setState] = useState<"loading" | "password" | "missing" | "ok">("loading");
  const [pw, setPw] = useState("");
  const [pwError, setPwError] = useState(false);

  const load = async (password?: string) => {
    try {
      const r = await api.public.site(slug, password);
      setDoc(r.design);
      setState("ok");
      document.title = `${r.design.sections[0]?.props.heading ?? "Event"} — Invito`;
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setState("password");
        if (password) setPwError(true);
      } else setState("missing");
    }
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  if (state === "loading") return <div className="h-screen grid place-items-center text-muted"><Spinner /></div>;
  if (state === "missing")
    return (
      <div className="h-screen grid place-items-center text-center p-6">
        <div>
          <Logo />
          <p className="display text-3xl mt-6">This event site isn&apos;t available.</p>
          <p className="text-ink-2 mt-2">It may have been unpublished or the link is incorrect.</p>
        </div>
      </div>
    );
  if (state === "password")
    return (
      <div className="h-screen grid place-items-center p-6">
        <form className="card p-8 w-full max-w-sm space-y-4" onSubmit={(e) => { e.preventDefault(); load(pw); }}>
          <p className="display text-2xl">This invitation is private</p>
          <p className="text-ink-2 text-[13px]">Enter the password from your invitation.</p>
          <input className="input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Password" autoFocus />
          {pwError && <p className="text-danger text-[12.5px]">That password isn&apos;t right.</p>}
          <button className="btn btn-primary w-full">Open</button>
        </form>
      </div>
    );
  return doc ? <SiteRenderer doc={doc} publicSlug={slug} /> : null;
}
