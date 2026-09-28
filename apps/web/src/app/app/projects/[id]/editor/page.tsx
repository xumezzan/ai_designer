"use client";
import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Editor } from "@/editor/Editor";
import { Spinner } from "@/components/ui";
import { useRequireAuth } from "@/lib/auth";
import { api, type Project } from "@/lib/api";

export default function EditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, loading } = useRequireAuth();
  const [project, setProject] = useState<Project | null>(null);
  const router = useRouter();
  useEffect(() => {
    if (!user) return;
    api.projects.get(id).then((p) => {
      if (!p.design) router.replace(`/app/new?project=${p.id}`);
      else setProject(p);
    });
  }, [id, user, router]);
  if (loading || !user || !project?.design) return <div className="h-screen grid place-items-center text-muted"><Spinner /></div>;
  return <Editor projectId={project.id} projectName={project.name} initialDoc={project.design} />;
}
