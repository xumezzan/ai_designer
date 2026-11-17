import Image from "next/image";
import type { CSSProperties } from "react";
import type { DirectedAsset } from "@/lib/assets/crop";
import type { Content } from "@/lib/schema/content";
import type { DesignSpec } from "@/lib/schema/designSpec";
import type { VisualSource } from "@/components/primitives/GeneratedVisual";
import { DirectedImage } from "@/components/primitives/DirectedImage";

type Treatment = DesignSpec["composition_rules"]["photo_treatment"];
type Mask = Treatment["mask_type"];

/** Corners of the protected region must fit inside the silhouette. Cropping
 * remains owned by the asset director; a mount cannot cut faces or hands. */
export function safeEditorialMask(photo: DirectedAsset, requested: Mask): Mask {
  if (requested === "rectangular_passepartout") return requested;
  const { safeArea: safe } = photo.asset;
  const { crop } = photo;
  const corners = [
    [(safe.x - crop.x) / crop.w, (safe.y - crop.y) / crop.h],
    [(safe.x + safe.w - crop.x) / crop.w, (safe.y - crop.y) / crop.h],
    [(safe.x - crop.x) / crop.w, (safe.y + safe.h - crop.y) / crop.h],
    [(safe.x + safe.w - crop.x) / crop.w, (safe.y + safe.h - crop.y) / crop.h],
  ];
  const fits = corners.every(([x, y]) => {
    if (x < .025 || x > .975 || y < .025 || y > .975) return false;
    if (requested === "oval_portrait") return ((x - .5) / .475) ** 2 + ((y - .5) / .475) ** 2 <= 1;
    if (requested === "soft_arch") return y >= .42 || ((x - .5) / .475) ** 2 + ((y - .42) / .395) ** 2 <= 1;
    // Organic radii are deliberately conservative around protected content.
    return x >= .22 && x <= .78 && y >= .22 && y <= .78;
  });
  return fits ? requested : "rectangular_passepartout";
}

export function EditorialMedia({ photo, source, treatment, locale, eager = false, children, className = "" }: {
  photo?: DirectedAsset; source?: VisualSource; treatment: Treatment; locale: Content["locale"]; eager?: boolean; children?: React.ReactNode; className?: string;
}) {
  const effective = photo ? safeEditorialMask(photo, treatment.mask_type) : treatment.mask_type;
  const blend = treatment.overlay_blend === "soft_light" ? "soft-light" : treatment.overlay_blend;
  return <div className={`editorial-media ${className}`} data-media-mask={treatment.mask_type} data-effective-mask={effective} data-protected-fallback={effective !== treatment.mask_type || undefined} data-media-source={photo ? "photo" : source ? "generated" : "native"} data-overlay-blend={blend} style={{ "--media-tint": treatment.overlay_tint || "transparent" } as CSSProperties}>
    <div className="editorial-media-window">
      {photo ? <DirectedImage photo={photo} locale={locale} eager={eager} /> : source ? <Image src={source.src} width={source.width} height={source.height} alt="" unoptimized priority={eager} aria-hidden="true" /> : children}
      {treatment.overlay_tint && blend !== "none" && <span className="editorial-media-tint" aria-hidden="true" />}
    </div>
  </div>;
}

/** Original engraved olive specimen, rendered as vector ink on the page. */
export function EditorialBotanical({ className = "" }: { className?: string }) {
  return <svg className={`editorial-botanical ${className}`} viewBox="0 0 280 340" fill="none" aria-hidden="true" focusable="false">
    <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <path strokeWidth="1.05" d="M117 310C119 256 146 180 155 120C160 87 151 59 160 30M139 208C96 194 60 166 48 121M153 145C194 133 224 104 239 68M153 116C124 97 110 70 106 46M125 276C169 255 199 225 213 195" />
      <path strokeWidth=".9" d="M122 287C96 283 73 262 74 242C100 246 120 261 122 287ZM129 258C151 272 181 256 186 236C157 232 139 243 129 258ZM139 221C116 228 95 214 93 195C115 194 135 204 139 221ZM148 184C167 197 190 189 199 170C175 165 157 172 148 184ZM153 152C132 145 122 129 127 111C147 119 155 132 153 152ZM155 115C170 110 184 91 180 75C165 80 155 95 155 115ZM157 73C141 64 139 46 147 34C162 44 166 58 157 73ZM160 30C170 23 180 11 173 2C159 7 152 18 160 30ZM89 182C69 186 48 172 43 155C62 153 82 166 89 182ZM66 155C81 140 79 118 66 111C54 126 57 143 66 155ZM48 121C31 120 19 107 21 91C37 94 46 106 48 121ZM189 124C187 104 202 89 218 90C218 108 205 121 189 124ZM220 93C238 98 253 89 259 76C241 70 227 76 220 93ZM239 68C226 52 230 34 244 29C255 45 251 61 239 68ZM126 84C128 65 116 48 102 47C98 63 111 77 126 84ZM106 46C93 41 86 26 92 15C105 19 111 33 106 46ZM179 241C174 223 184 208 197 204C204 220 194 235 179 241ZM201 214C220 224 236 211 237 198C222 190 208 197 201 214ZM213 195C206 180 212 165 225 162C233 177 225 188 213 195Z" />
      <g strokeWidth=".55" opacity=".58"><path d="m80 248 36 31m66-40-44 16m-40-57 33 18m62-43-39 9m-22-65 18 25m27-61-16 23m-15-65 9 23m-106 97 31 19m-12-61-3 30m-40-34 20 20m166-14-19 26m54-27-31 8m-120-34 19 29m-17-49 10 18m96 184-16 28m44-23-29 8" /></g>
      <ellipse cx="177" cy="150" rx="4" ry="7" transform="rotate(30 177 150)" fill="currentColor" fillOpacity=".12" />
      <ellipse cx="73" cy="185" rx="4" ry="7" transform="rotate(-25 73 185)" fill="currentColor" fillOpacity=".12" />
    </g>
  </svg>;
}
