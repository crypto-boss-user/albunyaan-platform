import { redirect } from 'next/navigation';

/** v0 URL kept alive — the real site (and this clone) use /programs/:slug. */
export default async function WatchRedirect({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/programs/${slug}`);
}
