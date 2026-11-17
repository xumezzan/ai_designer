/** Treat guest-supplied names and notes as text when opened in a spreadsheet. */
export function csvCell(value: unknown): string {
  let text = String(value ?? "");
  if (/^\s*[=+@-]/u.test(text) || /^[\t\r\n]/u.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
