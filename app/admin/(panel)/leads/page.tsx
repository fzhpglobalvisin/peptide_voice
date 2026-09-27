import { recentLeads, recentOrders } from '@/lib/analytics';
import { money, type CartItem } from '@/lib/types';
import { updateOrderStatus } from '@/app/admin/actions';

const STATUSES = ['pending_review', 'invoiced', 'paid', 'shipped', 'rejected'];

export default async function LeadsPage() {
  const orders = await recentOrders(100);
  const leads = await recentLeads(200);
  return (
    <div className="space-y-6">
      <section>
        <div className="flex items-center justify-between">
          <h1 className="font-head text-2xl font-bold">Order requests</h1>
          <a href="/api/admin/export?type=orders" className="btn-outline">Export CSV</a>
        </div>
        <div className="mt-3 overflow-x-auto rounded-xl border border-white/10 bg-[#0a1120]">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-white/10 text-white/50">
              <tr>
                <th className="px-3 py-2">#</th>
                <th className="px-2 py-2">Date</th>
                <th className="px-2 py-2">Customer</th>
                <th className="px-2 py-2">Institution</th>
                <th className="px-2 py-2">Items</th>
                <th className="px-2 py-2 text-right">Total</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-b border-white/5 align-top">
                  <td className="px-3 py-2">{o.id}</td>
                  <td className="px-2 py-2 whitespace-nowrap">{new Date(o.created_at).toLocaleDateString()}</td>
                  <td className="px-2 py-2">
                    {o.name}
                    <br />
                    <span className="text-white/50">{o.email}</span>
                  </td>
                  <td className="px-2 py-2">{o.institution}</td>
                  <td className="px-2 py-2">
                    {(JSON.parse(o.items) as CartItem[]).map((i) => (
                      <div key={i.slug + i.variant}>
                        {i.qty}× {i.name}
                        {i.variant ? ` (${i.variant})` : ''}
                      </div>
                    ))}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {money(o.total)}
                    {o.discount_code && <div className="text-white/40">{o.discount_code}</div>}
                  </td>
                  <td className="px-3 py-2">
                    <form action={updateOrderStatus} className="flex gap-1">
                      <input type="hidden" name="id" value={o.id} />
                      <select name="status" defaultValue={o.status} className="rounded bg-white/10 px-1 py-0.5">
                        {STATUSES.map((s) => (
                          <option key={s} value={s} className="bg-black">{s.replace('_', ' ')}</option>
                        ))}
                      </select>
                      <button className="rounded bg-white/10 px-2">Save</button>
                    </form>
                  </td>
                </tr>
              ))}
              {!orders.length && (
                <tr>
                  <td colSpan={7} className="px-3 py-4 text-white/40">No order requests yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="font-head text-xl font-bold">Leads</h2>
          <a href="/api/admin/export?type=leads" className="btn-outline">Export CSV</a>
        </div>
        <div className="mt-3 overflow-x-auto rounded-xl border border-white/10 bg-[#0a1120]">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-white/10 text-white/50">
              <tr>
                <th className="px-3 py-2">Date</th>
                <th className="px-2 py-2">Name</th>
                <th className="px-2 py-2">Contact</th>
                <th className="px-2 py-2">Institution</th>
                <th className="px-2 py-2">Source</th>
                <th className="px-2 py-2">WhatsApp OK</th>
                <th className="px-3 py-2">Message</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.id} className="border-b border-white/5 align-top">
                  <td className="px-3 py-2 whitespace-nowrap">{new Date(l.created_at).toLocaleDateString()}</td>
                  <td className="px-2 py-2">{l.name}</td>
                  <td className="px-2 py-2">
                    {l.email}
                    {l.whatsapp && (
                      <a href={`https://wa.me/${l.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="block text-[#25d366]">
                        {l.whatsapp}
                      </a>
                    )}
                  </td>
                  <td className="px-2 py-2">{l.institution}</td>
                  <td className="px-2 py-2">{l.source.replace('_', ' ')}{l.orders ? ' · ordered' : ''}</td>
                  <td className="px-2 py-2">{l.consent_whatsapp ? 'Yes' : 'No'}</td>
                  <td className="max-w-xs px-3 py-2 text-white/70">{l.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
