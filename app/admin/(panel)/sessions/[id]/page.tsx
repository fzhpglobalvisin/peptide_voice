import Link from 'next/link';
import { notFound } from 'next/navigation';
import { sessionDetail } from '@/lib/analytics';

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const s = await sessionDetail((await params).id);
  if (!s) notFound();
  const transcript = JSON.parse(s.transcript) as { role: string; text: string; at: number }[];
  let summary: Record<string, unknown> | null = null;
  try {
    summary = s.summary ? JSON.parse(s.summary) : null;
  } catch {}

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
      <div>
        <Link href="/admin" className="text-xs text-cyan-text">← Analytics</Link>
        <h1 className="mt-2 font-head text-xl font-bold">Session {s.id}</h1>
        <p className="text-xs text-white/50">
          {new Date(s.started_at).toLocaleString()} · {s.language ?? 'language —'} · {s.status}
        </p>
        <div className="mt-4 space-y-2">
          {transcript.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : ''}`}>
              <p dir="auto" className={`max-w-[80%] whitespace-pre-wrap rounded-xl px-3 py-2 text-sm ${m.role === 'user' ? 'bg-[#1f59c9]' : 'bg-white/5'}`}>
                {m.text}
              </p>
            </div>
          ))}
          {!transcript.length && <p className="text-sm text-white/40">Transcript is saved when the customer closes the session.</p>}
        </div>
      </div>
      <aside className="space-y-3">
        <div className="rounded-xl border border-white/10 bg-[#0a1120] p-4 text-xs">
          <h2 className="font-bold">Summary</h2>
          {summary ? (
            <dl className="mt-2 space-y-2">
              {Object.entries(summary).map(([k, v]) => (
                <div key={k}>
                  <dt className="uppercase text-white/40">{k.replace(/_/g, ' ')}</dt>
                  <dd>{Array.isArray(v) ? v.join(', ') : String(v || '—')}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="mt-2 text-white/40">Not summarised yet.</p>
          )}
        </div>
        <div className="rounded-xl border border-white/10 bg-[#0a1120] p-4 text-xs">
          <h2 className="font-bold">Research context</h2>
          {s.research ? (
            <ul className="mt-2 space-y-1">
              <li>Institution: {String(s.research.institution_type ?? '—')}</li>
              <li>Area: {String(s.research.research_area ?? '—')}</li>
              <li>Scale: {String(s.research.quantity_scale ?? '—')}</li>
              <li>Compounds: {JSON.parse(String(s.research.compounds ?? '[]')).join(', ') || '—'}</li>
              <li>COA required: {s.research.coa_required === 1 ? 'yes' : s.research.coa_required === 0 ? 'no' : '—'}</li>
            </ul>
          ) : (
            <p className="mt-2 text-white/40">None recorded.</p>
          )}
        </div>
        <div className="rounded-xl border border-white/10 bg-[#0a1120] p-4 text-xs">
          <h2 className="font-bold">Compliance redirects</h2>
          {s.compliance.length ? (
            <ul className="mt-2 space-y-1">
              {s.compliance.map((c, i) => (
                <li key={i}>
                  <span className="rounded bg-amber-500/20 px-1 text-amber-200">{c.category}</span> {c.excerpt}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-white/40">None.</p>
          )}
        </div>
        <div className="rounded-xl border border-white/10 bg-[#0a1120] p-4 text-xs">
          <h2 className="font-bold">Leads from this session</h2>
          {s.leads.length ? (
            s.leads.map((l) => (
              <p key={String(l.id)} className="mt-2">
                {String(l.name)} · {String(l.email ?? l.whatsapp ?? '')} · {String(l.source)}
              </p>
            ))
          ) : (
            <p className="mt-2 text-white/40">None.</p>
          )}
        </div>
      </aside>
    </div>
  );
}
