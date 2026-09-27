'use client';

import Link from 'next/link';
import { useState } from 'react';
import { SocialIcons } from './SocialIcons';

export function Footer() {
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');
  return (
    <footer id="newsletter" className="font-alt text-white">
      <div className="bg-gradient-to-b from-[#2a9ab8] to-[#1f7f98] px-4 py-6 text-center">
        <p className="mx-auto max-w-4xl text-sm font-semibold">
          Ridgeline FIT offers research-grade peptides for laboratory studies, validated for stability, purity, and reproducibility, strictly for non-clinical research use only. Not for human or veterinary consumption.
        </p>
        <SocialIcons size="h-6 w-6" className="mt-3 justify-center gap-2" />
      </div>
      <nav className="flex flex-wrap justify-center gap-x-3 gap-y-1 border-y border-white/10 bg-[#176c83] px-4 py-3 text-sm font-medium" aria-label="Footer">
        {[
          ['/', 'Home'],
          ['/shop', 'Shop'],
          ['/about', 'About Us'],
          ['/contact', 'Contact Us'],
          ['/privacy', 'Privacy Policy'],
          ['/refund-policy', 'Refund Policy'],
          ['/my-account', 'My Account'],
        ].map(([href, label], i, arr) => (
          <span key={href} className="flex items-center gap-3">
            <Link href={href} className="hover:underline">
              {label}
            </Link>
            {i < arr.length - 1 && <span className="opacity-70">|</span>}
          </span>
        ))}
      </nav>
      <div className="bg-gradient-to-b from-[#0f4c5c] to-black px-4 pb-6 pt-4 text-center">
        <h2 className="text-sm">Subscribe newsletter</h2>
        <form
          className="mx-auto mt-3 flex max-w-lg overflow-hidden rounded"
          onSubmit={async (e) => {
            e.preventDefault();
            const r = await fetch('/api/newsletter', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
            const d = await r.json();
            setMsg(r.ok ? 'Thanks — you are subscribed.' : d.error);
            if (r.ok) setEmail('');
          }}
        >
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter Email Address"
            aria-label="Email address"
            className="min-w-0 flex-1 bg-white px-3 py-1.5 text-sm text-black outline-none"
          />
          <button className="bg-[#2a9ab8] px-8 text-sm font-semibold sm:px-16">Subscribe</button>
        </form>
        {msg && <p className="mt-2 text-[13px] text-cyan-text" role="status">{msg}</p>}
        <div className="mt-4 flex justify-center gap-3">
          <span className="grid h-12 w-20 place-items-center rounded bg-white text-[13px] font-bold text-black">✔ norton</span>
          <span className="grid h-12 w-20 place-items-center rounded bg-white text-[13px] font-bold text-[#0a5c8a]">PCI DSS</span>
        </div>
        <p className="mt-5 text-xs font-semibold">© {new Date().getFullYear()} Ridgeline FIT . All Rights Reserved.</p>
      </div>
    </footer>
  );
}
