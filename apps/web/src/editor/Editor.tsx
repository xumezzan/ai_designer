"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Eye, Globe, Images, Layers, Monitor, Palette, Redo2, Smartphone, Sparkles, Tablet, Undo2, Users } from "lucide-react";
import type { DesignDocument } from "@/design/schema";
import { SiteRenderer } from "@/renderer/SiteRenderer";
import { Logo, Spinner } from "@/components/ui";
import { useEditor, type LeftTab } from "./store";
import { SectionsPanel } from "./panels/SectionsPanel";
import { AssetsPanel } from "./panels/AssetsPanel";
import { DesignPanel } from "./panels/DesignPanel";
import { PropertiesPanel } from "./panels/PropertiesPanel";
import { AIPanel } from "./panels/AIPanel";
import { PublishModal } from "./panels/PublishModal";
import { InspirationBoard } from "@/components/InspirationBoard";

const VIEWPORT_WIDTH = { desktop: 1280, tablet: 834, mobile: 390 } as const;

export function Editor({ projectId, projectName, initialDoc }: { projectId: string; projectName: string; initialDoc: DesignDocument }) {
  const s = useEditor();
  const [publishOpen, setPublishOpen] = useState(false);

  useEffect(() => {
    s.init(projectId, projectName, initialDoc);
    s.loadAssets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      const target = e.target as HTMLElement;
      const typing = target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
      if (meta && e.key.toLowerCase() === "z") {
        if (typing && target.isContentEditable) return;
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
      } else if (meta && e.key.toLowerCase() === "s") {
        e.preventDefault();
        s.save();
      } else if (meta && e.key.toLowerCase() === "d" && s.selectedSectionId && !typing) {
        e.preventDefault();
        s.duplicateSection(s.selectedSectionId);
      } else if ((e.key === "Backspace" || e.key === "Delete") && s.selectedSectionId && !typing) {
        e.preventDefault();
        s.removeSection(s.selectedSectionId);
      } else if (e.key === "Escape") {
        (document.activeElement as HTMLElement | null)?.blur?.();
        s.select(null);
      } else if (e.key === "ArrowUp" && e.altKey && s.selectedSectionId && !typing && s.doc) {
        const i = s.doc.sections.findIndex((x) => x.id === s.selectedSectionId);
        if (i > 0) s.moveSection(s.selectedSectionId, i - 1);
      } else if (e.key === "ArrowDown" && e.altKey && s.selectedSectionId && !typing && s.doc) {
        const i = s.doc.sections.findIndex((x) => x.id === s.selectedSectionId);
        if (i < s.doc.sections.length - 1) s.moveSection(s.selectedSectionId, i + 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [s]);

  // warn on leaving with unsaved changes
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (useEditor.getState().dirty) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, []);

  const onTextChange = useCallback((sectionId: string, prop: string, value: string) => {
    useEditor.getState().updateSectionProp(sectionId, prop, value);
  }, []);

  const doc = s.preview ?? s.doc;
  const width = VIEWPORT_WIDTH[s.viewport];
  const leftTabs = useMemo(
    () => [
      { id: "sections" as LeftTab, icon: Layers, label: "Sections" },
      { id: "assets" as LeftTab, icon: Images, label: "Assets" },
      { id: "design" as LeftTab, icon: Palette, label: "Design" },
      { id: "inspiration" as LeftTab, icon: Sparkles, label: "Inspiration" },
    ],
    []
  );

  if (!doc) return null;

  return (
    <div className="h-screen flex flex-col bg-bg overflow-hidden">
      {/* ------------------------------------------------ top bar */}
      <header className="h-12 border-b border-line bg-surface flex items-center justify-between px-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/app" className="btn btn-ghost btn-icon" title="Back to dashboard"><ArrowLeft size={15} /></Link>
          <Logo className="!text-[18px]" />
          <span className="text-line-strong">/</span>
          <span className="text-[13px] font-medium truncate max-w-[220px]">{s.projectName}</span>
          <span className="text-[11.5px] text-muted flex items-center gap-1.5 ml-1">
            {s.saving ? (<><Spinner className="!w-3 !h-3" /> Saving</>) : s.dirty ? "Unsaved changes" : (<><Check size={12} /> Saved</>)}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button className="btn btn-ghost btn-icon" title="Undo (⌘Z)" onClick={s.undo} disabled={s.past.length === 0}><Undo2 size={15} /></button>
          <button className="btn btn-ghost btn-icon" title="Redo (⇧⌘Z)" onClick={s.redo} disabled={s.future.length === 0}><Redo2 size={15} /></button>
          <div className="seg ml-3">
            {(["desktop", "tablet", "mobile"] as const).map((v) => {
              const Icon = v === "desktop" ? Monitor : v === "tablet" ? Tablet : Smartphone;
              return (
                <button key={v} className={s.viewport === v ? "active" : ""} onClick={() => s.setViewport(v)} title={v}>
                  <Icon size={13} />
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link href={`/app/projects/${projectId}/guests`} className="btn btn-ghost btn-sm"><Users size={14} /> Guests</Link>
          <Link href={`/app/projects/${projectId}/preview`} target="_blank" className="btn btn-secondary btn-sm"><Eye size={14} /> Preview</Link>
          <button className="btn btn-primary btn-sm" onClick={() => setPublishOpen(true)}><Globe size={14} /> Publish</button>
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        {/* ------------------------------------------------ left sidebar */}
        <aside className="w-[300px] shrink-0 border-r border-line bg-surface flex min-h-0">
          <nav className="w-14 border-r border-line flex flex-col items-center py-2 gap-1">
            {leftTabs.map((t) => (
              <button
                key={t.id}
                title={t.label}
                onClick={() => s.setLeftTab(t.id)}
                className={`w-10 h-10 rounded-md grid place-items-center text-ink-2 hover:bg-surface-2 ${s.leftTab === t.id ? "bg-surface-2 text-ink" : ""}`}
              >
                <t.icon size={17} strokeWidth={1.75} />
              </button>
            ))}
          </nav>
          <div className="flex-1 min-w-0 overflow-y-auto scrollbar-thin">
            {s.leftTab === "sections" && <SectionsPanel />}
            {s.leftTab === "assets" && <AssetsPanel />}
            {s.leftTab === "design" && <DesignPanel />}
            {s.leftTab === "inspiration" && (
              <div className="p-3">
                <p className="panel-title mb-3">Inspiration</p>
                <InspirationBoard projectId={projectId} compact />
              </div>
            )}
          </div>
        </aside>

        {/* ------------------------------------------------ canvas */}
        <main className="flex-1 min-w-0 canvas-bg overflow-auto scrollbar-thin" onClick={() => s.select(null)}>
          <div className="min-h-full py-8 px-6 flex justify-center">
            <div
              className="bg-white shadow-[0_30px_80px_-40px_rgba(0,0,0,.35)] transition-[width] duration-300"
              style={{ width: s.viewport === "desktop" ? "100%" : width, maxWidth: s.viewport === "desktop" ? 1400 : undefined, borderRadius: s.viewport === "mobile" ? 28 : 6, overflow: "hidden", border: s.viewport === "mobile" ? "8px solid #1b1a17" : undefined }}
              onClick={(e) => e.stopPropagation()}
            >
              <SiteRenderer
                doc={doc}
                editable={!s.preview}
                viewport={s.viewport}
                selectedSectionId={s.selectedSectionId}
                selectedElement={s.selectedElement}
                onSelect={(id, el) => s.select(id, el ?? null)}
                onTextChange={onTextChange}
                projectId={projectId}
              />
            </div>
          </div>
        </main>

        {/* ------------------------------------------------ right sidebar */}
        <aside className="w-[340px] shrink-0 border-l border-line bg-surface flex flex-col min-h-0">
          <div className="flex border-b border-line shrink-0">
            {(["properties", "ai"] as const).map((t) => (
              <button
                key={t}
                onClick={() => s.setRightTab(t)}
                className={`flex-1 h-11 text-[12.5px] font-medium flex items-center justify-center gap-1.5 border-b-2 -mb-px ${s.rightTab === t ? "border-ink text-ink" : "border-transparent text-ink-2 hover:text-ink"}`}
              >
                {t === "ai" ? (<><Sparkles size={13} /> AI Designer</>) : "Properties"}
              </button>
            ))}
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin">
            {s.rightTab === "properties" ? <PropertiesPanel /> : <AIPanel />}
          </div>
        </aside>
      </div>

      <PublishModal open={publishOpen} onClose={() => setPublishOpen(false)} projectId={projectId} />
    </div>
  );
}
