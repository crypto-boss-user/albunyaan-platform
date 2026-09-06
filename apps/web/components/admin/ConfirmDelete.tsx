/**
 * Verwijderknop met bevestiging in de Uscreen-vorm (⋯ → Delete → dialoog met tekst + Cancel/Delete), zonder client-JS:
 * een <details> als paneel, de echte verwijdering is een server-action-submit. AD 1.3.
 */
export default function ConfirmDelete({
  label,
  text,
  action,
  hidden,
}: {
  label: string;
  text: string;
  action: (formData: FormData) => Promise<void>;
  hidden: Record<string, string>;
}) {
  return (
    <details className="ad-rowmenu" data-confirm-delete>
      <summary className="ad-btn ad-btn-outline" style={{ color: 'var(--ad-destructive)' }}>{label}</summary>
      <div className="!min-w-[320px] p-4">
        <p className="mb-3 font-semibold">{label}?</p>
        <p className="ad-help mb-4">{text}</p>
        <form action={action} className="flex justify-end gap-2">
          {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
          <button type="submit" className="ad-btn ad-btn-primary !w-auto" style={{ background: 'var(--ad-destructive)' }}>{label}</button>
        </form>
      </div>
    </details>
  );
}
