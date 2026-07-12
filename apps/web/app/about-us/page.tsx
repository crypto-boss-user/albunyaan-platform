import Link from 'next/link';

export const metadata = { title: 'About us — Albunyaan TV' };

/** Ported verbatim from the live site's /pages/about-us (2026-07-12). */
export default function Page() {
  return (
    <div className="max-w-2xl mx-auto px-5 py-24">
      <div className="text-center mb-12">
        <p className="section-label">About</p>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mt-2">About us</h1>
      </div>

      <div className="space-y-5 text-[15px] text-ink-secondary leading-relaxed">
        <p>
          In 2011, the idea emerged among a group of knowledge-seeking students to provide
          entertaining content alongside acquiring knowledge, both for themselves and their
          children. At that time, this was scarcely available in the Netherlands. To start off,
          we filtered hundreds of movies and TV series under the guidance of scholars, and then
          offered this content in the form of a hard drive that could be connected to a computer.
          Many families purchased such a hard drive, and the idea began to take shape.
        </p>
        <p>
          By constantly checking our intentions, seeking advice from scholars, and placing our
          trust in Allah, we embarked on a journey of over 10 years to bring the multimedia
          platform Albunyaan to life. While striving towards a goal, challenges also came our
          way. One of them was financing the idea. Alhamdulillah, we managed to collect just
          enough money from various Muslims throughout the Netherlands who were willing to
          support Albunyaan for the sake of Allaah and recognized its potential. Another
          challenge was filtering the content. We invested a significant amount of time in this
          aspect. Every movie, series, and program was meticulously reviewed to remove music,
          inappropriate language, and misleading ideologies, among other things. The guidance of
          scholars was essential to ensure that the available content focused on the Qor&rsquo;aan,
          the Sunnah of the Prophet ﷺ, and the Sunnah of his companions.
        </p>
        <p>
          We are grateful to Allaah first and foremost, and then to everyone who contributed to
          the realization of Albunyaan. It was an intensive process to shape the idea into a
          respected multimedia platform, but this is not the final destination!
        </p>
        <p>
          Our ambition is to offer Albunyaan worldwide for the sake of Allaah. In addition to
          this lofty ambition, we continuously work on updating Albunyaan by providing content
          that assists families in practicing Islaam amidst the societal challenges of today.
          Step by step, we will move closer to our goal, but the most important aspect is that we
          must consistently check our intentions because the true goal is to attain the Pleasure
          of Allaah.
        </p>
      </div>

      <p className="text-center mt-12">
        <Link href="/catalog" className="text-[13px] font-semibold text-ink-muted hover:text-brand transition">
          ← Back to the catalog
        </Link>
      </p>
    </div>
  );
}
