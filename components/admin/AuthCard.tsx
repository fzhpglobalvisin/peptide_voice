import type { ReactNode } from 'react';

/** Shared card for the signed-out admin pages (login, forgot, reset). */
export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#05080d] px-4 text-white">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0a1120] p-8">
        <h1 className="text-center font-head text-2xl font-extrabold">{title}</h1>
        {subtitle && <p className="mt-2 text-center text-sm text-white/60">{subtitle}</p>}
        {children}
      </div>
    </main>
  );
}
