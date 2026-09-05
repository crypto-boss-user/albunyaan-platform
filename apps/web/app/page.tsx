import type { Metadata } from 'next';
import Link from 'next/link';
import MobileAppsImage from '../components/MobileAppsImage';
import { BUTTON, ImageText, VideoText } from '../components/storefront';

/**
 * Homepage = de 13 blokken van de gemeten storefront in US-volgorde (SR 4 stap 7; SR 2b `thema/pages/index.json`,
 * SR 2a `home__1440__en` + `home__390__en`; B13 1:1): Header · Hero banner · Text block · Image and text ×3 · Custom code
 * (diagram) · Video and text ×3 · Text block (CTA) · Mobile apps · Footer. Teksten letterlijk uit de SR 2a-HTML; beelden
 * byte-identiek uit `var/storefront-referentie/assets/` → `public/home/` (sha256 in de commit-tekst). De eigen
 * statistiekstrook en de home-catalogusrijen zijn weg (B68). Kopniveaus zoals gemeten: h1 in de hero, h3 in de blokken.
 * AANNAMES (aanpasbaar): "Sign up!"/"Sign up now!" → /login zoals de kop-knop (aanmelden gesloten tot B16/B64; storefront
 * → /pages/form); "Android app not working? Click here" → US-programma `albunyaan-cbfcf4` = video "Albunyaan App"
 * (DB-slug `albunyaan-app-2749561`, published) → eigen /programs-route (werkt na stap 11); speler = poster zonder
 * afspeelknop (kijkplatformkeuze open, ⛔ Bunny); afwisselende blokachtergrond #f9fff2 (gemeten in de PNG); hero-overlay
 * #282828 op 0.3 (gemeten inline-stijl); afmetingen/paddings geschat op het 1440/390-beeld.
 */
export const metadata: Metadata = {
  /** SR 2b index.json Page Settings (§5.16). */
  title: 'Albunyaan TV',
  description:
    "The Islamic media platform that focuses on parenting and educating muslims on every metric. At the same time it offers entertainment that's filtered.",
};

export default function Home() {
  return (
    <>
      {/* Blok 2 — Hero banner: desktop 2880×1280 (≥ 768 px) / mobiel 900×1600 via <picture>, overlay, inhoud links, knop "Sign up!". */}
      <section data-block="Hero banner" className="relative flex items-center overflow-hidden bg-ink">
        {/* Eén download per viewport (review I-2): ≥ 768 px de desktopbanner, daaronder de mobiele; bestanden byte-identiek. */}
        <picture>
          <source media="(min-width: 768px)" srcSet="/home/hero-banner-albunyaan.1720720104.jpg" width={2880} height={1280} />
          <img
            src="/home/hero-banner-mobile.1720720201.jpg"
            width={900}
            height={1600}
            alt=" I want to protect my Islamic identity"
            className="w-full h-auto"
            fetchPriority="high"
          />
        </picture>
        <div aria-hidden className="absolute inset-0" style={{ backgroundColor: '#282828', opacity: 0.3 }} />
        <div className="absolute inset-0 flex items-center">
          <div className="max-w-[1400px] w-full mx-auto px-5 sm:px-8 md:px-24">
            <div className="max-w-[640px] text-white">
              <h1 className="text-2xl sm:text-3xl font-bold leading-tight">
                <strong>I want to protect my Islamic identity</strong>
              </h1>
              <p className="mt-3 font-bold text-[1.25rem] leading-snug">
                <strong>Through watching safe and filtered content for a fixed (sadaqah jaariyah) amount per month or year!</strong>
              </p>
              <p className="mt-4 text-[14px] leading-relaxed">
                Albunyaan is working on providing Islamic filtered content to assist the practicing Muslim who strives to protect
                their Islamic identity. This is achieved by avoiding prohibited films/series and making permissible films/series
                available at any time of the day.
              </p>
              <Link href="/login" className={`${BUTTON} mt-8 max-md:w-full max-md:justify-center`}>
                Sign up!
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Blok 3 — Text block (center, wide) + knop. */}
      <section data-block="Text block" className="bg-white py-14 sm:py-20">
        <div className="max-w-[1200px] mx-auto px-5 sm:px-8 text-center">
          <h3 className="text-2xl sm:text-3xl font-bold text-ink">Islamic Identity</h3>
          <p className="mt-5 text-[15px] leading-relaxed text-ink">
            In a time when children and young people shape their identity through striving for money, fame, career at school
            and through social media, it has resulted in the true identity of a Muslim being seen as secondary or even unknown.
            But what is that identity? Attaining the Pleasure of Allah with the ultimate outcome of eternal Paradise. This is
            what Albunyaan contributes to by making educational programs available from the Quran and the Sunnah in a simple
            and enjoyable manner, to raise awareness among children and young people about their Islamic identity and how they
            can practice their faith according to the Qor&apos;aan and Sunnah.
          </p>
          <Link href="/programs/albunyaan-app-2749561" className={`${BUTTON} mt-8`}>
            Android app not working? Click here
          </Link>
        </div>
      </section>

      {/* Blokken 4–6 — Image and text. */}
      <ImageText
        src="/home/assets_page-editor_background.1718466357.jpg"
        width={1334}
        height={748}
        title="Watch unlimited series, movies, and programs on your phone, tablet, laptop, and TV."
        tint
      />
      <ImageText
        src="/home/image.1685289189.png"
        width={977}
        height={1029}
        title="Learning Arabic"
        imageRight
      >
        <p className="mt-4 text-[15px] leading-relaxed text-ink">
          Learning the Arabic language is important to understand the Quran and the Sunnah, but not everyone has the time and
          motivation to sit with grammar books. Scientific studies have proven that in the initial stages of language learning,
          it is best to expand your vocabulary through listening and then practicing speaking. It may be challenging at first,
          but by being persistent and patient, Allah will help you and your child become proficient in Arabic. Albunyaan offers
          hundreds of educational and interesting films and series for you and your child to enjoy!
        </p>
      </ImageText>
      <ImageText
        src="/home/sadqa.1685262162.jpeg"
        width={1024}
        height={691}
        title="Ongoing reward (sadaqah jaariyah)"
        tint
      >
        <p className="mt-4 text-[15px] leading-relaxed text-ink">
          Your subscription ensures that you are watching movies and series while earning countless hasanaat (rewards). How does
          it work? By your monthly contribution, Albunyaan remains accessible to everyone, and you also support other dawah
          projects that strive to help families in need, among other things. All of these hasanaat will be added to your scale
          of good deeds, even after you have passed away!
        </p>
      </ImageText>

      {/* Blok 7 — Custom code: `.sub-banner` = het diagram als achtergrond op 90 % breedte (EN/NL-beeld; AR via stap 6). */}
      <section data-block="Custom code" className="bg-white py-10 sm:py-14">
        <div className="max-w-[1400px] mx-auto px-5 sm:px-8">
          <img
            src="/home/juistevisualisatie.1685549178.jpg"
            width={2880}
            height={1280}
            alt=""
            className="sub-banner w-[90%] h-auto mx-auto"
          />
        </div>
      </section>

      {/* Blokken 8–10 — Video and text (poster). */}
      <VideoText poster="/home/review-poster-I4xT3UgTYGTg2w.jpg" title="Review teacher (NL)" tint />
      <VideoText poster="/home/review-poster-GfYD8aDAuLRoiQ.jpg" title="Review teenager (NL)" />
      <VideoText poster="/home/review-poster-dvLOhXF0il75HA.jpg" title="Review parent (NL)" tint />

      {/* Blok 11 — Text block CTA. */}
      <section data-block="Text block" className="bg-white py-14 sm:py-20">
        <div className="max-w-2xl mx-auto px-5 sm:px-8 text-center">
          <h3 className="text-2xl sm:text-3xl font-bold text-ink">Ready to start watching?</h3>
          <Link href="/login" className={`${BUTTON} mt-6`}>
            Sign up now!
          </Link>
        </div>
      </section>

      {/* Blok 12 — Mobile apps (alleen beeld, zoals gemeten). */}
      <section data-block="Mobile apps" className="bg-white pt-6">
        <div className="max-w-[1400px] mx-auto px-5 sm:px-8">
          <MobileAppsImage />
        </div>
      </section>
    </>
  );
}
