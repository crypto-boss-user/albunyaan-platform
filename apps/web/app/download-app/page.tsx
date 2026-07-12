import Link from 'next/link';

export const metadata = { title: 'Download app — Albunyaan TV' };

/**
 * Honest status page (WS10) — no app store links yet, mobile/TV apps are a
 * deferred workstream (see the platform program plan). NOT the cutover
 * comms copy for existing app subscribers (that's a separate, dated,
 * founder-approved message sent when a real cutover date exists) — this is
 * just today's truthful "where things stand."
 */
export default function DownloadAppPage() {
  return (
    <div className="max-w-xl mx-auto px-5 py-28 text-center">
      <p className="section-label">Apps</p>
      <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mt-2 mb-4">Download app</h1>
      <p className="text-[15px] text-ink-secondary leading-relaxed">
        We&rsquo;re building new iOS, Android and TV apps for Albunyaan TV — with offline
        downloads and kid profiles built in from day one. They&rsquo;re still in development and
        not available to download yet.
      </p>
      <p className="mt-4 text-[15px] text-ink-secondary leading-relaxed">
        If you already have the current Albunyaan TV app, keep using it as normal — nothing
        changes for existing app subscribers today. We&rsquo;ll email clear instructions well
        ahead of any change.
      </p>
      <Link
        href="/catalog"
        className="inline-flex mt-9 px-7 py-3.5 rounded-full bg-brand hover:bg-brand-light transition text-white font-semibold text-[15px]"
      >
        Watch on the web instead
      </Link>
    </div>
  );
}
