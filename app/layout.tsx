import type { Metadata } from "next";
import "./globals.css";
// Craft layer (SPEC §7.1): always on, never a theme field.
import "./craft.css";
import "./fonts.generated.css";

export const metadata: Metadata = {
  title: "Invitation Studio",
  description:
    "Внутренняя студия генерации приглашений: анкета, темы, предпросмотр, публикация.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
