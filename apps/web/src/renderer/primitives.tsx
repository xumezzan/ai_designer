"use client";
import React, { useEffect, useRef, useState } from "react";
import type { SizeToken } from "@/design/schema";
import { useRenderer, useSection } from "./context";

/* ------------------------------------------------------------------ */
/* Reveal — a single, restrained entrance animation                     */
/* ------------------------------------------------------------------ */

export function Reveal({
  children,
  delay = 0,
  className = "",
  as: Tag = "div",
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  as?: React.ElementType;
  style?: React.CSSProperties;
}) {
  const { doc, editable } = useRenderer();
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(doc.theme.animation === "none" || editable);

  useEffect(() => {
    if (shown) return;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.05 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [shown]);

  const dur = doc.theme.animation === "moderate" ? 1000 : 700;
  return (
    <Tag
      ref={ref}
      className={className}
      style={{
        ...style,
        opacity: shown ? 1 : 0,
        transform: shown ? "none" : "translateY(14px)",
        transition: `opacity ${dur}ms cubic-bezier(.2,.6,.2,1) ${delay}ms, transform ${dur}ms cubic-bezier(.2,.6,.2,1) ${delay}ms`,
      }}
    >
      {children}
    </Tag>
  );
}

/* ------------------------------------------------------------------ */
/* Editable text                                                        */
/* ------------------------------------------------------------------ */

interface TextProps {
  prop: string;
  value?: string;
  as?: React.ElementType;
  className?: string;
  style?: React.CSSProperties;
  placeholder?: string;
  multiline?: boolean;
}

export function Text({
  prop,
  value,
  as: Tag = "p",
  className = "",
  style,
  placeholder = "Add text",
  multiline,
}: TextProps) {
  const { editable, onTextChange, onSelect, selectedSectionId, selectedElement } = useRenderer();
  const section = useSection();
  const ref = useRef<HTMLElement>(null);
  const isSelected = editable && selectedSectionId === section.id && selectedElement === prop;

  // The editable node is uncontrolled: we own its text via the DOM so React
  // never fights the browser over contentEditable children.
  useEffect(() => {
    if (!editable) return;
    const el = ref.current;
    if (el && document.activeElement !== el && el.innerText !== (value ?? "")) {
      el.innerText = value ?? "";
    }
  }, [value, editable]);

  if (!editable) {
    if (!value) return null;
    return (
      <Tag className={className} style={{ whiteSpace: multiline ? "pre-line" : undefined, ...style }}>
        {value}
      </Tag>
    );
  }

  return (
    <Tag
      ref={ref}
      className={`${className} inv-editable ${isSelected ? "inv-selected" : ""} ${!value ? "inv-empty" : ""}`}
      style={{ whiteSpace: multiline ? "pre-line" : undefined, ...style }}
      contentEditable
      suppressContentEditableWarning
      data-placeholder={placeholder}
      onClick={(e: React.MouseEvent) => {
        e.stopPropagation();
        onSelect?.(section.id, prop);
      }}
      onBlur={(e: React.FocusEvent<HTMLElement>) => {
        const v = e.currentTarget.innerText.replace(/\n{3,}/g, "\n\n");
        if (v !== (value ?? "")) onTextChange?.(section.id, prop, v);
      }}
      onKeyDown={(e: React.KeyboardEvent<HTMLElement>) => {
        if (e.key === "Enter" && !multiline) {
          e.preventDefault();
          (e.currentTarget as HTMLElement).blur();
        }
        if (e.key === "Escape") (e.currentTarget as HTMLElement).blur();
      }}
      onInput={(e: React.FormEvent<HTMLElement>) => {
        const el = e.currentTarget;
        el.classList.toggle("inv-empty", el.innerText.trim().length === 0);
      }}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Typography                                                           */
/* ------------------------------------------------------------------ */

export function Eyebrow({ prop = "eyebrow", value, className = "" }: { prop?: string; value?: string; className?: string }) {
  return (
    <Text
      prop={prop}
      value={value}
      as="p"
      placeholder="Eyebrow"
      className={`inv-eyebrow ${className}`}
    />
  );
}

export function Heading({
  prop = "heading",
  value,
  size,
  as = "h2",
  className = "",
  style,
}: {
  prop?: string;
  value?: string;
  size?: SizeToken;
  as?: React.ElementType;
  className?: string;
  style?: React.CSSProperties;
}) {
  const section = useSection();
  const s = size ?? section.style.headingSize;
  return (
    <Text
      prop={prop}
      value={value}
      as={as}
      placeholder="Heading"
      className={`inv-heading inv-heading-${s} ${className}`}
      style={style}
    />
  );
}

export function Body({
  prop = "body",
  value,
  className = "",
  style,
}: {
  prop?: string;
  value?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <Text
      prop={prop}
      value={value}
      as="p"
      multiline
      placeholder="Paragraph"
      className={`inv-body ${className}`}
      style={style}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Button                                                               */
/* ------------------------------------------------------------------ */

export function Button({
  label,
  href,
  prop = "buttonLabel",
  variant = "solid",
  onClick,
  type,
}: {
  label?: string;
  href?: string;
  prop?: string;
  variant?: "solid" | "outline";
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  const { editable } = useRenderer();
  const cls = `inv-btn inv-btn-${variant}`;
  if (editable) {
    return (
      <span className={cls}>
        <Text prop={prop} value={label} as="span" placeholder="Button" />
      </span>
    );
  }
  if (!label) return null;
  if (href && !onClick) {
    return (
      <a className={cls} href={href}>
        {label}
      </a>
    );
  }
  return (
    <button className={cls} onClick={onClick} type={type ?? "button"}>
      {label}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Image with treatment + placeholder                                   */
/* ------------------------------------------------------------------ */

export function Img({
  src,
  alt = "",
  ratio = "4 / 5",
  prop = "image",
  className = "",
  style,
  fill,
}: {
  src?: string;
  alt?: string;
  ratio?: string;
  prop?: string;
  className?: string;
  style?: React.CSSProperties;
  fill?: boolean;
}) {
  const { editable, onSelect, selectedSectionId, selectedElement } = useRenderer();
  const section = useSection();
  const isSelected = editable && selectedSectionId === section.id && selectedElement === prop;
  const { onTextChange } = useRenderer();
  const handle = (e: React.MouseEvent) => {
    if (!editable) return;
    e.stopPropagation();
    onSelect?.(section.id, prop);
  };
  const dropProps = editable
    ? {
        onDragOver: (e: React.DragEvent) => e.preventDefault(),
        onDrop: (e: React.DragEvent) => {
          e.preventDefault();
          const url = e.dataTransfer.getData("text/uri-list") || e.dataTransfer.getData("text/plain");
          if (url) onTextChange?.(section.id, prop, url);
        },
      }
    : {};
  const base: React.CSSProperties = fill
    ? { position: "absolute", inset: 0, width: "100%", height: "100%" }
    : { aspectRatio: ratio, width: "100%" };

  if (!src) {
    return (
      <div
        className={`inv-img inv-img-placeholder ${isSelected ? "inv-selected" : ""} ${className}`}
        style={{ ...base, ...style }}
        onClick={handle}
        {...dropProps}
      >
        <span>{editable ? "Add photo" : ""}</span>
      </div>
    );
  }
  return (
    <div
      className={`inv-img ${isSelected ? "inv-selected" : ""} ${className}`}
      style={{ ...base, ...style }}
      onClick={handle}
      {...dropProps}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} loading="lazy" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Ornament — used ONLY when decoration > none                          */
/* ------------------------------------------------------------------ */

export function Rule({ className = "" }: { className?: string }) {
  const { doc } = useRenderer();
  if (doc.theme.decoration === "none") return null;
  return <span className={`inv-rule ${className}`} aria-hidden />;
}
