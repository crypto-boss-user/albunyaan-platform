import Link from 'next/link';
import { requireAdmin } from '../../../../lib/admin';
import bron from '../../../../../../reference/admin-2026-09/landing-pages-sr2b.json';

export const dynamic = 'force-dynamic';

/**
 * Marketing › Website landing pages (AD 1.5; norm AD0-inventaris §2.3): lijst van de 9 gemeten pagina's met hun instellingen
 * (Page name, Page URL, SEO description, Active) uit SR 2b en de inhoud als tekst uit SR 2a. Alleen lezen: de page builder is buiten scope
 * (B81); "Create a page" is daarom aanwezig maar uitgeschakeld met reden.
 */
export default async function AdminLandingPagesPage() {
  await requireAdmin();
  const items = bron.items;
  return (
    <div className="mx-auto max-w-[1120px]" data-landing-pages>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-semibold leading-7">Landing pages</h1>
          <p className="ad-help">{items.length} pages · bron: {bron.bron}</p>
        </div>
        <button type="button" className="ad-btn ad-btn-primary" disabled title="Create a page — page builder buiten scope (B81)">Create a page</button>
      </div>
      <div className="ad-card">
        <table className="ad-table" data-landing-pages-table>
          <thead><tr><th>Page</th><th>URL</th><th>Active</th><th>Content</th></tr></thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id} data-landing-page={p.id}>
                <td><Link href={`/admin/marketing/landing-pages/${p.id}`} className="font-medium hover:underline">{p.naam}</Link></td>
                <td className="font-mono text-[13px]" style={{ color: 'var(--ad-muted-fg)' }}>/pages/{p.page_url}</td>
                <td>{p.active ? <span className="ad-badge ad-badge-published">Active</span> : <span className="ad-badge ad-badge-muted">Inactive</span>}</td>
                <td style={{ color: 'var(--ad-muted-fg)' }}>{p.doorgestuurd_naar ? 'doorgestuurd (login vereist)' : p.tekst ? `${p.tekst.length.toLocaleString('en-US')} chars (EN)` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
