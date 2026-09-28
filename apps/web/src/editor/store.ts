"use client";
import { create } from "zustand";
import type { DesignDocument, EditOperation, Section, SectionType } from "@/design/schema";
import { applyOperations, createSection } from "@/design/operations";
import { api, type Asset } from "@/lib/api";

export type Viewport = "desktop" | "tablet" | "mobile";
export type LeftTab = "sections" | "assets" | "design" | "inspiration";
export type RightTab = "properties" | "ai";

interface EditorState {
  projectId: string | null;
  projectName: string;
  doc: DesignDocument | null;
  past: DesignDocument[];
  future: DesignDocument[];
  dirty: boolean;
  saving: boolean;
  lastSavedAt: number | null;
  selectedSectionId: string | null;
  selectedElement: string | null;
  viewport: Viewport;
  leftTab: LeftTab;
  rightTab: RightTab;
  assets: Asset[];
  /** pending AI proposal preview (applied virtually to the canvas) */
  preview: DesignDocument | null;

  init: (projectId: string, name: string, doc: DesignDocument) => void;
  setDoc: (doc: DesignDocument, opts?: { record?: boolean; source?: string }) => void;
  apply: (ops: EditOperation[], source?: string) => void;
  undo: () => void;
  redo: () => void;
  select: (sectionId: string | null, element?: string | null) => void;
  setViewport: (v: Viewport) => void;
  setLeftTab: (t: LeftTab) => void;
  setRightTab: (t: RightTab) => void;
  setPreview: (d: DesignDocument | null) => void;
  loadAssets: () => Promise<void>;
  save: () => Promise<void>;

  // convenience section ops
  updateSectionProp: (sectionId: string, prop: string, value: unknown) => void;
  updateSectionStyle: (sectionId: string, key: string, value: unknown) => void;
  setVariant: (sectionId: string, variant: string) => void;
  moveSection: (sectionId: string, to: number) => void;
  duplicateSection: (sectionId: string) => void;
  removeSection: (sectionId: string) => void;
  toggleVisible: (sectionId: string) => void;
  addSection: (type: SectionType, index?: number) => void;
  updateTheme: (path: string, value: unknown) => void;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

export const useEditor = create<EditorState>((set, get) => ({
  projectId: null,
  projectName: "",
  doc: null,
  past: [],
  future: [],
  dirty: false,
  saving: false,
  lastSavedAt: null,
  selectedSectionId: null,
  selectedElement: null,
  viewport: "desktop",
  leftTab: "sections",
  rightTab: "properties",
  assets: [],
  preview: null,

  init: (projectId, name, doc) => set({ projectId, projectName: name, doc, past: [], future: [], dirty: false, selectedSectionId: null, selectedElement: null, preview: null }),

  setDoc: (doc, opts = {}) => {
    const { record = true } = opts;
    const cur = get().doc;
    set({
      doc,
      past: record && cur ? [...get().past.slice(-80), cur] : get().past,
      future: record ? [] : get().future,
      dirty: true,
    });
    scheduleSave(get);
  },

  apply: (ops) => {
    const cur = get().doc;
    if (!cur || ops.length === 0) return;
    get().setDoc(applyOperations(cur, ops));
  },

  undo: () => {
    const { past, doc, future } = get();
    if (!doc || past.length === 0) return;
    const prev = past[past.length - 1];
    set({ doc: prev, past: past.slice(0, -1), future: [doc, ...future].slice(0, 80), dirty: true });
    scheduleSave(get);
  },
  redo: () => {
    const { past, doc, future } = get();
    if (!doc || future.length === 0) return;
    const next = future[0];
    set({ doc: next, past: [...past, doc], future: future.slice(1), dirty: true });
    scheduleSave(get);
  },

  select: (sectionId, element = null) => set({ selectedSectionId: sectionId, selectedElement: element, rightTab: sectionId ? "properties" : get().rightTab }),
  setViewport: (viewport) => set({ viewport }),
  setLeftTab: (leftTab) => set({ leftTab }),
  setRightTab: (rightTab) => set({ rightTab }),
  setPreview: (preview) => set({ preview }),

  loadAssets: async () => {
    const pid = get().projectId;
    if (!pid) return;
    set({ assets: await api.assets.list(pid) });
  },

  save: async () => {
    const { projectId, doc, dirty } = get();
    if (!projectId || !doc || !dirty) return;
    set({ saving: true });
    try {
      await api.projects.saveDesign(projectId, doc);
      set({ dirty: false, lastSavedAt: Date.now() });
    } finally {
      set({ saving: false });
    }
  },

  updateSectionProp: (id, prop, value) => get().apply([{ target: `#${id}`, action: "update", property: prop, value }]),
  updateSectionStyle: (id, key, value) => get().apply([{ target: `#${id}`, action: "update", property: `style.${key}`, value }]),
  setVariant: (id, variant) => get().apply([{ target: `#${id}`, action: "set_variant", value: variant }]),
  moveSection: (id, to) => get().apply([{ target: `#${id}`, action: "move", value: to }]),
  duplicateSection: (id) => {
    const doc = get().doc;
    const s = doc?.sections.find((x) => x.id === id);
    if (!doc || !s) return;
    const copy: Section = createSection({ ...JSON.parse(JSON.stringify(s)), id: undefined });
    get().apply([{ target: `#${id}`, action: "add", section: copy }]);
    set({ selectedSectionId: copy.id, selectedElement: null });
  },
  removeSection: (id) => {
    get().apply([{ target: `#${id}`, action: "remove" }]);
    if (get().selectedSectionId === id) set({ selectedSectionId: null, selectedElement: null });
  },
  toggleVisible: (id) => {
    const s = get().doc?.sections.find((x) => x.id === id);
    if (s) get().apply([{ target: `#${id}`, action: "update", property: "visible", value: !s.visible }]);
  },
  addSection: (type, index) => {
    const doc = get().doc;
    if (!doc) return;
    const s = createSection({ type, props: defaultProps(type, doc), style: { align: doc.sections[0]?.style.align ?? "center" } });
    get().apply([{ target: "sections", action: "add", section: s, index }]);
    set({ selectedSectionId: s.id, selectedElement: null, leftTab: "sections" });
  },
  updateTheme: (path, value) => {
    const parts = path.split(".");
    const prop = parts.pop()!;
    get().apply([{ target: ["theme", ...parts].join("."), action: "update", property: prop, value }]);
  },
}));

function scheduleSave(get: () => EditorState) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => get().save(), 1200);
}

export function defaultProps(type: SectionType, doc: DesignDocument): Section["props"] {
  const hero = doc.sections.find((s) => s.type === "hero")?.props ?? {};
  switch (type) {
    case "hero": return { eyebrow: "You're invited", heading: "Names", subheading: "invite you to celebrate", date: hero.date, venue: hero.venue, buttonLabel: "RSVP" };
    case "story": return { eyebrow: "Our story", heading: "How it began", body: "A few words about how we got here." };
    case "event_details": return { eyebrow: "Details", heading: "When & where", details: [{ label: "Date", value: (hero.date as string) || "Date" }, { label: "Venue", value: (hero.venue as string) || "Venue" }, { label: "Dress code", value: "Formal" }] };
    case "schedule": return { eyebrow: "Schedule", heading: "The order of the day", items: [{ time: "16:00", title: "Ceremony" }, { time: "18:00", title: "Dinner" }, { time: "21:00", title: "Dancing" }] };
    case "gallery": return { images: [{ src: undefined }, { src: undefined }, { src: undefined }, { src: undefined }] };
    case "countdown": return { eyebrow: "Counting down", heading: "See you soon", targetDate: undefined };
    case "quote": return { quote: "The best thing to hold onto in life is each other.", attribution: "Audrey Hepburn" };
    case "map": return { eyebrow: "Getting there", heading: "The venue", venue: hero.venue, address: "", mapQuery: hero.venue };
    case "dress_code": return { eyebrow: "Dress code", heading: "What to wear", dressCode: "Formal", body: "Think soft, natural tones." };
    case "speakers": return { eyebrow: "Speakers", heading: "Voices on stage", speakers: [{ name: "Speaker name", role: "Title, Company" }, { name: "Speaker name", role: "Title, Company" }, { name: "Speaker name", role: "Title, Company" }] };
    case "rsvp": return { eyebrow: "RSVP", heading: "Will you join us?", body: "Kindly reply so we can plan the day around you.", buttonLabel: "Send RSVP" };
    case "text": return { heading: "A note", body: "Write something here." };
    case "image": return { image: undefined };
    case "divider": return {};
    case "contact": return { eyebrow: "Questions", heading: "Get in touch", email: "hello@example.com" };
    case "footer": return { heading: hero.heading, body: hero.date };
  }
}
