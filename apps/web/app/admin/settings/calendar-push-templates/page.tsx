import SettingsForm from '../../../../components/admin/SettingsForm';
import { requireAdmin } from '../../../../lib/admin';
import bron from '../../../../../../reference/admin-2026-09/settings-ad2.json';
import { REDEN } from '../spec';

export const dynamic = 'force-dynamic';

/** Settings › Calendar push templates (settings-calendar-push-templates.json): kop "Calendar push notification templates", tabel Type · Time sent, 9 rijen; sjablonen zelf na kijkplatform/mail. */
export default async function CalendarPushTemplatesPage() {
  await requireAdmin();
  return (
    <SettingsForm kop="Calendar push notification templates">
      <p className="ad-help mb-4">Alleen de structuur (geen push-koppeling): {REDEN.kijkplatform} / {REDEN.mail}.</p>
      <div className="ad-card">
        <table className="ad-table" data-calendar-push>
          <thead><tr><th>Type</th><th>Time sent</th></tr></thead>
          <tbody>
            {bron.calendar_push_templates.map(([type, tijd], i) => (
              <tr key={i}><td className="font-medium">{type}</td><td>{tijd}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </SettingsForm>
  );
}
