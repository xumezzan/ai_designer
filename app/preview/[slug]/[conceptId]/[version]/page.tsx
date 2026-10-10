import Link from "next/link";
import { notFound } from "next/navigation";
import { readInvitation, demoConcepts } from "@/lib/projects/read";
import { ScrollNarrative } from "@/components/layouts/ScrollNarrative";
import "@/app/invitation.css";
import "@/app/artwork.css";
import "@/app/photos.css";
import "@/app/atelier.css";
import "@/app/physicality.css";
import { guestName } from "@/lib/invitation/guest";
import "@/app/demo/demo.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Приглашение · предпросмотр", robots: { index: false, follow: false } };

export default async function Preview({ params, searchParams }: { params: Promise<{ slug: string; conceptId: string; version: string }>; searchParams: Promise<{ embed?: string; to?: string | string[]; guest?: string | string[] }> }) {
  const { slug, conceptId, version } = await params;
  const invitation = await readInvitation(slug, conceptId, version);
  if (!invitation) notFound();
  const { content, theme } = invitation;
  if (theme.layout.preset !== "scroll-narrative") throw new Error("Layout is not available");
  const query = await searchParams;
  const embedded = query.embed === "1";
  const guest = guestName(query.to) || guestName(query.guest);
  const demos = slug === "demo" && !embedded ? await demoConcepts() : [];
  return <>
    {demos.length > 0 && <header className="demo-toolbar"><Link href="/demo">← Все темы</Link>
      <nav aria-label="Демо-темы">{demos.map((demo) => <Link key={demo.id} href={`/preview/demo/${demo.id}/${demo.version}`} aria-current={demo.id === conceptId ? "page" : undefined}>{demo.theme.meta.name}</Link>)}</nav>
      <span>Демо · данные вымышлены</span>
    </header>}
    <ScrollNarrative content={content} theme={theme} photos={invitation.photos} generatedVisual={invitation.generatedVisual} initialNow={Date.now()} guest={guest} embedded={embedded} />
  </>;
}
