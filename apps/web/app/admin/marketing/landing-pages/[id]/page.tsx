import { notFound } from 'next/navigation';
import { requireAdmin } from '../../../../../lib/admin';
import bron from '../../../../../../../reference/admin-2026-09/landing-pages-sr2b.json';

export const dynamic = 'force-dynamic';

/** Landing page: Settings (Page name, Page URL, SEO description, Active) zoals gemeten in de page builder + inhoud als tekst (SR 2a). Alleen lezen. */
export default async function AdminLandingPageDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const p = bron.items.find((x) => x.id === id);
  if (!p) notFound();
  return (
    <div className="mx-auto max-w-[1120px]" data-landing-page-detail>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-[20px] font-semibold leading-7">{p.naam}</h1>
        <div className="flex items-center gap-3">
          <a href={`https://albunyaan.tv/pages/${p.page_url}`} target="_blank" rel="noreferrer" className="ad-btn ad-btn-outline">Preview on albunyaan.tv</a>
          <button type="button" className="ad-btn ad-btn-primary" disabled title="Bewerken — page builder buiten scope (B81)">Edit in builder</button>
        </div>
      </div>
      <div className="grid gap-6" style={{ gridTemplateColumns: '1fr 2fr' }}>
        <section className="ad-card p-6" data-card="Settings">
          <h2 className="mb-4 text-[16px] font-semibold">Settings</h2>
          {[['Page name', p.page_name], ['Page URL', `/pages/${p.page_url}`], ['SEO description', p.seo_description || '—'], ['Active', p.active ? 'Yes' : 'No']].map(([l, v]) => (
            <div key={l} className="mb-4"><p className="ad-label">{l}</p><p className="ad-input" style={{ color: 'var(--ad-fg)' }}>{v}</p></div>
          ))}
          <p className="ad-help">Gemeten {p.gemeten.slice(0, 10)} (SR 2b); instellingen zijn alleen lezen tot de page builder gebouwd wordt.</p>
        </section>
        <section className="ad-card p-6" data-card="Content">
          <h2 className="mb-1 text-[16px] font-semibold">Content (text, EN, 1440)</h2>
          {p.doorgestuurd_naar ? (
            <p className="ad-help">Anoniem doorgestuurd naar {p.doorgestuurd_naar.replace('https://albunyaan.tv', '')} — inhoud niet gemeten (login vereist; SR 2a).</p>
          ) : (
            <>
              <p className="ad-help mb-3">Bron: {p.tekst_bron ?? 'geen tekstextract'}</p>
              {p.tekst ? <pre className="whitespace-pre-wrap rounded p-4 text-[13px] leading-5" style={{ background: 'var(--ad-muted)' }}>{p.tekst}</pre> : <p className="ad-help">Geen inhoud vastgelegd.</p>}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
