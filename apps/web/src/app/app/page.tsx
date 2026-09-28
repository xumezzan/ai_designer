"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Copy, ExternalLink, MoreHorizontal, Pencil, Plus, Trash2, Users } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { SiteThumbnail } from "@/components/SiteThumbnail";
import { Empty, Spinner, eventLabel, formatDate } from "@/components/ui";
import { api, publicUrlFor, type Project } from "@/lib/api";

export default function Dashboard() {
  return (
    <AppShell>
      <ProjectList />
    </AppShell>
  );
}

function ProjectList() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const router = useRouter();
  const reload = () => api.projects.list().then(setProjects);
  useEffect(() => {
    reload();
  }, []);

  const duplicate = async (p: Project) => {
    await api.projects.duplicate(p.id);
    reload();
  };
  const remove = async (p: Project) => {
    if (!confirm(`Delete “${p.name}”? This cannot be undone.`)) return;
    await api.projects.remove(p.id);
    reload();
  };

  return (
    <div>
      <div className="flex items-end justify-between mb-8">
        <div>
          <p className="eyebrow mb-2">Dashboard</p>
          <h1 className="display text-4xl">My events</h1>
        </div>
        <Link href="/app/new" className="btn btn-primary"><Plus size={15} /> Create event</Link>
      </div>

      {!projects ? (
        <div className="py-20 grid place-items-center text-muted"><Spinner /></div>
      ) : projects.length === 0 ? (
        <Empty
          title="No events yet"
          body="Start with a short brief and a few references. The AI will propose three design directions."
          action={<Link href="/app/new" className="btn btn-primary">Create your first event</Link>}
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((p) => (
            <div key={p.id} className="card card-hover overflow-hidden flex flex-col">
              <button className="text-left" onClick={() => router.push(p.design ? `/app/projects/${p.id}/editor` : `/app/new?project=${p.id}`)}>
                {p.design ? (
                  <SiteThumbnail doc={p.design} width={1280} />
                ) : (
                  <div className="aspect-[4/3] bg-surface-2 grid place-items-center text-muted text-[13px]">Brief in progress</div>
                )}
              </button>
              <div className="p-4 flex-1 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-muted">{eventLabel(p.event_type)}</p>
                    <p className="font-medium truncate">{p.name}</p>
                  </div>
                  {p.is_published ? (
                    <span className="badge badge-dot badge-live">Published</span>
                  ) : (
                    <span className="badge">{p.design ? "Draft" : "Brief"}</span>
                  )}
                </div>
                <div className="flex items-center justify-between text-xs text-muted">
                  <span>{p.event_date ? formatDate(p.event_date) : "No date yet"}</span>
                  <span>{p.rsvp_count} RSVP{p.rsvp_count === 1 ? "" : "s"}</span>
                </div>
                <div className="flex items-center gap-1 pt-1 border-t border-line -mx-1">
                  <Link href={p.design ? `/app/projects/${p.id}/editor` : `/app/new?project=${p.id}`} className="btn btn-ghost btn-sm"><Pencil size={13} /> Edit</Link>
                  {p.design && !p.is_published && <Link href={`/app/projects/${p.id}/preview`} className="btn btn-ghost btn-sm"><ExternalLink size={13} /> Preview</Link>}
                  {p.is_published && p.slug && <a href={publicUrlFor(p.slug)} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm"><ExternalLink size={13} /> Open site</a>}
                  <Link href={`/app/projects/${p.id}/guests`} className="btn btn-ghost btn-sm"><Users size={13} /> Guests</Link>
                  <Menu onDuplicate={() => duplicate(p)} onDelete={() => remove(p)} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Menu({ onDuplicate, onDelete }: { onDuplicate: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative ml-auto">
      <button className="btn btn-ghost btn-icon" onClick={() => setOpen((o) => !o)} aria-label="More"><MoreHorizontal size={15} /></button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 bottom-full mb-1 z-20 card shadow-lg p-1 w-40 fade-in">
            <button className="btn btn-ghost btn-sm w-full justify-start" onClick={() => { setOpen(false); onDuplicate(); }}><Copy size={13} /> Duplicate</button>
            <button className="btn btn-danger btn-sm w-full justify-start" onClick={() => { setOpen(false); onDelete(); }}><Trash2 size={13} /> Delete</button>
          </div>
        </>
      )}
    </div>
  );
}
