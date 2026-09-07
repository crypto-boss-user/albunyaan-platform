import SettingsForm from '../../../../components/admin/SettingsForm';
import { requireAdmin } from '../../../../lib/admin';

export const dynamic = 'force-dynamic';

/** Settings › Exported files (settings-exported-files.json): tabel File name · Note · Status · Export date; hier eerlijk leeg (geen exports in de eigen admin; export per sectie komt later). */
export default async function ExportedFilesPage() {
  await requireAdmin();
  return (
    <SettingsForm kop="Exported files">
      <div className="ad-card">
        <table className="ad-table" data-exported-files>
          <thead><tr><th>File name</th><th>Note</th><th>Status</th><th>Export date</th></tr></thead>
          <tbody>
            <tr><td colSpan={4} className="ad-help">No exported files yet — exports per sectie (People, Sales) komen na de betaal- en ledenbeslissing.</td></tr>
          </tbody>
        </table>
        <div className="flex items-center gap-3 p-4 text-[14px]" style={{ borderTop: '1px solid var(--ad-border)' }}>
          <button type="button" className="ad-btn ad-btn-outline" disabled>Previous</button>
          <button type="button" className="ad-btn ad-btn-outline" disabled>Next</button>
        </div>
      </div>
    </SettingsForm>
  );
}
