"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Copy, ImagePlus, Plus, Trash2, X } from "lucide-react";
import { SECTION_LABELS, SECTION_VARIANTS, type GalleryImage, type Section } from "@/design/schema";
import { Segmented } from "@/components/ui";
import { api } from "@/lib/api";
import { useEditor } from "../store";

const TEXT_FIELDS: { key: string; label: string; multiline?: boolean }[] = [
  { key: "eyebrow", label: "Eyebrow" },
  { key: "heading", label: "Heading" },
  { key: "subheading", label: "Subheading", multiline: true },
  { key: "body", label: "Body", multiline: true },
  { key: "quote", label: "Quote", multiline: true },
  { key: "attribution", label: "Attribution" },
  { key: "date", label: "Date" },
  { key: "time", label: "Time" },
  { key: "venue", label: "Venue" },
  { key: "address", label: "Address", multiline: true },
  { key: "mapQuery", label: "Map search" },
  { key: "targetDate", label: "Countdown to (ISO)" },
  { key: "dressCode", label: "Dress code" },
  { key: "buttonLabel", label: "Button label" },
  { key: "buttonHref", label: "Button link" },
  { key: "note", label: "Note" },
  { key: "successMessage", label: "Thank-you message" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
];

const FIELDS_BY_TYPE: Record<string, string[]> = {
  hero: ["eyebrow", "heading", "subheading", "date", "venue", "buttonLabel", "buttonHref"],
  story: ["eyebrow", "heading", "body"],
  event_details: ["eyebrow", "heading", "body"],
  schedule: ["eyebrow", "heading"],
  gallery: ["eyebrow", "heading"],
  countdown: ["eyebrow", "heading", "targetDate"],
  quote: ["quote", "attribution"],
  map: ["eyebrow", "heading", "venue", "address", "mapQuery", "body", "buttonLabel"],
  dress_code: ["eyebrow", "heading", "dressCode", "body"],
  speakers: ["eyebrow", "heading", "body"],
  rsvp: ["eyebrow", "heading", "body", "note", "buttonLabel", "successMessage"],
  text: ["eyebrow", "heading", "body"],
  image: ["note"],
  divider: [],
  contact: ["eyebrow", "heading", "body", "email", "phone"],
  footer: ["heading", "body"],
};

const HAS_IMAGE = new Set(["hero", "story", "image"]);

export function PropertiesPanel() {
  const { doc, selectedSectionId, selectedElement, updateSectionProp, updateSectionStyle, setVariant, duplicateSection, removeSection, moveSection, toggleVisible } = useEditor();
  if (!doc) return null;
  const section = doc.sections.find((s) => s.id === selectedSectionId);

  if (!section) {
    return (
      <div className="p-4 text-[12.5px] text-ink-2 leading-relaxed">
        <p className="panel-title mb-3">Properties</p>
        <p>Select a section on the canvas or in the Sections list to edit its layout, content and spacing.</p>
        <p className="mt-3">Click any text to edit it inline. Click an image to replace it.</p>
        <p className="mt-3 text-muted">Global colours, fonts and spacing live in the <strong>Design</strong> tab.</p>
      </div>
    );
  }

  const idx = doc.sections.indexOf(section);
  const fields = FIELDS_BY_TYPE[section.type] ?? [];
  const p = section.props;

  return (
    <div className="p-3 space-y-5">
      {/* header */}
      <div>
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-medium">{SECTION_LABELS[section.type]}</p>
          <div className="flex items-center gap-0.5">
            <button className="btn btn-ghost btn-icon" title="Move up" disabled={idx === 0} onClick={() => moveSection(section.id, idx - 1)}><ArrowUp size={13} /></button>
            <button className="btn btn-ghost btn-icon" title="Move down" disabled={idx === doc.sections.length - 1} onClick={() => moveSection(section.id, idx + 1)}><ArrowDown size={13} /></button>
            <button className="btn btn-ghost btn-icon" title="Duplicate" onClick={() => duplicateSection(section.id)}><Copy size={13} /></button>
            <button className="btn btn-ghost btn-icon text-danger" title="Delete" onClick={() => removeSection(section.id)}><Trash2 size={13} /></button>
          </div>
        </div>
      </div>

      {/* layout */}
      <div className="space-y-2">
        <p className="panel-title">Layout</p>
        <div className="prop-row">
          <span>Variant</span>
          <select className="select" value={section.variant} onChange={(e) => setVariant(section.id, e.target.value)}>
            {SECTION_VARIANTS[section.type].map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <div className="prop-row"><span>Align</span><Segmented value={section.style.align} onChange={(v) => updateSectionStyle(section.id, "align", v)} options={[{ value: "left", label: "Left" }, { value: "center", label: "Center" }]} /></div>
        <div className="prop-row"><span>Background</span><Segmented value={section.style.background} onChange={(v) => updateSectionStyle(section.id, "background", v)} options={[{ value: "default", label: "Base" }, { value: "surface", label: "Soft" }, { value: "accent", label: "Accent" }, { value: "dark", label: "Dark" }]} /></div>
        <div className="prop-row"><span>Padding</span><Segmented value={section.style.paddingY} onChange={(v) => updateSectionStyle(section.id, "paddingY", v)} options={[{ value: "sm", label: "S" }, { value: "md", label: "M" }, { value: "lg", label: "L" }, { value: "xl", label: "XL" }]} /></div>
        <div className="prop-row"><span>Heading size</span><Segmented value={section.style.headingSize} onChange={(v) => updateSectionStyle(section.id, "headingSize", v)} options={[{ value: "sm", label: "S" }, { value: "md", label: "M" }, { value: "lg", label: "L" }, { value: "xl", label: "XL" }]} /></div>
        <div className="prop-row"><span>Visible</span><Segmented value={section.visible ? "yes" : "no"} onChange={() => toggleVisible(section.id)} options={[{ value: "yes", label: "Shown" }, { value: "no", label: "Hidden" }]} /></div>
      </div>

      {/* image */}
      {(HAS_IMAGE.has(section.type) || (section.type === "hero")) && (
        <ImageField label="Image" value={p.image as string | undefined} highlight={selectedElement === "image"} onChange={(v) => updateSectionProp(section.id, "image", v)} />
      )}

      {/* text fields */}
      {fields.length > 0 && (
        <div className="space-y-2.5">
          <p className="panel-title">Content</p>
          {fields.map((k) => {
            const f = TEXT_FIELDS.find((x) => x.key === k)!;
            return <TextField key={k} label={f.label} multiline={f.multiline} value={(p[k] as string) ?? ""} highlight={selectedElement === k} onChange={(v) => updateSectionProp(section.id, k, v)} />;
          })}
        </div>
      )}

      {/* lists */}
      {section.type === "event_details" && <ListEditor section={section} prop="details" fields={["label", "value", "note"]} labels={["Label", "Value", "Note"]} blank={{ label: "Label", value: "Value" }} />}
      {section.type === "schedule" && <ListEditor section={section} prop="items" fields={["time", "title", "description"]} labels={["Time", "Title", "Description"]} blank={{ time: "12:00", title: "Title" }} />}
      {section.type === "speakers" && <ListEditor section={section} prop="speakers" fields={["name", "role"]} labels={["Name", "Role"]} blank={{ name: "Speaker", role: "Role" }} image />}
      {section.type === "gallery" && <GalleryEditor section={section} />}
      {section.type === "dress_code" && section.variant === "swatches" && <SwatchEditor section={section} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function TextField({ label, value, onChange, multiline, highlight }: { label: string; value: string; onChange: (v: string) => void; multiline?: boolean; highlight?: boolean }) {
  const [v, setV] = useState(value);
  const ref = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  useEffect(() => setV(value), [value]);
  useEffect(() => {
    if (highlight) ref.current?.scrollIntoView({ block: "nearest" });
  }, [highlight]);
  const commit = () => v !== value && onChange(v);
  const cls = `${multiline ? "textarea !min-h-[64px]" : "input"} !py-1.5 !text-[12.5px] ${highlight ? "!border-ink" : ""}`;
  return (
    <label className="block">
      <span className="text-[11.5px] text-ink-2 block mb-1">{label}</span>
      {multiline ? (
        <textarea ref={ref as React.RefObject<HTMLTextAreaElement>} className={cls} rows={3} value={v} onChange={(e) => setV(e.target.value)} onBlur={commit} />
      ) : (
        <input ref={ref as React.RefObject<HTMLInputElement>} className={cls} value={v} onChange={(e) => setV(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()} />
      )}
    </label>
  );
}

export function ImageField({ label, value, onChange, highlight }: { label: string; value?: string; onChange: (v: string | undefined) => void; highlight?: boolean }) {
  const { assets, loadAssets, projectId } = useEditor();
  const [url, setUrl] = useState("");
  const [open, setOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (highlight) setOpen(true);
  }, [highlight]);
  const upload = async (files: FileList) => {
    if (!projectId || !files[0]) return;
    const a = await api.assets.upload(projectId, files[0]);
    await loadAssets();
    onChange(a.url);
  };
  return (
    <div className={`space-y-2 ${highlight ? "ring-1 ring-ink rounded-md p-2 -m-2" : ""}`}>
      <p className="panel-title">{label}</p>
      <div className="flex items-center gap-2">
        <div className="w-16 h-12 rounded border border-line bg-surface-2 overflow-hidden shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {value ? <img src={value} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full grid place-items-center text-muted"><ImagePlus size={14} /></div>}
        </div>
        <div className="flex flex-col gap-1 flex-1">
          <button className="btn btn-secondary btn-sm" onClick={() => setOpen((o) => !o)}>{value ? "Replace" : "Choose image"}</button>
          {value && <button className="btn btn-ghost btn-sm" onClick={() => onChange(undefined)}><X size={12} /> Remove</button>}
        </div>
      </div>
      {open && (
        <div className="card p-2 space-y-2 fade-in">
          <div className="flex gap-1">
            <input className="input !py-1 !text-[12px]" placeholder="Paste image URL" value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && url) { onChange(url); setUrl(""); setOpen(false); } }} />
            <button className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()}>Upload</button>
            <input ref={fileRef} type="file" hidden accept="image/*" onChange={(e) => e.target.files && upload(e.target.files)} />
          </div>
          {assets.length > 0 && (
            <div className="grid grid-cols-4 gap-1">
              {assets.map((a) => (
                <button key={a.id} className={`aspect-square rounded overflow-hidden border ${a.url === value ? "border-ink" : "border-line"}`} onClick={() => { onChange(a.url); setOpen(false); }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={a.url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
          {assets.length === 0 && <p className="text-[11.5px] text-muted">No assets yet — upload a photo or paste a URL.</p>}
        </div>
      )}
    </div>
  );
}

function ListEditor({ section, prop, fields, labels, blank, image }: { section: Section; prop: string; fields: string[]; labels: string[]; blank: Record<string, string>; image?: boolean }) {
  const { updateSectionProp } = useEditor();
  const items = (section.props[prop] as Record<string, string>[] | undefined) ?? [];
  const set = (next: Record<string, string>[]) => updateSectionProp(section.id, prop, next);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="panel-title">Items</p>
        <button className="btn btn-ghost btn-sm" onClick={() => set([...items, { ...blank }])}><Plus size={12} /> Add</button>
      </div>
      {items.map((it, i) => (
        <div key={i} className="card p-2 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted">#{i + 1}</span>
            <div className="flex gap-0.5">
              <button className="btn btn-ghost btn-icon !w-6 !h-6" disabled={i === 0} onClick={() => { const n = [...items]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; set(n); }}><ArrowUp size={11} /></button>
              <button className="btn btn-ghost btn-icon !w-6 !h-6" disabled={i === items.length - 1} onClick={() => { const n = [...items]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; set(n); }}><ArrowDown size={11} /></button>
              <button className="btn btn-ghost btn-icon !w-6 !h-6 text-danger" onClick={() => set(items.filter((_, j) => j !== i))}><Trash2 size={11} /></button>
            </div>
          </div>
          {fields.map((f, fi) => (
            <input key={f} className="input !py-1 !text-[12px]" placeholder={labels[fi]} defaultValue={it[f] ?? ""} onBlur={(e) => { if (e.target.value !== (it[f] ?? "")) { const n = items.map((x, j) => (j === i ? { ...x, [f]: e.target.value } : x)); set(n); } }} />
          ))}
          {image && <ImageField label="Photo" value={it.image} onChange={(v) => set(items.map((x, j) => (j === i ? { ...x, image: v ?? "" } : x)))} />}
        </div>
      ))}
    </div>
  );
}

function GalleryEditor({ section }: { section: Section }) {
  const { updateSectionProp, selectedElement } = useEditor();
  const images = section.props.images ?? [];
  const set = (next: GalleryImage[]) => updateSectionProp(section.id, "images", next);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="panel-title">Photos</p>
        <button className="btn btn-ghost btn-sm" onClick={() => set([...images, { src: undefined }])}><Plus size={12} /> Add slot</button>
      </div>
      {images.map((im, i) => (
        <div key={i} className="card p-2 flex items-start gap-2">
          <div className="flex-1">
            <ImageField label={`Photo ${i + 1}`} value={im.src ?? undefined} highlight={selectedElement === `images.${i}.src`} onChange={(v) => set(images.map((x, j) => (j === i ? { ...x, src: v } : x)))} />
          </div>
          <button className="btn btn-ghost btn-icon text-danger" onClick={() => set(images.filter((_, j) => j !== i))}><Trash2 size={12} /></button>
        </div>
      ))}
    </div>
  );
}

function SwatchEditor({ section }: { section: Section }) {
  const { updateSectionProp } = useEditor();
  const sw = (section.props.swatches as string[] | undefined) ?? [];
  const set = (n: string[]) => updateSectionProp(section.id, "swatches", n);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="panel-title">Swatches</p>
        <button className="btn btn-ghost btn-sm" onClick={() => set([...sw, "#888888"])}><Plus size={12} /> Add</button>
      </div>
      <div className="flex flex-wrap gap-2">
        {sw.map((c, i) => (
          <div key={i} className="color-input">
            <input type="color" value={c} onChange={(e) => set(sw.map((x, j) => (j === i ? e.target.value : x)))} />
            <button className="btn btn-ghost btn-icon !w-6 !h-6" onClick={() => set(sw.filter((_, j) => j !== i))}><X size={11} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
