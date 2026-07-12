/**
 * Minimal Resend REST client — plain fetch, no SDK dependency for the one
 * transactional send this app does outside Supabase auth (the contact form).
 * Server-only.
 *
 * Requires RESEND_API_KEY + a `from` address on a domain verified in Resend.
 * albunyaan.tv verification is pending on founder DNS work (founder-runbook.md
 * step A/B) — sends will fail with a Resend 4xx until that lands; this module
 * surfaces that as a normal error result, not a crash.
 */
export interface SendEmailInput {
  to: string;
  from: string;
  subject: string;
  html: string;
  replyTo?: string;
}

export type SendEmailResult = { ok: true; id: string } | { ok: false; error: string };

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, error: 'RESEND_API_KEY not configured' };

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: input.from,
      to: [input.to],
      subject: input.subject,
      html: input.html,
      reply_to: input.replyTo,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    return { ok: false, error: `Resend ${res.status}: ${body.slice(0, 300)}` };
  }
  const data = (await res.json()) as { id: string };
  return { ok: true, id: data.id };
}
