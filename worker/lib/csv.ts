/**
 * Minimal RFC-4180 CSV parser — no dependency, handles quoted fields,
 * embedded commas/newlines/escaped quotes ("" inside a quoted field).
 * Enough for Uscreen admin exports; not a general streaming parser
 * (fixture is ~500 rows, leads ~2.9k — memory is a non-issue).
 */

export function parseCsv(text: string): string[][] {
  // Strip BOM if present.
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
        } else {
          inQuotes = false;
          i += 1;
        }
      } else {
        field += ch;
        i += 1;
      }
    } else if (ch === '"') {
      inQuotes = true;
      i += 1;
    } else if (ch === ',') {
      row.push(field);
      field = '';
      i += 1;
    } else if (ch === '\r') {
      i += 1; // handled by the \n that follows (or ignored)
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i += 1;
    } else {
      field += ch;
      i += 1;
    }
  }
  // Final field/row (file without trailing newline).
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** Parse CSV text into objects keyed by the header row. Empty lines are skipped. */
export function parseCsvRecords(text: string): Record<string, string>[] {
  const rows = parseCsv(text);
  if (rows.length === 0) return [];
  const header = rows[0].map((h) => h.trim());
  const records: Record<string, string>[] = [];
  for (const cells of rows.slice(1)) {
    if (cells.length === 1 && cells[0].trim() === '') continue; // blank line
    const rec: Record<string, string> = {};
    header.forEach((h, idx) => {
      rec[h] = (cells[idx] ?? '').trim();
    });
    records.push(rec);
  }
  return records;
}
