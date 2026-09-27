'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useApp } from './AppProvider';
import { Logo } from './site/Logo';

/** Researcher verification gate (21+ and lab-research-only). Blocks the store until both boxes are confirmed. */
export function VerificationGate() {
  const { verified, setVerified } = useApp();
  const path = usePathname();
  const [age, setAge] = useState(false);
  const [researcher, setResearcher] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const show = !verified && !path.startsWith('/admin');

  useEffect(() => {
    document.body.style.overflow = show ? 'hidden' : '';
  }, [show]);

  if (!show) return null;

  const submit = async () => {
    setBusy(true);
    setError('');
    const r = await fetch('/api/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ age, researcher }) });
    setBusy(false);
    if (r.ok) setVerified(true);
    else setError('Please confirm both statements to continue.');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="gate-title"
      className="fixed inset-0 z-[100] overflow-y-auto bg-[#eef1f4] px-4 py-10"
      style={{ backgroundImage: 'radial-gradient(circle at 20% 20%, #ffffff 0, transparent 40%), radial-gradient(circle at 80% 80%, #ffffff 0, transparent 40%)' }}
    >
      <Logo className="mx-auto h-20 w-auto drop-shadow" />
      <div className="mx-auto mt-4 max-w-md rounded-2xl bg-white p-6 shadow-xl sm:p-8">
        <h1 id="gate-title" className="font-head text-2xl font-black text-[#0f1b2d] sm:text-3xl">
          Researcher verification
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-500">
          Ridgeline Fit sells research peptides exclusively to qualified researchers and laboratories for in vitro and laboratory use. Please confirm before continuing.
        </p>
        <label data-ai="off" className="mt-5 flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-4 text-sm text-slate-700">
          <input type="checkbox" className="mt-0.5 h-4 w-4" checked={age} onChange={(e) => setAge(e.target.checked)} />
          <span>
            I am at least <b className="text-black">21 years of age.</b>
          </span>
        </label>
        <label data-ai="off" className="mt-3 flex cursor-pointer items-start gap-3 rounded-lg border border-slate-300 p-4 text-sm text-slate-700">
          <input type="checkbox" className="mt-0.5 h-4 w-4" checked={researcher} onChange={(e) => setResearcher(e.target.checked)} />
          <span>
            I confirm I am a <b className="text-black">qualified researcher</b> purchasing for <b className="text-black">in vitro / laboratory research only</b> and not for human or veterinary use.
          </span>
        </label>
        <button
          disabled={!age || !researcher || busy}
          onClick={submit}
          className="mt-6 w-full rounded-full bg-[#2a6fd1] py-3 text-sm font-semibold text-white transition disabled:bg-[#c5d3e3] disabled:text-slate-500"
        >
          {busy ? 'Verifying…' : 'Enter Ridgeline Fit →'}
        </button>
        {error && <p className="mt-2 text-center text-xs text-red-600" role="alert">{error}</p>}
        <p className="mt-5 text-[11px] leading-relaxed text-slate-500">
          We&apos;ll remember your confirmation on this device for 30 days. By proceeding you affirm the statements above are true. Products are not for human or veterinary use, not for use in diagnostic procedures, and have not been evaluated by the U.S. Food and Drug Administration.
        </p>
      </div>
    </div>
  );
}
