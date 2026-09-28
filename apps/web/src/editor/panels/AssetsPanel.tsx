"use client";
import { useRef, useState } from "react";
import { Trash2, Upload } from "lucide-react";
import { api } from "@/lib/api";
import { Spinner } from "@/components/ui";
import { useEditor } from "../store";

/**
 * Project media library. Click an image to place it into the selected
 * image element (or the hero if nothing is selected); drag onto the canvas
 * also works because image elements accept drops.
 */
export function AssetsPanel() {
  const { assets, loadAssets, projectId, selectedSectionId, selectedElement, doc, updateSectionProp, select } = useEditor();
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const upload = async (files: FileList) => {
    if (!projectId) return;
    setBusy(true);
    try {
      for (const f of Array.from(files)) if (f.type.startsWith("image/")) await api.assets.upload(projectId, f);
      await loadAssets();
    } finally {
      setBusy(false);
    }
  };

  const place = (url: string) => {
    if (!doc) return;
    const targetId = selectedSectionId ?? doc.sections.find((s) => s.type === "hero")?.id;
    if (!targetId) return;
    const section = doc.sections.find((s) => s.id === targetId)!;
    let prop = selectedElement && (selectedElement === "image" || selectedElement.endsWith(".src") || selectedElement.endsWith(".image")) ? selectedElement : "image";
    if (section.type === "gallery" && prop === "image") {
      const imgs = section.props.images ?? [];
      const emptyIdx = imgs.findIndex((i) => !i.src);
      prop = `images.${emptyIdx === -1 ? imgs.length : emptyIdx}.src`;
    }
    updateSectionProp(targetId, prop, url);
    select(targetId, prop);
  };

  return (
    <div className="p-3">
      <div className="flex items-center justify-between mb-3">
        <p className="panel-title">Assets</p>
        <button className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()} disabled={busy}>{busy ? <Spinner /> : <Upload size={13} />} Upload</button>
        <input ref={fileRef} type="file" hidden multiple accept="image/*" onChange={(e) => e.target.files && upload(e.target.files)} />
      </div>
      <p className="text-[11.5px] text-muted mb-3">
        {selectedSectionId ? "Click an image to place it in the selected section." : "Select an image on the canvas, then click an asset to replace it."}
      </p>
      {assets.length === 0 ? (
        <button onClick={() => fileRef.current?.click()} className="w-full border border-dashed border-line-strong rounded-lg py-10 text-center text-muted text-[12.5px] hover:border-ink hover:text-ink">
          <Upload size={18} className="mx-auto mb-2" /> Upload photos
        </button>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {assets.map((a) => (
            <div key={a.id} className="group relative rounded-md overflow-hidden border border-line aspect-square">
              <button className="w-full h-full" onClick={() => place(a.url)} title={a.filename ?? ""} draggable onDragStart={(e) => e.dataTransfer.setData("text/uri-list", a.url)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.url} alt="" className="w-full h-full object-cover" />
              </button>
              <button
                className="absolute top-1 right-1 btn btn-icon !w-6 !h-6 bg-white/90 opacity-0 group-hover:opacity-100"
                onClick={async () => { if (projectId) { await api.assets.remove(projectId, a.id); loadAssets(); } }}
                aria-label="Delete"
              >
                <Trash2 size={11} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
