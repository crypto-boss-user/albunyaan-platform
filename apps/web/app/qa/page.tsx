import type { Metadata } from 'next';
import Link from 'next/link';
import { BUTTON } from '../../components/storefront';

/**
 * SR 4 stap 8 — Q&A 1:1 de gemeten storefront (SR 2a page-qa__1440__en = Uscreen page-builder landing page #52371):
 * h2 "Frequently Asked Questions" + 9 vragen als accordeon (<details>/<summary>, grijze kaart rgba(232,233,232), dicht zoals
 * gemeten), daarna h2 "Who are we?" + intro + knop + introvideo (poster). Teksten letterlijk gekopieerd (AI herformuleert
 * niets); lijsttypen zoals de bron (ol bij login/TV/contribute, ul bij wachtwoord). De page-builder-eigen kop/voet van de
 * landing page vervallen — onze layout levert header/footer. AANNAMES (aanpasbaar): "Watch our Content" (storefront →
 * /pages/form) → /login zoals de andere aanmeldknoppen; "Downloads Page" → /download-app, "Contact us here" → /contact;
 * speler = poster (var/storefront-referentie/assets/qa-poster-Albunyaan_En.jpg, byte-identiek), geen afspeelknop.
 */
export const metadata: Metadata = { title: 'Q&A' };

const A = 'mt-5 text-[15px] leading-relaxed text-ink space-y-3';
const OL = 'list-decimal ps-5 space-y-1';
const UL = 'list-disc ps-5 space-y-1';

function Faq({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <details className="p-6 mb-3 rounded bg-[#e8e9e8]">
      <summary className="cursor-pointer text-[17px] font-bold text-ink list-none flex items-center justify-between gap-4 [&::-webkit-details-marker]:hidden">
        {q}
        <svg width="14" height="14" viewBox="0 0 14 8" aria-hidden className="shrink-0">
          <path d="M1 1l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      </summary>
      <div className={A}>{children}</div>
    </details>
  );
}

export default function Page() {
  return (
    <>
      <section data-block="FAQ" className="bg-white py-12 md:py-24 px-4">
        <div className="max-w-xl mx-auto text-center mb-8 md:mb-16">
          <h2 className="text-2xl md:text-3xl font-bold text-ink">Frequently Asked Questions</h2>
        </div>
        <div className="w-full max-w-3xl mx-auto">
          <Faq q="How can I login?">
            <ol className={OL}>
              <li>Click the &apos;Log in&apos; button located at the top right corner.</li>
              <li>Fill in your email &amp; password.</li>
              <li>Click on &apos;Log in&apos; &amp; enjoy!</li>
            </ol>
            <p>
              <em>NOTE: Once you subscribe, your password will be sent to your email</em>
            </p>
          </Faq>
          <Faq q="How can I watch Albunyaan on TV?">
            <p>
              <em>You can watch Albunyaan on TV through the following methods:</em>
            </p>
            <ol className={OL}>
              <li>
                <strong>TV Box (Best Option):</strong> Download the Albunyaan app directly onto your TV box for the best viewing
                experience. This option provides full control over your TV, including parental controls and other settings.
              </li>
              <li>
                <strong>Android TV:</strong> If you have an Android TV, you can download the Albunyaan app directly from the TV
                store.
              </li>
              <li>
                <strong>Chromecast:</strong> You can cast Albunyaan from your phone, tablet, or computer to your TV using a
                Chromecast device.
              </li>
              <li>
                <strong>TV Browser:</strong> You can also watch Albunyaan through our website using the TV browser. However,
                please note that this method may cause bugs and issues and is the least recommended option.
                <br />
                <u>For detailed instructions and necessary downloads, please visit our:</u>{' '}
                <Link href="/download-app" className="text-brand">
                  <u>Downloads Page</u>
                </Link>
                <u>.</u>
              </li>
            </ol>
          </Faq>
          <Faq q="Why is most of the content in Arabic?">
            <p>
              Many people, especially parents living in Western countries, ask this question. While we have Dutch and English
              content available, we have deliberately chosen to prioritize Arabic as the most prominent language.
            </p>
            <p>This is the language every Muslim parent should prioritize for their children.</p>
            <p>
              Despite some people thinking that transitioning from their native language to Arabic is too difficult, this is
              not the case. Experience shows that everyone, especially children, can quickly master the language. The younger
              the child is, the easier it is for them to learn Arabic and understand Islam as a whole.
            </p>
            <p>
              Albunyaan is a tool that can help us motivate, encourage, and raise our children. The beginning will always be
              difficult, but if we as parents give up when our children want something different, we are feeding their
              desires.
            </p>
            <p>
              In fact, there have been parents who do not speak Arabic themselves, but their children nevertheless speak and
              write fluent Arabic <strong>with the help of the right multimedia content they are exposed to.</strong>
            </p>
          </Faq>
          <Faq q="Why is Albunyaan not completely free?">
            <p>
              Albunyaan is a non-profit da3wah foundation. Everything we get is sadaqah, because it&apos;s being invested in the
              da3wah. Everyone who participates in this is doing it for Allaah&apos;s sake.
            </p>
            <p>If we were able to, we would make it free for everyone.</p>
          </Faq>
          <Faq q="Which payment methods do you provide?">
            <p>We provide iDeal, Visa, Mastercard, American Express, China UnionPay, Apple Pay, Google Pay, Bancontact, SEPA &amp; Link.</p>
          </Faq>
          <Faq q="How can I change my account password?">
            <p>
              <strong>If you are using a web browser:</strong>
            </p>
            <ul className={UL}>
              <li>Go to the menu and hover the mouse over your photo.</li>
              <li>Click on &quot;Dashboard&quot;.</li>
              <li>Scroll down to find the button labeled &quot;Change password&quot;.</li>
              <li>Click on the button and enter your current password and your new password.</li>
              <li>Click on &quot;Save changes&quot;.</li>
            </ul>
            <p>Your password has been changed!</p>
          </Faq>
          <Faq q="Can I contribute to Albunyaan?">
            <p>
              <strong>Yes, definitely. You can contribute to Albunyaan in the following ways:</strong>
            </p>
            <ol className={OL}>
              <li>Donate to support this project and other similar Islamic projects.</li>
              <li>
                Share this project with your family, relatives, friends, and anyone you know in the Muslim community. &quot;Guiding
                someone to goodness is equivalent to the reward of the person who does it.&quot; as the Prophet,
                sallallaahu3alayhiwassalam, said.
              </li>
              <li>Inform us of any content that contains any violations of Islamic principles, whether in speech or action.</li>
            </ol>
          </Faq>
          <Faq q="Can I be a sponsor?">
            <p>Please email us at info@albunyaan.tv with the details of your sponsorship, including the amount and duration.</p>
          </Faq>
          <Faq q="Any other question?">
            <p>
              <Link href="/contact" className="text-brand underline">
                Contact us here
              </Link>
            </p>
          </Faq>
        </div>
      </section>

      <section data-block="Who are we" className="bg-white py-12 md:py-24 px-4">
        <div className="max-w-[1200px] mx-auto md:flex md:items-center md:justify-between gap-10">
          <div className="text-center md:text-start md:max-w-sm">
            <h2 className="text-2xl md:text-3xl font-bold text-ink mb-4">Who are we?</h2>
            <p className="text-base md:text-lg text-ink mb-6">
              To get an idea about who we are, watch our small introduction and start watching our content by clicking the
              button below.
            </p>
            <Link href="/login" className={`${BUTTON} my-8`}>
              Watch our Content
            </Link>
          </div>
          <figure data-poster className="mt-8 md:mt-0 md:max-w-xl w-full aspect-video overflow-hidden rounded bg-black">
            <img src="/pages/qa-poster-Albunyaan_En.jpg" width={1920} height={1080} alt="" className="w-full h-full object-cover" />
          </figure>
        </div>
      </section>
    </>
  );
}
