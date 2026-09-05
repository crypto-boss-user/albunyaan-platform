import type { Metadata } from 'next';
import { TextBlock, VideoText } from '../../components/storefront';
import CouponForm from './CouponForm';

/**
 * SR 4 stap 8 — Coupon PUBLIEK zoals de storefront (§5.13, B37: coupon bouwen): SR 2a page-coupon__1440__en = Text block
 * (center) · Video and text (video links, poster) · Custom code (inwisselformulier naar coupon.albunyaan.nl, T2).
 * De login-redirect is weg (pagina anoniem 200). Het INWISSELFORMULIER blijft het bestaande `CouponForm` (T2: inwisselen
 * vereist een ingelogde sessie; anoniem geeft de server-action "session expired" — gemeld in de teamreview, niet gewijzigd).
 * Teksten letterlijk; poster byte-identiek (var/storefront-referentie/assets/coupon-poster-piSWqcc1czhPjA.jpg).
 */
export const metadata: Metadata = { title: 'Albunyaan' };

export default function CouponPage() {
  return (
    <>
      <TextBlock title="Coupon كوبونات" center narrow>
        <div className="mt-4 space-y-2 text-[15px] leading-relaxed text-ink">
          <p>Redeem your coupon now! Gain full access to our content.</p>
          <p>فعل قسيمتك الآن, واحصل على اشتراك لمدة سنة كاملة.</p>
          <p className="pt-6">
            <strong>
              <em>
                <span className="text-[1.125rem]" style={{ color: 'rgb(255, 0, 0)' }}>
                  Please note that the password will be sent to your email!
                </span>
              </em>
            </strong>
          </p>
          <p>
            <strong>
              <em>
                <span className="text-[1.125rem]" style={{ color: 'rgb(255, 0, 0)' }}>
                  سيتم إرسال كلمة المرور إلى البريد الإلكتروني الخاص بك
                </span>
              </em>
            </strong>
          </p>
        </div>
      </TextBlock>
      <VideoText
        poster="/pages/coupon-poster-piSWqcc1czhPjA.jpg"
        videoLeft
        title={
          <>
            شرح كيفية تفعيل الكوبون{' '}
            <br />
            How to activate the coupon
          </>
        }
      />
      {/* Inwisselen (T2): het bestaande formulier, buiten de tekst-diff (data-us-exclude). */}
      <section data-block="Custom code" data-us-exclude className="bg-white py-14">
        <div className="max-w-md mx-auto px-5">
          <CouponForm />
        </div>
      </section>
    </>
  );
}
