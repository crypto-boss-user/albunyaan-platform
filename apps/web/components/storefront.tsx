import Link from 'next/link';

/**
 * Bouwstenen van de gemeten Uscreen-thema-blokken (SR 4 stappen 7–8; SR 2a-HTML, B13 1:1):
 * knop, tekstblok (h3 + tekst, center/links), beeld-en-tekst, video-en-tekst (speler = poster).
 * Kopniveaus zoals gemeten (h3 in thema-blokken). AANNAME (aanpasbaar): maten/paddings geschat op de 1440/390-beelden.
 */
export const BUTTON =
  'inline-flex items-center px-6 py-2.5 rounded-md bg-brand hover:bg-brand-dark transition text-white font-semibold text-[14px]';

/** Blokachtergrond van de even blokken (gemeten in home__1440__en.png: rgb(249,255,242)). */
export const TINT = 'bg-[#f9fff2]';

export function ThemeButton({ href, children, className = '' }: { href: string; children: React.ReactNode; className?: string }) {
  const external = /^https?:/.test(href);
  return external ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={`${BUTTON} ${className}`}>
      {children}
    </a>
  ) : (
    <Link href={href} className={`${BUTTON} ${className}`}>
      {children}
    </Link>
  );
}

export function TextBlock({
  title,
  center,
  narrow,
  tint,
  children,
}: {
  title?: React.ReactNode;
  center?: boolean;
  /** max-w-2xl zoals de storefront-tekstblokken met "Regular" breedte. */
  narrow?: boolean;
  tint?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <section data-block="Text block" className={`${tint ? TINT : 'bg-white'} py-14 sm:py-20`}>
      <div className={`${narrow ? 'max-w-2xl' : 'max-w-[1200px]'} mx-auto px-5 sm:px-8 ${center ? 'text-center' : ''}`}>
        {title && <h3 className="text-2xl sm:text-3xl font-bold text-ink">{title}</h3>}
        {children}
      </div>
    </section>
  );
}

export function ImageText({
  src,
  width,
  height,
  title,
  imageRight,
  tint,
  children,
}: {
  src: string;
  width: number;
  height: number;
  title: React.ReactNode;
  imageRight?: boolean;
  tint?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <section data-block="Image and text" className={`${tint ? TINT : 'bg-white'} py-14 sm:py-20`}>
      <div className="max-w-[1400px] mx-auto px-5 sm:px-8 md:flex md:items-stretch">
        <div className={`md:w-1/2 flex items-center ${imageRight ? 'md:order-3 md:pl-20' : 'md:order-1 md:pr-20'}`}>
          {/* eslint-disable-next-line @next/next/no-img-element -- byte-identiek gemeten beeld */}
          <img src={src} width={width} height={height} alt="" className="w-full h-auto" />
        </div>
        <div className="md:order-2 md:w-1/2 flex flex-col justify-center items-start pt-8 md:pt-0">
          <h3 className="text-2xl sm:text-3xl font-bold text-ink">{title}</h3>
          {children}
        </div>
      </div>
    </section>
  );
}

/** Speler = poster (norm tot de kijkplatformkeuze, ⛔ Bunny); geen afspeelknop omdat er niets afspeelt. */
export function VideoText({
  poster,
  title,
  videoLeft,
  tint,
  children,
}: {
  poster: string;
  title: React.ReactNode;
  videoLeft?: boolean;
  tint?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <section data-block="Video and text" className={`${tint ? TINT : 'bg-white'} py-10 sm:py-14`}>
      <div className="max-w-[1400px] mx-auto px-5 sm:px-8 md:flex md:items-center">
        <div className={`md:w-1/2 ${videoLeft ? 'md:order-1 md:pr-20' : 'md:order-3 md:pl-20'}`}>
          <figure data-poster className="aspect-video overflow-hidden bg-black">
            {/* eslint-disable-next-line @next/next/no-img-element -- byte-identiek gemeten poster */}
            <img src={poster} width={960} height={540} alt="" className="w-full h-full object-cover" />
          </figure>
        </div>
        <div className="md:order-2 md:w-1/2 pt-8 md:pt-0">
          <h3 className="text-2xl sm:text-3xl font-bold text-ink">{title}</h3>
          {children}
        </div>
      </div>
    </section>
  );
}
