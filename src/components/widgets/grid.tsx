"use client";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { DndContext, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, LayoutGrid, RotateCcw } from "lucide-react";
import { Sheet } from "../sheet";

export type GridWidget = { id: string; title: string; size: "s" | "m" | "l" | "xl"; node: ReactNode };

/**
 * The widget grid. The page only ever shows the widgets that are switched on, in the person's order, so nothing is left lying around.
 * Everything about layout lives in one place: Customise opens a panel listing every widget with a switch and a handle to reorder (mouse, touch, or keyboard:
 * Space to lift, arrows to move). Changes apply to the page behind it straight away and are remembered per person on this device. Reset restores the default.
 */
export function WidgetGrid({ storageKey, widgets }: { storageKey: string; widgets: GridWidget[] }) {
  const defaults = useMemo(() => widgets.map((w) => w.id), [widgets]);
  const [order, setOrder] = useState<string[]>(defaults);
  const [hidden, setHidden] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

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
  const toggle = (id: string) => save(order, hidden.includes(id) ? hidden.filter((x) => x !== id) : [...hidden, id]);

  // Two lists in the panel (the small number tiles, and the bigger widgets). Moving inside one list rebuilds the shared order.
  const small = order.filter((id) => byId.get(id)?.size === "s"), big = order.filter((id) => byId.has(id) && byId.get(id)!.size !== "s");
  const reorder = (group: string[]) => (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const moved = arrayMove(group, group.indexOf(String(e.active.id)), group.indexOf(String(e.over.id)));
    const set = new Set(group); let i = 0;
    save(order.map((id) => (set.has(id) ? moved[i++] : id)), hidden);
  };
  const list = (title: string, ids: string[]) => ids.length > 0 && (
    <section className="cz-sec"><h3>{title}</h3>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={reorder(ids)}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <ul className="cz-list">{ids.map((id) => <Row key={id} id={id} title={byId.get(id)!.title} on={!hidden.includes(id)} onToggle={() => toggle(id)} />)}</ul>
        </SortableContext>
      </DndContext>
    </section>
  );

  return (
    <div>
      <div className="wgrid-bar">
        <button type="button" className="btn btn-quiet !min-h-9 !px-3 text-[13px]" aria-haspopup="dialog" onClick={() => setOpen(true)}>
          <LayoutGrid size={14} aria-hidden /> Customise{hidden.length > 0 && <span className="cz-n">{hidden.length} hidden</span>}
        </button>
      </div>
      <div className="wgrid">{shown.map((id) => <div key={id} className={`wcell s-${byId.get(id)!.size}`}>{byId.get(id)!.node}</div>)}</div>
      {shown.length === 0 && <p className="cz-none">Everything is hidden. <button type="button" onClick={() => setOpen(true)}>Choose what to show</button></p>}
      {open && createPortal(
        <Sheet open onClose={() => setOpen(false)} title="Customise Today">
          <div className="cz">
            <p className="cz-lead">Switch widgets on or off, and drag to reorder.</p>
            {list("Numbers", small)}
            {list("Widgets", big)}
            <div className="cz-foot"><button type="button" className="btn btn-quiet" onClick={() => save(defaults, [])}><RotateCcw size={15} aria-hidden /> Reset to default</button><button type="button" className="btn" onClick={() => setOpen(false)}>Done</button></div>
          </div>
        </Sheet>, document.body)}
    </div>
  );
}

function Row({ id, title, on, onToggle }: { id: string; title: string; on: boolean; onToggle: () => void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <li ref={setNodeRef} className={`cz-row ${isDragging ? "dragging" : ""} ${on ? "" : "off"}`} style={{ transform: CSS.Transform.toString(transform), transition }}>
      <button ref={setActivatorNodeRef} type="button" className="cz-grip" aria-label={`Move ${title}`} {...attributes} {...listeners}><GripVertical size={18} aria-hidden /></button>
      <label htmlFor={`cz-${id}`} className="cz-t">{title}</label>
      <span className="sw"><input id={`cz-${id}`} type="checkbox" checked={on} onChange={onToggle} /><i aria-hidden /></span>
    </li>
  );
}
