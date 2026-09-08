'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

/** Kopvakje "alles selecteren" voor de rij-checkboxes (name="ids", form="bulk") — Uscreen bulk-selectie (AD 1.2). */
export function SelectAllCheckbox() {
  const [checked, setChecked] = useState(false);
  const sp = useSearchParams(); // na client-navigatie (Next ›, zoekterm) zijn de rijen nieuw en dus niet geselecteerd → opnieuw meten (Codex D-4)
  useEffect(() => {
    const sync = () => {
      const boxes = Array.from(document.querySelectorAll<HTMLInputElement>('input[name="ids"]'));
      setChecked(boxes.length > 0 && boxes.every((b) => b.checked));
    };
    sync();
    document.addEventListener('change', sync);
    return () => document.removeEventListener('change', sync);
  }, [sp]);
  return (
    <input
      type="checkbox"
      aria-label="Select all rows"
      checked={checked}
      onChange={(e) => {
        document.querySelectorAll<HTMLInputElement>('input[name="ids"]').forEach((b) => { b.checked = e.target.checked; });
        setChecked(e.target.checked);
        document.dispatchEvent(new Event('change'));
      }}
    />
  );
}

/** Bulk-knoppen: pas actief zodra ≥ 1 rij geselecteerd is (geen dode knoppen). */
export function BulkButtons() {
  const [n, setN] = useState(0);
  const sp = useSearchParams(); // na client-navigatie (pagina/zoekterm) opnieuw tellen (koude review M-2)
  useEffect(() => {
    const sync = () => setN(document.querySelectorAll<HTMLInputElement>('input[name="ids"]:checked').length);
    sync();
    document.addEventListener('change', sync);
    return () => document.removeEventListener('change', sync);
  }, [sp]);
  return (
    <div className="flex items-center gap-2" data-bulk-bar>
      <span className="ad-help" data-bulk-count>{n} selected</span>
      <button type="submit" form="bulk" name="nextStatus" value="published" className="ad-btn ad-btn-outline !h-8" disabled={n === 0}>Publish</button>
      <button type="submit" form="bulk" name="nextStatus" value="draft" className="ad-btn ad-btn-outline !h-8" disabled={n === 0}>Unpublish</button>
    </div>
  );
}
