import Link from 'next/link';
import { PEOPLE_STATUS_OPTIONS, PEOPLE_TYPE_OPTIONS, listPeopleForAdmin } from '@albunyaan/core/data';
import { requireAdmin } from '../../../lib/admin';
import { fmtDate, initials } from '../../../components/admin/format';

export const dynamic = 'force-dynamic';

/**
 * People › All in de Uscreen-vorm (AD 1.4; norm AD0-inventaris §2.2): kop "People" + Add member (uitgeschakeld tot de ledenmigratie),
 * zoekveld "Search by name or email", Filter by user type / status / tags, tabel avatar+naam+e-mail · Tags · Status · Lifetime ·
 * Creation date, 25 per pagina. Alleen lezen (bewerken van leden = T2, ledenmigratie). Waarden komen uit de Uscreen-export in people.raw.
 */
const STATUS_LABEL: Record<string, string> = { active: 'Active', lead: '—', churned: 'Churned', new: 'New', pending_cancellation: 'Pending cancellation', reactivated: 'Reactivated', on_hold: 'On hold' };

export default async function AdminPeoplePage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; type?: string; page?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const q = typeof sp.q === 'string' ? sp.q : ''; // ?q=a&q=b → array (koude review M-1)
  const status = (PEOPLE_STATUS_OPTIONS as readonly string[]).includes(sp.status ?? '') ? (sp.status as (typeof PEOPLE_STATUS_OPTIONS)[number]) : undefined;
  const type = (PEOPLE_TYPE_OPTIONS as readonly string[]).includes(sp.type ?? '') ? (sp.type as (typeof PEOPLE_TYPE_OPTIONS)[number]) : undefined;
  const page = Math.max(1, Number(sp.page ?? '1') || 1);
  const { rows, total, perPage } = await listPeopleForAdmin({ q: q || undefined, status, type, page });
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const qs = (p: number) => { const u = new URLSearchParams(); if (q) u.set('q', q); if (status) u.set('status', status); if (type) u.set('type', type); if (p > 1) u.set('page', String(p)); const s = u.toString(); return s ? `?${s}` : ''; };
  const pageLinks = Array.from(new Set([1, 2, page - 1, page, page + 1, totalPages].filter((p) => p >= 1 && p <= totalPages))).sort((a, b) => a - b);

  return (
    <div className="mx-auto max-w-[1120px]" data-people-page>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-[20px] font-semibold leading-7">People</h1>
        <div className="flex items-center gap-3">
          <span className="ad-help">Add member: wacht op de ledenmigratie</span>
          <button type="button" className="ad-btn ad-btn-primary" disabled title="Add member — wacht op de ledenmigratie (T2)">Add member</button>
        </div>
      </div>
      <div className="ad-card">
        <form action="/admin/people" className="flex flex-wrap items-center gap-3 p-4" style={{ borderBottom: '1px solid var(--ad-border)' }}>
          <input type="search" name="q" defaultValue={q} placeholder="Search by name or email" aria-label="Search by name or email" className="ad-input !w-72" />
          <select name="type" defaultValue={type ?? ''} aria-label="Filter by user type" className="ad-select !w-44">
            <option value="">Filter by user type</option>
            <option value="member">Member</option>
            <option value="lead">Lead</option>
          </select>
          <select name="status" defaultValue={status ?? ''} aria-label="Filter by status" className="ad-select !w-48">
            <option value="">Filter by status</option>
            {PEOPLE_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_LABEL[s] === '—' ? 'Lead' : STATUS_LABEL[s]}</option>)}
          </select>
          <select aria-label="Filter by tags" className="ad-select !w-40" disabled title="Tags: geen tags in de export (0 van 2.928)">
            <option>Filter by tags</option>
          </select>
          <button type="submit" className="ad-btn ad-btn-outline">Apply</button>
        </form>
        <table className="ad-table" data-people-table>
          <thead>
            <tr>
              <th>{total.toLocaleString('de-DE')} people</th>
              <th>Tags</th>
              <th>Status</th>
              <th>Lifetime</th>
              <th>Creation date</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={5} className="!py-10 text-center" style={{ color: 'var(--ad-muted-fg)' }}>No people match.</td></tr>}
            {rows.map((p) => {
              const raw = p.raw ?? {};
              const st = raw.Status ?? '';
              return (
                <tr key={p.id} data-person-row={p.id}>
                  <td>
                    <Link href={`/admin/people/${p.id}`} className="flex items-center gap-3 hover:underline">
                      <span className="grid size-8 shrink-0 place-items-center rounded-full text-[12px] font-semibold" style={{ background: 'var(--ad-accent)', color: 'var(--ad-primary)' }}>{initials(p.full_name, p.email)}</span>
                      <span className="min-w-0"><span className="block truncate font-medium">{p.full_name ?? '—'}</span><span className="block truncate text-[12px]" style={{ color: 'var(--ad-muted-fg)' }}>{p.email}</span></span>
                    </Link>
                  </td>
                  <td style={{ color: 'var(--ad-muted-fg)' }}>{raw.Tags || '---'}</td>
                  <td>{st === 'active' ? <span className="ad-badge ad-badge-published">Active</span> : <span style={{ color: 'var(--ad-muted-fg)' }}>{STATUS_LABEL[st] ?? '---'}</span>}</td>
                  <td style={{ color: 'var(--ad-muted-fg)' }}>{raw.Lifetime ?? '—'}</td>
                  <td style={{ color: 'var(--ad-muted-fg)' }}>{fmtDate(p.signup_at ?? p.created_at)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="flex items-center justify-between gap-3 p-4 text-[14px]" data-pagination>
          <span style={{ color: 'var(--ad-muted-fg)' }}>Showing {total === 0 ? 0 : (page - 1) * perPage + 1}–{Math.min(total, page * perPage)} of {total.toLocaleString('de-DE')} people</span>
          <div className="flex items-center gap-1">
            <Link href={`/admin/people${qs(Math.max(1, page - 1))}`} className={`ad-btn ad-btn-ghost !h-8 ${page <= 1 ? 'pointer-events-none opacity-40' : ''}`}>‹ Previous</Link>
            {pageLinks.map((p, i) => (
              <span key={p} className="flex items-center gap-1">
                {i > 0 && pageLinks[i - 1] !== p - 1 && <span style={{ color: 'var(--ad-muted-fg)' }}>…</span>}
                <Link href={`/admin/people${qs(p)}`} aria-current={p === page ? 'page' : undefined} className={`ad-btn !h-8 !min-w-8 !px-2 justify-center ${p === page ? 'ad-btn-outline' : 'ad-btn-ghost'}`}>{p}</Link>
              </span>
            ))}
            <Link href={`/admin/people${qs(Math.min(totalPages, page + 1))}`} className={`ad-btn ad-btn-ghost !h-8 ${page >= totalPages ? 'pointer-events-none opacity-40' : ''}`}>Next ›</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
