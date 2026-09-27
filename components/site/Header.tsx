'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { Logo } from './Logo';
import { SocialIcons } from './SocialIcons';
import { useApp } from '../AppProvider';

const NAV = [
  { href: '/', label: 'Home' },
  { href: '/shop', label: 'All Products' },
  { href: '/coas', label: 'COAs' },
  { href: '/about', label: 'About Us' },
  { href: '/contact', label: 'Contact Us' },
];

function CartIcon({ count }: { count: number }) {
  return (
    <Link href="/cart" aria-label={`Cart, ${count} items`} title="Cart" className="relative grid h-8 w-8 place-items-center text-white hover:text-cyan-text">
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M3 4h2l2.4 11h11.2L21 7H6.2" />
        <circle cx="9" cy="20" r="1.4" />
        <circle cx="18" cy="20" r="1.4" />
      </svg>
      <span className="absolute -right-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[#1f7fc0] px-1 text-[11px] font-bold leading-none text-white">{count}</span>
    </Link>
  );
}

function AccountIcon({ className = '' }: { className?: string }) {
  return (
    <Link href="/my-account" aria-label="My Account" title="My Account" className={`grid h-8 w-8 place-items-center rounded-full bg-[#1f7fc0] text-white hover:bg-cyan-brand ${className}`}>
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="currentColor" aria-hidden>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5z" />
      </svg>
    </Link>
  );
}

/** Header laid out like ridgelinefit.com: social · account · cart · search | logo | menu. */
export function Header() {
  const path = usePathname();
  const router = useRouter();
  const { cart } = useApp();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const count = cart.reduce((s, i) => s + i.qty, 0);
  const active = (href: string) => (href === '/' ? path === '/' : path.startsWith(href));
  const search = (e: { preventDefault: () => void }) => {
    e.preventDefault();
    setOpen(false);
    router.push(`/shop?q=${encodeURIComponent(q)}`);
  };

  return (
    <header className="bg-black px-3 py-3 sm:px-6 sm:py-4">
      <div className="mx-auto grid max-w-[1240px] grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-[36px] border border-white/30 px-4 py-2 sm:px-7 sm:py-3">
        {/* Left: social · My Account · cart · search */}
        <div className="flex min-w-0 items-center gap-2.5">
          <SocialIcons variant="header" size="h-8 w-8" className="hidden xl:flex" />
          <AccountIcon className="hidden md:grid" />
          <CartIcon count={count} />
          <form className="ml-1 hidden h-10 w-full max-w-[230px] items-center rounded-full bg-white px-4 lg:flex" onSubmit={search} role="search">
            <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-black" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search for products..."
              aria-label="Search products"
              className="ml-2.5 min-w-0 flex-1 bg-transparent text-[15px] text-black outline-none placeholder:text-slate-500"
            />
          </form>
        </div>

        {/* Center: logo */}
        <Link href="/" aria-label="Ridgeline Fit home" className="justify-self-center">
          <Logo className="h-14 w-auto sm:h-20" />
        </Link>

        {/* Right: main menu */}
        <nav className="hidden items-center justify-end gap-5 md:flex" aria-label="Main">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`whitespace-nowrap border-b-2 pb-1 text-[15px] font-bold ${active(n.href) ? 'border-cyan-price text-cyan-price' : 'border-transparent text-white hover:text-cyan-text'}`}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <button className="justify-self-end text-white md:hidden" aria-label="Menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2">
            <path d={open ? 'M6 6l12 12M18 6 6 18' : 'M4 7h16M4 12h16M4 17h16'} />
          </svg>
        </button>
      </div>

      {/* Mobile menu: search, links, account, social */}
      {open && (
        <nav className="mx-auto mt-2 flex max-w-[1240px] flex-col gap-1 rounded-2xl border border-white/20 bg-black p-3 md:hidden" aria-label="Mobile">
          <form className="mb-2 flex h-11 items-center rounded-full bg-white px-4" onSubmit={search} role="search">
            <svg viewBox="0 0 24 24" className="h-5 w-5 text-black" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search for products..." aria-label="Search products" className="ml-2.5 flex-1 bg-transparent text-base text-black outline-none placeholder:text-slate-500" />
          </form>
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} onClick={() => setOpen(false)} className={`rounded-lg px-3 py-3 text-base font-bold ${active(n.href) ? 'text-cyan-price' : 'text-white'}`}>
              {n.label}
            </Link>
          ))}
          <Link href="/my-account" onClick={() => setOpen(false)} className={`rounded-lg px-3 py-3 text-base font-bold ${active('/my-account') ? 'text-cyan-price' : 'text-white'}`}>
            My Account
          </Link>
          <SocialIcons variant="header" size="h-9 w-9" className="mt-2 px-3" />
        </nav>
      )}
    </header>
  );
}
