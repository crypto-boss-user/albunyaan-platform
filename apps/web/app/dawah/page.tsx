import type { Metadata } from 'next';
import { ImageText, TextBlock, ThemeButton } from '../../components/storefront';

/**
 * SR 4 stap 8 — 1:1 de gemeten storefront (SR 2a page-dawah__1440__en; SR 2b dawah.json): Text block · Image and text ×2 ·
 * Text block (center). Beelden byte-identiek uit var/storefront-referentie/assets/ (sha256 in de commit-tekst).
 * AANNAME (aanpasbaar): de knoppen "Invest in these projects"/"Invest now" (storefront: donate.stripe.com) → eigen /donate,
 * zoals de footer-link Donate (B68); /donate opent dezelfde Stripe-link.
 */
export const metadata: Metadata = { title: 'Dawah' };

export default function Page() {
  return (
    <>
      <TextBlock title="Dawah projects">
        <div className="mt-5 space-y-5 text-[15px] leading-relaxed text-ink">
          <p>
            Albunyaan supports multiple foundations that engage in various projects to spread the Dawah (invitation to
            Allah). These projects aim to reach both Muslims and non-Muslims. It is important to emphasize that all proceeds
            from Albunyaan are directly forwarded to these foundations, enabling them to continue and expand their
            important work.
          </p>
          <p>Let&apos;s take a look at some of these foundations and their efforts:</p>
        </div>
        <ThemeButton href="/donate" className="mt-8">
          Invest in these projects
        </ThemeButton>
      </TextBlock>

      <ImageText
        src="/pages/dawah-istiqaamah.png"
        width={870}
        height={443}
        title={
          <strong>
            <em>Stichting Al-Istiqaamah</em>
          </strong>
        }
      >
        <p className="mt-4 text-[15px] leading-relaxed text-ink">
          Stichting Al-Istiqaamah is a non-profit Islamic relief organization that focuses on providing assistance to girls
          and women aged twelve and above. With their team of expert scholars, they draw upon the sources of the Qor&apos;aan,
          the Sunnah of the Prophet ﷺ and the Sunnah of his companions to offer a holistic approach to addressing social,
          societal, spiritual, educational, and other issues. Through guidance and support, they strive to help these women
          overcome their challenges and lead a life in accordance with the Pleasure of Allaah.
        </p>
      </ImageText>

      <ImageText src="/pages/dawah-barmharitheid.jpg" width={2551} height={1819} title={<em>Tarbiyah Consultancy</em>} imageRight tint>
        <p className="mt-4 text-[15px] leading-relaxed text-ink">
          Tarbiyah Consultancy is a renowned non-profit organization that focuses on providing educational programs, courses,
          and activities to the Muslim community. Their aim is to help people understand and practice Islam correctly, based
          on the teachings of the Qor&apos;aan, the Sunnah of the Prophet ﷺ and the Sunnah of his companions. In this regard,
          they have released two valuable publications:
        </p>
        <ul className="mt-3 list-disc ps-5 text-[15px] leading-relaxed text-ink">
          <li>Appointment with the King</li>
          <li>The Mercy of Islaam for Non-Muslims</li>
        </ul>
      </ImageText>

      <TextBlock center narrow>
        <p className="text-[15px] leading-relaxed text-ink">
          Motivated by the projects? Invest in your Hereafter through ongoing charitable giving (sadaqah jaariyah) now and
          click below!
        </p>
        <ThemeButton href="/donate" className="mt-6">
          Invest now
        </ThemeButton>
      </TextBlock>
    </>
  );
}
