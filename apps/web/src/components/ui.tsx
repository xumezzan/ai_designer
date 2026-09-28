"use client";
import React, { useEffect } from "react";
import { Loader2, X } from "lucide-react";

export function Spinner({ className = "" }: { className?: string }) {
  return <Loader2 className={`spin ${className}`} size={16} />;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted mt-1.5">{hint}</span>}
    </label>
  );
}

export function Segmented<T extends string>({ value, options, onChange, className = "" }: { value: T; options: { value: T; label: React.ReactNode; title?: string }[]; onChange: (v: T) => void; className?: string }) {
  return (
    <div className={`seg ${className}`}>
      {options.map((o) => (
        <button key={o.value} type="button" title={o.title} className={o.value === value ? "active" : ""} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Modal({ open, onClose, title, children, width = 520 }: { open: boolean; onClose: () => void; title?: string; children: React.ReactNode; width?: number }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="card fade-in w-full shadow-xl" style={{ maxWidth: width }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <h3 className="text-[15px] font-medium">{title}</h3>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <div className="px-5 pb-5">{children}</div>
      </div>
    </div>
  );
}

export function Empty({ title, body, action }: { title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="card border-dashed p-10 text-center">
      <p className="text-[15px] font-medium">{title}</p>
      {body && <p className="text-muted mt-1 max-w-sm mx-auto">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`font-display text-[22px] leading-none tracking-tight ${className}`}>
      Invito<span className="text-muted">.ai</span>
    </span>
  );
}

export const EVENT_TYPES: { value: string; label: string; hint: string }[] = [
  { value: "wedding", label: "Wedding", hint: "Names, story, schedule, RSVP" },
  { value: "birthday", label: "Birthday", hint: "Name, age, program, gallery" },
  { value: "engagement", label: "Engagement", hint: "Couple, date, celebration" },
  { value: "party", label: "Party", hint: "Theme, time, location" },
  { value: "corporate", label: "Corporate event", hint: "Speakers, agenda, registration" },
  { value: "baby_shower", label: "Baby shower", hint: "Hosts, date, wishes" },
  { value: "other", label: "Other", hint: "Anything else" },
];

export function eventLabel(v: string) {
  return EVENT_TYPES.find((e) => e.value === v)?.label ?? v;
}

export function formatDate(raw?: string | null) {
  if (!raw) return "";
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
