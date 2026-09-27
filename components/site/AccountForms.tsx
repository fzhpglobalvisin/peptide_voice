'use client';

import { useActionState, useState } from 'react';
import {
  changeCustomerPassword,
  customerLogin,
  customerRegister,
  saveAccountDetails,
  type AccountState,
} from '@/app/(store)/my-account/actions';
import { storeWhatsApp } from '@/lib/social';

const label = 'block text-[13px] font-semibold text-slate-700';
const input = 'mt-1 w-full rounded border border-slate-400 bg-white px-3 py-2.5 text-[15px] text-slate-900 outline-none focus:border-[#1f7fc0] focus:ring-2 focus:ring-[#1f7fc0]/25';
const btn = 'rounded-full bg-[#2aa3c9] px-6 py-2.5 text-sm font-bold text-white hover:bg-[#1f7fc0] disabled:opacity-50';

function Msg({ s }: { s: AccountState }) {
  if (s.error)
    return (
      <p className="rounded border-l-4 border-red-500 bg-red-50 px-3 py-2 text-[13px] text-red-700" role="alert">
        {s.error}
      </p>
    );
  if (s.ok)
    return (
      <p className="rounded border-l-4 border-emerald-500 bg-emerald-50 px-3 py-2 text-[13px] text-emerald-700" role="status">
        {s.ok}
      </p>
    );
  return null;
}

/** Password field with a show/hide eye, like the live site. */
function Password({ name, autoComplete, labelText }: { name: string; autoComplete: string; labelText: string }) {
  const [show, setShow] = useState(false);
  return (
    <label className={label}>
      {labelText} <span className="text-red-600">*</span>
      <span className="relative mt-1 block">
        <input name={name} type={show ? 'text' : 'password'} autoComplete={autoComplete} required className={`${input} mt-0 pr-11`} />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? 'Hide password' : 'Show password'}
          className="absolute inset-y-0 right-0 grid w-10 place-items-center text-[#1f7fc0]"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
            <circle cx="12" cy="12" r="3" />
            {show && <path d="M3 3l18 18" />}
          </svg>
        </button>
      </span>
    </label>
  );
}

/** Bots fill every field; people never see this one. */
const Honeypot = () => <input type="text" name="website" tabIndex={-1} autoComplete="off" className="!m-0 hidden" aria-hidden />;

export function LoginForm() {
  const [s, action, pending] = useActionState<AccountState, FormData>(customerLogin, {});
  const wa = storeWhatsApp();
  const lost = wa
    ? `https://wa.me/${wa}?text=${encodeURIComponent('Hello Ridgeline Fit, I forgot my account password. My account email is: ')}`
    : '/contact';
  return (
    <form action={action} className="space-y-4">
      <label className={label}>
        Email address <span className="text-red-600">*</span>
        <input name="email" type="email" autoComplete="email" required className={input} />
      </label>
      <Password name="password" autoComplete="current-password" labelText="Password" />
      <Honeypot />
      <Msg s={s} />
      <div className="flex flex-wrap items-center gap-4">
        <button disabled={pending} className={btn}>
          {pending ? 'Logging in…' : 'Log In'}
        </button>
        <label className="flex items-center gap-2 text-[13px] text-slate-700">
          <input type="checkbox" name="remember" className="h-4 w-4" defaultChecked /> Remember me
        </label>
      </div>
      <a href={lost} target={wa ? '_blank' : undefined} rel="noreferrer" className="inline-block text-[13px] text-[#c2185b] underline">
        Lost your password?
      </a>
    </form>
  );
}

export function RegisterForm() {
  const [s, action, pending] = useActionState<AccountState, FormData>(customerRegister, {});
  return (
    <form action={action} className="space-y-4">
      <label className={label}>
        Email address <span className="text-red-600">*</span>
        <input name="email" type="email" autoComplete="email" required className={input} />
      </label>
      <Password name="password" autoComplete="new-password" labelText="Password (8+ characters)" />
      <Honeypot />
      <p className="text-[12px] leading-relaxed text-slate-500">
        Your details are used to manage your account and research orders. Products are sold for laboratory research use only.
      </p>
      <Msg s={s} />
      <button disabled={pending} className={btn}>
        {pending ? 'Creating account…' : 'Register'}
      </button>
    </form>
  );
}

export function DetailsForm({ name, whatsapp, email }: { name: string; whatsapp: string; email: string }) {
  const [s, action, pending] = useActionState<AccountState, FormData>(saveAccountDetails, {});
  return (
    <form action={action} className="space-y-4">
      <label className={label}>
        Email address
        <input value={email} readOnly className={`${input} bg-slate-100 text-slate-500`} />
      </label>
      <label className={label}>
        Name
        <input name="name" defaultValue={name} autoComplete="name" className={input} />
      </label>
      <label className={label}>
        WhatsApp number (with country code)
        <input name="whatsapp" type="tel" defaultValue={whatsapp} autoComplete="tel" placeholder="+923001234567" className={input} />
      </label>
      <p className="text-[12px] text-slate-500">Your name and WhatsApp are filled in automatically when you order or request a quote.</p>
      <Msg s={s} />
      <button disabled={pending} className={btn}>
        {pending ? 'Saving…' : 'Save details'}
      </button>
    </form>
  );
}

export function PasswordForm() {
  const [s, action, pending] = useActionState<AccountState, FormData>(changeCustomerPassword, {});
  return (
    <form action={action} className="space-y-4">
      <Password name="current" autoComplete="current-password" labelText="Current password" />
      <Password name="password" autoComplete="new-password" labelText="New password (8+ characters)" />
      <Password name="confirm" autoComplete="new-password" labelText="Confirm new password" />
      <Msg s={s} />
      <button disabled={pending} className={btn}>
        {pending ? 'Saving…' : 'Change password'}
      </button>
    </form>
  );
}
