"use client";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { SiteRenderer } from "@/renderer/SiteRenderer";
import { Spinner } from "@/components/ui";
import { useRequireAuth } from "@/lib/auth";
import { api, type Project } from "@/lib/api";

export default function PreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useRequireAuth();
  const [project, setProject] = useState<Project | null>(null);
  useEffect(() => {
    if (user) api.projects.get(id).then(setProject);
  }, [id, user]);
  if (!project?.design) return <div className="h-screen grid place-items-center text-muted"><Spinner /></div>;
  return (
    <div>
      <div className="fixed top-3 left-3 z-50 flex items-center gap-2">
        <span className="badge bg-white/90">Preview</span>
        <Link href={`/app/projects/${id}/editor`} className="btn btn-primary btn-sm">Back to editor</Link>
      </div>
      <SiteRenderer doc={project.design} projectId={id} />
    </div>
  );
}
