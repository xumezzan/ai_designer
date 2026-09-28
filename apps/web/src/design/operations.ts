/**
 * Structured edit operations.
 * Both the AI Designer and the manual editor mutate the document
 * exclusively through these operations, so every change is
 * validated, reversible, and cannot break the site structure.
 */
import {
  SECTION_VARIANTS,
  type DesignDocument,
  type EditOperation,
  type Section,
  type SectionStyle,
  type SectionType,
} from "./schema";

export function uid(prefix = "sec") {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

export const DEFAULT_SECTION_STYLE: SectionStyle = {
  background: "default",
  paddingY: "lg",
  align: "center",
  headingSize: "md",
};

export function createSection(
  partial: Partial<Omit<Section, "style">> & { type: SectionType; style?: Partial<SectionStyle> }
): Section {
  const variants = SECTION_VARIANTS[partial.type] ?? ["default"];
  return {
    id: partial.id ?? uid(),
    type: partial.type,
    variant: partial.variant && variants.includes(partial.variant) ? partial.variant : variants[0],
    visible: partial.visible ?? true,
    props: { ...(partial.props ?? {}) },
    style: { ...DEFAULT_SECTION_STYLE, ...(partial.style ?? {}) },
  };
}

export function findSection(doc: DesignDocument, ref: string): Section | undefined {
  if (ref.startsWith("#")) return doc.sections.find((s) => s.id === ref.slice(1));
  return doc.sections.find((s) => s.type === ref || s.id === ref);
}

function setPath(obj: Record<string, unknown>, path: string[], value: unknown) {
  let cur: Record<string, unknown> = obj;
  for (let i = 0; i < path.length - 1; i++) {
    const k = path[i];
    if (typeof cur[k] !== "object" || cur[k] === null) cur[k] = {};
    cur = cur[k] as Record<string, unknown>;
  }
  cur[path[path.length - 1]] = value;
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

/**
 * Apply a single operation to a copy of the document.
 * Unknown targets are ignored rather than throwing — the site must never break.
 */
export function applyOperation(doc: DesignDocument, op: EditOperation): DesignDocument {
  const next = clone(doc);
  const [head, ...rest] = op.target.split(".");

  /* ---------- theme / layout ---------- */
  if (head === "theme" || head === "layout") {
    if (op.action === "update") {
      const path = [...rest, ...(op.property ? [op.property] : [])];
      if (path.length === 0) return next;
      setPath(next as unknown as Record<string, unknown>, [head, ...path], op.value);
    }
    return next;
  }

  /* ---------- sections collection ---------- */
  if (head === "sections" && op.action === "add" && op.section) {
    const section = createSection(op.section);
    const footerIdx = next.sections.findIndex((s) => s.type === "footer");
    const idx =
      op.index !== undefined
        ? Math.min(Math.max(0, op.index), next.sections.length)
        : footerIdx === -1
          ? next.sections.length
          : footerIdx;
    next.sections.splice(idx, 0, section);
    return next;
  }

  /* ---------- a specific section ---------- */
  const section = findSection(next, head);
  if (!section) return next;
  const idx = next.sections.indexOf(section);

  switch (op.action) {
    case "remove": {
      if (rest.length === 0) {
        next.sections.splice(idx, 1);
      } else {
        // clear an element/prop of a section, e.g. hero.image
        const key = rest[0] === "props" ? rest[1] : rest[0];
        delete section.props[key];
      }
      return next;
    }
    case "set_variant": {
      const variants = SECTION_VARIANTS[section.type];
      if (typeof op.value === "string" && variants.includes(op.value)) section.variant = op.value;
      return next;
    }
    case "move": {
      let to = idx;
      if (op.value === "up") to = idx - 1;
      else if (op.value === "down") to = idx + 1;
      else if (typeof op.value === "number") to = op.value;
      to = Math.max(0, Math.min(next.sections.length - 1, to));
      next.sections.splice(idx, 1);
      next.sections.splice(to, 0, section);
      return next;
    }
    case "add": {
      if (op.section) {
        const s = createSection(op.section);
        next.sections.splice(idx + 1, 0, s);
      }
      return next;
    }
    case "update": {
      const path = [...rest, ...(op.property ? [op.property] : [])];
      if (path.length === 0) return next;
      if (path[0] === "style") {
        setPath(section as unknown as Record<string, unknown>, path, op.value);
      } else if (path[0] === "visible" || path[0] === "variant") {
        if (path[0] === "variant") {
          if (typeof op.value === "string" && SECTION_VARIANTS[section.type].includes(op.value))
            section.variant = op.value;
        } else section.visible = Boolean(op.value);
      } else {
        const propPath = path[0] === "props" ? path.slice(1) : path;
        setPath(section.props as Record<string, unknown>, propPath, op.value);
      }
      return next;
    }
  }
  return next;
}

export function applyOperations(doc: DesignDocument, ops: EditOperation[]): DesignDocument {
  return ops.reduce((d, op) => applyOperation(d, op), doc);
}

/* ------------------------------------------------------------------ */
/* Diff (for Before → After summaries in the AI panel)                  */
/* ------------------------------------------------------------------ */

export interface DiffEntry {
  path: string;
  before: unknown;
  after: unknown;
}

export function diffDocuments(a: DesignDocument, b: DesignDocument): DiffEntry[] {
  const out: DiffEntry[] = [];
  const walk = (x: unknown, y: unknown, path: string) => {
    if (JSON.stringify(x) === JSON.stringify(y)) return;
    if (
      x && y && typeof x === "object" && typeof y === "object" &&
      !Array.isArray(x) && !Array.isArray(y)
    ) {
      const keys = new Set([...Object.keys(x), ...Object.keys(y)]);
      keys.forEach((k) =>
        walk(
          (x as Record<string, unknown>)[k],
          (y as Record<string, unknown>)[k],
          path ? `${path}.${k}` : k
        )
      );
      return;
    }
    out.push({ path, before: x, after: y });
  };
  walk(a.theme, b.theme, "theme");
  walk(a.layout, b.layout, "layout");
  // Sections: match by id
  const bIds = new Map(b.sections.map((s, i) => [s.id, { s, i }]));
  a.sections.forEach((s) => {
    const m = bIds.get(s.id);
    if (!m) out.push({ path: `${s.type}`, before: "present", after: "removed" });
    else walk(s, m.s, s.type);
  });
  b.sections.forEach((s) => {
    if (!a.sections.find((x) => x.id === s.id))
      out.push({ path: `${s.type}`, before: "—", after: "added" });
  });
  if (
    a.sections.map((s) => s.id).join() !==
    b.sections.filter((s) => a.sections.find((x) => x.id === s.id)).map((s) => s.id).join()
  ) {
    out.push({ path: "sections.order", before: "previous order", after: "reordered" });
  }
  return out;
}
