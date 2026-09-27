'use client';

import Link from 'next/link';
import { useActionState, useRef, useState, type ReactNode } from 'react';
import { login, registerAdmin, type FormState } from '@/app/admin/login/actions';

const field =
  'mt-1.5 w-full rounded-lg border border-white/20 bg-white/10 px-3.5 py-2.5 text-[15px] text-white outline-none placeholder:text-white/40 focus:border-[#7aa2ff] focus:ring-2 focus:ring-[#7aa2ff]/40';
const lbl = 'block text-[13px] font-medium text-white/85';
const primary = 'w-full rounded-lg bg-[#5b8cff] py-2.5 text-[15px] font-semibold text-white shadow-lg shadow-[#5b8cff]/25 transition hover:bg-[#6d99ff] disabled:opacity-60';

function Alert({ s }: { s: FormState }) {
  if (s.error) return <p className="rounded-lg border border-red-400/40 bg-red-500/15 px-3 py-2 text-[13px] text-red-100" role="alert">{s.error}</p>;
  if (s.ok) return <p className="rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-3 py-2 text-[13px] text-emerald-100" role="status">{s.ok}</p>;
  return null;
}

function SignIn({ accounts }: { accounts: string[] }) {
  const [s, action, pending] = useActionState<FormState, FormData>(login, {});
  const userRef = useRef<HTMLInputElement>(null);
  const passRef = useRef<HTMLInputElement>(null);
  return (
    <form action={action} className="space-y-4">
      <label className={lbl}>
        User ID or email
        <input ref={userRef} name="username" autoComplete="username" required autoFocus className={field} />
      </label>
      <label className={lbl}>
        Password
        <input ref={passRef} name="password" type="password" autoComplete="current-password" required className={field} />
      </label>
      <Alert s={s} />
      <button disabled={pending} className={primary}>
        {pending ? 'Signing in…' : 'Sign in'}
      </button>
      <p className="text-center">
        <Link href="/admin/forgot" className="text-[13px] text-white/60 hover:text-white">
          Forgot user ID or password?
        </Link>
      </p>

      {accounts.length > 0 && (
        <div className="border-t border-white/10 pt-4">
          <p className="mb-2 text-[12px] text-white/60">Admin accounts:</p>
          <div className="flex flex-wrap gap-2">
            {accounts.map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => {
                  // Fills the user ID only; the password is always typed by hand.
                  if (userRef.current) userRef.current.value = u;
                  passRef.current?.focus();
                }}
                className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[12px] text-white/90 hover:bg-white/20"
              >
                <b className="mr-1">{u}</b>
                <span className="text-white/60">Super admin</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </form>
  );
}

function CreateAccount({ inviteEnabled }: { inviteEnabled: boolean }) {
  const [s, action, pending] = useActionState<FormState, FormData>(registerAdmin, {});
  if (!inviteEnabled)
    return (
      <p className="rounded-lg border border-white/15 bg-white/5 p-4 text-[13px] leading-relaxed text-white/75">
        New admin accounts are turned off. To allow them, set <code className="text-white">ADMIN_INVITE_CODE</code> in <code className="text-white">.env</code> and share the
        code only with people who should manage the store. Existing admins can also reset access with <code className="text-white">npm run reset-admin</code>.
      </p>
    );
  return (
    <form action={action} className="space-y-4">
      <label className={lbl}>
        Invite code
        <input name="invite" required autoComplete="off" className={field} placeholder="From the store owner" />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={lbl}>
          User ID
          <input name="username" required autoComplete="username" className={field} />
        </label>
        <label className={lbl}>
          Email <span className="text-white/45">(for recovery)</span>
          <input name="email" type="email" autoComplete="email" className={field} />
        </label>
      </div>
      <label className={lbl}>
        Password <span className="text-white/45">(10+ characters)</span>
        <input name="password" type="password" minLength={10} required autoComplete="new-password" className={field} />
      </label>
      <label className={lbl}>
        Repeat password
        <input name="confirm" type="password" minLength={10} required autoComplete="new-password" className={field} />
      </label>
      <Alert s={s} />
      <button disabled={pending} className={primary}>
        {pending ? 'Creating…' : 'Create admin account'}
      </button>
    </form>
  );
}

/** Admin sign-in card: tabs for Sign in / Create account, quick-pick account chips. */
export function AdminAuthCard({ accounts, inviteEnabled, notice }: { accounts: string[]; inviteEnabled: boolean; notice?: ReactNode }) {
  const [tab, setTab] = useState<'signin' | 'create'>('signin');
  return (
    <div className="w-full max-w-[420px] rounded-2xl border border-white/15 bg-white/[0.07] p-6 shadow-2xl backdrop-blur-md sm:p-7">
      <div className="flex items-center gap-3">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#ff6fb5] via-[#a855f7] to-[#5b8cff] shadow-lg">
          <svg viewBox="0 0 24 24" className="h-7 w-7 text-white" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" aria-hidden>
            <path d="M2.5 18 9 7l3.5 5.5L15 9l6.5 9z" />
          </svg>
        </div>
        <div>
          <h1 className="font-head text-2xl font-bold leading-tight text-white">Ridgeline Admin</h1>
          <p className="text-[13px] text-white/65">Products · orders · customers · reports</p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-1 rounded-xl bg-black/25 p-1" role="tablist">
        {(
          [
            ['signin', 'Sign in'],
            ['create', 'Create account'],
          ] as const
        ).map(([k, l]) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={`rounded-lg py-2 text-[14px] font-semibold transition ${tab === k ? 'bg-white/15 text-white shadow' : 'text-white/60 hover:text-white'}`}
          >
            {l}
          </button>
        ))}
      </div>

      {notice && <div className="mt-4">{notice}</div>}

      <div className="mt-5">{tab === 'signin' ? <SignIn accounts={accounts} /> : <CreateAccount inviteEnabled={inviteEnabled} />}</div>
    </div>
  );
}
