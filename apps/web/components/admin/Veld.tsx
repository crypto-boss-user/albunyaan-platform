/**
 * Veldweergave in de Uscreen-vorm voor Settings (AD 2.2, server component): label, invoer, uitlegregel; `uitgeschakeld` = reden
 * (tooltip + regel), dan is het veld disabled en komt het niet in de server action (geen spec in settings/spec.ts).
 */
export function Veld({
  label,
  name,
  value,
  help,
  uitgeschakeld,
  type = 'text',
  placeholder,
}: {
  label: string;
  name: string;
  value?: string | number | null;
  help?: string;
  uitgeschakeld?: string;
  type?: 'text' | 'url' | 'number' | 'email';
  placeholder?: string;
}) {
  return (
    <div className="mb-4" data-veld={name}>
      <label className="ad-label" htmlFor={name}>{label}</label>
      <input id={name} name={name} type={type} defaultValue={value ?? ''} placeholder={placeholder} className="ad-input" disabled={!!uitgeschakeld} title={uitgeschakeld} />
      {(help || uitgeschakeld) && <p className="ad-help mt-1">{uitgeschakeld ? `Uitgeschakeld — ${uitgeschakeld}` : help}</p>}
    </div>
  );
}

export function Keuze({
  label,
  name,
  value,
  opties,
  help,
  uitgeschakeld,
}: {
  label: string;
  name: string;
  value: string;
  opties: readonly string[];
  help?: string;
  uitgeschakeld?: string;
}) {
  return (
    <div className="mb-4" data-veld={name}>
      <label className="ad-label" htmlFor={name}>{label}</label>
      <select id={name} name={name} defaultValue={value} className="ad-select" disabled={!!uitgeschakeld} title={uitgeschakeld}>
        {opties.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
      {(help || uitgeschakeld) && <p className="ad-help mt-1">{uitgeschakeld ? `Uitgeschakeld — ${uitgeschakeld}` : help}</p>}
    </div>
  );
}

export function Schakelaar({ label, name, checked, help, uitgeschakeld }: { label: string; name: string; checked: boolean; help?: string; uitgeschakeld?: string }) {
  return (
    <div className="mb-4 flex items-start gap-3" data-veld={name}>
      <input id={name} name={name} type="checkbox" defaultChecked={checked} disabled={!!uitgeschakeld} title={uitgeschakeld} className="mt-1 size-4" role="switch" aria-checked={checked} />
      <div>
        <label className="ad-label !mb-0" htmlFor={name}>{label}</label>
        {(help || uitgeschakeld) && <p className="ad-help">{uitgeschakeld ? `Uitgeschakeld — ${uitgeschakeld}` : help}</p>}
      </div>
    </div>
  );
}

/** Knop zonder werking, met de reden zichtbaar (founder-regel: geen dode knoppen — uitgeschakeld + reden). */
export function KnopUit({ label, reden, primair }: { label: string; reden: string; primair?: boolean }) {
  return (
    <button type="button" className={`ad-btn ${primair ? 'ad-btn-primary' : 'ad-btn-outline'}`} disabled title={`${label} — ${reden}`} data-knop-uit={label}>
      {label}
    </button>
  );
}

export function Sectie({ kop, tekst, children }: { kop: string; tekst?: string; children: React.ReactNode }) {
  return (
    <section className="ad-card mb-6 p-6" data-sectie={kop}>
      <h2 className="text-[16px] font-semibold">{kop}</h2>
      {tekst && <p className="ad-help mb-4 mt-1">{tekst}</p>}
      {!tekst && <div className="mb-4" />}
      {children}
    </section>
  );
}
