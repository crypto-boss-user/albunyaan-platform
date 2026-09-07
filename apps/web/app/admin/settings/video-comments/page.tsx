import { getAdminSettings } from '@albunyaan/core/data';
import SettingsForm from '../../../../components/admin/SettingsForm';
import { Keuze, Sectie } from '../../../../components/admin/Veld';
import { hasRole, requireAdmin } from '../../../../lib/admin';
import { DEFAULTS, SECTIES } from '../spec';

export const dynamic = 'force-dynamic';

/** Settings › Video comments (settings-video-comments.json, bij Uscreen onder People): Access levels (view/post comboboxen) en Availability (radio Enable/Disable). Bewaard in admin_settings; de storefront (video_comments-tabel, 0 rijen) leest het nog niet. */
export default async function VideoCommentsPage() {
  const { admin } = await requireAdmin();
  const rolUit = hasRole(admin.role, 'admin') ? undefined : 'opslaan vereist de admin-rol'; // koude review AD 2.2 I-2: Save uit als de action zou weigeren
  const s = await getAdminSettings(SECTIES.video_comments.velden.map((v) => v.key));
  const v = (k: string) => (s[k] ?? DEFAULTS[k]) as string;
  const opties = (k: string) => { const f = SECTIES.video_comments.velden.find((x) => x.key === k); return f && f.type === 'enum' ? f.opties : []; }; // één bron (koude review M-2)
  const enabled = v('video_comments.enabled');
  return (
    <SettingsForm kop="Video comments" section="video_comments" uitgeschakeld={rolUit}>
      <Sectie kop="Access levels" tekst="Control who can view and post video comments.">
        <Keuze label="Access to view video comments" name="video_comments.access_view" value={v('video_comments.access_view')} opties={opties('video_comments.access_view')} />
        <Keuze label="Access to post video comments" name="video_comments.access_post" value={v('video_comments.access_post')} opties={opties('video_comments.access_post')} />
      </Sectie>
      <Sectie kop="Availability" tekst="Turn video comments on or off across your storefront.">
        <div className="flex flex-col gap-2" data-veld="video_comments.enabled">
          <label className="flex items-center gap-2"><input type="radio" name="video_comments.enabled" value="enabled" defaultChecked={enabled === 'enabled'} /> Enable video comments</label>
          <label className="flex items-center gap-2"><input type="radio" name="video_comments.enabled" value="disabled" defaultChecked={enabled === 'disabled'} /> Disable video comments</label>
        </div>
      </Sectie>
    </SettingsForm>
  );
}
