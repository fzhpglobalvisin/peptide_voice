'use client';

import { useState } from 'react';

const FAQS = [
  ['Are your products intended for laboratory use only?', 'Yes, all peptides and compounds are formulated strictly for controlled laboratory studies, in vitro analysis, and research applications. They are not for personal, human, or veterinary use.'],
  ['Are your compounds verified for purity and quality?', 'All products undergo rigorous third-party testing for purity, concentration, and integrity. Each batch includes documentation to ensure reproducibility and reliable experimental outcomes.'],
  ['Do you offer bulk or custom quantities?', 'Yes, we provide flexible quantity options suitable for research laboratories and institutions, including bulk orders and specialized compound concentrations.'],
  ['Are your compounds water-soluble?', 'Our peptides and research compounds are formulated for optimal solubility and stability under laboratory conditions, supporting consistent preparation and analysis.'],
];

export function Faq() {
  const [open, setOpen] = useState<Set<number>>(new Set([0, 1, 2, 3]));
  return (
    <div className="space-y-2.5">
      {FAQS.map(([q, a], i) => {
        const isOpen = open.has(i);
        return (
          <div key={q} className="overflow-hidden rounded-md border border-cyan-faq">
            <button
              className="flex w-full items-center justify-between bg-black px-3 py-2 text-left font-alt text-sm font-bold uppercase text-cyan-text"
              aria-expanded={isOpen}
              onClick={() =>
                setOpen((s) => {
                  const n = new Set(s);
                  n.has(i) ? n.delete(i) : n.add(i);
                  return n;
                })
              }
            >
              {q}
              <span aria-hidden className="text-white">{isOpen ? '–' : '+'}</span>
            </button>
            {isOpen && <p className="bg-cyan-faq px-3 py-3 font-alt text-sm leading-relaxed text-white">{a}</p>}
          </div>
        );
      })}
    </div>
  );
}
