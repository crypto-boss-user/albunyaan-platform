import { listPlatformAdmins } from '@albunyaan/core/data';
import SettingsForm from '../../../../components/admin/SettingsForm';
import { KnopUit } from '../../../../components/admin/Veld';
import { requireAdmin } from '../../../../lib/admin';
import { REDEN } from '../spec';

export const dynamic = 'force-dynamic';

/** Settings › Team (eigen kaart, founder 2026-09-07): lijst uit platform_admins (rol, e-mail, notitie, sinds); toevoegen/verwijderen = T2 → alleen tonen en melden. */
export default async function TeamPage() {
  await requireAdmin('admin'); // beheerdersadressen alleen voor admin/owner (koude review M-5)
  const admins = await listPlatformAdmins();
  return (
    <SettingsForm kop="Team" extra={<KnopUit label="Add admin" reden={REDEN.team} primair />}>
      <p className="ad-help mb-4">Beheerders van deze admin ({admins.length}). Rollen: owner ⊃ admin ⊃ editor ⊃ support. Wijzigen gebeurt buiten de UI (T2, founder-ja).</p>
      <div className="ad-card">
        <table className="ad-table" data-team>
          <thead><tr><th>Email</th><th>Role</th><th>Note</th><th>Since</th><th /></tr></thead>
          <tbody>
            {admins.map((a) => (
              <tr key={a.auth_user_id}>
                <td>{a.email ?? '—'}</td>
                <td><span className="ad-badge ad-badge-muted">{a.role}</span></td>
                <td>{a.note ?? ''}</td>
                <td>{a.created_at.slice(0, 10)}</td>
                <td className="text-right"><KnopUit label="Remove" reden={REDEN.team} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SettingsForm>
  );
}
