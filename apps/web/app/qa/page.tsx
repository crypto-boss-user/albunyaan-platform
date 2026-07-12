import Link from 'next/link';

export const metadata = { title: 'Q&A — Albunyaan TV' };

const FAQ: { q: string; a: React.ReactNode }[] = [
  {
    q: 'How can I login?',
    a: (
      <>
        <p>Click the &ldquo;Log in&rdquo; button located at the top right corner.</p>
        <p>Fill in your email &amp; password.</p>
        <p>Click on &ldquo;Log in&rdquo; &amp; enjoy!</p>
        <p className="italic mt-2">Note: once you subscribe, your password will be sent to your email.</p>
      </>
    ),
  },
  {
    q: 'How can I watch Albunyaan on TV?',
    a: (
      <>
        <p>You can watch Albunyaan on TV through the following methods:</p>
        <ul className="list-disc pl-5 mt-2 space-y-1.5">
          <li>
            <strong>TV Box (best option):</strong> download the Albunyaan app directly onto your
            TV box for the best viewing experience, including parental controls.
          </li>
          <li>
            <strong>Android TV:</strong> download the Albunyaan app directly from the TV store.
          </li>
          <li>
            <strong>Chromecast:</strong> cast Albunyaan from your phone, tablet, or computer.
          </li>
          <li>
            <strong>TV browser:</strong> also possible via our website, though this may cause bugs
            and is the least recommended option.
          </li>
        </ul>
      </>
    ),
  },
  {
    q: 'Why is most of the content in Arabic?',
    a: (
      <>
        <p>
          Many people, especially parents living in Western countries, ask this question. While
          we have Dutch and English content available, we have deliberately chosen to prioritize
          Arabic as the most prominent language.
        </p>
        <p className="mt-2">
          This is the language every Muslim parent should prioritize for their children. Despite
          some people thinking that transitioning from their native language to Arabic is too
          difficult, this is not the case. Experience shows that everyone, especially children,
          can quickly master the language. The younger the child is, the easier it is for them to
          learn Arabic and understand Islam as a whole.
        </p>
        <p className="mt-2">
          Albunyaan is a tool that can help us motivate, encourage, and raise our children. The
          beginning will always be difficult, but if we as parents give up when our children want
          something different, we are feeding their desires.
        </p>
        <p className="mt-2">
          In fact, there have been parents who do not speak Arabic themselves, but their children
          nevertheless speak and write fluent Arabic with the help of the right multimedia content
          they are exposed to.
        </p>
      </>
    ),
  },
  {
    q: 'Why is Albunyaan not completely free?',
    a: (
      <>
        <p>
          Albunyaan is a non-profit da&rsquo;wah foundation. Everything we get is sadaqah, because
          it&rsquo;s being invested in the da&rsquo;wah. Everyone who participates in this is doing
          it for Allaah&rsquo;s sake.
        </p>
        <p className="mt-2">If we were able to, we would make it free for everyone.</p>
      </>
    ),
  },
  {
    q: 'Which payment methods do you provide?',
    a: <p>We provide iDeal, Visa, Mastercard, American Express, China UnionPay, Apple Pay, Google Pay, Bancontact, SEPA &amp; Link.</p>,
  },
  {
    q: 'How can I change my account password?',
    a: (
      <>
        <p>If you are using a web browser:</p>
        <ul className="list-disc pl-5 mt-2 space-y-1.5">
          <li>Go to the menu and hover the mouse over your photo.</li>
          <li>Click on &ldquo;Dashboard&rdquo;.</li>
          <li>Scroll down to find the button labeled &ldquo;Change password&rdquo;.</li>
          <li>Click on the button and enter your current password and your new password.</li>
          <li>Click on &ldquo;Save changes&rdquo;.</li>
        </ul>
        <p className="mt-2">Your password has been changed!</p>
      </>
    ),
  },
  {
    q: 'Can I contribute to Albunyaan?',
    a: (
      <>
        <p>Yes, definitely. You can contribute to Albunyaan in the following ways:</p>
        <ul className="list-disc pl-5 mt-2 space-y-1.5">
          <li>Donate to support this project and other similar Islamic projects.</li>
          <li>
            Share this project with your family, relatives, friends, and anyone you know in the
            Muslim community. &ldquo;Guiding someone to goodness is equivalent to the reward of
            the person who does it,&rdquo; as the Prophet ﷺ said.
          </li>
          <li>Inform us of any content that contains any violations of Islamic principles, whether in speech or action.</li>
        </ul>
      </>
    ),
  },
  {
    q: 'Can I be a sponsor?',
    a: (
      <p>
        Please email us at{' '}
        <a href="mailto:info@albunyaan.tv" className="text-brand font-semibold hover:underline">
          info@albunyaan.tv
        </a>{' '}
        with the details of your sponsorship, including the amount and duration.
      </p>
    ),
  },
  {
    q: 'Any other question?',
    a: (
      <p>
        <Link href="/contact" className="text-brand font-semibold hover:underline">
          Contact us here
        </Link>
        .
      </p>
    ),
  },
];

export default function Page() {
  return (
    <div className="max-w-2xl mx-auto px-5 py-24">
      <div className="text-center mb-12">
        <p className="section-label">Questions</p>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mt-2">Q&amp;A</h1>
        <p className="mt-4 text-[15px] text-ink-secondary leading-relaxed">
          Answers to common questions about the platform, subscriptions and our content policy.
        </p>
      </div>

      <div className="space-y-3">
        {FAQ.map((item, i) => (
          <details key={i} className="card-elevated rounded-2xl p-5 group">
            <summary className="cursor-pointer list-none flex items-center justify-between gap-4 font-semibold text-[15px] text-ink">
              {item.q}
              <svg
                width="14"
                height="8"
                viewBox="0 0 14 8"
                fill="none"
                className="shrink-0 transition-transform group-open:rotate-180"
                aria-hidden
              >
                <path d="M1 1L7 7L13 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </summary>
            <div className="mt-4 text-[14px] text-ink-secondary leading-relaxed">{item.a}</div>
          </details>
        ))}
      </div>

      <p className="text-center mt-12">
        <Link href="/catalog" className="text-[13px] font-semibold text-ink-muted hover:text-brand transition">
          ← Back to the catalog
        </Link>
      </p>
    </div>
  );
}
