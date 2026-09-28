"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ConceptPicker } from "@/components/ConceptPicker";
import { InspirationBoard } from "@/components/InspirationBoard";
import { EVENT_TYPES, Field, Spinner } from "@/components/ui";
import { api, type Project } from "@/lib/api";

type Step = 1 | 2 | 3 | 4;

const STYLE_CHIPS = ["Minimal", "Editorial", "Old money", "Romantic", "Modern", "Warm", "Botanical", "Black tie", "Playful", "Film photography", "Mediterranean", "Monochrome"];

export default function NewEventPage() {
  return (
    <AppShell wide>
      <Suspense fallback={<div className="py-20 grid place-items-center"><Spinner /></div>}>
        <Wizard />
      </Suspense>
    </AppShell>
  );
}

function Wizard() {
  const params = useSearchParams();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [step, setStep] = useState<Step>(1);
  const [eventType, setEventType] = useState("wedding");
  const [brief, setBrief] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const id = params.get("project");
    if (!id) return;
    api.projects.get(id).then((p) => {
      setProject(p);
      setEventType(p.event_type);
      setBrief((p.brief ?? {}) as Record<string, string>);
      setStep(p.reference_analysis ? 4 : 3);
    });
  }, [params]);

  const set = (k: string, v: string) => setBrief((b) => ({ ...b, [k]: v }));
  const chips = (brief.styleKeywords ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const toggleChip = (c: string) => {
    const next = chips.includes(c) ? chips.filter((x) => x !== c) : [...chips, c];
    set("styleKeywords", next.join(", "));
  };

  const saveBrief = async () => {
    setBusy(true);
    try {
      const name = brief.title || brief.hosts || `${EVENT_TYPES.find((e) => e.value === eventType)?.label} event`;
      const payload = { name, event_type: eventType, brief: { ...brief, styleKeywords: chips } };
      const p = project ? await api.projects.update(project.id, payload) : await api.projects.create(payload);
      setProject(p);
      if (!project) router.replace(`/app/new?project=${p.id}`);
      setStep(3);
    } finally {
      setBusy(false);
    }
  };

  const isWedding = eventType === "wedding" || eventType === "engagement";

  return (
    <div className="max-w-5xl mx-auto">
      <ol className="flex items-center gap-2 text-[12px] text-muted mb-10">
        {["Event type", "Brief", "Inspiration", "Directions"].map((l, i) => (
          <li key={l} className="flex items-center gap-2">
            <button
              disabled={i + 1 > step || (i + 1 >= 3 && !project)}
              onClick={() => setStep((i + 1) as Step)}
              className={`flex items-center gap-2 ${i + 1 === step ? "text-ink font-medium" : ""} disabled:cursor-default`}
            >
              <span className={`w-5 h-5 rounded-full grid place-items-center text-[10.5px] border ${i + 1 <= step ? "bg-ink text-accent-ink border-ink" : "border-line-strong"}`}>{i + 1}</span>
              {l}
            </button>
            {i < 3 && <span className="w-8 h-px bg-line" />}
          </li>
        ))}
      </ol>

      {step === 1 && (
        <section className="fade-in">
          <p className="eyebrow mb-2">Step 1</p>
          <h1 className="display text-4xl mb-8">What are we celebrating?</h1>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
            {EVENT_TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => setEventType(t.value)}
                className={`card p-5 text-left transition-colors ${eventType === t.value ? "border-ink ring-1 ring-ink" : "hover:border-line-strong"}`}
              >
                <p className="font-medium">{t.label}</p>
                <p className="text-muted text-[12.5px] mt-1">{t.hint}</p>
              </button>
            ))}
          </div>
          <div className="flex justify-end mt-8">
            <button className="btn btn-primary" onClick={() => setStep(2)}>Continue <ArrowRight size={15} /></button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="fade-in max-w-2xl">
          <p className="eyebrow mb-2">Step 2</p>
          <h1 className="display text-4xl mb-2">A short brief</h1>
          <p className="text-ink-2 mb-8">The AI reads this like an art director would. Plain words work best.</p>
          <div className="grid sm:grid-cols-2 gap-5">
            {isWedding ? (
              <Field label="Couple's names"><input className="input" placeholder="Humoyun & Malika" value={brief.hosts ?? ""} onChange={(e) => set("hosts", e.target.value)} /></Field>
            ) : eventType === "birthday" ? (
              <>
                <Field label="Name"><input className="input" placeholder="Aziz" value={brief.hosts ?? ""} onChange={(e) => set("hosts", e.target.value)} /></Field>
                <Field label="Age"><input className="input" placeholder="25" value={brief.age ?? ""} onChange={(e) => set("age", e.target.value)} /></Field>
              </>
            ) : (
              <>
                <Field label="Event name"><input className="input" placeholder={eventType === "corporate" ? "Nova Summit 2027" : "A summer gathering"} value={brief.title ?? ""} onChange={(e) => set("title", e.target.value)} /></Field>
                <Field label={eventType === "corporate" ? "Organiser" : "Host(s)"}><input className="input" placeholder={eventType === "corporate" ? "Nova Labs" : "Dilnoza"} value={brief.hosts ?? ""} onChange={(e) => set("hosts", e.target.value)} /></Field>
              </>
            )}
            <Field label="Date"><input className="input" type="date" value={brief.date ?? ""} onChange={(e) => set("date", e.target.value)} /></Field>
            <Field label="Time"><input className="input" type="time" value={brief.time ?? ""} onChange={(e) => set("time", e.target.value)} /></Field>
            <Field label="Venue"><input className="input" placeholder="Villa Cimbrone" value={brief.venue ?? ""} onChange={(e) => set("venue", e.target.value)} /></Field>
            <Field label="City / address"><input className="input" placeholder="Ravello, Italy" value={brief.city ?? ""} onChange={(e) => set("city", e.target.value)} /></Field>
            {eventType !== "corporate" && (
              <Field label="Dress code"><input className="input" placeholder="Black tie optional" value={brief.dressCode ?? ""} onChange={(e) => set("dressCode", e.target.value)} /></Field>
            )}
          </div>
          <div className="mt-5">
            <Field label="Describe the atmosphere" hint="Style, mood, colours, photography — e.g. “Italian summer wedding, old money, elegant, warm ivory, olive green, dark brown, cinematic photography, minimal.”">
              <textarea className="textarea" rows={4} value={brief.description ?? ""} onChange={(e) => set("description", e.target.value)} placeholder="Italian summer wedding, old money, elegant, warm ivory, olive green, dark brown, cinematic photography, minimal." />
            </Field>
          </div>
          <div className="mt-5">
            <span className="label">Style keywords</span>
            <div className="flex flex-wrap gap-2">
              {STYLE_CHIPS.map((c) => (
                <button key={c} onClick={() => toggleChip(c)} className={`badge !py-1.5 !px-3 !text-[12px] cursor-pointer ${chips.includes(c) ? "!bg-ink !text-accent-ink !border-ink" : "hover:border-ink"}`}>{c}</button>
              ))}
            </div>
          </div>
          <div className="flex justify-between mt-10">
            <button className="btn btn-ghost" onClick={() => setStep(1)}><ArrowLeft size={15} /> Back</button>
            <button className="btn btn-primary" onClick={saveBrief} disabled={busy}>{busy && <Spinner />} Continue to inspiration <ArrowRight size={15} /></button>
          </div>
        </section>
      )}

      {step === 3 && project && (
        <section className="fade-in">
          <p className="eyebrow mb-2">Step 3</p>
          <h1 className="display text-4xl mb-2">Inspiration board</h1>
          <p className="text-ink-2 mb-8 max-w-xl">Add anything that feels right — screenshots, photographs, invitations, interiors. Then let the AI read the common visual language. This step is optional but makes a real difference.</p>
          <InspirationBoard projectId={project.id} />
          <div className="flex justify-between mt-10">
            <button className="btn btn-ghost" onClick={() => setStep(2)}><ArrowLeft size={15} /> Back</button>
            <button className="btn btn-primary" onClick={() => setStep(4)}>Generate design directions <ArrowRight size={15} /></button>
          </div>
        </section>
      )}

      {step === 4 && project && (
        <section className="fade-in">
          <ConceptPicker projectId={project.id} onSelected={() => router.push(`/app/projects/${project.id}/editor`)} />
          <div className="flex justify-start mt-10">
            <button className="btn btn-ghost" onClick={() => setStep(3)}><ArrowLeft size={15} /> Back to inspiration</button>
          </div>
        </section>
      )}
    </div>
  );
}
