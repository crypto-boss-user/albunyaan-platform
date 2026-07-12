'use client';

import { useActionState } from 'react';
import type { AdminVideoRow } from '@albunyaan/core/data';
import { updateVideoAction, type VideoEditState } from '../actions';

const initial: VideoEditState = { error: null, saved: false };

export default function EditVideoForm({ video }: { video: AdminVideoRow }) {
  const [state, formAction, pending] = useActionState(updateVideoAction, initial);

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="id" value={video.id} />

      <div>
        <label className="block text-[12px] font-semibold text-ink-secondary mb-1">Title</label>
        <input
          name="title"
          defaultValue={video.title}
          required
          className="w-full px-4 py-2.5 rounded-xl border border-black/15 text-[14px] focus:border-brand focus:outline-none"
        />
      </div>

      <div>
        <label className="block text-[12px] font-semibold text-ink-secondary mb-1">Short description</label>
        <input
          name="short_description"
          defaultValue={video.short_description}
          className="w-full px-4 py-2.5 rounded-xl border border-black/15 text-[14px] focus:border-brand focus:outline-none"
        />
      </div>

      <div>
        <label className="block text-[12px] font-semibold text-ink-secondary mb-1">Description</label>
        <textarea
          name="description"
          defaultValue={video.description}
          rows={5}
          className="w-full px-4 py-2.5 rounded-xl border border-black/15 text-[14px] font-mono focus:border-brand focus:outline-none"
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-[12px] font-semibold text-ink-secondary mb-1">Status</label>
          <select name="status" defaultValue={video.status} className="w-full px-3 py-2.5 rounded-xl border border-black/15 text-[14px]">
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="scheduled">Scheduled</option>
            <option value="live">Live channel</option>
          </select>
        </div>
        <div>
          <label className="block text-[12px] font-semibold text-ink-secondary mb-1">Access</label>
          <select name="access" defaultValue={video.access} className="w-full px-3 py-2.5 rounded-xl border border-black/15 text-[14px]">
            <option value="subscription">Subscription</option>
            <option value="free">Free</option>
          </select>
        </div>
        <div>
          <label className="block text-[12px] font-semibold text-ink-secondary mb-1">
            Age rating {video.age_rating_source === 'unrated' && <span className="text-amber-600">(unrated)</span>}
          </label>
          <select name="age_rating" defaultValue={video.age_rating} className="w-full px-3 py-2.5 rounded-xl border border-black/15 text-[14px]">
            <option value="all">All ages</option>
            <option value="7+">7+</option>
            <option value="13+">13+</option>
            <option value="16+">16+</option>
          </select>
        </div>
      </div>

      {state.error && <p className="text-[13px] text-red-600 font-medium">{state.error}</p>}
      {state.saved && <p className="text-[13px] text-brand font-medium">Saved.</p>}

      <button
        type="submit"
        disabled={pending}
        className="px-6 py-2.5 rounded-full bg-brand hover:bg-brand-light disabled:opacity-60 transition text-white font-semibold text-[14px]"
      >
        {pending ? 'Saving…' : 'Save changes'}
      </button>
    </form>
  );
}
