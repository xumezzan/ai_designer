import type { Theme } from "@/lib/schema/theme";
import { getOrnament } from "@/registry/ornaments";

export function Ornament({ theme, placement }: { theme: Theme; placement: Theme["ornament"]["placement"][number] }) {
  if (!theme.ornament.placement.includes(placement) || theme.ornament.pack === "none") return null;
  const geometry = getOrnament(theme.ornament.pack).elements[placement];
  return <svg className={`ornament ornament-${placement}`} data-density={theme.ornament.density}
    viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="1" aria-hidden="true" focusable="false"
    dangerouslySetInnerHTML={{ __html: geometry }} />;
}
