"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, ShieldCheck, Sparkles, X } from "lucide-react";
import type { DesignDocument, EditOperation } from "@/design/schema";
import { applyOperations, diffDocuments, type DiffEntry } from "@/design/operations";
import { api, type DesignIssue } from "@/lib/api";
import { Spinner } from "@/components/ui";
import { useEditor } from "../store";

interface Message {
  role: "user" | "ai";
  text: string;
  proposal?: { id?: string; operations: EditOperation[]; diff: DiffEntry[]; status: "pending" | "applied" | "discarded" };
}

const SUGGESTIONS = [
  "Make the first screen feel more premium",
  "Use olive only for accents",
  "Make it more minimal",
  "Replace the serif with a modern font",
  "Make RSVP more prominent",
  "Make the background slightly warmer",
  "Make the heading smaller",
  "Fix the mobile version",
];

export function AIPanel() {
  const { doc, projectId, apply, setPreview, preview } = useEditor();
  const [messages, setMessages] = useState<Message[]>([
    { role: "ai", text: "I know this design — its palette, type, sections and spacing. Tell me what to change and I'll adjust only what's needed. You'll see a before → after summary before anything is applied." },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [issues, setIssues] = useState<{ score: number; issues: DesignIssue[] } | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, issues]);

  const send = async (text: string) => {
    if (!doc || !projectId || !text.trim()) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text }]);
    setBusy(true);
    try {
      const r = await api.ai.edit(projectId, text, doc);
      const after = applyOperations(doc, r.operations);
      const diff = diffDocuments(doc, after);
      setMessages((m) => [...m, { role: "ai", text: r.summary, proposal: r.operations.length ? { id: r.id, operations: r.operations, diff, status: "pending" } : undefined }]);
      if (r.operations.length) setPreview(after);
    } catch (e) {
      setMessages((m) => [...m, { role: "ai", text: `Something went wrong: ${(e as Error).message}` }]);
    } finally {
      setBusy(false);
    }
  };

  const resolve = (i: number, accept: boolean) => {
    const msg = messages[i];
    if (!msg.proposal) return;
    if (accept) {
      apply(msg.proposal.operations);
      if (projectId && msg.proposal.id) api.ai.markApplied(projectId, msg.proposal.id).catch(() => {});
    }
    setPreview(null);
    setMessages((m) => m.map((x, j) => (j === i && x.proposal ? { ...x, proposal: { ...x.proposal, status: accept ? "applied" : "discarded" } } : x)));
  };

  const check = async () => {
    if (!doc || !projectId) return;
    setBusy(true);
    try {
      setIssues(await api.ai.check(projectId, doc));
    } finally {
      setBusy(false);
    }
  };

  const fixIssue = (iss: DesignIssue) => {
    apply(iss.operations);
    setIssues((s) => (s ? { ...s, issues: s.issues.filter((x) => x !== iss) } : s));
  };

  const pending = messages.some((m) => m.proposal?.status === "pending");

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className="max-w-full">
              <div className={`chat-bubble ${m.role === "user" ? "chat-user" : "chat-ai"}`}>{m.text}</div>
              {m.proposal && (
                <div className="mt-2 card p-3 text-[12px] space-y-2 mr-3">
                  <p className="panel-title">Before → After</p>
                  <ul className="space-y-1 max-h-44 overflow-y-auto scrollbar-thin">
                    {m.proposal.diff.slice(0, 14).map((d, j) => (
                      <li key={j} className="grid grid-cols-[1fr_auto_1fr] gap-1.5 items-center">
                        <span className="text-muted truncate" title={d.path}>{prettyPath(d.path)}</span>
                        <ArrowRight size={11} className="text-muted" />
                        <span className="truncate" title={String(d.after)}>
                          <Val v={d.before} muted /> <span className="text-muted">→</span> <Val v={d.after} />
                        </span>
                      </li>
                    ))}
                    {m.proposal.diff.length > 14 && <li className="text-muted">+{m.proposal.diff.length - 14} more</li>}
                  </ul>
                  {m.proposal.status === "pending" ? (
                    <div className="flex gap-2 pt-1">
                      <button className="btn btn-primary btn-sm flex-1" onClick={() => resolve(i, true)}><Check size={13} /> Apply changes</button>
                      <button className="btn btn-secondary btn-sm" onClick={() => resolve(i, false)}><X size={13} /> Discard</button>
                    </div>
                  ) : (
                    <p className={`text-[11.5px] ${m.proposal.status === "applied" ? "text-success" : "text-muted"}`}>{m.proposal.status === "applied" ? "Applied" : "Discarded"}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {issues && (
          <div className="card p-3 text-[12px] space-y-2 fade-in">
            <div className="flex items-center justify-between">
              <p className="panel-title">Design check</p>
              <span className="badge">{issues.score}/100</span>
            </div>
            {issues.issues.length === 0 ? (
              <p className="text-success">No issues found. Contrast, hierarchy and density all look good.</p>
            ) : (
              issues.issues.map((iss, i) => (
                <div key={i} className="border-t border-line pt-2">
                  <p className="font-medium flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${iss.severity === "error" ? "bg-danger" : iss.severity === "warning" ? "bg-[#c48a2c]" : "bg-muted"}`} />
                    {iss.title}
                  </p>
                  <p className="text-ink-2 mt-0.5">{iss.detail}</p>
                  {iss.operations.length > 0 && <button className="btn btn-secondary btn-sm mt-1.5" onClick={() => fixIssue(iss)}>Fix</button>}
                </div>
              ))
            )}
          </div>
        )}
        {busy && <div className="chat-bubble chat-ai inline-flex items-center gap-2"><Spinner /> Thinking…</div>}
        <div ref={endRef} />
      </div>

      <div className="border-t border-line p-3 space-y-2 shrink-0 bg-surface">
        {preview && <p className="text-[11.5px] text-ink-2 flex items-center gap-1.5"><Sparkles size={12} /> Previewing proposed changes on the canvas.</p>}
        <div className="flex flex-wrap gap-1.5">
          {SUGGESTIONS.slice(0, 4).map((s) => (
            <button key={s} className="badge hover:border-ink cursor-pointer" onClick={() => send(s)} disabled={busy || pending}>{s}</button>
          ))}
        </div>
        <form
          onSubmit={(e) => { e.preventDefault(); send(input); }}
          className="flex gap-2"
        >
          <textarea
            className="textarea !min-h-[44px] !py-2.5 !text-[13px]"
            rows={1}
            placeholder={pending ? "Apply or discard the pending change first" : "Describe a change… e.g. “make the hero more expensive”"}
            value={input}
            disabled={busy || pending}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
          />
          <button className="btn btn-primary" disabled={busy || pending || !input.trim()} type="submit"><ArrowRight size={15} /></button>
        </form>
        <button className="btn btn-ghost btn-sm w-full" onClick={check} disabled={busy}><ShieldCheck size={13} /> Check design (contrast, hierarchy, mobile)</button>
      </div>
    </div>
  );
}

function Val({ v, muted }: { v: unknown; muted?: boolean }) {
  const s = typeof v === "string" ? v : v === undefined || v === null ? "—" : JSON.stringify(v);
  const isColor = typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v);
  return (
    <span className={muted ? "text-muted line-through decoration-line-strong" : ""}>
      {isColor && <span className="inline-block w-2.5 h-2.5 rounded-sm border border-line align-middle mr-1" style={{ background: v as string }} />}
      {s.length > 26 ? s.slice(0, 26) + "…" : s}
    </span>
  );
}

function prettyPath(p: string) {
  return p.replace(/^theme\./, "").replace(/\.props\./, " · ").replace(/\.style\./, " · ").replace(/_/g, " ");
}

export type { DesignDocument };
