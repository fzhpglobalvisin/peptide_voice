'use client';

import { useEffect, useState } from 'react';
import { publicUrl, shareLinks } from '@/lib/social';
import { SOCIAL_ICONS } from './SocialIcons';

/**
 * Share buttons: native share sheet (phones), WhatsApp, Facebook, X, Telegram, copy link.
 * `path` defaults to the current page.
 */
export function ShareButtons({ title, path, className = '' }: { title: string; path?: string; className?: string }) {
  const [url, setUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [canNative, setCanNative] = useState(false);

  useEffect(() => {
    setUrl(publicUrl(path ?? window.location.pathname + window.location.search));
    setCanNative(typeof navigator.share === 'function');
  }, [path]);

  if (!url) return null;
  const text = `${title} — Ridgeline Fit (research use only)`;
  const links = shareLinks(url, text);
  const isLocal = /localhost|127\.0\.0\.1/.test(url);

  const btn = 'grid h-9 w-9 place-items-center rounded-full border border-white/25 text-white hover:border-cyan-text hover:text-cyan-text';
  const open = (href: string) => window.open(href, '_blank', 'noopener,noreferrer,width=640,height=640');

  return (
    <div className={className}>
      <p className="mb-2 text-[13px] font-bold uppercase text-white/60">Share</p>
      <div className="flex flex-wrap items-center gap-2">
        <button className="flex h-9 items-center gap-1.5 rounded-full bg-[#25d366] px-4 text-[15px] font-bold text-white hover:brightness-110" aria-label="Share on WhatsApp" onClick={() => open(links.whatsapp)}>
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
            {SOCIAL_ICONS.whatsapp}
          </svg>
          WhatsApp
        </button>
        {canNative && (
          <button
            className={btn}
            aria-label="Share…"
            onClick={() => navigator.share({ title: text, url }).catch(() => {})}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
            </svg>
          </button>
        )}
        <button className={btn} aria-label="Share on Facebook" onClick={() => open(links.facebook)}>
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
            {SOCIAL_ICONS.facebook}
          </svg>
        </button>
        <button className={btn} aria-label="Share on X" onClick={() => open(links.x)}>
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
            {SOCIAL_ICONS.x}
          </svg>
        </button>
        <button className={btn} aria-label="Share on Telegram" onClick={() => open(links.telegram)}>
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
            <path d="M21.5 4.3 18.3 19.6c-.2 1-.9 1.3-1.8.8l-4.8-3.6-2.3 2.2c-.3.3-.5.5-1 .5l.3-4.9 8.9-8c.4-.4-.1-.6-.6-.2l-11 6.9-4.7-1.5c-1-.3-1-1 .2-1.5l18.5-7.1c.9-.3 1.6.2 1.5 1.1z" />
          </svg>
        </button>
        <button
          className={`${btn} w-auto px-3 text-[13px] font-semibold`}
          aria-label="Copy link"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
            } catch {
              window.prompt('Copy this link:', url);
            }
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
          }}
        >
          {copied ? 'Copied ✓' : 'Copy link'}
        </button>
      </div>
      {isLocal && (
        <p className="mt-2 text-sm text-amber-200/80">
          Testing on localhost: shared links only open on this computer, and Facebook can&apos;t preview them. Once the site is live (NEXT_PUBLIC_SITE_URL), shares use the real address.
        </p>
      )}
    </div>
  );
}
