'use client';

import { useActionState } from 'react';
import { demoDataAction } from '@/app/admin/actions';

type State = { error?: string; ok?: string };
interface Counts {
  sessions: number;
  leads: number;
  orders: number;
  customers: number;
  present: boolean;
}

function Messages({ state }: { state: State }) {
  if (state.error) return <p className="rounded-md bg-red-500/10 px-3 py-2 text-xs text-red-300" role="alert">{state.error}</p>;
  if (state.ok) return <p className="rounded-md bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300" role="status">{state.ok}</p>;
  return null;
}

function RemoveForm({ label = 'Remove demo data', compact = false }: { label?: string; compact?: boolean }) {
  const [state, action, pending] = useActionState<State, FormData>(demoDataAction, {});
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm('Remove all demo data? Only sample records (tagged demo / @demo.example) are deleted. Real orders, leads, customers and products stay.')) e.preventDefault();
      }}
      className={compact ? 'flex flex-wrap items-center gap-2' : 'space-y-2'}
    >
      <input type="hidden" name="op" value="remove" />
      <button disabled={pending} className="rounded-lg bg-red-500/90 px-3 py-2 text-xs font-bold text-white hover:bg-red-500 disabled:opacity-60">
        {pending ? 'Removing…' : label}
      </button>
      <Messages state={state} />
    </form>
  );
}

function LoadForm({ refresh }: { refresh: boolean }) {
  const [state, action, pending] = useActionState<State, FormData>(demoDataAction, {});
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="op" value="load" />
      <button disabled={pending} className="btn-primary text-xs disabled:opacity-60">
        {pending ? 'Loading… (a few seconds)' : refresh ? 'Reset demo data' : 'Load demo data'}
      </button>
      <Messages state={state} />
    </form>
  );
}

/** Account page section. */
export function DemoDataPanel({ counts }: { counts: Counts }) {
  return (
    <div className="space-y-4 text-sm">
      <p className="text-xs leading-relaxed text-white/60">
        Fills the dashboard with about 90 days of sample voice sessions, leads, WhatsApp quotes, orders and customers, so you can show how the
        admin works. Every sample record is tagged (<code className="text-white/80">demo</code> / <code className="text-white/80">@demo.example</code>, fake
        +1 555-01xx numbers), so removing it never touches real customers, orders or products.
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(
          [
            ['Sessions', counts.sessions],
            ['Leads', counts.leads],
            ['Orders', counts.orders],
            ['Customers', counts.customers],
          ] as const
        ).map(([k, v]) => (
          <div key={k} className="rounded-lg bg-white/5 px-3 py-2">
            <div className="text-[11px] uppercase tracking-wide text-white/45">{k}</div>
            <div className="font-head text-lg font-bold">{v}</div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-start gap-3">
        <LoadForm refresh={counts.present} />
        {counts.present && <RemoveForm />}
      </div>
      {counts.present && (
        <p className="text-xs text-white/50">
          Demo customers can sign in to My Account with any <code>@demo.example</code> email from the Customers page and the password{' '}
          <code className="text-white/80">demo-password-123</code>. Remove the demo data before the store goes live.
        </p>
      )}
    </div>
  );
}

/** Notice on the dashboard while sample data is mixed into the numbers. */
export function DemoDataBanner({ counts }: { counts: Counts }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3">
      <p className="text-xs text-amber-100">
        <b>Demo data is showing.</b> The figures include {counts.sessions} sample voice sessions, {counts.leads} leads and {counts.orders} orders that
        aren&apos;t real. Remove them before the store goes live.
      </p>
      <RemoveForm compact />
    </div>
  );
}
