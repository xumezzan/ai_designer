import Link from "next/link";
import "./studio.css";
import "./photos.css";
import "@/app/photos.css";

export const metadata = { title: "Студия приглашений", robots: { index: false, follow: false } };
export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return <div className="studio"><header className="studio-header"><Link href="/studio" className="studio-brand">Invitation<span>Studio</span></Link><nav aria-label="Студия"><Link href="/studio">Проекты</Link><Link href="/demo">Коллекция дизайнов ↗</Link></nav><span className="studio-private">Личная мастерская</span></header>{children}</div>;
}
