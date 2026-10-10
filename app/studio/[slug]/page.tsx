import { notFound } from "next/navigation";
import { projectStore, StudioError } from "@/lib/studio/store";
import { ProjectEditor } from "@/components/studio/ProjectEditor";

export const dynamic = "force-dynamic";
export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try { return <ProjectEditor initial={await projectStore.read(slug)} />; }
  catch (error) {
    if (error instanceof StudioError && [400, 404].includes(error.status)) notFound();
    throw error;
  }
}
