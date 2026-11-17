import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { InvitationCanvas } from "@/components/platform/InvitationCanvas";
import { PublicRsvp } from "@/components/platform/PublicRsvp";
import { getPublicInvitation } from "@/lib/platform/service";

export const dynamic = "force-dynamic";

/** Share crawlers receive no event, owner or guest identity. Invitations remain
 * accessible by their published URL while search indexing is disabled. */
export const metadata: Metadata = {
  title: "Для вас · Taklif",
  description: "Для вас подготовлена персональная страница. Откройте её, чтобы узнать больше.",
  robots: { index: false, follow: false, noarchive: true },
  // Native RSVP POSTs need their Origin header for CSRF validation. Keep
  // invitation URLs private on external navigation while preserving local forms.
  referrer: "same-origin",
  openGraph: {
    title: "Для вас", description: "Для вас подготовлена персональная страница.", type: "website", locale: "ru_RU",
  },
  twitter: { card: "summary", title: "Для вас", description: "Для вас подготовлена персональная страница." },
};

export default async function PublicInvitationPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ rsvp?: string | string[] }> }) {
  const { slug } = await params;
  const invitation = await getPublicInvitation(slug);
  if (!invitation) notFound();
  const query = await searchParams;
  const nativeResult = query.rsvp === "saved" ? invitation.content.locale === "ru" ? "Спасибо! Ваш ответ сохранён." : "Rahmat! Javobingiz saqlandi." : query.rsvp === "error" ? invitation.content.locale === "ru" ? "Не удалось сохранить ответ. Проверьте поля и повторите отправку." : "Javob saqlanmadi. Maydonlarni tekshiring va qayta yuboring." : undefined;
  return <InvitationCanvas draft={invitation.content} slug={invitation.slug} initialNow={Date.now()}
    rsvp={<>{nativeResult && <p className="platform-rsvp-notice" role={query.rsvp === "error" ? "alert" : "status"}>{nativeResult}</p>}<PublicRsvp slug={invitation.slug} locale={invitation.content.locale} /></>} />;
}
