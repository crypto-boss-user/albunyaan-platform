/**
 * Placeholder voor een scope-sectie die nog geen functie heeft (AD 1.1, founder-regel: eerlijk leeg, geen dode knoppen).
 * Toont de gemeten Uscreen-kop en de stap waarin de sectie gebouwd wordt.
 */
export default function NogNietGebouwd({ kop, stap, tekst }: { kop: string; stap: number; tekst?: string }) {
  return (
    <div data-nog-niet-gebouwd className="mx-auto max-w-[1120px]">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-[20px] font-semibold leading-7">{kop}</h1>
      </div>
      <div className="ad-card px-6 py-16 text-center">
        <p className="text-[16px] font-semibold">Nog niet gebouwd — AD stap {stap}</p>
        {tekst && <p className="mt-2 text-[14px]" style={{ color: 'var(--ad-muted-fg)' }}>{tekst}</p>}
      </div>
    </div>
  );
}
