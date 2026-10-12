import { expect, test, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { QualityReport } from "./QualityReport";
import { CHECK_IDS, QA_ENGINE, QaReport } from "@/lib/schema/qa";

test("QA timestamps produce identical hydration HTML in different server/browser timezones", () => {
  const report = QaReport.parse({
    runId: "72b0b3f7-f7ec-430d-a8bf-d84c43c67b88", slug: "test", conceptId: "letter", version: "1",
    createdAt: "2026-10-10T07:00:00.000Z", engine: QA_ENGINE,
    contentRevision: "a".repeat(64), planRevision: "b".repeat(64), themeRevision: "c".repeat(64), rendererRevision: "d".repeat(64),
    viewports: [390, 1024, 1440], checks: CHECK_IDS.map((id) => ({ id, status: "pass", samples: 1, findings: [] })), visionModel: "test", evidence: [],
  });
  const render = () => renderToStaticMarkup(<QualityReport qa={{ report, stale: false }} pendingEdits={false} checking={false} elapsed={0} disabled={false} onCheck={() => {}} />);
  try {
    vi.stubEnv("TZ", "UTC"); const server = render();
    vi.stubEnv("TZ", "Asia/Tashkent"); const browser = render();
    expect(browser).toBe(server);
    expect(browser).toContain("07:00:00 UTC");
  } finally { vi.unstubAllEnvs(); }
});
