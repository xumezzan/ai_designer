"use client";

import { useEffect, useState } from "react";
import { InvitationCanvas } from "@/components/platform/InvitationCanvas";
import {
  InvitationDraftSchema,
  type InvitationDraft,
} from "@/lib/platform/schema";
import { platformContent } from "@/lib/platform-render/content";

/** Draft facts arrive only through the editor's parent window. No project ID,
 * session, draft fetch or owner record is exposed by this preview surface. */
export function PlatformLivePreview() {
  const [draft, setDraft] = useState<InvitationDraft | null>(null);
  const [error, setError] = useState("");
  const [initialNow] = useState(() => Date.now());
  useEffect(() => {
    function receive(event: MessageEvent) {
      if (
        window.parent === window ||
        event.origin !== window.location.origin ||
        event.source !== window.parent ||
        event.data?.type !== "platform-preview"
      )
        return;
      const result = InvitationDraftSchema.safeParse(event.data.invitation);
      if (!result.success) {
        setError("Заполните обязательные поля, чтобы обновить предпросмотр.");
        return;
      }
      try {
        // Resolve the wall-clock date before rendering; a DST gap or an
        // unfinished date must not crash the iframe or invent another time.
        platformContent(result.data);
        setDraft(result.data);
        setError("");
      } catch (failure) {
        setError(
          failure instanceof Error
            ? failure.message
            : "Проверьте дату мероприятия.",
        );
      }
    }
    window.addEventListener("message", receive);
    if (window.parent !== window)
      window.parent.postMessage(
        { type: "platform-preview-ready" },
        window.location.origin,
      );
    return () => window.removeEventListener("message", receive);
  }, []);

  if (!draft)
    return (
      <main className="platform-preview-empty">
        <p role="status">
          {error ||
            "Предпросмотр появится после заполнения приглашения в редакторе."}
        </p>
      </main>
    );
  return (
    <>
      {error && (
        <p className="platform-preview-error" role="status">
          {error}
        </p>
      )}
      <InvitationCanvas draft={draft} embedded initialNow={initialNow} />
    </>
  );
}
