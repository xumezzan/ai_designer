"use client";
import { useEffect, useState } from "react";
import { Check, RefreshCw, Smartphone, Monitor } from "lucide-react";
import type { DesignDocument } from "@/design/schema";
import { api, type Generation } from "@/lib/api";
import { SiteThumbnail } from "./SiteThumbnail";
import { Spinner } from "./ui";

export function ConceptPicker({ projectId, onSelected }: { projectId: string; onSelected: () => void }) {
  const [gen, setGen] = useState<Generation | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"desktop" | "mobile">("desktop");
  const [selecting, setSelecting] = useState<number | null>(null);

  const generate = async () => {
    setBusy(true);
    setError(null);
    try {
      let g = await api.ai.generate(projectId);
      // poll if a worker is processing asynchronously
      for (let i = 0; i < 60 && g.status !== "done" && g.status !== "failed"; i++) {
        await new Promise((r) => setTimeout(r, 1500));
        g = await api.ai.generation(projectId, g.id);
      }
      if (g.status === "failed") setError(g.error ?? "Generation failed");
      setGen(g);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    api.ai.generations(projectId).then((gs) => {
      const done = gs.find((g) => g.status === "done" && g.concepts?.length);
      if (done) setGen(done);
      else generate();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const choose = async (i: number) => {
    if (!gen) return;
    setSelecting(i);
    await api.ai.selectConcept(projectId, gen.id, i);
    onSelected();
  };

  const summary = gen?.style_profile?.summary;

  if (busy && !gen) {
    return (
      <div className="py-24 text-center">
        <Spinner className="mx-auto mb-4" />
        <p className="font-medium">Reading your brief and references…</p>
        <p className="text-muted text-[13px] mt-1">Extracting style → building a design system → composing three directions</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <p className="eyebrow mb-2">Step 4</p>
          <h2 className="display text-3xl md:text-4xl">Your design directions</h2>
          <p className="text-ink-2 mt-2 max-w-xl">Three genuinely different concepts. Pick one — you can change anything afterwards, by hand or by asking the AI.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="seg">
            <button className={view === "desktop" ? "active" : ""} onClick={() => setView("desktop")}><Monitor size={13} /></button>
            <button className={view === "mobile" ? "active" : ""} onClick={() => setView("mobile")}><Smartphone size={13} /></button>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={generate} disabled={busy}>
            {busy ? <Spinner /> : <RefreshCw size={13} />} Regenerate
          </button>
        </div>
      </div>

      {summary && (
        <div className="card p-4 mb-8 grid grid-cols-2 md:grid-cols-6 gap-4 text-[12.5px]">
          <Attr label="Style" value={summary.style} />
          <Attr label="Palette" value={summary.palette.join(" · ")} />
          <Attr label="Typography" value={summary.typography} />
          <Attr label="Composition" value={summary.composition} />
          <Attr label="Decoration" value={summary.decoration} />
          <Attr label="Image treatment" value={summary.imageTreatment} />
        </div>
      )}
      {error && <p className="text-danger text-[13px] mb-4">{error}</p>}

      <div className={`grid gap-8 ${view === "mobile" ? "md:grid-cols-3 max-w-4xl mx-auto" : "lg:grid-cols-3 md:grid-cols-2"}`}>
        {(gen?.concepts ?? []).map((c: DesignDocument, i) => (
          <div key={i} className="flex flex-col">
            <p className="eyebrow mb-2">Concept 0{i + 1}</p>
            <h3 className="font-display text-2xl mb-1">{c.meta.direction}</h3>
            <p className="text-ink-2 text-[13px] leading-relaxed mb-4 min-h-[60px]">{c.meta.rationale}</p>
            <div className="card overflow-hidden card-hover">
              {view === "mobile" ? (
                <div className="mx-auto" style={{ maxWidth: 260 }}>
                  <SiteThumbnail doc={c} width={390} height={520} interactive />
                </div>
              ) : (
                <SiteThumbnail doc={c} width={1280} height={420} interactive />
              )}
            </div>
            <div className="flex items-center gap-2 mt-4 text-[12px] text-muted">
              <span className="w-3.5 h-3.5 rounded-full border border-line" style={{ background: c.theme.colors.background }} />
              <span className="w-3.5 h-3.5 rounded-full border border-line" style={{ background: c.theme.colors.accent }} />
              <span className="w-3.5 h-3.5 rounded-full border border-line" style={{ background: c.theme.colors.text }} />
              <span className="ml-1">{c.theme.typography.headingFont} · {c.theme.typography.bodyFont}</span>
            </div>
            <button className="btn btn-primary mt-4" onClick={() => choose(i)} disabled={selecting !== null}>
              {selecting === i ? <Spinner /> : <Check size={15} />} Use this design
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function Attr({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="eyebrow mb-1">{label}</p>
      <p className="leading-snug">{value}</p>
    </div>
  );
}
