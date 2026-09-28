"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ImagePlus, Link2, Sparkles, Trash2, X } from "lucide-react";
import { api, type Reference, type ReferenceAnalysis } from "@/lib/api";
import { Spinner } from "./ui";

/**
 * Pinterest-like board: masonry of references, drag & drop upload,
 * notes, groups, and the "Analyze references" action.
 */
export function InspirationBoard({ projectId, compact, onAnalyzed }: { projectId: string; compact?: boolean; onAnalyzed?: (a: ReferenceAnalysis) => void }) {
  const [refs, setRefs] = useState<Reference[]>([]);
  const [analysis, setAnalysis] = useState<ReferenceAnalysis | null>(null);
  const [busy, setBusy] = useState<"upload" | "analyze" | null>(null);
  const [drag, setDrag] = useState(false);
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const reload = useCallback(async () => {
    setRefs(await api.references.list(projectId));
    const p = await api.projects.get(projectId);
    if (p.reference_analysis) setAnalysis(p.reference_analysis);
  }, [projectId]);
  useEffect(() => {
    reload();
  }, [reload]);

  const upload = async (files: FileList | File[]) => {
    setBusy("upload");
    setError(null);
    try {
      for (const f of Array.from(files)) {
        if (!f.type.startsWith("image/")) continue;
        await api.references.upload(projectId, f);
      }
      await reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const addUrl = async () => {
    if (!url.trim()) return;
    setBusy("upload");
    setError(null);
    try {
      await api.references.fromUrl(projectId, url.trim());
      setUrl("");
      await reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const analyze = async () => {
    setBusy("analyze");
    try {
      const a = await api.ai.analyzeReferences(projectId);
      setAnalysis(a);
      onAnalyzed?.(a);
    } finally {
      setBusy(null);
    }
  };

  const groups = Array.from(new Set(refs.map((r) => r.group).filter(Boolean))) as string[];

  return (
    <div
      className={`relative ${drag ? "ring-2 ring-ink ring-offset-4 ring-offset-bg rounded-lg" : ""}`}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); upload(e.dataTransfer.files); }}
    >
      {/* toolbar */}
      <div className={`flex flex-wrap items-center gap-2 ${compact ? "mb-3" : "mb-5"}`}>
        <button className="btn btn-secondary btn-sm" onClick={() => fileRef.current?.click()} disabled={busy === "upload"}>
          {busy === "upload" ? <Spinner /> : <ImagePlus size={14} />} Upload images
        </button>
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => e.target.files && upload(e.target.files)} />
        <div className="flex items-center gap-1 flex-1 min-w-[200px]">
          <Link2 size={14} className="text-muted" />
          <input className="input !py-1.5 !text-[12.5px]" placeholder="Paste an image URL (Pinterest, Unsplash…)" value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addUrl()} />
          <button className="btn btn-ghost btn-sm" onClick={addUrl} disabled={!url}>Add</button>
        </div>
        <button className="btn btn-primary btn-sm" onClick={analyze} disabled={busy !== null || refs.length === 0}>
          {busy === "analyze" ? <Spinner /> : <Sparkles size={14} />} Analyze references
        </button>
      </div>
      {error && <p className="text-danger text-xs mb-3">{error}</p>}

      {/* analysis */}
      {analysis && (
        <div className={`card p-4 mb-5 grid ${compact ? "grid-cols-2" : "sm:grid-cols-3 md:grid-cols-6"} gap-4 fade-in`}>
          <Attr label="Style" value={analysis.style.join(" / ")} />
          <div>
            <p className="eyebrow mb-1.5">Colors</p>
            <div className="flex items-center gap-1.5 flex-wrap">
              {analysis.colorHex.slice(0, 5).map((h, i) => (
                <span key={i} title={analysis.colors[i]} className="w-5 h-5 rounded-full border border-line" style={{ background: h }} />
              ))}
            </div>
            <p className="text-[12px] mt-1 capitalize">{analysis.colors.slice(0, 3).join(" / ")}</p>
          </div>
          <Attr label="Typography" value={analysis.typography} />
          <Attr label="Composition" value={analysis.composition} />
          <Attr label="Mood" value={analysis.mood.join(" / ")} />
          <Attr label="Decoration" value={analysis.decoration} />
        </div>
      )}

      {/* board */}
      {refs.length === 0 ? (
        <button
          onClick={() => fileRef.current?.click()}
          className="w-full border border-dashed border-line-strong rounded-xl py-16 text-center text-muted hover:border-ink hover:text-ink transition-colors"
        >
          <ImagePlus className="mx-auto mb-3" size={22} />
          <p className="font-medium text-ink">Drop images here</p>
          <p className="text-[12.5px] mt-1">Screenshots, photos, invitations, interiors — anything that feels right.</p>
        </button>
      ) : (
        <div style={{ columns: compact ? 2 : 4, columnGap: 12 }}>
          {refs.map((r) => (
            <RefCard key={r.id} r={r} projectId={projectId} groups={groups} onChange={reload} compact={compact} />
          ))}
        </div>
      )}
    </div>
  );
}

function Attr({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="eyebrow mb-1.5">{label}</p>
      <p className="text-[12.5px] leading-snug">{value}</p>
    </div>
  );
}

function RefCard({ r, projectId, groups, onChange, compact }: { r: Reference; projectId: string; groups: string[]; onChange: () => void; compact?: boolean }) {
  const [note, setNote] = useState(r.note ?? "");
  const [editing, setEditing] = useState(false);
  const saveNote = async () => {
    setEditing(false);
    if (note !== (r.note ?? "")) await api.references.update(projectId, r.id, { note });
  };
  const setGroup = async (g: string) => {
    await api.references.update(projectId, r.id, { group: g || null });
    onChange();
  };
  return (
    <div className="card overflow-hidden mb-3 break-inside-avoid group relative">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={r.url} alt="" className="w-full block" />
      <button
        className="absolute top-2 right-2 btn btn-icon bg-white/90 text-ink opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={async () => { await api.references.remove(projectId, r.id); onChange(); }}
        aria-label="Remove"
      >
        <Trash2 size={13} />
      </button>
      <div className="p-2.5 space-y-2">
        {r.palette && (
          <div className="flex gap-1">
            {r.palette.map((c) => <span key={c} className="h-2.5 flex-1 rounded-sm" style={{ background: c }} />)}
          </div>
        )}
        {editing ? (
          <textarea className="textarea !min-h-[56px] !text-[12px]" autoFocus value={note} onChange={(e) => setNote(e.target.value)} onBlur={saveNote} placeholder="What do you like here?" />
        ) : (
          <button className="text-left text-[12px] text-ink-2 w-full" onClick={() => setEditing(true)}>
            {note || <span className="text-muted">Add a note…</span>}
          </button>
        )}
        {!compact && (
          <input
            className="input !py-1 !text-[11.5px]"
            list={`groups-${projectId}`}
            placeholder="Group (e.g. Typography, Venue)"
            defaultValue={r.group ?? ""}
            onBlur={(e) => e.target.value !== (r.group ?? "") && setGroup(e.target.value)}
          />
        )}
        <datalist id={`groups-${projectId}`}>{groups.map((g) => <option key={g} value={g} />)}</datalist>
      </div>
    </div>
  );
}

export { X as _X };
