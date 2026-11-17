import { notFound } from "next/navigation";
import { ScrollNarrative } from "@/components/layouts/ScrollNarrative";
import { readInvitation } from "@/lib/projects/read";
import { compileDesignSpec } from "@/lib/design/spec";
import { editorialExamples } from "@/lib/design/fixtures";
import { DESIGN_HERO_COMPONENTS } from "@/lib/schema/designSpec";
import "@/app/invitation.css";
import "@/app/immersive.css";
import "@/app/reference-invitation.css";
import "@/app/artwork.css";
import "@/app/photos.css";
import "@/app/atelier.css";
import "@/app/physicality.css";
import "@/app/material-scenes.css";
import "@/app/organic-paper.css";
import "@/app/editorial-fonts.css";
import "@/app/editorial-invitation.css";

export const metadata = { title: "Editorial · пример композиции", robots: { index: false, follow: false } };
export default async function EditorialExample({ params }: { params: Promise<{ component: string }> }) {
  const { component } = await params;
  if (!DESIGN_HERO_COMPONENTS.includes(component as (typeof DESIGN_HERO_COMPONENTS)[number])) notFound();
  const demo = await readInvitation("demo", "letter", "2");
  if (!demo) notFound();
  const spec = editorialExamples[component as keyof typeof editorialExamples];
  const theme = compileDesignSpec(spec, demo.theme);
  return <ScrollNarrative content={demo.content} theme={theme} initialNow={Date.now()} embedded />;
}
