import { listCustomers } from '@/lib/customers';
import { money } from '@/lib/types';
import { CustomerPasswordForm } from '@/components/admin/CustomerPasswordForm';

export default async function CustomersPage() {
  const customers = await listCustomers();
  return (
    <div>
      <h1 className="font-head text-2xl font-bold">Customers ({customers.length})</h1>
      <p className="mt-1 text-xs text-white/50">Accounts created on My Account. When a customer taps “Lost your password?” they message you on WhatsApp; set a new password here and send it to them.</p>
      <div className="mt-4 overflow-x-auto rounded-xl border border-white/10 bg-[#0a1120]">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-white/10 text-white/50">
            <tr>
              <th className="px-4 py-2">Email</th>
              <th className="px-2 py-2">Name</th>
              <th className="px-2 py-2">WhatsApp</th>
              <th className="px-2 py-2 text-right">Orders</th>
              <th className="px-2 py-2 text-right">Spent</th>
              <th className="px-2 py-2">Joined</th>
              <th className="px-2 py-2">Last login</th>
              <th className="px-4 py-2">Password</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.id} className="border-b border-white/5 align-middle">
                <td className="px-4 py-2">{c.email}</td>
                <td className="px-2 py-2">{c.name || '—'}</td>
                <td className="px-2 py-2">
                  {c.whatsapp ? (
                    <a href={`https://wa.me/${c.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="text-[#25d366]">
                      {c.whatsapp}
                    </a>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">{c.orders}</td>
                <td className="px-2 py-2 text-right tabular-nums">{money(c.spent)}</td>
                <td className="px-2 py-2 whitespace-nowrap">{new Date(c.created_at).toLocaleDateString()}</td>
                <td className="px-2 py-2 whitespace-nowrap">{c.last_login_at ? new Date(c.last_login_at).toLocaleString() : '—'}</td>
                <td className="px-4 py-2">
                  <CustomerPasswordForm id={c.id} />
                </td>
              </tr>
            ))}
            {!customers.length && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-white/40">No customer accounts yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
