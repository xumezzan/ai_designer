import { cookies } from "next/headers";
import { StudioShell } from "@/components/studio/StudioShell";
import "./studio.css";
import "./photos.css";
import "@/app/photos.css";
import "./workspace.css";

export const metadata = { title: "Студия приглашений", robots: { index: false, follow: false } };
export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  const savedTheme = (await cookies()).get("studio-theme")?.value;
  return <StudioShell initialTheme={savedTheme === "dark" ? "dark" : "light"}>{children}</StudioShell>;
}
