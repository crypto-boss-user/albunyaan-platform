import type { Metadata } from 'next';
import { TextBlock } from '../../components/storefront';

/**
 * SR 4 stap 8 — "Download apps" 1:1 de gemeten storefront (SR 2a page-downloads__1440__en; SR 2b downloads.json):
 * Text block (center) met de Arabische kop + "All our links in one place", daarna het Custom-code-raster (4/2/1 kolommen)
 * met 10 cellen: beeld · titel · knop. Teksten letterlijk; beelden byte-identiek (var/storefront-referentie/assets/).
 * B63 + founder 2026-09-05: de store-/APK-links wijzen tot de cutover naar de bestaande (Uscreen-)apps en -bestanden zoals
 * gemeten. AANNAME (aanpasbaar): de donatiecel → eigen /donate (B68, zoals de footer); de overige doelen ongewijzigd extern.
 * VRAAG (teamreview): de APK's staan op Uscreen-opslag (unode1.s3.amazonaws.com) en vervallen bij de cutover; FitrahTube en
 * Rabbaanie zijn andere projecten — meenemen of niet is een founderkeuze.
 */
export const metadata: Metadata = { title: 'Download Albunyaan TV' };

/** `maxW` = gerenderde beeldbreedte uit de bron (img width=180 voor Android-APK en FitrahTube; donatiebeeld natuurlijk 248 px). */
type Cell = { href: string; img: string; w: number; h: number; alt: string; title: React.ReactNode; note?: React.ReactNode; button: string; maxW?: number };

const CELLS: Cell[] = [
  { href: 'https://apps.apple.com/app/albunyaan-tv/id1666119687', img: '/pages/downloads-app-store.jpg', w: 1920, h: 1080, alt: 'iOS app', title: 'تطبيق البنيان للأيفون', button: 'متجر آبل ستور' },
  { href: 'https://play.google.com/store/apps/details?id=tv.uscreen.albunyaan2', img: '/pages/downloads-google-play.jpg', w: 1920, h: 1080, alt: 'Android app', title: 'تطبيق البنيان للأندرويد', button: 'متجر جوجل بلاي' },
  { href: 'https://play.google.com/store/apps/details?id=tv.uscreen.albunyaan2tv', img: '/pages/downloads-tv.jpg', w: 1920, h: 1080, alt: 'TV', title: 'البنيان للأندرويد تي في', button: 'متجر جوجل تي في' },
  { href: 'https://unode1.s3.amazonaws.com/assets%2F%2Fassets%2F29123%2F%2Falbunyaan-for-tv-4.1786799858.apk', img: '/pages/downloads-tv-box.jpg', w: 1920, h: 1080, alt: 'TV BOX', title: 'TV BOX نسخة', button: 'تنزيل مباشر' },
  { href: 'https://unode1.s3.amazonaws.com/assets%2F%2Fassets%2F29123%2F%2Falbunyaan-app--2.1786800150.apk', img: '/pages/downloads-android.jpg', w: 519, h: 644, maxW: 180, alt: 'Android APK', title: 'لأجهزة الأندرويد', button: 'تنزيل مباشر' },
  {
    href: 'https://unode1.s3.amazonaws.com/assets%2F%2Fassets%2F29123%2F%2Ffitrahtube-100-beta45.1787749266.apk',
    img: '/pages/downloads-albunyaan-tube.png',
    w: 2112,
    h: 2179,
    maxW: 180,
    alt: 'AlbunyaanTube APK',
    title: 'فطرة تيوب',
    note: (
      <>
        <p className="text-[red] font-bold text-[15px] my-0.5">الإصدار تجريبي</p>
        <p className="text-[15px] text-[#333] leading-snug max-w-[260px] mx-auto mt-0.5 mb-2">
          النسخة مازالت قيد البرمجة والغربلة والتطوير، وبعدها سيتم اضافة مئات الآلاف من القنوات وقوائم التشغيل
        </p>
      </>
    ),
    button: 'تنزيل مباشر',
  },
  {
    href: 'https://unode1.s3.amazonaws.com/assets%2F%2Fassets%2F29123%2F%2Frabbaanie-v1522.1787746940.apk',
    img: '/pages/downloads-rabbaanie-logo.jpeg',
    w: 1024,
    h: 1024,
    alt: 'Rabbaanie App',
    title: 'تطبيق رباني',
    note: <p className="text-[15px] text-[#333] leading-snug max-w-[260px] mx-auto mt-0.5 mb-2">رفيقُك في تربيةٍ على الكتاب والسنّة وفهم الصحابة</p>,
    button: 'تنزيل',
  },
  { href: 'https://play.google.com/store/apps/details?id=com.rabbaanie.app', img: '/pages/downloads-google-play.jpg', w: 1920, h: 1080, alt: 'Rabbaanie on Google Play', title: 'تطبيق رباني للأندرويد', button: 'متجر جوجل بلاي' },
  { href: 'https://support.albunyaan.tv/wp-content/uploads/2024/08/albunyaan-about-us-7.pdf', img: '/pages/downloads-about-us.jpg', w: 1920, h: 1080, alt: 'About us', title: 'عن البنيان', button: 'تنزيل' },
  {
    href: '/donate',
    img: '/pages/downloads-donation.jpg',
    w: 248,
    h: 228,
    maxW: 248,
    alt: 'Donation',
    title: (
      <>
        ادعم هذا المشروع
        <br />
        واستثمر لآخرتك
      </>
    ),
    button: 'تصدق الآن',
  },
];

/** Knopstijl uit de gemeten custom code: #007410, radius 15, 10×20 padding. */
const CELL_BUTTON = 'inline-block mt-5 mb-10 px-5 py-2.5 rounded-[15px] bg-[#007410] hover:bg-[#3e8e41] transition text-white text-[16px] font-bold';

export default function DownloadAppPage() {
  return (
    <>
      <TextBlock title="جميع روابط منصة البنيان" center narrow>
        <p className="mt-4 text-[15px]">
          <strong style={{ color: 'rgb(1, 116, 16)' }}>All our links in one place</strong>
        </p>
      </TextBlock>
      <section data-block="Custom code" className="bg-white pb-14">
        <div className="max-w-[1400px] mx-auto px-5 sm:px-8 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5 text-center">
          {CELLS.map((c) => {
            const external = /^https?:/.test(c.href);
            const rel = external ? 'noopener noreferrer' : undefined;
            const target = external ? '_blank' : undefined;
            return (
              <div key={c.href} className="flex flex-col items-center justify-center">
                <a href={c.href} target={target} rel={rel} className="block w-full" style={{ maxWidth: c.maxW ?? 420 }}>
                  <img
                    src={c.img}
                    width={c.w}
                    height={c.h}
                    alt={c.alt}
                    className={c.img.endsWith('rabbaanie-logo.jpeg') ? 'block w-[65%] max-w-[300px] h-auto mx-auto' : 'w-full h-auto'}
                  />
                </a>
                <p className="mt-3 font-extrabold text-[20px] text-ink">{c.title}</p>
                {c.note}
                <a href={c.href} target={target} rel={rel} className={CELL_BUTTON}>
                  <strong>{c.button}</strong>
                </a>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
