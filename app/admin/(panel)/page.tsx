import Link from 'next/link';
import {
  complianceBreakdown,
  funnel,
  kpis,
  languageBreakdown,
  leadFunnel,
  orderStatusBreakdown,
  productPerformance,
  recentActivity,
  recentSessions,
  researchBreakdown,
  timeSeries,
  type ActivityItem,
} from '@/lib/analytics';
import { Card, ColumnChart, Donut, Funnel, HBars, LineChart, SERIES } from '@/components/admin/DashCharts';
import { money } from '@/lib/types';

export const dynamic = 'force-dynamic';

const RANGES = [7, 30, 90, 365];

const LANGUAGES: Record<string, string> = {
  en: 'English', es: 'Spanish', ar: 'Arabic', ur: 'Urdu', hi: 'Hindi', fr: 'French', de: 'German', pt: 'Portuguese',
  it: 'Italian', zh: 'Chinese', ja: 'Japanese', ko: 'Korean', ru: 'Russian', tr: 'Turkish', bn: 'Bengali', pa: 'Punjabi', unknown: 'Not detected',
};

function ago(ms: number) {
  const s = Math.max(1, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

/** KPI tile with change vs the previous period of the same length. */
function Tile({
  label,
  value,
  now,
  prev,
  hint,
  money: isMoney,
  lowerIsBetter,
}: {
  label: string;
  value?: string;
  now: number;
  prev?: number;
  hint?: string;
  money?: boolean;
  /** e.g. compliance redirects: going up is bad → red */
  lowerIsBetter?: boolean;
}) {
  const delta = prev === undefined ? null : prev === 0 ? (now > 0 ? 100 : 0) : Math.round(((now - prev) / prev) * 100);
  return (
    <div className="rounded-xl border border-white/10 bg-[#0a1120] p-3">
      <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-white/50">{label}</p>
      <p className="mt-1 font-head text-xl font-bold tabular-nums">{value ?? (isMoney ? money(now) : now.toLocaleString())}</p>
      <p className="mt-0.5 flex items-center gap-1 text-[10px] text-white/40">
        {delta !== null && delta !== 0 && (
          <span className={delta > 0 !== !!lowerIsBetter ? 'text-emerald-400' : 'text-red-400'} aria-label={`${delta > 0 ? 'up' : 'down'} ${Math.abs(delta)} percent`}>
            {delta > 0 ? '▲' : '▼'} {Math.abs(delta)}%
          </span>
        )}
        {delta === 0 && <span>— 0%</span>}
        <span className="truncate">{hint ?? (delta !== null ? 'vs previous' : '')}</span>
      </p>
    </div>
  );
}

const ACTIVITY_STYLE: Record<ActivityItem['kind'], { color: string; icon: string }> = {
  session: { color: SERIES[0], icon: '🎙' },
  lead: { color: SERIES[2], icon: '👤' },
  quote: { color: SERIES[3], icon: '📄' },
  order: { color: SERIES[1], icon: '🛒' },
  compliance: { color: '#e66767', icon: '⚠' },
};

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const sp = await searchParams;
  const days = RANGES.includes(Number(sp.days)) ? Number(sp.days) : 30;
  const now = Date.now();
  const since = now - days * 86400000;
  const prevSince = since - days * 86400000;

  // one round-trip wave instead of eight sequential queries
  const [k, p, ts, perf, research, leadsBySource, activity, sessions, funnelSteps, statusRows, langRows, complianceRows] = await Promise.all([
    kpis(since),
    kpis(prevSince, since),
    timeSeries(since, days),
    productPerformance(since),
    researchBreakdown(since),
    leadFunnel(since),
    recentActivity(18),
    recentSessions(8),
    funnel(since),
    orderStatusBreakdown(since),
    languageBreakdown(since),
    complianceBreakdown(since),
  ]);
  const labelMode = ts.monthly ? 'month' : 'day';
  const topProducts = [...perf].filter((x) => x.views + x.cart_adds + x.orders > 0).sort((a, b) => b.views - a.views || b.cart_adds - a.cart_adds).slice(0, 7);

  return (
    <div className="space-y-4">
      {/* Title + range */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-head text-2xl font-bold">Dashboard</h1>
          <p className="text-xs text-white/50">Live store health: voice sessions, leads, quotes and WhatsApp orders.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 rounded-lg bg-white/5 p-1 text-xs" role="group" aria-label="Date range">
            {RANGES.map((d) => (
              <Link key={d} href={`/admin?days=${d}`} aria-current={d === days ? 'true' : undefined} className={`rounded-md px-3 py-1 ${d === days ? 'bg-cyan-brand font-bold text-black' : 'text-white/70 hover:text-white'}`}>
                {d}d
              </Link>
            ))}
          </div>
          <Link href={`/admin?days=${days}`} className="rounded-lg bg-white/5 px-2.5 py-1.5 text-xs text-white/70 hover:text-white" aria-label="Refresh" title="Refresh">
            ↻
          </Link>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
        <Tile label="Voice sessions" now={k.sessions} prev={p.sessions} />
        <Tile label="Leads" now={k.leads} prev={p.leads} />
        <Tile label="WhatsApp opt-ins" now={k.wa_optins} prev={p.wa_optins} />
        <Tile label="Quotes" now={k.quotes} prev={p.quotes} />
        <Tile label="Orders" now={k.orders} prev={p.orders} />
        <Tile label="Order value" now={k.order_value} prev={p.order_value} money />
        <Tile label="Open orders" now={k.open_orders} hint="awaiting confirmation" />
        <Tile label="Compliance redirects" now={k.compliance_redirects} prev={p.compliance_redirects} lowerIsBetter />
      </div>

      {/* Trend + lead sources */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title={`Activity — last ${days} days`} subtitle={ts.monthly ? 'per month' : 'per day'} className="lg:col-span-2">
          <LineChart
            labels={ts.labels}
            labelMode={labelMode}
            series={[
              { name: 'Voice sessions', values: ts.sessions, color: SERIES[0] },
              { name: 'Leads', values: ts.leads, color: SERIES[1] },
              { name: 'Orders', values: ts.orders, color: SERIES[2] },
            ]}
          />
        </Card>
        <Card title="Leads by source">
          <Donut data={leadsBySource.map((l) => ({ label: l.label, n: l.n }))} centerLabel="leads" />
          <p className="mt-3 text-[11px] text-white/45">
            {leadsBySource.reduce((a, b) => a + b.converted, 0)} of {leadsBySource.reduce((a, b) => a + b.n, 0)} leads went on to order.
          </p>
        </Card>
      </div>

      {/* Funnel · order value · order status */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Product funnel" subtitle="all products">
          <Funnel steps={funnelSteps} />
        </Card>
        <Card title="Order value" subtitle={ts.monthly ? 'per month' : 'per day'}>
          <ColumnChart labels={ts.labels} values={ts.value} valueMode="money" labelMode={labelMode} color={SERIES[1]} />
          <p className="mt-2 text-[11px] text-white/45">Total {money(k.order_value)} · {k.orders} orders</p>
        </Card>
        <Card title="Orders by status">
          <Donut data={statusRows} centerLabel="orders" />
        </Card>
      </div>

      {/* Top products · languages · compliance */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Top products" subtitle="by views · orders shown right">
          <HBars data={topProducts.map((x) => ({ label: x.name, n: x.views, sub: `${x.orders} ord` }))} empty="No product views yet." />
        </Card>
        <Card title="Session languages">
          <Donut data={langRows.map((l) => ({ label: LANGUAGES[l.label ?? 'unknown'] ?? (l.label ?? 'Not detected'), n: l.n }))} centerLabel="sessions" />
        </Card>
        <Card title="Compliance redirects" subtitle="questions the assistant declined">
          <Donut data={complianceRows} centerLabel="redirects" />
        </Card>
      </div>

      {/* Research context (only filled when customers mention it) */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card title="Institution type">
          <HBars data={research.institution.map((r) => ({ label: (r.label ?? '—').replace(/_/g, ' '), n: r.n }))} color={SERIES[0]} />
        </Card>
        <Card title="Quantity scale">
          <HBars data={research.scale.map((r) => ({ label: (r.label ?? '—').replace(/_/g, ' '), n: r.n }))} color={SERIES[0]} />
        </Card>
        <Card title="Research areas">
          <HBars data={research.area.map((r) => ({ label: r.label ?? '—', n: r.n }))} color={SERIES[0]} empty="None mentioned yet." />
        </Card>
        <Card title="COA requirement">
          <HBars data={research.coa.map((r) => ({ label: r.label ?? '—', n: r.n }))} color={SERIES[0]} />
        </Card>
      </div>

      {/* Product table + activity feed */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Product performance" subtitle="views → AI recs → cart → quote → order" className="lg:col-span-2">
          <div className="-mx-4 max-h-[420px] overflow-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-[#0a1120] text-white/50">
                <tr className="border-b border-white/10">
                  <th className="px-4 py-2 font-semibold">Product</th>
                  <th className="px-2 py-2 text-right font-semibold">Views</th>
                  <th className="px-2 py-2 text-right font-semibold">AI recs</th>
                  <th className="px-2 py-2 text-right font-semibold">Cart</th>
                  <th className="px-2 py-2 text-right font-semibold">Quotes</th>
                  <th className="px-2 py-2 text-right font-semibold">Orders</th>
                  <th className="px-4 py-2 text-right font-semibold">View→order</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {perf.map((x) => (
                  <tr key={x.id} className="border-b border-white/5 hover:bg-white/[0.03]">
                    <td className="px-4 py-1.5">
                      {x.name} {x.status === 'retired' && <span className="text-white/40">(retired)</span>}
                    </td>
                    <td className="px-2 py-1.5 text-right">{x.views}</td>
                    <td className="px-2 py-1.5 text-right">{x.ai_recs}</td>
                    <td className="px-2 py-1.5 text-right">{x.cart_adds}</td>
                    <td className="px-2 py-1.5 text-right">{x.quotes}</td>
                    <td className="px-2 py-1.5 text-right">{x.orders}</td>
                    <td className="px-4 py-1.5 text-right">{x.view_to_order_pct === null ? '—' : `${x.view_to_order_pct}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Recent activity">
          <ul className="-mr-2 max-h-[420px] space-y-2.5 overflow-auto pr-2">
            {activity.map((a, i) => {
              const st = ACTIVITY_STYLE[a.kind];
              const body = (
                <span className="flex items-start gap-2.5">
                  <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px]" style={{ background: `${st.color}33`, color: st.color }} aria-hidden>
                    {st.icon}
                  </span>
                  <span className="min-w-0 text-[11px] leading-snug">
                    <span className="block truncate font-semibold text-white/90">{a.title}</span>
                    <span className="text-white/50">
                      {a.detail} · {ago(a.at)}
                    </span>
                  </span>
                </span>
              );
              return <li key={i}>{a.href ? <Link href={a.href} className="block rounded hover:bg-white/[0.04]">{body}</Link> : body}</li>;
            })}
            {!activity.length && <li className="py-6 text-center text-xs text-white/40">No activity yet.</li>}
          </ul>
        </Card>
      </div>

      {/* Latest sessions with AI summaries */}
      <Card title="Latest voice sessions" subtitle="click for transcript & summary">
        <ul className="divide-y divide-white/5">
          {sessions.map((s) => {
            let summary: { intent?: string } = {};
            try {
              summary = s.summary ? JSON.parse(s.summary) : {};
            } catch {}
            return (
              <li key={s.id} className="py-2 text-xs">
                <Link href={`/admin/sessions/${s.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 hover:text-cyan-text">
                  <span className="text-white/50">{new Date(s.started_at).toLocaleString()}</span>
                  <span className="rounded bg-white/10 px-1.5">{s.language ?? '—'}</span>
                  <span>{s.turn_count} turns</span>
                  {s.redirects > 0 && <span className="rounded bg-amber-500/20 px-1.5 text-amber-200">{s.redirects} redirect{s.redirects > 1 ? 's' : ''}</span>}
                  <span className={s.status === 'open' ? 'text-emerald-400' : 'text-white/40'}>{s.status}</span>
                </Link>
                {summary.intent && <p className="mt-1 text-white/75">{summary.intent}</p>}
              </li>
            );
          })}
          {!sessions.length && <li className="py-4 text-xs text-white/40">No sessions yet.</li>}
        </ul>
      </Card>
    </div>
  );
}
