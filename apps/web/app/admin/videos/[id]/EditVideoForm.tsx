'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import type { AdminVideoRow } from '@albunyaan/core/data';
import { STATUS_BADGE, STATUS_LABEL } from '../../../../components/admin/format';
import { updateVideoAction, type VideoEditState } from '../actions';

const initial: VideoEditState = { error: null, saved: false };

function Card({ title, help, children }: { title: string; help?: string; children: React.ReactNode }) {
  return (
    <section className="ad-card p-6" data-card={title}>
      <h2 className="mb-4 text-[16px] font-semibold">{title}</h2>
      {help && <p className="ad-help -mt-3 mb-4">{help}</p>}
      {children}
    </section>
  );
}

/**
 * Detailformulier in de Uscreen-vorm (AD0-inventaris §2.1): links About · Thumbnails · Organize · SEO, rechts Video · Visibility ·
 * Access · Subscription & Pricing · Subtitles · Audio · Preview. Velden die op een beslissing wachten (kijkplatform KP, betaal BT)
 * zijn zichtbaar maar uitgeschakeld met de reden; Age rating blijft (founder 2026-09-06 (c)).
 */
export default function EditVideoForm({
  video,
  categories,
  categoryIds,
}: {
  video: AdminVideoRow;
  categories: { id: string; name: string }[];
  categoryIds: string[];
}) {
  const [state, formAction, pending] = useActionState(updateVideoAction, initial);
  const [status, setStatus] = useState<AdminVideoRow['status']>(video.status);
  const [shortLen, setShortLen] = useState(video.short_description.length);
  const publishAtLocal = video.publish_at ? new Date(video.publish_at).toISOString().slice(0, 16) : '';

  return (
    <form action={formAction} className="mx-auto max-w-[1120px]" data-video-form>
      <input type="hidden" name="id" value={video.id} />

      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-[20px] font-semibold leading-7">{video.title}</h1>
          <p className="ad-help">
            <span className={STATUS_BADGE[video.status]}>{STATUS_LABEL[video.status]}</span>
            <span className="ml-2 font-mono">{video.slug}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          {state.error && <p className="text-[13px] font-medium" style={{ color: 'var(--ad-destructive)' }} data-form-error>{state.error}</p>}
          {state.saved && !state.error && <p className="text-[13px] font-medium" style={{ color: 'var(--ad-primary)' }} data-form-saved>Changes saved</p>}
          <button type="submit" disabled={pending} className="ad-btn ad-btn-primary">{pending ? 'Saving…' : 'Save changes'}</button>
        </div>
      </div>

      <div className="grid gap-6" style={{ gridTemplateColumns: '2fr 1fr' }}>
        <div className="flex flex-col gap-6">
          <Card title="About">
            <label className="ad-label" htmlFor="title">Title</label>
            <input id="title" name="title" defaultValue={video.title} required className="ad-input mb-4" />
            <label className="ad-label" htmlFor="description">Description <span className="ad-help">(HTML)</span></label>
            <textarea id="description" name="description" defaultValue={video.description} rows={6} className="ad-textarea mb-4 font-mono text-[13px]" />
            <label className="ad-label" htmlFor="short_description">Short description</label>
            <textarea
              id="short_description"
              name="short_description"
              defaultValue={video.short_description}
              maxLength={140}
              rows={2}
              className="ad-textarea"
              onChange={(e) => setShortLen(e.target.value.length)}
            />
            <p className="ad-help mt-1 text-right">{140 - shortLen} characters left</p>
          </Card>

          <Card title="Thumbnails">
            <div className="flex items-start gap-6">
              <div className="flex-1">
                <p className="font-medium">Horizontal thumbnail (1480×840px)</p>
                <p className="ad-help mb-3">Appears as a thumbnail on your catalog page. Cover uit het archief (posters-bucket); upload na kijkplatformkeuze.</p>
                <label className="ad-label" htmlFor="thumbnail_url">Cover URL</label>
                <input id="thumbnail_url" name="thumbnail_url" defaultValue={video.thumbnail_url ?? ''} placeholder="https://…" className="ad-input" />
              </div>
              <div className="h-[105px] w-[185px] shrink-0 overflow-hidden rounded" style={{ background: 'var(--ad-secondary)' }}>
                {video.thumbnail_url && <img src={video.thumbnail_url} alt="" className="h-full w-full object-cover" />}
              </div>
            </div>
          </Card>

          <Card title="Organize">
            <p className="ad-label">Categories</p>
            <div className="mb-4 flex flex-wrap gap-2" data-categories>
              {categories.map((c) => (
                <label key={c.id} className="inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1 text-[13px]" style={{ background: 'var(--ad-secondary)' }}>
                  <input type="checkbox" name="category_ids" value={c.id} defaultChecked={categoryIds.includes(c.id)} />
                  {c.name}
                </label>
              ))}
            </div>
            <Link href="/admin/categories" className="text-[13px]" style={{ color: 'var(--ad-primary)' }}>Manage categories</Link>
            <p className="ad-label mt-4">Authors</p>
            <p className="ad-help">You don't have any authors. <Link href="/admin/authors" style={{ color: 'var(--ad-primary)' }}>Authors</Link></p>
            <p className="ad-label mt-4">Custom filters</p>
            <p className="ad-help">Type · Subject — toewijzing per video volgt in AD stap 3. <Link href="/admin/custom-filters" style={{ color: 'var(--ad-primary)' }}>Manage filters</Link></p>
          </Card>

          <Card title="SEO">
            <label className="ad-label" htmlFor="seo_title">Website page title</label>
            <input id="seo_title" name="seo_title" defaultValue={video.seo?.meta_title ?? ''} maxLength={60} className="ad-input mb-4" />
            <p className="ad-label">Website URL</p>
            <p className="ad-input mb-4 flex items-center gap-1" style={{ color: 'var(--ad-muted-fg)' }}>
              <span>/watch/</span><span style={{ color: 'var(--ad-fg)' }}>{video.slug}</span>
            </p>
            <label className="ad-label" htmlFor="seo_description">Meta description</label>
            <textarea id="seo_description" name="seo_description" defaultValue={video.seo?.meta_description ?? ''} maxLength={170} rows={2} className="ad-textarea" />
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card title="Video">
            <div className="mb-3 aspect-video w-full overflow-hidden rounded" style={{ background: 'var(--ad-secondary)' }}>
              {video.thumbnail_url && <img src={video.thumbnail_url} alt="" className="h-full w-full object-cover" />}
            </div>
            <button type="button" className="ad-btn ad-btn-outline mb-2 w-full justify-center" disabled title="Replace — na kijkplatformkeuze">Replace</button>
            <p className="ad-help mb-2 text-center">Upload/Replace: na kijkplatformkeuze</p>
            {video.status === 'published' ? (
              <Link href={`/watch/${video.slug}`} className="ad-btn ad-btn-outline w-full justify-center">View on website</Link>
            ) : (
              <p className="ad-help text-center">View on website: na publiceren</p>
            )}
          </Card>

          <Card title="Visibility">
            <div className="flex flex-col gap-2" data-visibility>
              {(['draft', 'published', 'scheduled'] as const).map((s) => (
                <label key={s} className="flex items-center gap-2">
                  <input type="radio" name="status" value={s} checked={status === s} onChange={() => setStatus(s)} />
                  {STATUS_LABEL[s]}
                </label>
              ))}
              {video.status === 'live' && (
                <label className="flex items-center gap-2">
                  <input type="radio" name="status" value="live" checked={status === 'live'} onChange={() => setStatus('live')} />
                  Live (eigen status, geen Uscreen-naam)
                </label>
              )}
              {status === 'scheduled' && (
                <div className="mt-2">
                  <label className="ad-label" htmlFor="publish_at">Publish on <span className="ad-help">(UTC)</span></label>
                  <input id="publish_at" type="datetime-local" name="publish_at" defaultValue={publishAtLocal} className="ad-input" required />
                </div>
              )}
            </div>
          </Card>

          <Card title="Access">
            <label className="flex items-start gap-2">
              <input type="radio" name="access" value="subscription" defaultChecked={video.access === 'subscription'} className="mt-1" />
              <span>Gated<span className="ad-help block">Only users with access will be able to watch this content</span></span>
            </label>
            <label className="mt-2 flex items-start gap-2">
              <input type="radio" name="access" value="free" defaultChecked={video.access === 'free'} className="mt-1" />
              <span>Free for all users<span className="ad-help block">All users will be able to watch this content, including users that are not logged in</span></span>
            </label>
            <label className="ad-label mt-4" htmlFor="age_rating">Age rating {video.age_rating_source === 'unrated' && <span className="ad-help">(unrated)</span>}</label>
            <select id="age_rating" name="age_rating" defaultValue={video.age_rating} className="ad-select">
              <option value="all">All ages</option>
              <option value="7+">7+</option>
              <option value="13+">13+</option>
              <option value="16+">16+</option>
            </select>
          </Card>

          <Card title="Subscription & Pricing">
            <p className="ad-help">Subscription plans per video: nog niet gekoppeld — wacht op de betaalbeslissing (Uscreen: 11 plannen).</p>
          </Card>

          <Card title="Subtitles and captions">
            {video.subtitle_tracks.length === 0 ? <p className="ad-help">No subtitle tracks. Upload: na kijkplatformkeuze.</p> : (
              <ul className="text-[13px]">{video.subtitle_tracks.map((t, i) => <li key={i} className="font-mono">{JSON.stringify(t)}</li>)}</ul>
            )}
          </Card>

          <Card title="Audio track">
            {video.audio_tracks.length === 0 ? <p className="ad-help">No extra audio tracks. Upload: na kijkplatformkeuze.</p> : (
              <ul className="text-[13px]">{video.audio_tracks.map((t, i) => <li key={i} className="font-mono">{JSON.stringify(t)}</li>)}</ul>
            )}
          </Card>

          <Card title="Preview">
            <p className="ad-help">Free preview / Trailer: na kijkplatformkeuze.</p>
          </Card>
        </div>
      </div>
    </form>
  );
}
