"use client";
import { useEffect, useState } from "react";
import { Check, Copy, ExternalLink, Globe } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { Field, Modal, Spinner } from "@/components/ui";
import { api, type Publication } from "@/lib/api";
import { useEditor } from "../store";

export function PublishModal({ open, onClose, projectId }: { open: boolean; onClose: () => void; projectId: string }) {
  const { save, projectName, dirty } = useEditor();
  const [pub, setPub] = useState<Publication | null>(null);
  const [slug, setSlug] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    api.publish.get(projectId).then((p) => {
      setPub(p);
      setSlug(p?.slug ?? projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""));
    });
  }, [open, projectId, projectName]);

  const publicUrl = pub ? `${typeof window !== "undefined" ? window.location.origin : ""}/e/${pub.slug}` : "";

  const publish = async () => {
    setBusy(true);
    setError(null);
    try {
      if (dirty) await save();
      const p = await api.publish.publish(projectId, { slug: slug || undefined, password: password || null });
      setPub(p);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const unpublish = async () => {
    setBusy(true);
    try {
      setPub(await api.publish.unpublish(projectId));
    } finally {
      setBusy(false);
    }
  };
  const copy = async () => {
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  const downloadQr = () => {
    const c = document.getElementById("invito-qr") as HTMLCanvasElement | null;
    if (!c) return;
    const a = document.createElement("a");
    a.href = c.toDataURL("image/png");
    a.download = `${pub?.slug}-qr.png`;
    a.click();
  };

  return (
    <Modal open={open} onClose={onClose} title="Publish" width={560}>
      {pub?.is_live ? (
        <div className="space-y-5">
          <div className="flex items-center gap-2 text-success text-[13px]"><span className="badge badge-dot badge-live">Live</span> Your event website is published{dirty ? " — publish again to push your latest edits." : "."}</div>
          <div className="flex gap-2">
            <input className="input font-mono !text-[12.5px]" readOnly value={publicUrl} />
            <button className="btn btn-secondary" onClick={copy}>{copied ? <Check size={14} /> : <Copy size={14} />}</button>
            <a className="btn btn-secondary" href={publicUrl} target="_blank" rel="noreferrer"><ExternalLink size={14} /></a>
          </div>
          <div className="grid grid-cols-[auto_1fr] gap-5 items-center">
            <div className="p-3 bg-white border border-line rounded-lg">
              <QRCodeCanvas id="invito-qr" value={publicUrl} size={140} level="M" fgColor="#1b1a17" />
            </div>
            <div className="text-[13px] text-ink-2 space-y-2">
              <p>Print this QR code on paper invitations or share it in chats. Guests open the site straight from their phone camera.</p>
              <button className="btn btn-secondary btn-sm" onClick={downloadQr}>Download QR (PNG)</button>
              <p className="text-muted text-[12px]">{pub.views} view{pub.views === 1 ? "" : "s"} · published {new Date(pub.published_at).toLocaleString()}</p>
            </div>
          </div>
          <details className="text-[13px]">
            <summary className="cursor-pointer text-ink-2">Change address or password</summary>
            <div className="grid sm:grid-cols-2 gap-3 mt-3">
              <Field label="Address"><div className="flex items-center gap-1"><span className="text-muted text-[12px]">/e/</span><input className="input" value={slug} onChange={(e) => setSlug(e.target.value)} /></div></Field>
              <Field label="Password (optional)"><input className="input" placeholder={pub.has_password ? "•••••• (set)" : "None"} value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
            </div>
          </details>
          {error && <p className="text-danger text-[13px]">{error}</p>}
          <div className="flex items-center justify-between pt-2 border-t border-line">
            <button className="btn btn-danger btn-sm" onClick={unpublish} disabled={busy}>Unpublish</button>
            <button className="btn btn-primary" onClick={publish} disabled={busy}>{busy && <Spinner />} Publish latest version</button>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <p className="text-[13.5px] text-ink-2">Publishing creates a public URL and a QR code. You can update or unpublish at any time. Custom domains are coming next.</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Address" hint="Letters, numbers and dashes.">
              <div className="flex items-center gap-1"><span className="text-muted text-[12px]">/e/</span><input className="input" value={slug} onChange={(e) => setSlug(e.target.value)} /></div>
            </Field>
            <Field label="Password (optional)" hint="Guests will be asked for it.">
              <input className="input" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="None" />
            </Field>
          </div>
          {error && <p className="text-danger text-[13px]">{error}</p>}
          <div className="flex justify-end gap-2">
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={publish} disabled={busy}>{busy ? <Spinner /> : <Globe size={14} />} Publish</button>
          </div>
        </div>
      )}
    </Modal>
  );
}
