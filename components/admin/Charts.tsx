export function BarList({ title, rows, total }: { title: string; rows: { label: string | null; n: number }[]; total?: number }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  const sum = total ?? rows.reduce((s, r) => s + r.n, 0);
  return (
    <div className="rounded-xl border border-white/10 bg-[#0a1120] p-4">
      <h3 className="text-xs font-bold uppercase tracking-wide text-white/60">{title}</h3>
      {rows.length ? (
        <ul className="mt-3 space-y-2">
          {rows.map((r) => (
            <li key={r.label ?? '—'} className="text-xs">
              <div className="flex justify-between">
                <span className="truncate">{(r.label ?? '—').replace(/_/g, ' ')}</span>
                <span className="tabular-nums text-white/70">
                  {r.n} <span className="text-white/40">({sum ? Math.round((100 * r.n) / sum) : 0}%)</span>
                </span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-white/5">
                <div className="h-1.5 rounded-full bg-cyan-brand" style={{ width: `${(100 * r.n) / max}%` }} />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-xs text-white/40">No data yet.</p>
      )}
    </div>
  );
}

export function Kpi({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#0a1120] p-4">
      <p className="text-[11px] uppercase tracking-wide text-white/50">{label}</p>
      <p className="mt-1 font-head text-2xl font-bold tabular-nums">{value}</p>
      {hint && <p className="text-[11px] text-white/40">{hint}</p>}
    </div>
  );
}
