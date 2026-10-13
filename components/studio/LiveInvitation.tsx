"use client";

import { useEffect, useRef, useState, type ComponentProps } from "react";
import { Content } from "@/lib/schema/content";
import { canvasContent, editCanvasText } from "@/lib/studio/live";
import { ScrollNarrative } from "@/components/layouts/ScrollNarrative";

type Props = ComponentProps<typeof ScrollNarrative>;
export function LiveInvitation(props: Props) {
  const [content, setContent] = useState(props.content);
  const current = useRef(props.content);
  const editing = useRef<HTMLElement | null>(null);
  const locked = useRef(false);
  const pending = useRef<Content | null>(null);
  useEffect(() => {
    const send = (message: object) => window.parent.postMessage({ channel: "invitation-studio", ...message }, window.location.origin);
    const receive = (event: MessageEvent) => {
      if (event.origin !== location.origin || event.source !== window.parent || event.data?.channel !== "invitation-studio" || event.data.type !== "content") return;
      locked.current = Boolean(event.data.locked);
      if (locked.current && editing.current) { editing.current.contentEditable = "false"; editing.current = null; }
      const parsed = Content.safeParse(event.data.content);
      if (!parsed.success || parsed.data.slug !== props.content.slug) return;
      current.current = parsed.data;
      if (editing.current) pending.current = parsed.data;
      else setContent(parsed.data);
    };
    const input = (event: Event) => {
      if (locked.current) return;
      const element = (event.target as HTMLElement).closest<HTMLElement>("[data-studio-field]");
      if (!element || element !== editing.current) return;
      const field = element.dataset.studioField!;
      const text = element.innerText.replace(/\u00a0/g, " ");
      const next = editCanvasText(current.current, field, text);
      if (next) { current.current = next; send({ type: "edit", field, text }); }
    };
    const finish = () => {
      if (!editing.current) return;
      editing.current.contentEditable = "false";
      editing.current = null;
      setContent(pending.current ?? current.current);
      pending.current = null;
    };
    const click = (event: MouseEvent) => {
      if (locked.current) { event.preventDefault(); return; }
      const target = event.target as HTMLElement;
      const field = target.closest<HTMLElement>("[data-studio-field]");
      const section = target.closest<HTMLElement>("[data-studio-section], [data-section]");
      if (field) {
        if (editing.current !== field) {
          finish();
          editing.current = field;
          field.contentEditable = "plaintext-only";
          field.spellcheck = true;
          field.focus();
          send({ type: "select", field: field.dataset.studioField });
        }
        return;
      }
      if (target.closest("a, button, summary, input, form")) event.preventDefault();
      finish();
      if (section) send({ type: "select", field: section.dataset.studioSection ?? section.dataset.section });
    };
    const paste = (event: ClipboardEvent) => {
      if (!editing.current) return;
      event.preventDefault();
      const text = event.clipboardData?.getData("text/plain") ?? "";
      document.execCommand("insertText", false, text);
    };
    const blur = (event: FocusEvent) => { if (event.target === editing.current) finish(); };
    const key = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && ["z", "y"].includes(event.key.toLowerCase())) {
        event.preventDefault(); finish(); send({ type: "history", redo: event.key.toLowerCase() === "y" || event.shiftKey });
      }
      if (event.key === "Escape") { editing.current?.blur(); finish(); }
    };
    window.addEventListener("message", receive);
    document.addEventListener("click", click, true);
    document.addEventListener("input", input);
    document.addEventListener("paste", paste);
    document.addEventListener("focusout", blur);
    document.addEventListener("keydown", key);
    send({ type: "ready" });
    return () => {
      window.removeEventListener("message", receive);
      document.removeEventListener("click", click, true);
      document.removeEventListener("input", input);
      document.removeEventListener("paste", paste);
      document.removeEventListener("focusout", blur);
      document.removeEventListener("keydown", key);
    };
  }, [props.content.slug]);
  return <><style>{`
    [data-studio-field], [data-studio-section] { cursor: text; min-width: 1ch; }
    [data-studio-field]:hover, [data-studio-section]:hover { outline: 1px dashed #8b6df0; outline-offset: 5px; }
    [contenteditable="plaintext-only"] { outline: 2px solid #8b6df0; outline-offset: 5px; border-radius: 2px; }
    .invitation { overflow-wrap: anywhere; }
  `}</style><ScrollNarrative {...props} content={canvasContent(content)} embedded /></>;
}
