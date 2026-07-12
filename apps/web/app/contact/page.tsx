import ContactForm from './ContactForm';

export const metadata = { title: 'Contact — Albunyaan TV' };

export default function ContactPage() {
  return (
    <div className="max-w-md mx-auto px-5 py-16">
      <p className="section-label text-center">Contact</p>
      <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mt-2 mb-4 text-center">Get in touch</h1>
      <p className="text-[15px] text-ink-secondary leading-relaxed text-center mb-8">
        Questions, content suggestions or technical issues — send us a message and we&rsquo;ll
        reply by email.
      </p>
      <ContactForm />
    </div>
  );
}
