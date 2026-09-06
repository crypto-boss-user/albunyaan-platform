'use client';

import { useEffect, useState } from 'react';

/**
 * Sorteerbare lijst (AD 1.3, Uscreen "Drag to reorder"): native HTML5-slepen + ▲/▼-knoppen (toetsenbord); de volgorde gaat als
 * verborgen veld `order` (komma-gescheiden ids) naar de server action, die fail-closed controleert dat de set exact klopt.
 * De rij-inhoud komt als ReactNode van de server (geen client-data-fetching).
 */
export default function SortableList({
  items,
  action,
  hidden,
  saveLabel = 'Save order',
}: {
  items: { id: string; node: React.ReactNode }[];
  action: (formData: FormData) => Promise<void>;
  hidden?: Record<string, string>;
  saveLabel?: string;
}) {
  const ids = items.map((i) => i.id).join(',');
  const [order, setOrder] = useState(items.map((i) => i.id));
  useEffect(() => setOrder(ids ? ids.split(',') : []), [ids]); // na een server-actie (verwijderen/toevoegen) volgt de lijst de nieuwe items (gemeten 2026-09-06: oude state bleef staan)
  const [dragging, setDragging] = useState<string | null>(null);
  const dirty = order.join(',') !== items.map((i) => i.id).join(',');
  const byId = new Map(items.map((i) => [i.id, i]));

  const move = (id: string, delta: number) => {
    setOrder((o) => {
      const i = o.indexOf(id);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= o.length) return o;
      const n = [...o];
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });
  };
  const dropOn = (targetId: string) => {
    if (!dragging || dragging === targetId) return;
    setOrder((o) => {
      const n = o.filter((x) => x !== dragging);
      n.splice(n.indexOf(targetId), 0, dragging);
      return n;
    });
  };

  return (
    <form action={action} data-sortable>
      {hidden && Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <input type="hidden" name="order" value={order.join(',')} />
      <ul className="flex flex-col gap-1">
        {order.filter((id) => byId.has(id)).map((id, i) => (
          <li
            key={id}
            data-sortable-item={id}
            draggable
            onDragStart={() => setDragging(id)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => dropOn(id)}
            onDragEnd={() => setDragging(null)}
            className="ad-card flex items-center gap-3 px-3 py-2"
            style={{ opacity: dragging === id ? 0.5 : 1 }}
          >
            <span className="cursor-grab select-none" style={{ color: 'var(--ad-muted-fg)' }} aria-hidden="true" title="Drag to reorder">⋮⋮</span>
            <div className="min-w-0 flex-1">{byId.get(id)?.node}</div>
            <div className="flex items-center gap-1">
              <button type="button" className="ad-btn ad-btn-ghost !h-7 !w-7 !p-0 justify-center" aria-label={`Move up ${i + 1}`} disabled={i === 0} onClick={() => move(id, -1)}>▲</button>
              <button type="button" className="ad-btn ad-btn-ghost !h-7 !w-7 !p-0 justify-center" aria-label={`Move down ${i + 1}`} disabled={i === order.length - 1} onClick={() => move(id, 1)}>▼</button>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-center gap-3">
        <button type="submit" className="ad-btn ad-btn-primary" disabled={!dirty} data-save-order>{saveLabel}</button>
        {dirty && <span className="ad-help">Order changed — not saved yet</span>}
      </div>
    </form>
  );
}
