'use client';

import { useActionState } from 'react';
import { saveSettingsAction } from '../../app/admin/settings/actions';
import type { FormState } from '../../lib/admin-form';

/**
 * Formulierschil voor een Settings-pagina (AD 2.2): kop links, Save rechts (Uscreen: "Save" in de paginakop), daaronder de velden
 * (server-gerenderd als children). `uitgeschakeld` = reden waarom Save uit staat (bv. "tot de betaalbeslissing"); dan is er geen action.
 */
export default function SettingsForm({
  kop,
  section,
  uitgeschakeld,
  extra,
  children,
}: {
  kop: string;
  section?: string;
  uitgeschakeld?: string;
  extra?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(saveSettingsAction, { error: null, saved: false } as FormState);
  return (
    <form action={section && !uitgeschakeld ? formAction : undefined} className="mx-auto max-w-[1120px]" data-settings-page={section ?? kop}>
      {section && <input type="hidden" name="section" value={section} />}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-[20px] font-semibold leading-7">{kop}</h1>
        <div className="flex items-center gap-3">
          {extra}
          {(section || uitgeschakeld) && (
            <>
              {uitgeschakeld && <span className="ad-help">{uitgeschakeld}</span>}
              <button type="submit" className="ad-btn ad-btn-primary" disabled={pending || !!uitgeschakeld} title={uitgeschakeld ? `Save — ${uitgeschakeld}` : undefined} data-save>
                {pending ? 'Saving…' : 'Save'}
              </button>
            </>
          )}
        </div>
      </div>
      {state.error && <p className="mb-4 text-[13px]" style={{ color: 'var(--ad-destructive)' }} data-form-error>{state.error}</p>}
      {state.saved && !state.error && <p className="mb-4 text-[13px]" style={{ color: 'var(--ad-primary)' }} data-form-saved>Settings saved</p>}
      {children}
    </form>
  );
}
