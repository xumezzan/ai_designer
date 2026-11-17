import { notFound } from "next/navigation";
import { ScrollNarrative } from "@/components/layouts/ScrollNarrative";
import { readInvitation } from "@/lib/projects/read";
import { studioTemplates, studioTemplateTheme } from "@/registry/studioTemplates";
import { templateExampleContent } from "@/lib/templates/examples";
import { populatedSections } from "@/lib/invitation/sections";
import "@/app/invitation.css";
import "@/app/photos.css";
import "@/app/atelier.css";
import "@/app/physicality.css";

export const metadata = { title: "Шаблон приглашения · Invitation Studio", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default async function TemplateExample({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ palette?: string; embed?: string }> }) {
  const { id } = await params;
  const { palette } = await searchParams;
  const template = studioTemplates.find((item) => item.id === id);
  if (!template || (palette && !template.paletteIds.some((item) => item === palette))) notFound();
  const demo = await readInvitation("demo", "letter", "1");
  if (!demo) notFound();
  const content = templateExampleContent(demo.content, template.id);
  const theme = studioTemplateTheme({ templateId: template.id, paletteId: (palette as typeof template.defaultPaletteId) ?? template.defaultPaletteId, fontPairId: template.defaultFontPairId, ornamentSetId: template.ornamentSetId });
  theme.layout.sectionOrder = populatedSections(content);
  return <ScrollNarrative content={content} theme={theme} initialNow={Date.now()} embedded />;
}
