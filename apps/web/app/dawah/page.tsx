import Link from 'next/link';

export const metadata = { title: 'Dawah — Albunyaan TV' };

/** Ported verbatim from the live site's /pages/dawah (2026-07-12). */
export default function Page() {
  return (
    <div className="max-w-2xl mx-auto px-5 py-24">
      <div className="text-center mb-12">
        <p className="section-label">Da&rsquo;wah</p>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mt-2">Dawah projects</h1>
      </div>

      <div className="space-y-5 text-[15px] text-ink-secondary leading-relaxed">
        <p>
          Albunyaan supports multiple foundations that engage in various projects to spread the
          Dawah (invitation to Allah). These projects aim to reach both Muslims and non-Muslims.
          It is important to emphasize that all proceeds from Albunyaan are directly forwarded to
          these foundations, enabling them to continue and expand their important work.
        </p>
        <p>Let&rsquo;s take a look at some of these foundations and their efforts:</p>
      </div>

      <div className="mt-10 space-y-6">
        <div className="card-elevated rounded-2xl p-6">
          <h2 className="text-lg font-bold text-ink">Stichting Al-Istiqaamah</h2>
          <p className="mt-2 text-[14px] text-ink-secondary leading-relaxed">
            Stichting Al-Istiqaamah is a non-profit Islamic relief organization that focuses on
            providing assistance to girls and women aged twelve and above. With their team of
            expert scholars, they draw upon the sources of the Qor&rsquo;aan, the Sunnah of the
            Prophet ﷺ and the Sunnah of his companions to offer a holistic approach to addressing
            social, societal, spiritual, educational, and other issues. Through guidance and
            support, they strive to help these women overcome their challenges and lead a life in
            accordance with the Pleasure of Allaah.
          </p>
        </div>

        <div className="card-elevated rounded-2xl p-6">
          <h2 className="text-lg font-bold text-ink">Tarbiyah Consultancy</h2>
          <p className="mt-2 text-[14px] text-ink-secondary leading-relaxed">
            Tarbiyah Consultancy is a renowned non-profit organization that focuses on providing
            educational programs, courses, and activities to the Muslim community. Their aim is
            to help people understand and practice Islam correctly, based on the teachings of the
            Qor&rsquo;aan, the Sunnah of the Prophet ﷺ and the Sunnah of his companions. In this
            regard, they have released two valuable publications:
          </p>
          <ul className="mt-3 list-disc pl-5 text-[14px] text-ink-secondary space-y-1">
            <li>Appointment with the King</li>
            <li>The Mercy of Islaam for Non-Muslims</li>
          </ul>
        </div>
      </div>

      <div className="text-center mt-12">
        <p className="text-[15px] text-ink-secondary leading-relaxed">
          Motivated by the projects? Invest in your Hereafter through ongoing charitable giving
          (sadaqah jaariyah) now.
        </p>
        <Link
          href="/donate"
          className="inline-flex mt-6 px-7 py-3.5 rounded-full bg-brand hover:bg-brand-light transition text-white font-semibold text-[15px]"
        >
          Invest now
        </Link>
        <p className="mt-8">
          <Link href="/catalog" className="text-[13px] font-semibold text-ink-muted hover:text-brand transition">
            ← Back to the catalog
          </Link>
        </p>
      </div>
    </div>
  );
}
