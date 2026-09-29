import type { Metadata } from "next";
import "./globals.css";
// Craft layer (SPEC §7.1): always on, never a theme field.
import "./craft.css";

export const metadata: Metadata = {
  title: "Invitation Studio",
  description:
    "Внутренняя студия генерации приглашений: анкета, темы, предпросмотр, публикация.",
};

/**
 * Marks the document as scripted before first paint. The craft layer hides a
 * block waiting for its reveal only under `html[data-craft="js"]`, so without
 * JS the content is simply there — see app/craft.css.
 */
const CRAFT_FLAG =
  "document.documentElement.dataset.craft='js'";

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <head>
        <script dangerouslySetInnerHTML={{ __html: CRAFT_FLAG }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
