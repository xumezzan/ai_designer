import Link from "next/link";
import { editorialExamples } from "@/lib/design/fixtures";

export const metadata = { title: "Editorial · примеры композиций", robots: { index: false, follow: false } };
export default function EditorialExamples() {
  return <main style={{ maxWidth: 780, margin: "0 auto", padding: "72px 24px", color: "#2C2A29", background: "#F5F2EB", minHeight: "100dvh" }}>
    <p style={{ fontSize: 12, letterSpacing: ".2em", textTransform: "uppercase" }}>Editorial / Organic Paper</p>
    <h1 style={{ fontFamily: "Georgia, serif", fontSize: "clamp(36px, 7vw, 64px)", fontWeight: 400, margin: "24px 0" }}>Пять характеров приглашения</h1>
    <p style={{ lineHeight: 1.7, marginBottom: 36 }}>Примеры композиций на одном вымышленном событии.</p>
    <nav aria-label="Примеры приглашений">{Object.entries(editorialExamples).map(([id, spec]) => <Link key={id} href={`/editorial/${id}`} style={{ display: "flex", gap: 16, justifyContent: "space-between", padding: "24px 0", borderTop: "1px solid #C5A880", color: "inherit", textDecoration: "none" }}><span>{spec.design_title}</span><span aria-hidden="true">↗</span></Link>)}</nav>
  </main>;
}
