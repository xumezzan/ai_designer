"use client";
import { FONT_LIBRARY } from "@/design/tokens";
import { Segmented } from "@/components/ui";
import { useEditor } from "../store";

/** Theme (design tokens) editor. Every control maps to a token the AI also uses. */
export function DesignPanel() {
  const { doc, updateTheme, apply } = useEditor();
  if (!doc) return null;
  const t = doc.theme;

  const Color = ({ k, label }: { k: keyof typeof t.colors; label: string }) => (
    <div className="prop-row">
      <span>{label}</span>
      <div className="color-input">
        <input type="color" value={t.colors[k]} onChange={(e) => updateTheme(`colors.${k}`, e.target.value)} />
        <input className="input !py-1 !text-[12px] font-mono uppercase" value={t.colors[k]} onChange={(e) => /^#[0-9a-f]{6}$/i.test(e.target.value) && updateTheme(`colors.${k}`, e.target.value)} />
      </div>
    </div>
  );

  return (
    <div className="p-3 space-y-6">
      <div>
        <p className="panel-title mb-3">Concept</p>
        <p className="text-[13px] font-medium">{doc.meta.direction}</p>
        <p className="text-[12px] text-ink-2 leading-relaxed mt-1">{doc.meta.rationale}</p>
      </div>

      <div className="space-y-2">
        <p className="panel-title mb-3">Colors</p>
        <Color k="background" label="Background" />
        <Color k="surface" label="Surface" />
        <Color k="text" label="Text" />
        <Color k="muted" label="Muted" />
        <Color k="accent" label="Accent" />
        <Color k="accentText" label="On accent" />
      </div>

      <div className="space-y-2">
        <p className="panel-title mb-3">Typography</p>
        <div className="prop-row">
          <span>Heading font</span>
          <select className="select" value={t.typography.headingFont} onChange={(e) => updateTheme("typography.headingFont", e.target.value)}>
            <optgroup label="Serif">{FONT_LIBRARY.serif.map((f) => <option key={f}>{f}</option>)}</optgroup>
            <optgroup label="Sans">{FONT_LIBRARY.sans.map((f) => <option key={f}>{f}</option>)}</optgroup>
          </select>
        </div>
        <div className="prop-row">
          <span>Body font</span>
          <select className="select" value={t.typography.bodyFont} onChange={(e) => updateTheme("typography.bodyFont", e.target.value)}>
            <optgroup label="Sans">{FONT_LIBRARY.sans.map((f) => <option key={f}>{f}</option>)}</optgroup>
            <optgroup label="Serif">{FONT_LIBRARY.serif.map((f) => <option key={f}>{f}</option>)}</optgroup>
          </select>
        </div>
        <div className="prop-row"><span>Scale</span><Segmented value={t.typography.scale} onChange={(v) => updateTheme("typography.scale", v)} options={[{ value: "compact", label: "S" }, { value: "regular", label: "M" }, { value: "display", label: "L" }]} /></div>
        <div className="prop-row"><span>Weight</span>
          <select className="select" value={t.typography.headingWeight} onChange={(e) => updateTheme("typography.headingWeight", Number(e.target.value))}>
            {[300, 400, 500, 600, 700].map((w) => <option key={w} value={w}>{w}</option>)}
          </select>
        </div>
        <div className="prop-row"><span>Case</span><Segmented value={t.typography.headingCase} onChange={(v) => updateTheme("typography.headingCase", v)} options={[{ value: "none", label: "Aa" }, { value: "uppercase", label: "AA" }]} /></div>
        <div className="prop-row"><span>Tracking</span><Segmented value={t.typography.headingTracking} onChange={(v) => updateTheme("typography.headingTracking", v)} options={[{ value: "tight", label: "Tight" }, { value: "normal", label: "Normal" }, { value: "wide", label: "Wide" }]} /></div>
        <div className="prop-row"><span>Italic</span><Segmented value={t.typography.headingItalic ? "yes" : "no"} onChange={(v) => updateTheme("typography.headingItalic", v === "yes")} options={[{ value: "no", label: "Off" }, { value: "yes", label: "On" }]} /></div>
      </div>

      <div className="space-y-2">
        <p className="panel-title mb-3">Layout & feel</p>
        <div className="prop-row"><span>Spacing</span><Segmented value={t.spacing} onChange={(v) => updateTheme("spacing", v)} options={[{ value: "compact", label: "Compact" }, { value: "comfortable", label: "Comfort" }, { value: "airy", label: "Airy" }]} /></div>
        <div className="prop-row"><span>Max width</span>
          <select className="select" value={doc.layout.maxWidth} onChange={(e) => apply([{ target: "layout", action: "update", property: "maxWidth", value: Number(e.target.value) }])}>
            {[960, 1080, 1200, 1320].map((w) => <option key={w} value={w}>{w}px</option>)}
          </select>
        </div>
        <div className="prop-row"><span>Corners</span><Segmented value={t.radius} onChange={(v) => updateTheme("radius", v)} options={[{ value: "none", label: "0" }, { value: "sm", label: "S" }, { value: "md", label: "M" }, { value: "lg", label: "L" }]} /></div>
        <div className="prop-row"><span>Shadows</span><Segmented value={t.shadows} onChange={(v) => updateTheme("shadows", v)} options={[{ value: "none", label: "None" }, { value: "soft", label: "Soft" }]} /></div>
        <div className="prop-row"><span>Decoration</span><Segmented value={t.decoration} onChange={(v) => updateTheme("decoration", v)} options={[{ value: "none", label: "None" }, { value: "minimal", label: "Min" }, { value: "moderate", label: "Some" }]} /></div>
        <div className="prop-row"><span>Animation</span><Segmented value={t.animation} onChange={(v) => updateTheme("animation", v)} options={[{ value: "none", label: "None" }, { value: "subtle", label: "Subtle" }, { value: "moderate", label: "More" }]} /></div>
        <div className="prop-row"><span>Photos</span>
          <select className="select" value={t.imageTreatment} onChange={(e) => updateTheme("imageTreatment", e.target.value)}>
            {["natural", "film", "muted", "mono", "warm"].map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
}
