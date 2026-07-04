'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useActiveProfile } from '../lib/store';

const links = [
  { href: '/catalog', label: 'Catalog' },
  { href: '/profiles', label: 'Profiles' },
  { href: '/parents', label: 'Parents' },
];

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const { profile, hydrated } = useActiveProfile();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const linkColor = scrolled ? 'text-ink hover:text-brand' : 'text-white/70 hover:text-white';

  return (
    <nav className={`glass-nav ${scrolled ? 'scrolled' : ''} fixed top-0 inset-x-0 z-50 transition-all duration-300`}>
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        <div className="flex items-center justify-between h-[72px]">
          <Link
            href="/"
            className={`text-lg font-extrabold tracking-tight ${scrolled ? 'text-brand' : 'text-white'}`}
          >
            Albunyaan<span className="gradient-text-green">TV</span>
          </Link>
          <div className="flex items-center gap-6">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className={`text-[13px] font-medium transition ${linkColor}`}>
                {l.label}
              </Link>
            ))}
            {hydrated && (
              <Link
                href="/profiles"
                aria-label={`Active profile: ${profile.name}`}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] font-semibold text-white"
                style={{ backgroundColor: `hsl(${profile.avatarHue} 45% 35%)` }}
              >
                <span
                  aria-hidden
                  className="w-5 h-5 rounded-full grid place-items-center text-[10px] font-bold bg-white/20"
                >
                  {profile.name[0]}
                </span>
                {profile.name}
                {profile.kind === 'kid' && <span className="opacity-75">· kids</span>}
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
