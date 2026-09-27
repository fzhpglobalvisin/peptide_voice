import type { ReactNode } from 'react';
import { SOCIAL, shareLinks, storeWhatsApp } from '@/lib/social';

const ICONS: Record<string, ReactNode> = {
  facebook: <path d="M13.5 21v-7.5h2.5l.4-3h-2.9V8.6c0-.9.3-1.5 1.5-1.5h1.5V4.4c-.3 0-1.2-.1-2.2-.1-2.2 0-3.7 1.3-3.7 3.8v2.4H8v3h2.6V21h2.9z" />,
  instagram: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="4.5" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="3.6" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="17.2" cy="6.8" r="1.2" />
    </>
  ),
  tiktok: <path d="M16.6 5.8A4.3 4.3 0 0 1 15.5 3h-3.1v12.3a2.6 2.6 0 1 1-2.6-2.6c.3 0 .5 0 .8.1V9.6a5.8 5.8 0 1 0 4.9 5.7V9a7.3 7.3 0 0 0 4.3 1.4V7.3a4.3 4.3 0 0 1-3.2-1.5z" />,
  x: <path d="M17.8 3h3l-6.6 7.6L22 21h-6.1l-4.8-6.2L5.6 21h-3l7.1-8.1L2.2 3h6.2l4.3 5.7L17.8 3zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5z" />,
  whatsapp: (
    <path d="M12 3a9 9 0 0 0-7.8 13.5L3 21l4.6-1.2A9 9 0 1 0 12 3zm0 16.4a7.4 7.4 0 0 1-3.8-1l-.3-.2-2.7.7.7-2.6-.2-.3A7.4 7.4 0 1 1 12 19.4zm4.1-5.5c-.2-.1-1.3-.7-1.5-.7-.2-.1-.4-.1-.5.1l-.7.9c-.1.2-.3.2-.5.1a6 6 0 0 1-3-2.6c-.2-.4.2-.4.6-1.3.1-.2 0-.3 0-.4l-.7-1.6c-.2-.4-.4-.4-.5-.4h-.4c-.2 0-.4.1-.6.3-.2.2-.8.8-.8 1.9s.8 2.2.9 2.4c.1.1 1.6 2.5 4 3.5 1.5.6 2 .7 2.8.6.4-.1 1.3-.5 1.5-1.1.2-.5.2-1 .1-1.1l-.5-.2z" />
  ),
};

const LABELS: Record<string, string> = { facebook: 'Facebook', instagram: 'Instagram', tiktok: 'TikTok', x: 'X (Twitter)', whatsapp: 'WhatsApp' };

/** Round white social icons (header/footer). Links open the client's real profiles. */
export function SocialIcons({
  size = 'h-4 w-4',
  className = '',
  variant = 'footer',
}: {
  size?: string;
  className?: string;
  /** header = exactly like the live site (Facebook, Instagram, TikTok, X; blue glyphs). footer adds WhatsApp first. */
  variant?: 'header' | 'footer';
}) {
  const wa = storeWhatsApp();
  const links: [string, string][] = [
    // WhatsApp first: chat with the store, or (until the number is set) share the site on WhatsApp.
    ['whatsapp', wa ? `https://wa.me/${wa}` : shareLinks((process.env.NEXT_PUBLIC_SITE_URL || 'https://ridgelinefit.com').replace(/\/$/, '') + '/', 'Ridgeline Fit — research compounds').whatsapp],
    ['facebook', SOCIAL.facebook],
    ['instagram', SOCIAL.instagram],
    ['tiktok', SOCIAL.tiktok],
    ['x', SOCIAL.x],
  ];
  if (variant === 'header') {
    const order: [string, string][] = [
      ['facebook', SOCIAL.facebook],
      ['instagram', SOCIAL.instagram],
      ['tiktok', SOCIAL.tiktok],
      ['x', SOCIAL.x],
    ];
    const cls = `grid ${size} place-items-center rounded-full bg-white text-[#1f7fc0] transition hover:bg-cyan-text hover:text-white`;
    return (
      <div className={`flex items-center gap-1.5 ${className}`}>
        {order.map(([k, href]) =>
          href ? (
            <a key={k} href={href} target="_blank" rel="noopener noreferrer" aria-label={`Ridgeline Fit on ${LABELS[k]}`} title={LABELS[k]} className={cls}>
              <svg viewBox="0 0 24 24" className="h-[62%] w-[62%]" fill="currentColor" aria-hidden>
                {ICONS[k]}
              </svg>
            </a>
          ) : (
            // Shown like the live site even before a profile URL is set (NEXT_PUBLIC_SOCIAL_TIKTOK).
            <span key={k} title={LABELS[k]} className={cls} aria-hidden>
              <svg viewBox="0 0 24 24" className="h-[62%] w-[62%]" fill="currentColor">
                {ICONS[k]}
              </svg>
            </span>
          ),
        )}
      </div>
    );
  }

  return (
    <div className={`flex gap-1 ${className}`}>
      {links
        .filter(([, href]) => href)
        .map(([k, href]) => (
          <a
            key={k}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={k === 'whatsapp' ? (wa ? 'Chat with Ridgeline Fit on WhatsApp' : 'Share Ridgeline Fit on WhatsApp') : `Ridgeline Fit on ${LABELS[k]}`}
            title={LABELS[k]}
            className={`grid ${size} place-items-center rounded-full transition ${k === 'whatsapp' ? 'bg-[#25d366] text-white hover:brightness-110' : 'bg-white text-black hover:bg-cyan-text'}`}
          >
            <svg viewBox="0 0 24 24" className="h-[70%] w-[70%]" fill="currentColor" aria-hidden>
              {ICONS[k]}
            </svg>
          </a>
        ))}
    </div>
  );
}

export { ICONS as SOCIAL_ICONS };
