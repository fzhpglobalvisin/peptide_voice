'use client';

import { useActionState, useState } from 'react';
import { adminSetCustomerPassword } from '@/app/admin/actions';

export function CustomerPasswordForm({ id }: { id: number }) {
  const [open, setOpen] = useState(false);
  const [s, action, pending] = useActionState(adminSetCustomerPassword, {} as { error?: string; ok?: string });
  if (!open) return <button onClick={() => setOpen(true)} className="rounded bg-white/10 px-2 py-1 hover:bg-white/20">Set password</button>;
  return (
    <form action={action} className="flex flex-wrap items-center gap-1.5">
      <input type="hidden" name="id" value={id} />
      <input name="password" type="text" minLength={8} required placeholder="New password" className="w-36 rounded bg-white/10 px-2 py-1" autoComplete="off" />
      <button disabled={pending} className="rounded bg-cyan-brand px-2 py-1 font-bold text-black">Save</button>
      {s.error && <span className="text-red-300">{s.error}</span>}
      {s.ok && <span className="text-emerald-300">{s.ok}</span>}
    </form>
  );
}
