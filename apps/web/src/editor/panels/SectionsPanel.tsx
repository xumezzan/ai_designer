"use client";
import { useState } from "react";
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Copy, Eye, EyeOff, GripVertical, Plus, Trash2 } from "lucide-react";
import { SECTION_LABELS, type SectionType } from "@/design/schema";
import { useEditor } from "../store";

const ADDABLE: SectionType[] = ["hero", "story", "event_details", "schedule", "gallery", "countdown", "quote", "map", "dress_code", "speakers", "rsvp", "text", "image", "divider", "contact", "footer"];

export function SectionsPanel() {
  const { doc, selectedSectionId, select, setDoc, addSection } = useEditor();
  const [adding, setAdding] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  if (!doc) return null;

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = doc.sections.findIndex((s) => s.id === active.id);
    const to = doc.sections.findIndex((s) => s.id === over.id);
    setDoc({ ...doc, sections: arrayMove(doc.sections, from, to) });
  };

  return (
    <div className="p-3">
      <div className="flex items-center justify-between mb-3">
        <p className="panel-title">Sections</p>
        <button className="btn btn-ghost btn-sm" onClick={() => setAdding((a) => !a)}><Plus size={13} /> Add</button>
      </div>

      {adding && (
        <div className="card p-2 mb-3 grid grid-cols-2 gap-1 fade-in">
          {ADDABLE.map((t) => (
            <button key={t} className="btn btn-ghost btn-sm justify-start !font-normal" onClick={() => { addSection(t); setAdding(false); }}>
              {SECTION_LABELS[t]}
            </button>
          ))}
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={doc.sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <ul className="space-y-1">
            {doc.sections.map((s) => (
              <Row key={s.id} id={s.id} label={SECTION_LABELS[s.type]} variant={s.variant} visible={s.visible} selected={selectedSectionId === s.id} onSelect={() => { select(s.id); document.querySelector(`[data-section-id="${s.id}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" }); }} />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      <p className="text-[11px] text-muted mt-4 leading-relaxed">
        Drag to reorder. <span className="kbd">⌘Z</span> undo · <span className="kbd">⌘D</span> duplicate · <span className="kbd">⌫</span> delete · <span className="kbd">⌥↑↓</span> move
      </p>
    </div>
  );
}

function Row({ id, label, variant, visible, selected, onSelect }: { id: string; label: string; variant: string; visible: boolean; selected: boolean; onSelect: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const { duplicateSection, removeSection, toggleVisible } = useEditor();
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 }}
      className={`group flex items-center gap-1.5 rounded-md pl-1 pr-1 py-1 text-[12.5px] cursor-pointer ${selected ? "bg-ink text-accent-ink" : "hover:bg-surface-2"} ${!visible ? "opacity-60" : ""}`}
      onClick={onSelect}
    >
      <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-0.5 opacity-50 hover:opacity-100" aria-label="Drag">
        <GripVertical size={13} />
      </button>
      <span className="flex-1 truncate">
        {label} <span className={`text-[11px] ${selected ? "opacity-60" : "text-muted"}`}>· {variant}</span>
      </span>
      <span className={`flex items-center gap-0.5 ${selected ? "" : "opacity-0 group-hover:opacity-100"}`}>
        <button className="p-1 rounded hover:bg-white/10" title={visible ? "Hide" : "Show"} onClick={(e) => { e.stopPropagation(); toggleVisible(id); }}>{visible ? <Eye size={12} /> : <EyeOff size={12} />}</button>
        <button className="p-1 rounded hover:bg-white/10" title="Duplicate" onClick={(e) => { e.stopPropagation(); duplicateSection(id); }}><Copy size={12} /></button>
        <button className="p-1 rounded hover:bg-white/10" title="Delete" onClick={(e) => { e.stopPropagation(); removeSection(id); }}><Trash2 size={12} /></button>
      </span>
    </li>
  );
}
