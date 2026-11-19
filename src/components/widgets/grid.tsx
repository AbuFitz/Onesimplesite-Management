"use client";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Eye, EyeOff, GripVertical, LayoutGrid, RotateCcw, Check } from "lucide-react";

export type GridWidget = { id: string; title: string; size: "s" | "m" | "l" | "xl"; node: ReactNode };

/**
 * A customisable widget grid. The server renders every widget in its default order, so there is no flash; once the browser has the person's saved layout
 * (kept per person on this device), it reorders and hides. "Customise" turns on drag handles (mouse, touch and keyboard: Space to lift, arrows to move, Space to drop)
 * and an eye on each widget; hidden widgets wait in a tray and can be brought back. Nothing is lost by hiding, and Reset restores the default.
 */
export function WidgetGrid({ storageKey, widgets }: { storageKey: string; widgets: GridWidget[] }) {
  const defaults = useMemo(() => widgets.map((w) => w.id), [widgets]);
  const [order, setOrder] = useState<string[]>(defaults);
  const [hidden, setHidden] = useState<string[]>([]);
  const [edit, setEdit] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? "null") as { order?: string[]; hidden?: string[] } | null;
      if (!saved) return;
      const known = new Set(defaults);
      const o = (saved.order ?? []).filter((id) => known.has(id));
      setOrder([...o, ...defaults.filter((id) => !o.includes(id))]);
      setHidden((saved.hidden ?? []).filter((id) => known.has(id)));
    } catch { /* an unreadable saved layout just means the default one */ }
  }, [storageKey, defaults]);
  const save = (o: string[], h: string[]) => { setOrder(o); setHidden(h); try { localStorage.setItem(storageKey, JSON.stringify({ order: o, hidden: h })); } catch { /* private mode */ } };
  const byId = new Map(widgets.map((w) => [w.id, w]));
  const shown = order.filter((id) => !hidden.includes(id) && byId.has(id));
  const onEnd = (e: DragEndEvent) => { if (e.over && e.active.id !== e.over.id) save(arrayMove(order, order.indexOf(String(e.active.id)), order.indexOf(String(e.over.id))), hidden); };

  return (
    <div>
      <div className="wgrid-bar">
        {edit && <button type="button" className="btn btn-quiet !min-h-9 !px-3 text-[13px]" onClick={() => save(defaults, [])}><RotateCcw size={14} aria-hidden /> Reset</button>}
        <button type="button" className={`btn !min-h-9 !px-3 text-[13px] ${edit ? "" : "btn-quiet"}`} aria-pressed={edit} onClick={() => setEdit((v) => !v)}>
          {edit ? <><Check size={14} aria-hidden /> Done</> : <><LayoutGrid size={14} aria-hidden /> Customise</>}
        </button>
      </div>
      {edit && <p className="wgrid-tip" role="status">Drag the handle to move a widget. Tap the eye to hide it.<span className="sr-only"> With a keyboard, focus the handle, press Space, then use the arrow keys.</span></p>}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onEnd}>
        <SortableContext items={shown} strategy={rectSortingStrategy}>
          <div className="wgrid">
            {shown.map((id) => <Cell key={id} w={byId.get(id)!} edit={edit} onHide={() => save(order, [...hidden, id])} />)}
          </div>
        </SortableContext>
      </DndContext>
      {edit && hidden.length > 0 && (
        <div className="wgrid-tray"><p>Hidden widgets</p>
          <ul>{hidden.filter((id) => byId.has(id)).map((id) => <li key={id}><button type="button" className="btn btn-quiet !min-h-9 !px-3 text-[13px]" onClick={() => save(order, hidden.filter((x) => x !== id))}><Eye size={14} aria-hidden /> {byId.get(id)!.title}</button></li>)}</ul>
        </div>
      )}
    </div>
  );
}

function Cell({ w, edit, onHide }: { w: GridWidget; edit: boolean; onHide: () => void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: w.id, disabled: !edit });
  return (
    <div ref={setNodeRef} className={`wcell s-${w.size} ${edit ? "editing" : ""} ${isDragging ? "dragging" : ""}`} style={{ transform: CSS.Transform.toString(transform), transition }}>
      {edit && (
        <div className="wcell-tools">
          <button ref={setActivatorNodeRef} type="button" className="iconbtn !size-9" aria-label={`Move ${w.title}`} {...attributes} {...listeners}><GripVertical size={16} aria-hidden /></button>
          <button type="button" className="iconbtn !size-9" aria-label={`Hide ${w.title}`} onClick={onHide}><EyeOff size={16} aria-hidden /></button>
        </div>
      )}
      <div className={edit ? "pointer-events-none select-none" : ""} inert={edit || undefined}>{w.node}</div>
    </div>
  );
}
