import SettingsForm from '../../../../components/admin/SettingsForm';
import { requireAdmin } from '../../../../lib/admin';
import bron from '../../../../../../reference/admin-2026-09/settings-ad2.json';
import { REDEN } from '../spec';

export const dynamic = 'force-dynamic';

/** Settings › Email templates (SR 2b email-templates/00-lijst.json): tabel Title · Description · Enabled, 21 sjablonen; bewerken na de mailbeslissing. Eigen sjablonen: supabase/templates (magic link, e-mailwijziging). */
export default async function EmailTemplatesPage() {
  await requireAdmin();
  return (
    <SettingsForm kop="Email templates">
      <p className="ad-help mb-4">Uscreen-lijst als norm (SR 2b, 21 sjablonen). Eigen platform nu: 2 Supabase-sjablonen (magic link, e-mailwijziging) in supabase/templates. Bewerken: {REDEN.mail}.</p>
      <div className="ad-card">
        <table className="ad-table" data-email-templates>
          <thead><tr><th>Title</th><th>Description</th><th>Enabled</th></tr></thead>
          <tbody>
            {bron.email_templates.map((t) => (
              <tr key={t.title}><td className="font-medium">{t.title}</td><td>{t.description}</td><td>{t.enabled}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </SettingsForm>
  );
}
