/**
 * Shared shell for /terms and /privacy. Both documents are DRAFT (see
 * docs/legal/README.md) — pending founder + legal sign-off — so the banner
 * here is not decorative: it is the honest, load-bearing status of the page
 * until that sign-off happens and this component's draft prop flips to false.
 */
export default function LegalPage({
  label,
  title,
  draft = true,
  children,
}: {
  label: string;
  title: string;
  draft?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="max-w-[760px] mx-auto px-5 sm:px-8 py-12">
      <p className="section-label">{label}</p>
      <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mt-2 mb-6">{title}</h1>

      {draft && (
        <div className="mb-10 px-5 py-4 rounded-2xl bg-amber-50 border border-amber-200 text-[13px] text-amber-900 leading-relaxed">
          <strong>Draft — not yet reviewed or published.</strong> This document is not legally
          final: it is pending founder and legal sign-off, and still contains open placeholders
          (shown in brackets, e.g. <code>[CONTACT-EMAIL]</code>). Do not rely on it as the
          platform&rsquo;s actual terms until this notice is removed.
        </div>
      )}

      <div className="legal-doc text-[14px] text-ink-secondary leading-relaxed space-y-5">
        {children}
      </div>
    </div>
  );
}
