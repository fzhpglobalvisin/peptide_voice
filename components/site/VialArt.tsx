/* eslint-disable @next/next/no-img-element */
import type { Product } from '@/lib/types';

/**
 * Product image. Uses the product's real photo when image_url is set in the admin;
 * otherwise draws a vial in the Ridgeline style (blue cap, silver crimp, black label, purity band).
 */
export function VialArt({ product, className = '' }: { product: Pick<Product, 'name' | 'image_url' | 'purity' | 'category'>; className?: string }) {
  if (product.image_url) {
    return <img src={product.image_url} alt={product.name} className={`object-contain ${className}`} loading="lazy" decoding="async" />;
  }
  const label = product.name.replace(/\s*\(.*?\)\s*/g, ' ').trim();
  const lines = label.length > 14 ? splitLabel(label) : [label];
  const id = label.replace(/[^a-z0-9]/gi, '').slice(0, 12) || 'v';
  return (
    <svg viewBox="0 0 100 150" className={className} role="img" aria-label={product.name}>
      <defs>
        <linearGradient id={`g-${id}`} x1="0" x2="1">
          <stop offset="0" stopColor="#dfe6ee" />
          <stop offset="0.25" stopColor="#ffffff" />
          <stop offset="0.6" stopColor="#cfd8e2" />
          <stop offset="1" stopColor="#a7b3c1" />
        </linearGradient>
        <linearGradient id={`c-${id}`} x1="0" x2="1">
          <stop offset="0" stopColor="#1b2f73" />
          <stop offset="0.5" stopColor="#2c46a8" />
          <stop offset="1" stopColor="#15245a" />
        </linearGradient>
      </defs>
      <ellipse cx="50" cy="14" rx="26" ry="7" fill={`url(#c-${id})`} />
      <rect x="24" y="12" width="52" height="12" rx="4" fill={`url(#c-${id})`} />
      <rect x="27" y="24" width="46" height="16" rx="2" fill={`url(#g-${id})`} />
      <path d="M30 40 h40 v6 q8 4 8 12 v78 q0 8 -8 8 h-40 q-8 0 -8 -8 v-78 q0 -8 8 -12z" fill={`url(#g-${id})`} opacity="0.95" />
      <rect x="23" y="62" width="54" height="66" rx="2" fill="#0a0d14" />
      <path d="M40 72 l6 -6 l4 4 l4 -4 l6 6z" fill="#3d7bd8" />
      <text x="50" y="80" textAnchor="middle" fontSize="4" fill="#9ab3d6" fontFamily="sans-serif" fontWeight="700">RIDGELINE FIT</text>
      {lines.map((l, i) => (
        <text key={i} x="50" y={91 + i * 7} textAnchor="middle" fontSize={lines.length > 1 ? 5.4 : 6.2} fill="#fff" fontFamily="sans-serif" fontWeight="800">
          {l}
        </text>
      ))}
      <rect x="23" y="106" width="54" height="7" fill="#1f59c9" />
      <text x="50" y="111.4" textAnchor="middle" fontSize="4.3" fill="#fff" fontFamily="sans-serif" fontWeight="800">
        {product.category === 'supply' ? 'LAB SUPPLY' : `${product.purity} PURITY`}
      </text>
      <text x="50" y="120" textAnchor="middle" fontSize="3.2" fill="#9aa4b2" fontFamily="sans-serif">RESEARCH USE ONLY</text>
      <text x="50" y="124.5" textAnchor="middle" fontSize="2.6" fill="#6f7a88" fontFamily="sans-serif">NOT FOR HUMAN CONSUMPTION</text>
      <rect x="30" y="44" width="4" height="90" rx="2" fill="#fff" opacity="0.35" />
    </svg>
  );
}

function splitLabel(s: string) {
  const words = s.split(/[\s/]+/);
  const out: string[] = [''];
  for (const w of words) {
    const cur = out[out.length - 1];
    if ((cur + ' ' + w).trim().length > 14 && cur) out.push(w);
    else out[out.length - 1] = (cur + ' ' + w).trim();
  }
  return out.slice(0, 2);
}
