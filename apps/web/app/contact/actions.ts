'use server';

import { sendEmail } from '../../lib/resend';

export interface ContactFormState {
  status: 'idle' | 'sent' | 'error';
  message: string | null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CONTACT_INBOX = 'info@albunyaan.tv';
const CONTACT_FROM = 'no-reply@albunyaan.tv';

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export async function sendContactMessageAction(
  _prev: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  // Honeypot: a real visitor never fills a field named "website" that CSS
  // hides off-screen; form-filling bots that autofill every input do. Report
  // success without sending, so the bot doesn't learn to avoid the field.
  if (String(formData.get('website') ?? '').length > 0) {
    return { status: 'sent', message: null };
  }

  const name = String(formData.get('name') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const message = String(formData.get('message') ?? '').trim();

  if (!name) return { status: 'error', message: 'Please enter your name.' };
  if (!EMAIL_RE.test(email)) return { status: 'error', message: 'Please enter a valid email address.' };
  if (message.length < 10) return { status: 'error', message: 'Please add a little more detail to your message.' };
  if (message.length > 4000) return { status: 'error', message: 'That message is too long — please shorten it.' };

  const result = await sendEmail({
    to: CONTACT_INBOX,
    from: CONTACT_FROM,
    subject: `Contact form: ${name}`,
    html: `<p><strong>From:</strong> ${escapeHtml(name)} &lt;${escapeHtml(email)}&gt;</p><p style="white-space:pre-wrap">${escapeHtml(message)}</p>`,
    replyTo: email,
  });

  if (!result.ok) {
    console.error(`contact form send failed: ${result.error}`);
    return { status: 'error', message: 'Could not send your message right now — please try again shortly.' };
  }
  return { status: 'sent', message: null };
}
