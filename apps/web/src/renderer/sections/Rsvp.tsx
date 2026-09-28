"use client";
import { useState } from "react";
import { useRenderer, useSection } from "../context";
import { Body, Button, Eyebrow, Heading, Reveal, Text } from "../primitives";
import { api } from "@/lib/api";

export function Rsvp() {
  const s = useSection();
  const p = s.props;
  const { editable, publicSlug } = useRenderer();
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [form, setForm] = useState({
    name: "",
    guests: 1,
    attending: "yes",
    dietary: "",
    message: "",
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editable) return;
    if (!publicSlug) {
      setState("done");
      return;
    }
    setState("sending");
    try {
      await api.rsvp.submit(publicSlug, {
        name: form.name,
        guests: Number(form.guests),
        attending: form.attending === "yes",
        dietary: form.dietary,
        message: form.message,
      });
      setState("done");
    } catch {
      setState("error");
    }
  };

  const formEl =
    state === "done" ? (
      <div className="inv-rsvp-done">
        <Text prop="successMessage" value={(p.successMessage as string) ?? "Thank you — we can't wait to see you."} as="p" className="inv-detail-value" />
      </div>
    ) : (
      <form className="inv-form" onSubmit={submit}>
        <label>
          <span className="inv-label">Full name</span>
          <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Your name" disabled={editable} />
        </label>
        <div className="inv-form-row">
          <label>
            <span className="inv-label">Attendance</span>
            <select value={form.attending} onChange={(e) => setForm({ ...form, attending: e.target.value })} disabled={editable}>
              <option value="yes">Joyfully accept</option>
              <option value="no">Regretfully decline</option>
            </select>
          </label>
          <label>
            <span className="inv-label">Guests</span>
            <input type="number" min={1} max={10} value={form.guests} onChange={(e) => setForm({ ...form, guests: Number(e.target.value) })} disabled={editable} />
          </label>
        </div>
        <label>
          <span className="inv-label">Dietary preferences</span>
          <input value={form.dietary} onChange={(e) => setForm({ ...form, dietary: e.target.value })} placeholder="Vegetarian, allergies…" disabled={editable} />
        </label>
        <label>
          <span className="inv-label">Message</span>
          <textarea rows={3} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="A few words, if you like" disabled={editable} />
        </label>
        {state === "error" && <p className="inv-form-error">Something went wrong. Please try again.</p>}
        <Button label={p.buttonLabel ?? "Send RSVP"} type="submit" onClick={undefined} />
      </form>
    );

  if (s.variant === "split") {
    return (
      <div className="inv-container inv-rsvp inv-rsvp-split" id="rsvp">
        <Reveal className="inv-rsvp-copy">
          <Eyebrow value={p.eyebrow} />
          <Heading value={p.heading} />
          <Body value={p.body} />
          <Text prop="note" value={p.note} as="p" className="inv-caption" placeholder="Deadline note" />
        </Reveal>
        <Reveal delay={100} className="inv-rsvp-form">
          {formEl}
        </Reveal>
      </div>
    );
  }

  return (
    <div className={`inv-container inv-narrow inv-rsvp inv-rsvp-${s.variant}`} id="rsvp">
      <Reveal className="inv-rsvp-copy">
        <Eyebrow value={p.eyebrow} />
        <Heading value={p.heading} />
        <Body value={p.body} />
        <Text prop="note" value={p.note} as="p" className="inv-caption" placeholder="Deadline note" />
      </Reveal>
      <Reveal delay={100} className="inv-rsvp-form">
        {formEl}
      </Reveal>
    </div>
  );
}
