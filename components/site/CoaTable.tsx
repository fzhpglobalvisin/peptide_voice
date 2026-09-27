'use client';

import { useMemo, useState } from 'react';
import type { Coa } from '@/lib/types';

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const fmt = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d}/${MONTHS[m - 1]}/${String(y).slice(2)}`;
};

export function CoaTable({ coas }: { coas: Coa[] }) {
  const [product, setProduct] = useState('');
  const [q, setQ] = useState('');
  const [applied, setApplied] = useState('');
  const names = useMemo(() => Array.from(new Set(coas.map((c) => c.label))), [coas]);
  const rows = coas.filter((c) => (!product || c.label === product) && (!applied || c.label.toLowerCase().includes(applied.toLowerCase())));

  return (
    <div className="mx-auto mt-6 max-w-[960px]">
      <form
        className="grid gap-3 rounded-xl border border-white/10 bg-gradient-to-r from-[#0d1b3d] to-[#0a1430] p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          setApplied(q);
        }}
      >
        <label className="text-xs font-extrabold uppercase">
          Product
          <select value={product} onChange={(e) => setProduct(e.target.value)} className="mt-1 w-full rounded border border-white/10 bg-[#060d1f] px-2 py-1.5 text-[15px] font-normal normal-case text-white">
            <option value="">All Products</option>
            {names.map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
        <label className="text-xs font-extrabold uppercase">
          Search by product name
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Enter product name..." className="mt-1 w-full rounded border border-white/10 bg-[#060d1f] px-2 py-1.5 text-[15px] font-normal normal-case text-white outline-none" />
        </label>
        <button className="rounded bg-gradient-to-b from-[#4a8fd8] to-[#2a5fa8] px-8 py-2 text-[15px] font-bold">Search</button>
      </form>

      <div className="mt-3 overflow-x-auto">
        <div className="min-w-[520px]">
          <div className="grid grid-cols-[2fr_1.2fr_1fr_0.8fr_0.8fr_0.9fr] rounded-lg border border-white/10 bg-[#101c44] px-3 py-2.5 text-xs font-extrabold uppercase">
            <span>Product</span>
            <span>Batch number</span>
            <span>Test date</span>
            <span>File size</span>
            <span>Status</span>
            <span>Action</span>
          </div>
          {rows.map((c) => (
            <div key={c.id} className="mt-1.5 grid grid-cols-[2fr_1.2fr_1fr_0.8fr_0.8fr_0.9fr] items-center rounded-lg border border-white/10 bg-[#070d19] px-3 py-2 text-xs">
              <span className="flex items-center gap-2 font-bold">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-[#1a2f66] text-[15px] text-cyan-text">✦</span>
                {c.label}
              </span>
              <span>{c.batch}</span>
              <span>{fmt(c.test_date)}</span>
              <span>{c.file_size_mb ? `${c.file_size_mb.toFixed(2)} MB` : '—'}</span>
              <span>
                <span className="rounded-full border border-cyan-brand/60 bg-[#101c44] px-2 py-0.5 text-xs font-extrabold uppercase">{c.status}</span>
              </span>
              {c.file_url ? (
                <a href={c.file_url} target="_blank" rel="noreferrer" className="w-fit rounded bg-[#2a5fa8] px-2.5 py-1 text-xs font-bold">
                  ↗ View COA
                </a>
              ) : (
                <span className="text-xs text-white/40">On request</span>
              )}
            </div>
          ))}
          {!rows.length && <p className="py-8 text-center text-xs text-white/60">No COA found for that product.</p>}
        </div>
      </div>
    </div>
  );
}
