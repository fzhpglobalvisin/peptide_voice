'use client';

import { useState } from 'react';
import { useApp } from '../AppProvider';
import { api } from '@/lib/client';

const input = 'w-full rounded-sm bg-white px-2.5 py-2 text-sm text-black outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-cyan-brand';

export function ContactForm() {
  const { sessionId } = useApp();
  const [f, setF] = useState({ first: '', last: '', email: '', mobile: '', message: '' });
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');
  const [err, setErr] = useState('');
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));

  if (state === 'done') return <p className="mt-6 text-center text-sm text-cyan-text">Thank you — our research support team will reply shortly.</p>;

  return (
    <form
      className="mt-5 space-y-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setState('busy');
        setErr('');
        try {
          await api.lead({
            name: `${f.first} ${f.last}`.trim(),
            email: f.email,
            whatsapp: f.mobile,
            message: f.message,
            source: 'contact',
            consent_whatsapp: consent,
            sessionId,
          });
          setState('done');
        } catch (x) {
          setErr((x as Error).message);
          setState('idle');
        }
      }}
    >
      <div className="grid grid-cols-2 gap-2">
        <input required className={input} placeholder="First Name" value={f.first} onChange={set('first')} aria-label="First name" />
        <input className={input} placeholder="Last Name" value={f.last} onChange={set('last')} aria-label="Last name" />
      </div>
      <input required type="email" className={input} placeholder="Enter Your Email Address" value={f.email} onChange={set('email')} aria-label="Email" />
      <input type="tel" className={input} placeholder="Enter Your Mobile Number" value={f.mobile} onChange={set('mobile')} aria-label="Mobile number" />
      <textarea required className={`${input} h-16`} placeholder="Research Inquiry Details" value={f.message} onChange={set('message')} aria-label="Research inquiry details" />
      <label data-ai="off" className="flex items-start gap-2 text-sm text-white/80">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" />
        You may contact me on WhatsApp at this number.
      </label>
      {err && <p className="text-xs text-red-400" role="alert">{err}</p>}
      <button disabled={state === 'busy'} className="w-full rounded-sm bg-[#3aaec9] py-2 text-sm font-semibold text-white disabled:opacity-60">
        {state === 'busy' ? 'Sending…' : 'Send'}
      </button>
    </form>
  );
}
