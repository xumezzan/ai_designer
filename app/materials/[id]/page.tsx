import { readFile } from "node:fs/promises";
import path from "node:path";
import { notFound } from "next/navigation";
import { Content } from "@/lib/schema/content";
import { exampleTheme } from "@/lib/materials/examples";
import { validateTheme } from "@/lib/theme/validate";
import { ScrollNarrative } from "@/components/layouts/ScrollNarrative";
import "@/app/invitation.css";
import "@/app/artwork.css";
import "@/app/photos.css";
import "@/app/atelier.css";
import "@/app/physicality.css";
import "@/app/material-scenes.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Материалы · пример приглашения", robots: { index: false, follow: false } };
export default async function MaterialExample({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ embed?: string }> }) {
  const content = Content.parse(JSON.parse(await readFile(path.join(process.cwd(), "projects/demo/content.json"), "utf8")));
  const theme = exampleTheme((await params).id, content);
  if (!theme) notFound();
  const checked = validateTheme(theme, { locale: content.locale });
  if (!checked.ok) throw new Error(checked.errors.join("; "));
  return <ScrollNarrative content={content} theme={checked.theme} initialNow={Date.now()} embedded={(await searchParams).embed === "1"} />;
}
