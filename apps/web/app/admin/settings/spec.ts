/**
 * Settings-hub en veldspecificaties (AD 2.2). Norm = AD0-inventaris §2.8 (settings-hub.json + settings-*.json, 2026-09-07) en SR 2b
 * (General, Domain, Email templates, Snippets). Founder 2026-09-07 (vraag 6): alle 14 kaarten met alle gemeten velden; opslaan via de
 * settings-tabel (admin_settings, 0014); betalings-/Stripe-/PayPal-velden zichtbaar maar uitgeschakeld "tot de betaalbeslissing";
 * geheime waarden nooit tonen. Alleen keys uit VELDEN hieronder komen in de tabel (whitelist voor de server action).
 */
export const REDEN = {
  betaal: 'tot de betaalbeslissing',
  kijkplatform: 'na de kijkplatformkeuze',
  mail: 'na de mailbeslissing',
  dns: 'DNS en domein = founder (B61)',
  leden: 'na de ledenmigratie',
  team: 'beheerders toevoegen/verwijderen = T2, alleen tonen',
  storefront: 'de storefront is de repo; alleen bewaard, nog niet gelezen',
} as const;

export interface HubKaart {
  naam: string;
  tekst: string;
  href: string;
  /** Eigen kaart die Uscreen niet heeft (Team) — in de test apart geteld. */
  extra?: boolean;
}

/** De hub: 3 groepen, 14 gemeten kaarten in de gemeten volgorde (+ 1 eigen kaart Team, founder-opdracht 2026-09-07). */
export const SETTINGS_HUB: { groep: string; kaarten: HubKaart[] }[] = [
  {
    groep: 'Storefront setup',
    kaarten: [
      { naam: 'General settings', tekst: "Set your storefront's basics: store name, contact information, currency, and more.", href: '/admin/settings/general' },
      { naam: 'Domain settings', tekst: 'Change your Uscreen domain or host your storefront on your own domain.', href: '/admin/settings/domain' },
      { naam: 'Checkout', tekst: 'Set up payment providers to start getting paid, plus checkout tools to grow your business.', href: '/admin/settings/checkout' },
      { naam: 'Snippets', tekst: 'Add custom CSS, head code, and checkout code snippets.', href: '/admin/settings/snippets' },
      { naam: 'User fields', tekst: 'Collect additional information from your users during checkout.', href: '/admin/settings/user-fields' },
    ],
  },
  {
    groep: 'Communication',
    kaarten: [
      { naam: 'Marketing email settings', tekst: 'Add a custom domain for outgoing emails.', href: '/admin/settings/marketing-email' },
      { naam: 'Email templates', tekst: 'Customize your transactional emails: invoices, invite emails, and more.', href: '/admin/settings/email-templates' },
      { naam: 'Calendar push templates', tekst: 'Set up and control your default push notifications: scheduled videos, live events, published videos.', href: '/admin/settings/calendar-push-templates' },
      { naam: 'Video comments', tekst: 'Enable video comments and control who can view and post them.', href: '/admin/settings/video-comments' },
    ],
  },
  {
    groep: 'Integration & security',
    kaarten: [
      { naam: 'Exported files', tekst: 'Access and download your previously exported files: reports, invoices, and more.', href: '/admin/settings/exported-files' },
      { naam: 'Webhooks', tekst: 'Connect external services to react to signups, payments, cancellations, and more.', href: '/admin/settings/webhooks' },
      { naam: 'Integrations', tekst: 'Connect to a variety of third party apps and services.', href: '/admin/settings/integrations' },
      { naam: 'Security', tekst: 'Protect content and revenue with device limits, captcha, and digital rights management (DRM)', href: '/admin/settings/security' },
      { naam: 'Geo-Blocking', tekst: 'Restrict access to your storefront in certain countries.', href: '/admin/settings/geo-blocking' },
      { naam: 'Team', tekst: 'Beheerders van deze admin (platform_admins): rol en e-mail. Eigen kaart, niet in Uscreen.', href: '/admin/settings/team', extra: true },
    ],
  },
];

export function settingsKaart(pathname: string): HubKaart | undefined {
  for (const g of SETTINGS_HUB) for (const k of g.kaarten) if (pathname === k.href || pathname.startsWith(k.href + '/')) return k;
  return undefined;
}

export type VeldSpec =
  | { key: string; type: 'text'; max?: number }
  | { key: string; type: 'code'; max?: number }
  | { key: string; type: 'bool' }
  | { key: string; type: 'number'; min: number; max: number }
  | { key: string; type: 'enum'; opties: readonly string[] }
  | { key: string; type: 'list'; max?: number };

/** Per sectie de opslaanbare velden (whitelist) en het pad dat na opslaan ververst. */
export const SECTIES: Record<string, { pad: string; velden: VeldSpec[] }> = {
  general: {
    pad: '/admin/settings/general',
    velden: [
      { key: 'general.store_name', type: 'text', max: 200 },
      { key: 'general.time_zone', type: 'enum', opties: ['(GMT+02:00) Amsterdam', '(GMT+00:00) UTC'] },
      { key: 'general.storefront_locale', type: 'enum', opties: ['English (Default)'] },
      { key: 'general.business_address', type: 'text', max: 500 },
      { key: 'general.terms_of_service_url', type: 'text', max: 500 },
      { key: 'general.maintenance_mode', type: 'bool' },
    ],
  },
  snippets: {
    pad: '/admin/settings/snippets',
    velden: [
      { key: 'snippets.head_code', type: 'code', max: 50000 },
      { key: 'snippets.post_purchase_code', type: 'code', max: 50000 },
      { key: 'snippets.custom_styles', type: 'code', max: 50000 },
    ],
  },
  user_fields: {
    pad: '/admin/settings/user-fields',
    velden: [
      { key: 'user_fields.field_1', type: 'text', max: 200 },
      { key: 'user_fields.field_2', type: 'text', max: 200 },
      { key: 'user_fields.field_3', type: 'text', max: 200 },
    ],
  },
  marketing_email: {
    pad: '/admin/settings/marketing-email',
    velden: [
      { key: 'marketing_email.from_name', type: 'text', max: 200 },
      { key: 'marketing_email.from_email', type: 'text', max: 200 },
    ],
  },
  video_comments: {
    pad: '/admin/settings/video-comments',
    velden: [
      { key: 'video_comments.access_view', type: 'enum', opties: ['Anyone', 'All logged in users', 'Logged in users with access'] },
      { key: 'video_comments.access_post', type: 'enum', opties: ['All logged in users', 'Logged in users with access'] },
      { key: 'video_comments.enabled', type: 'enum', opties: ['enabled', 'disabled'] },
    ],
  },
  security: {
    pad: '/admin/settings/security',
    velden: [{ key: 'security.max_devices', type: 'number', min: 1, max: 50 }],
  },
  geo_blocking: {
    pad: '/admin/settings/geo-blocking',
    velden: [{ key: 'geo_blocking.blocked_countries', type: 'list', max: 250 }],
  },
};

/** Alle keys die een pagina leest (ook de defaults hieronder), zodat getAdminSettings één query doet. */
export const DEFAULTS: Record<string, string | number | boolean | string[]> = {
  'general.store_name': 'Albunyaan',
  'general.time_zone': '(GMT+02:00) Amsterdam',
  'general.storefront_locale': 'English (Default)',
  'general.business_address': '',
  'general.terms_of_service_url': '',
  'general.maintenance_mode': false,
  'snippets.head_code': '',
  'snippets.post_purchase_code': '',
  'snippets.custom_styles': '',
  'user_fields.field_1': '',
  'user_fields.field_2': '',
  'user_fields.field_3': '',
  'marketing_email.from_name': 'Albunyaan',
  'marketing_email.from_email': 'info',
  'video_comments.access_view': 'Anyone',
  'video_comments.access_post': 'All logged in users',
  'video_comments.enabled': 'enabled',
  'security.max_devices': 7,
  'geo_blocking.blocked_countries': [],
};
