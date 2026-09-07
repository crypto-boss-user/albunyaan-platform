import { settingsKaart } from './settings/spec';

/**
 * Zijmenu van de admin (AD 1.1, uitgebreid in AD 2.1) — volgorde en namen exact als de gemeten Uscreen-admin
 * (reference/admin-2026-09/ad0-2026-09-06/menu-inventaris.json, 2026-09-06), MINUS de door de founder uitgesloten secties (plan §5 B81):
 * Live Streaming, Calendar, Audiences/Tags/Comments, Community, Bundles, Website, Mobile & TV apps, Refer to Uscreen, Changelog, Get help,
 * Analytics › Community/Advanced. Sinds B84 (founder 2026-09-07) horen Home, Subscriptions, Sales, Analytics (6) en Settings er wél bij.
 * Settings staat bij Uscreen in de ondergroep van het zijmenu (`plaats: 'onderaan'`). De structuurtest tests/admin-raamwerk.spec.ts leidt
 * de verwachting uit het gemeten JSON af, niet uit dit bestand.
 */
export interface AdminMenuItem {
  naam: string;
  href: string;
}
export interface AdminMenuSection {
  naam: string;
  href: string;
  icoon: 'home' | 'content' | 'people' | 'subscriptions' | 'sales' | 'marketing' | 'analytics' | 'settings';
  items: AdminMenuItem[]; // leeg = plat menu-item (Marketing)
  /** Uscreen toont Settings in de ondergroep van het zijmenu (menu-inventaris "— onderaan —"). */
  plaats?: 'onderaan';
}

export const ADMIN_MENU: AdminMenuSection[] = [
  { naam: 'Home', href: '/admin', icoon: 'home', items: [] },
  {
    naam: 'Content',
    href: '/admin/videos',
    icoon: 'content',
    items: [
      { naam: 'Videos', href: '/admin/videos' },
      { naam: 'Collections', href: '/admin/collections' },
      { naam: 'Resources', href: '/admin/resources' },
      { naam: 'Categories', href: '/admin/categories' },
      { naam: 'Custom Filters', href: '/admin/custom-filters' },
      { naam: 'Authors', href: '/admin/authors' },
    ],
  },
  { naam: 'People', href: '/admin/people', icoon: 'people', items: [{ naam: 'All', href: '/admin/people' }] },
  { naam: 'Subscriptions', href: '/admin/subscriptions', icoon: 'subscriptions', items: [] },
  { naam: 'Sales', href: '/admin/sales/invoices', icoon: 'sales', items: [] },
  { naam: 'Marketing', href: '/admin/marketing', icoon: 'marketing', items: [] },
  {
    naam: 'Analytics',
    href: '/admin/analytics/overview',
    icoon: 'analytics',
    items: [
      { naam: 'Overview', href: '/admin/analytics/overview' },
      { naam: 'Content', href: '/admin/analytics/content' },
      { naam: 'People', href: '/admin/analytics/people' },
      { naam: 'Sales', href: '/admin/analytics/sales' },
      { naam: 'Subscriptions', href: '/admin/analytics/subscriptions' },
      { naam: 'Marketing', href: '/admin/analytics/marketing' },
    ],
  },
  { naam: 'Settings', href: '/admin/settings', icoon: 'settings', items: [], plaats: 'onderaan' },
];

/** Marketing-hub: de gemeten kaarten in drie groepen (inventaris §2.3), minus Refer a friend en Try again for free (B81). */
export const MARKETING_HUB: { groep: string; kaarten: { naam: string; tekst: string; href: string }[] }[] = [
  {
    groep: 'Generate leads',
    kaarten: [
      { naam: 'Website landing pages', tekst: 'Build personalized landing pages to add to your storefront.', href: '/admin/marketing/landing-pages' },
      { naam: 'Giveaway funnels', tekst: 'Create a giveaway to turn leads into subscribers with a discounted offer.', href: '/admin/marketing/giveaway-funnels' },
      { naam: 'YouTube lead generator', tekst: 'Nurture your YouTube audience by capturing emails through your lead generation URL.', href: '/admin/marketing/youtube-lead-generator' },
      { naam: 'Link in Bio', tekst: 'Create a customizable link page to share across your social profiles.', href: '/admin/marketing/link-in-bio' },
      { naam: 'Email capture', tekst: 'Collect emails from your website and grow your audience.', href: '/admin/marketing/email-capture' },
    ],
  },
  {
    groep: 'Nurture audience',
    kaarten: [
      { naam: 'Automations', tekst: 'Automate your marketing based on triggers and filters.', href: '/admin/marketing/automations' },
      { naam: 'Email broadcasts', tekst: 'Send personalized emails to targeted groups and keep your audience engaged.', href: '/admin/marketing/email-broadcasts' },
      { naam: 'Push notifications', tekst: 'Send short announcements to your mobile app users.', href: '/admin/marketing/push-notifications' },
      { naam: 'Coupons', tekst: 'Create custom discounts to attract new buyers and reward loyal customers.', href: '/admin/marketing/coupons' },
      { naam: 'Gifts', tekst: 'Enable users to purchase and redeem gifts while growing your community.', href: '/admin/marketing/gifts' },
      { naam: 'Subscription upsell', tekst: 'Offer users a discount for a longer term plan during checkout.', href: '/admin/marketing/subscription-upsell' },
      { naam: 'Abandoned cart', tekst: 'Encourage users to complete their purchase if they abandon the checkout.', href: '/admin/marketing/abandoned-cart' },
    ],
  },
];

/** Broodkruimel uit het pad: Content › Videos, People › All, Marketing › Coupons … */
export function breadcrumb(pathname: string): string[] {
  if (pathname.startsWith('/admin/subscriptions')) return pathname === '/admin/subscriptions' ? ['Subscriptions'] : ['Subscriptions', 'Details'];
  if (pathname.startsWith('/admin/sales')) return pathname === '/admin/sales/invoices' ? ['Sales', 'Invoices'] : ['Sales', 'Invoices', 'Details'];
  if (pathname.startsWith('/admin/settings')) {
    const kaart = settingsKaart(pathname);
    return kaart ? ['Settings', kaart.naam] : ['Settings'];
  }
  for (const s of ADMIN_MENU) {
    for (const it of s.items) {
      if (pathname === it.href) return [s.naam, it.naam];
      if (pathname.startsWith(it.href + '/')) return [s.naam, it.naam, 'Details']; // Uscreen: Content › Videos › Details
    }
  }
  for (const g of MARKETING_HUB) for (const k of g.kaarten) if (pathname === k.href || pathname.startsWith(k.href + '/')) return ['Marketing', k.naam];
  if (pathname.startsWith('/admin/marketing')) return ['Marketing'];
  if (pathname.startsWith('/admin/members')) return ['People', 'All'];
  if (pathname.startsWith('/admin/vouchers')) return ['Marketing', 'Coupons'];
  if (pathname.startsWith('/admin/mfa')) return ['Admin security'];
  return ['Dashboard'];
}
