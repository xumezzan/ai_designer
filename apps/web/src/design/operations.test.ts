/**
 * Unit tests for the structured edit operations (design/operations.ts) —
 * the only way a DesignDocument may change, for both the manual editor
 * and the AI. Contract: unknown targets are ignored, invalid values are
 * rejected, and the document structure can never break.
 */
import { describe, expect, it } from "vitest";
import { applyOperation, applyOperations, createSection } from "./operations";
import type { DesignDocument, EditOperation, Section } from "./schema";

/* ------------------------------------------------------------------ */
/* Sample document                                                     */
/* ------------------------------------------------------------------ */

const sectionStyle = {
  background: "default",
  paddingY: "lg",
  align: "center",
  headingSize: "md",
} as const;

function sampleDocument(): DesignDocument {
  return {
    version: 1,
    meta: {
      conceptName: "Concept 01",
      direction: "Editorial Romance",
      rationale: "Quiet, editorial, ivory and olive.",
      eventType: "wedding",
    },
    theme: {
      colors: {
        background: "#FBF9F4",
        surface: "#F3EFE6",
        text: "#2B2A26",
        muted: "#6E6A5E",
        accent: "#8A6D3B",
        accentText: "#FFFFFF",
      },
      typography: {
        headingFont: "Cormorant Garamond",
        bodyFont: "Inter",
        scale: "display",
        headingWeight: 500,
        headingCase: "none",
        headingTracking: "normal",
        headingItalic: false,
      },
      spacing: "airy",
      radius: "none",
      shadows: "none",
      decoration: "minimal",
      animation: "subtle",
      imageTreatment: "film",
    },
    layout: { maxWidth: 1200 },
    sections: [
      {
        id: "sec_hero",
        type: "hero",
        variant: "editorial",
        visible: true,
        props: {
          heading: "A & B",
          subheading: "We are getting married",
          image: "/stock/wedding-1.jpg",
          date: "2026-09-29",
        },
        style: { ...sectionStyle },
      },
      {
        id: "sec_story",
        type: "story",
        variant: "split",
        visible: true,
        props: { heading: "Our story", body: "Ten years in the making." },
        style: { ...sectionStyle },
      },
      {
        id: "sec_rsvp",
        type: "rsvp",
        variant: "card",
        visible: true,
        props: { heading: "RSVP", buttonLabel: "Reply" },
        style: { ...sectionStyle },
      },
      {
        id: "sec_footer",
        type: "footer",
        variant: "simple",
        visible: true,
        props: {},
        style: { ...sectionStyle },
      },
    ],
  };
}

const types = (doc: DesignDocument) => doc.sections.map((s) => s.type);
const section = (doc: DesignDocument, id: string): Section => {
  const s = doc.sections.find((x) => x.id === id);
  expect(s, `section ${id} should exist`).toBeDefined();
  return s as Section;
};

/* ------------------------------------------------------------------ */
/* update                                                              */
/* ------------------------------------------------------------------ */

describe("update", () => {
  it("updates a theme color via target path + property", () => {
    const doc = sampleDocument();
    const next = applyOperation(doc, {
      target: "theme.colors",
      action: "update",
      property: "accent",
      value: "#66705A",
    });
    expect(next.theme.colors.accent).toBe("#66705A");
    // untouched siblings stay as they were
    expect(next.theme.colors.background).toBe("#FBF9F4");
  });

  it("updates a theme value via a fully dotted target", () => {
    const next = applyOperation(sampleDocument(), {
      target: "theme.typography.headingFont",
      action: "update",
      value: "Fraunces",
    });
    expect(next.theme.typography.headingFont).toBe("Fraunces");
  });

  it("updates layout.maxWidth", () => {
    const next = applyOperation(sampleDocument(), {
      target: "layout",
      action: "update",
      property: "maxWidth",
      value: 1080,
    });
    expect(next.layout.maxWidth).toBe(1080);
  });

  it("updates a section prop by type target + property", () => {
    const next = applyOperation(sampleDocument(), {
      target: "hero",
      action: "update",
      property: "heading",
      value: "Amara & Ben",
    });
    expect(section(next, "sec_hero").props.heading).toBe("Amara & Ben");
  });

  it("updates a section prop via a dotted target", () => {
    const next = applyOperation(sampleDocument(), {
      target: "hero.subheading",
      action: "update",
      value: "Join us",
    });
    expect(section(next, "sec_hero").props.subheading).toBe("Join us");
  });

  it("updates a section style token", () => {
    const next = applyOperation(sampleDocument(), {
      target: "hero",
      action: "update",
      property: "style.headingSize",
      value: "xl",
    });
    expect(section(next, "sec_hero").style.headingSize).toBe("xl");
  });

  it("updates a section by #id", () => {
    const next = applyOperation(sampleDocument(), {
      target: "#sec_story",
      action: "update",
      property: "body",
      value: "A decade of adventures.",
    });
    expect(section(next, "sec_story").props.body).toBe("A decade of adventures.");
  });

  it("toggles visibility", () => {
    const next = applyOperation(sampleDocument(), {
      target: "story",
      action: "update",
      property: "visible",
      value: false,
    });
    expect(section(next, "sec_story").visible).toBe(false);
  });

  it("validates variant updates — a valid variant is applied", () => {
    const next = applyOperation(sampleDocument(), {
      target: "hero",
      action: "update",
      property: "variant",
      value: "split",
    });
    expect(section(next, "sec_hero").variant).toBe("split");
  });

  it("validates variant updates — an invalid variant is ignored", () => {
    const doc = sampleDocument();
    const next = applyOperation(doc, {
      target: "hero",
      action: "update",
      property: "variant",
      value: "carousel",
    });
    expect(section(next, "sec_hero").variant).toBe("editorial");
  });

  it("does not mutate the original document", () => {
    const doc = sampleDocument();
    const before = JSON.stringify(doc);
    applyOperation(doc, { target: "hero.heading", action: "update", value: "Changed" });
    expect(JSON.stringify(doc)).toBe(before);
  });

  it("is a no-op for a theme update without a path", () => {
    const doc = sampleDocument();
    const next = applyOperation(doc, { target: "theme", action: "update" });
    expect(next).toEqual(doc);
  });
});

/* ------------------------------------------------------------------ */
/* remove                                                              */
/* ------------------------------------------------------------------ */

describe("remove", () => {
  it("removes a section by type target", () => {
    const next = applyOperation(sampleDocument(), { target: "story", action: "remove" });
    expect(types(next)).toEqual(["hero", "rsvp", "footer"]);
  });

  it("removes a section by #id target", () => {
    const next = applyOperation(sampleDocument(), { target: "#sec_rsvp", action: "remove" });
    expect(types(next)).toEqual(["hero", "story", "footer"]);
  });

  it("clears a section element (hero.image) without removing the section", () => {
    const next = applyOperation(sampleDocument(), { target: "hero.image", action: "remove" });
    const hero = section(next, "sec_hero");
    expect(hero.props.image).toBeUndefined();
    expect(hero.props.heading).toBe("A & B"); // other props intact
    expect(types(next)).toEqual(["hero", "story", "rsvp", "footer"]);
  });

  it("clears a prop via the props. path form", () => {
    const next = applyOperation(sampleDocument(), {
      target: "#sec_rsvp.props.buttonLabel",
      action: "remove",
    });
    expect(section(next, "sec_rsvp").props.buttonLabel).toBeUndefined();
    expect(types(next)).toEqual(["hero", "story", "rsvp", "footer"]); // section stays
  });
});

/* ------------------------------------------------------------------ */
/* set_variant                                                         */
/* ------------------------------------------------------------------ */

describe("set_variant", () => {
  it("sets a valid variant", () => {
    const next = applyOperation(sampleDocument(), {
      target: "#sec_hero",
      action: "set_variant",
      value: "split",
    });
    expect(section(next, "sec_hero").variant).toBe("split");
  });

  it("resolves the section by type", () => {
    const next = applyOperation(sampleDocument(), {
      target: "rsvp",
      action: "set_variant",
      value: "minimal",
    });
    expect(section(next, "sec_rsvp").variant).toBe("minimal");
  });

  it("ignores a variant not in the section's variant list", () => {
    const next = applyOperation(sampleDocument(), {
      target: "hero",
      action: "set_variant",
      value: "parallax",
    });
    expect(section(next, "sec_hero").variant).toBe("editorial");
  });

  it("ignores non-string values", () => {
    const next = applyOperation(sampleDocument(), {
      target: "hero",
      action: "set_variant",
      value: 3,
    });
    expect(section(next, "sec_hero").variant).toBe("editorial");
  });
});

/* ------------------------------------------------------------------ */
/* add                                                                 */
/* ------------------------------------------------------------------ */

describe("add", () => {
  it("adds a section to `sections` before the footer by default", () => {
    const next = applyOperation(sampleDocument(), {
      target: "sections",
      action: "add",
      section: { type: "gallery", props: { heading: "Gallery" } },
    });
    expect(types(next)).toEqual(["hero", "story", "rsvp", "gallery", "footer"]);
    const gallery = next.sections.find((s) => s.type === "gallery") as Section;
    expect(gallery.id).toMatch(/^sec_/);
    expect(gallery.visible).toBe(true);
    expect(gallery.variant).toBe("grid"); // first variant of gallery
    expect(gallery.style.paddingY).toBe("lg"); // default style filled in
  });

  it("adds a section at an explicit index", () => {
    const next = applyOperation(sampleDocument(), {
      target: "sections",
      action: "add",
      section: { type: "quote" },
      index: 0,
    });
    expect(types(next)).toEqual(["quote", "hero", "story", "rsvp", "footer"]);
  });

  it("clamps out-of-range indexes", () => {
    const next = applyOperation(sampleDocument(), {
      target: "sections",
      action: "add",
      section: { type: "divider" },
      index: 99,
    });
    expect(types(next)).toEqual(["hero", "story", "rsvp", "footer", "divider"]);

    const neg = applyOperation(sampleDocument(), {
      target: "sections",
      action: "add",
      section: { type: "divider" },
      index: -5,
    });
    expect(types(neg)).toEqual(["divider", "hero", "story", "rsvp", "footer"]);
  });

  it("adds a section right after a target section", () => {
    const next = applyOperation(sampleDocument(), {
      target: "hero",
      action: "add",
      section: { type: "countdown" },
    });
    expect(types(next)).toEqual(["hero", "countdown", "story", "rsvp", "footer"]);
  });

  it("keeps a requested variant when it is valid, falls back otherwise", () => {
    const valid = createSection({ type: "hero", variant: "fullscreen" });
    expect(valid.variant).toBe("fullscreen");
    const invalid = createSection({ type: "hero", variant: "video-loop" });
    expect(invalid.variant).toBe("centered");
  });

  it("is a no-op for `sections` add without a section payload", () => {
    const doc = sampleDocument();
    const next = applyOperation(doc, { target: "sections", action: "add" });
    expect(next.sections.map((s) => s.id)).toEqual(doc.sections.map((s) => s.id));
  });
});

/* ------------------------------------------------------------------ */
/* move                                                                */
/* ------------------------------------------------------------------ */

describe("move", () => {
  it("moves a section up", () => {
    const next = applyOperation(sampleDocument(), { target: "rsvp", action: "move", value: "up" });
    expect(types(next)).toEqual(["hero", "rsvp", "story", "footer"]);
  });

  it("moves a section down", () => {
    const next = applyOperation(sampleDocument(), { target: "hero", action: "move", value: "down" });
    expect(types(next)).toEqual(["story", "hero", "rsvp", "footer"]);
  });

  it("moves a section to an absolute index", () => {
    const next = applyOperation(sampleDocument(), { target: "footer", action: "move", value: 0 });
    expect(types(next)).toEqual(["footer", "hero", "story", "rsvp"]);
  });

  it("resolves the target by #id", () => {
    const next = applyOperation(sampleDocument(), { target: "#sec_story", action: "move", value: "down" });
    expect(types(next)).toEqual(["hero", "rsvp", "story", "footer"]);
  });

  it("clamps at the top edge", () => {
    const next = applyOperation(sampleDocument(), { target: "hero", action: "move", value: "up" });
    expect(types(next)).toEqual(["hero", "story", "rsvp", "footer"]);
  });

  it("clamps at the bottom edge", () => {
    const next = applyOperation(sampleDocument(), { target: "footer", action: "move", value: "down" });
    expect(types(next)).toEqual(["hero", "story", "rsvp", "footer"]);

    const big = applyOperation(sampleDocument(), { target: "hero", action: "move", value: 42 });
    expect(types(big)).toEqual(["story", "rsvp", "footer", "hero"]);
  });

  it("ignores an unrecognized move value", () => {
    const next = applyOperation(sampleDocument(), { target: "story", action: "move", value: "sideways" });
    expect(types(next)).toEqual(["hero", "story", "rsvp", "footer"]);
  });
});

/* ------------------------------------------------------------------ */
/* Unknown targets & validation — the document must never break        */
/* ------------------------------------------------------------------ */

describe("unknown targets & validation", () => {
  const eachAction: EditOperation["action"][] = ["update", "remove", "set_variant", "move"];

  it.each(eachAction)("ignores an unknown section target for action `%s`", (action) => {
    const doc = sampleDocument();
    const next = applyOperation(doc, { target: "testimonials", action, value: "anything" });
    expect(next).toEqual(doc);
  });

  it("ignores an unknown #id target", () => {
    const doc = sampleDocument();
    const next = applyOperation(doc, {
      target: "#sec_nope",
      action: "update",
      property: "heading",
      value: "x",
    });
    expect(next).toEqual(doc);
  });

  it("ignores unknown targets for `add` as well", () => {
    const doc = sampleDocument();
    const next = applyOperation(doc, {
      target: "testimonials",
      action: "add",
      section: { type: "quote" },
    });
    expect(types(next)).toEqual(types(doc));
  });

  it("ignores non-update actions on theme / layout", () => {
    const doc = sampleDocument();
    expect(applyOperation(doc, { target: "theme.colors", action: "remove" })).toEqual(doc);
    expect(applyOperation(doc, { target: "layout", action: "set_variant", value: "wide" })).toEqual(doc);
    expect(applyOperation(doc, { target: "theme", action: "move", value: "up" })).toEqual(doc);
  });

  it("never throws — random garbage operations return an equivalent document", () => {
    const doc = sampleDocument();
    const garbage: EditOperation[] = [
      { target: "", action: "update", value: 1 },
      { target: "...", action: "remove" },
      { target: "theme.", action: "update", property: "", value: "x" },
      { target: "hero", action: "set_variant", value: { not: "a string" } },
      { target: "sections", action: "move", value: "up" },
    ];
    for (const op of garbage) {
      expect(() => applyOperation(doc, op)).not.toThrow();
    }
  });
});

/* ------------------------------------------------------------------ */
/* applyOperations — sequential application                            */
/* ------------------------------------------------------------------ */

describe("applyOperations", () => {
  it("applies a list of operations in order (README sample)", () => {
    const next = applyOperations(sampleDocument(), [
      { target: "hero", action: "update", property: "style.headingSize", value: "xl" },
      { target: "theme.colors", action: "update", property: "accent", value: "#66705A" },
      { target: "hero.image", action: "remove" },
      { target: "#sec_story", action: "set_variant", value: "centered" },
      { target: "sections", action: "add", section: { type: "map" } },
    ]);
    expect(section(next, "sec_hero").style.headingSize).toBe("xl");
    expect(section(next, "sec_hero").props.image).toBeUndefined();
    expect(next.theme.colors.accent).toBe("#66705A");
    expect(section(next, "sec_story").variant).toBe("centered");
    expect(types(next)).toEqual(["hero", "story", "rsvp", "map", "footer"]);
  });

  it("skips invalid operations and applies the rest", () => {
    const next = applyOperations(sampleDocument(), [
      { target: "nonexistent", action: "remove" },
      { target: "hero", action: "set_variant", value: "nonsense" },
      { target: "hero", action: "update", property: "heading", value: "A & B ❤" },
    ]);
    expect(types(next)).toEqual(["hero", "story", "rsvp", "footer"]);
    expect(section(next, "sec_hero").variant).toBe("editorial");
    expect(section(next, "sec_hero").props.heading).toBe("A & B ❤");
  });
});
