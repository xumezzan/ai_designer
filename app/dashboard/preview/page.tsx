import type { Metadata } from "next";
import { PlatformLivePreview } from "./PlatformLivePreview";
import { InvitationCanvas } from "@/components/platform/InvitationCanvas";
import { TEMPLATE_IDS, type TemplateId } from "@/lib/platform/schema";
import { createPlatformDemo } from "@/lib/platform-render/demo";

export const metadata: Metadata = {
  title: "Предпросмотр приглашения",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function PreviewPage({
  searchParams,
}: {
  searchParams: Promise<{
    template?: string | string[];
    locale?: string | string[];
    entrance?: string | string[];
  }>;
}) {
  const query = await searchParams;
  if (
    typeof query.template === "string" &&
    TEMPLATE_IDS.includes(query.template as TemplateId)
  ) {
    const locale = query.locale === "uz-latn" ? "uz-latn" : "ru";
    return (
      <>
        <p className="platform-preview-demo">
          {locale === "ru"
            ? "Демонстрация · все данные вымышлены"
            : "Namuna · barcha maʼlumotlar to‘qima"}
        </p>
        <InvitationCanvas
          draft={createPlatformDemo(query.template as TemplateId, locale)}
          embedded={query.entrance !== "1"}
          initialNow={Date.now()}
        />
      </>
    );
  }
  return <PlatformLivePreview />;
}
