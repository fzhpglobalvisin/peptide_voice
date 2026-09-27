// Client-safe settings for social links and sharing.
// Profile URLs come from the live ridgelinefit.com site; override any of them in .env with NEXT_PUBLIC_SOCIAL_*.

export const SOCIAL = {
  facebook: process.env.NEXT_PUBLIC_SOCIAL_FACEBOOK || 'https://www.facebook.com/ridgelinefit01',
  instagram: process.env.NEXT_PUBLIC_SOCIAL_INSTAGRAM || 'https://www.instagram.com/ridgelinefit1/',
  tiktok: process.env.NEXT_PUBLIC_SOCIAL_TIKTOK || '', // not linked on the live site yet
  x: process.env.NEXT_PUBLIC_SOCIAL_X || 'https://x.com/Ridgelinefit1',
};

/** Store WhatsApp number (digits only), or '' when not set / still the example number. */
export function storeWhatsApp() {
  const n = (process.env.NEXT_PUBLIC_WHATSAPP_BUSINESS_NUMBER || '').replace(/\D/g, '');
  return n.length >= 8 && !n.startsWith('1555') ? n : '';
}

/** Public URL for sharing: uses the real site address, not localhost, when configured. */
export function publicUrl(pathAndQuery: string) {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '');
  if (typeof window !== 'undefined' && (!base || /localhost|127\.0\.0\.1/.test(base))) return window.location.origin + pathAndQuery;
  return (base || '') + pathAndQuery;
}

export const shareLinks = (url: string, text: string) => ({
  // api.whatsapp.com works on phones (app), desktop app and WhatsApp Web
  whatsapp: `https://api.whatsapp.com/send?text=${encodeURIComponent(`${text} ${url}`)}`,
  facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  x: `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
  telegram: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
});
