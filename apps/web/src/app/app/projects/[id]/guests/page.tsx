"use client";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Download, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Empty, Spinner } from "@/components/ui";
import { api, publicUrlFor, type Project, type RsvpRow, type RsvpStats } from "@/lib/api";

export default function GuestsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <AppShell>
      <Guests id={id} />
    </AppShell>
  );
}

function Guests({ id }: { id: string }) {
  const [project, setProject] = useState<Project | null>(null);
  const [rows, setRows] = useState<RsvpRow[] | null>(null);
  const [stats, setStats] = useState<RsvpStats | null>(null);
  const [filter, setFilter] = useState<"all" | "yes" | "no">("all");
  const reload = async () => {
    const [p, r, s] = await Promise.all([api.projects.get(id), api.rsvp.list(id), api.rsvp.stats(id)]);
    setProject(p);
    setRows(r);
    setStats(s);
  };
  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const exportCsv = () => {
    if (!rows) return;
    const head = ["Name", "Guests", "Attending", "Dietary", "Message", "Email", "Date"];
    const body = rows.map((r) => [r.name, r.guests, r.attending ? "Yes" : "No", r.dietary ?? "", r.message ?? "", r.email ?? "", new Date(r.created_at).toISOString()]);
    const csv = [head, ...body].map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `${project?.name ?? "guests"}-rsvps.csv`;
    a.click();
  };

  const visible = (rows ?? []).filter((r) => (filter === "all" ? true : filter === "yes" ? r.attending : !r.attending));

  return (
    <div>
      <Link href="/app" className="text-[13px] text-ink-2 inline-flex items-center gap-1 mb-4"><ArrowLeft size={13} /> My events</Link>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <p className="eyebrow mb-2">Guests</p>
          <h1 className="display text-4xl">{project?.name ?? "…"}</h1>
          {project?.is_published && project.slug && <a href={publicUrlFor(project.slug)} target="_blank" className="text-[13px] text-ink-2 underline underline-offset-4" rel="noreferrer">{publicUrlFor(project.slug)}</a>}
        </div>
        <div className="flex gap-2">
          <Link href={`/app/projects/${id}/editor`} className="btn btn-secondary btn-sm">Open editor</Link>
          <button className="btn btn-secondary btn-sm" onClick={exportCsv} disabled={!rows?.length}><Download size={13} /> Export CSV</button>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[["Total guests", stats.total_guests], ["Confirmed", stats.confirmed], ["Declined", stats.declined], ["Responses", stats.total_responses]].map(([l, v]) => (
            <div key={l} className="card p-5">
              <p className="eyebrow">{l}</p>
              <p className="display text-4xl mt-2">{v}</p>
            </div>
          ))}
        </div>
      )}

      {!rows ? (
        <div className="py-20 grid place-items-center"><Spinner /></div>
      ) : rows.length === 0 ? (
        <Empty title="No RSVPs yet" body={project?.is_published ? "Share your link or QR code — responses will appear here." : "Publish your site to start collecting RSVPs."} />
      ) : (
        <div className="card overflow-hidden">
          <div className="flex items-center gap-2 p-3 border-b border-line">
            <div className="seg">
              {(["all", "yes", "no"] as const).map((f) => (
                <button key={f} className={filter === f ? "active" : ""} onClick={() => setFilter(f)}>{f === "all" ? "All" : f === "yes" ? "Attending" : "Declined"}</button>
              ))}
            </div>
            <span className="text-muted text-[12.5px] ml-auto">{visible.length} of {rows.length}</span>
          </div>
          <table className="w-full text-[13px]">
            <thead className="text-left text-muted text-[11.5px] uppercase tracking-wider">
              <tr className="border-b border-line">
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">Attendance</th>
                <th className="px-4 py-2.5 font-medium">Guests</th>
                <th className="px-4 py-2.5 font-medium">Dietary</th>
                <th className="px-4 py-2.5 font-medium">Message</th>
                <th className="px-4 py-2.5 font-medium">Received</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.id} className="border-b border-line last:border-0 hover:bg-surface-2/60">
                  <td className="px-4 py-3 font-medium">{r.name}{r.email && <span className="block text-muted text-[12px] font-normal">{r.email}</span>}</td>
                  <td className="px-4 py-3">{r.attending ? <span className="badge badge-dot badge-live">Accepted</span> : <span className="badge">Declined</span>}</td>
                  <td className="px-4 py-3">{r.guests}</td>
                  <td className="px-4 py-3 text-ink-2">{r.dietary || "—"}</td>
                  <td className="px-4 py-3 text-ink-2 max-w-xs truncate" title={r.message ?? ""}>{r.message || "—"}</td>
                  <td className="px-4 py-3 text-muted">{new Date(r.created_at).toLocaleDateString()}</td>
                  <td className="px-2 py-3"><button className="btn btn-ghost btn-icon text-danger" onClick={async () => { await api.rsvp.remove(id, r.id); reload(); }}><Trash2 size={13} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
