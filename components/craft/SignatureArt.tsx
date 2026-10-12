import { useId } from "react";
import type { Content } from "@/lib/schema/content";

export const SIGNATURE_COMPOSITIONS = ["duet", "ribbon", "imprint"] as const;
export type SignatureComposition = (typeof SIGNATURE_COMPOSITIONS)[number];
export function isSignatureComposition(value: string): value is SignatureComposition {
  return (SIGNATURE_COMPOSITIONS as readonly string[]).includes(value);
}

/** Personal geometry is stable across SSR/hydration and changes with the event. */
export function signatureGeometry(content: Pick<Content, "hosts" | "date">) {
  const key = JSON.stringify([content.hosts.map(({ name }) => name.trim().normalize("NFC")), content.date.start]);
  let seed = 2166136261;
  for (const character of key) seed = Math.imul(seed ^ character.codePointAt(0)!, 16777619) >>> 0;
  return { shift: seed % 29 - 14, tilt: seed % 13 - 6, contour: 12 + seed % 9, seed };
}

export function SignatureArt({ content, composition }: { content: Content; composition: SignatureComposition }) {
  const id = useId().replaceAll(":", "");
  const { shift, tilt, contour } = signatureGeometry(content);
  const initials = content.hosts.map(({ name }) => Array.from(name.trim())[0] || "").slice(0, 2);
  return <div className="signature-art" data-art={composition} aria-hidden="true">
    <svg viewBox="0 0 600 600" fill="none" focusable="false">
      <defs>
        <linearGradient id={`${id}-pigment`} x1="120" y1="20" x2="510" y2="560" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--accent-alt)" /><stop offset=".28" stopColor="var(--accent)" /><stop offset=".65" stopColor="var(--accent)" /><stop offset="1" stopColor="var(--ink)" />
        </linearGradient>
        <linearGradient id={`${id}-silk`} x1="60" y1="60" x2="470" y2="510" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--ink)" /><stop offset=".19" stopColor="var(--accent)" /><stop offset=".4" stopColor="var(--accent-alt)" /><stop offset=".53" stopColor="var(--surface)" /><stop offset=".63" stopColor="var(--accent-alt)" /><stop offset=".87" stopColor="var(--accent)" /><stop offset="1" stopColor="var(--ink)" />
        </linearGradient>
        <filter id={`${id}-shadow`} x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="7" dy="22" stdDeviation="13" floodColor="var(--ink)" floodOpacity=".16" /></filter>
      </defs>
      {composition === "duet" && <g transform={`rotate(${tilt} 300 300)`}>
        <g filter={`url(#${id}-shadow)`}>
          <path fill={`url(#${id}-pigment)`} fillRule="evenodd" d={`M${252 + shift} 34C100 12 22 141 46 280C71 430 203 571 348 559C493 547 569 415 537 271C510 146 406 57 ${252 + shift} 34ZM269 165C197 149 162 207 180 275C200 351 249 412 321 427C386 440 426 374 410 314C392 242 347 182 269 165Z`} />
          <path fill="var(--bg)" fillOpacity=".18" d="M76 216C93 117 154 65 243 64C154 94 116 154 110 238C116 345 163 429 230 469C136 433 72 334 76 216Z" />
        </g>
        {Array.from({ length: contour }, (_, i) => <path key={i} d={`M${35 + i * 7} ${386 + shift}C${114 + i * 5} ${505 - i * 2} ${226 + i * 4} ${561 - i * 5} ${411 + i * 3} ${502 - i * 5}`} stroke="var(--ink)" strokeOpacity=".28" strokeWidth=".8" />)}
        <path d="M113 71L489 539M42 300H558" stroke="var(--accent)" strokeOpacity=".3" strokeWidth=".8" />
      </g>}
      {composition === "ribbon" && <g transform={`rotate(${tilt - 8} 300 300)`} filter={`url(#${id}-shadow)`}>
        <path d={`M62 ${410 + shift}C110 476 195 467 256 373C328 261 202 39 131 130C76 202 384 505 469 400C556 293 282 66 240 185C216 253 314 333 382 270C433 223 473 173 548 174`} stroke={`url(#${id}-silk)`} strokeWidth="66" strokeLinecap="butt" />
        <path d={`M63 ${405 + shift}C111 471 193 461 252 368C324 258 201 44 136 132C87 201 383 494 465 394C549 291 281 72 245 187C224 250 312 324 378 264C430 218 473 168 548 169`} stroke="var(--surface)" strokeOpacity=".55" strokeWidth="1.3" />
        {Array.from({ length: 7 }, (_, i) => <path key={i} d={`M${69 + i * 2} ${422 + shift + i * 3}C124 ${478 + i * 3} 196 ${468 + i * 3} 264 ${377 + i * 3}C328 ${266 + i * 3} 219 ${48 + i * 3} 145 ${132 + i * 3}`} stroke="var(--ink)" strokeOpacity=".12" strokeWidth=".6" />)}
      </g>}
      {composition === "imprint" && <g transform={`rotate(${tilt / 2} 300 300)`}>
        <path d={`M${154 + shift} 37H440V115H522V445H440V523H111V442H35V${158 - shift}H111V37Z`} fill="var(--surface)" stroke="var(--accent)" strokeWidth="1" />
        <path d="M129 58H421V135H501V426H420V502H131V421H56V178H131V58Z" stroke="var(--accent)" strokeOpacity=".5" strokeWidth=".8" />
        <path d="M128 65H420V140H495M57 417H134V495H417" stroke="var(--bg)" strokeOpacity=".8" strokeWidth="2" />
        <text x="255" y="374" textAnchor="middle" fill="var(--accent)" fontFamily="var(--font-display)" fontSize="268" letterSpacing="-24">{initials[0]}</text>
        <text x="383" y="397" textAnchor="middle" stroke="var(--accent)" strokeWidth="1.3" fill="var(--surface)" fontFamily="var(--font-display)" fontSize="268" letterSpacing="-24">{initials[1] || initials[0]}</text>
        <path d={`M98 277C177 ${205 + shift} 409 ${421 - shift} 484 333`} stroke="var(--accent)" strokeWidth="1" />
        <circle cx="79" cy="150" r="3" fill="var(--accent)" /><circle cx="461" cy="472" r="3" fill="var(--accent)" />
      </g>}
    </svg>
  </div>;
}
