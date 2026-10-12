import { ProjectEditor } from "@/components/studio/ProjectEditor";

export const dynamic = "force-dynamic";
export default function NewProject() { return <ProjectEditor imagesConfigured={Boolean(process.env.OPENAI_API_KEY?.trim())} visionConfigured={Boolean(process.env.ANTHROPIC_API_KEY)} />; }
