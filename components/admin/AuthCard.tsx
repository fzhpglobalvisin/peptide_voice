import type { ReactNode } from 'react';

/** Signed-out admin pages (sign in, forgot, reset) — purple glass card like the Workflow Hub login. */
export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <main
      className="grid min-h-screen place-items-center px-4 py-10 text-white"
      style={{
        background:
          'radial-gradient(1200px 600px at 10% -10%, #7b3fe4 0%, transparent 55%), radial-gradient(900px 600px at 110% 110%, #3b82f6 0%, transparent 50%), linear-gradient(135deg, #2a0f5c 0%, #3d1478 45%, #1e0b45 100%)',
      }}
    >
      <div className="w-full max-w-[400px] rounded-2xl border border-white/15 bg-white/[0.07] p-6 shadow-[0_20px_60px_rgba(10,0,40,0.55)] backdrop-blur-xl sm:p-7">
        <div className="flex items-center gap-3.5">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#ff6fa8] via-[#b35cff] to-[#6d5cff] shadow-lg" aria-hidden>
            <svg viewBox="0 0 24 24" className="h-6 w-6 text-white" fill="currentColor">
              <rect x="4" y="4" width="4" height="16" rx="1.5" />
              <rect x="10" y="4" width="4" height="10" rx="1.5" />
              <rect x="16" y="4" width="4" height="13" rx="1.5" />
            </svg>
          </div>
          <div className="min-w-0">
            <h1 className="font-head text-2xl font-extrabold leading-tight tracking-tight">{title}</h1>
            {subtitle && <p className="text-[13px] text-white/65">{subtitle}</p>}
          </div>
        </div>
        {children}
      </div>
    </main>
  );
}

/** Shared styles for the purple admin auth forms. */
export const authStyles = {
  label: 'block text-[13px] font-medium text-white/80',
  input:
    'mt-1.5 w-full rounded-lg border border-white/20 bg-[#2b1656]/70 px-3.5 py-2.5 text-[15px] text-white outline-none placeholder:text-white/35 focus:border-[#7aa7ff] focus:ring-2 focus:ring-[#7aa7ff]/40',
  primary: 'w-full rounded-lg bg-[#5b9bf8] py-2.5 text-[15px] font-semibold text-white shadow-md transition hover:bg-[#4a8af0] disabled:opacity-50',
  secondary:
    'flex w-full items-center justify-center gap-2 rounded-lg border border-white/20 bg-white/[0.06] py-2.5 text-[15px] font-semibold text-white transition hover:bg-white/[0.12] disabled:opacity-50',
};
