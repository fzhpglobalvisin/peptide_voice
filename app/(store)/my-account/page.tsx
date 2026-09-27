import Link from 'next/link';
import { PageHero } from '@/components/site/PageHero';
import { DetailsForm, LoginForm, PasswordForm, RegisterForm } from '@/components/site/AccountForms';
import { currentCustomer, customerOrders } from '@/lib/customers';
import { customerLogout } from './actions';
import { money, type CartItem } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'My account', robots: { index: false } };

const TABS = [
  ['dashboard', 'Dashboard'],
  ['orders', 'Orders'],
  ['details', 'Account details'],
] as const;

const STATUS: Record<string, string> = {
  pending_review: 'Awaiting confirmation',
  invoiced: 'Invoiced',
  paid: 'Paid',
  shipped: 'Shipped',
  rejected: 'Cancelled',
};

const card = 'rounded-lg border border-slate-300 bg-white p-6 text-slate-800 shadow-sm sm:p-7';

export default async function MyAccount({ searchParams }: { searchParams: Promise<{ tab?: string; welcome?: string }> }) {
  const sp = await searchParams;
  const me = await currentCustomer();

  // ── Signed out: Login | Register, like the live site ──
  if (!me) {
    return (
      <>
        <PageHero title="My Account" />
        <section className="mx-auto grid max-w-[900px] gap-6 px-4 py-12 md:grid-cols-2">
          <div>
            <h2 className="mb-3 text-xl font-semibold text-white/80">Login</h2>
            <div className={card}>
              <LoginForm />
            </div>
          </div>
          <div>
            <h2 className="mb-3 text-xl font-semibold text-white/80">Register</h2>
            <div className={card}>
              <RegisterForm />
            </div>
          </div>
        </section>
      </>
    );
  }

  // ── Signed in: dashboard / orders / details ──
  const tab = TABS.some(([k]) => k === sp.tab) ? sp.tab! : 'dashboard';
  const orders = customerOrders(me.id);
  const displayName = me.name || me.email.split('@')[0];

  return (
    <>
      <PageHero title="My Account" />
      <section className="mx-auto grid max-w-[1100px] gap-6 px-4 py-12 md:grid-cols-[230px_1fr]">
        <nav className="flex flex-row flex-wrap gap-2 md:flex-col" aria-label="Account">
          {TABS.map(([k, l]) => (
            <Link
              key={k}
              href={`/my-account?tab=${k}`}
              aria-current={tab === k ? 'page' : undefined}
              className={`rounded-lg px-4 py-3 text-[15px] font-semibold ${tab === k ? 'bg-[#1f7fc0] text-white' : 'bg-white/5 text-white/80 hover:bg-white/10'}`}
            >
              {l}
            </Link>
          ))}
          <form action={customerLogout}>
            <button className="w-full rounded-lg bg-white/5 px-4 py-3 text-left text-[15px] font-semibold text-white/80 hover:bg-white/10">Log out</button>
          </form>
        </nav>

        <div className={card}>
          {tab === 'dashboard' && (
            <div className="space-y-4 text-[15px] leading-relaxed">
              {sp.welcome && <p className="rounded border-l-4 border-emerald-500 bg-emerald-50 px-3 py-2 text-emerald-700">Your account has been created. Welcome!</p>}
              <p>
                Hello <b>{displayName}</b>. Not you? Use <b>Log out</b> in the menu.
              </p>
              <p>
                From your account dashboard you can view your{' '}
                <Link href="/my-account?tab=orders" className="text-[#1f7fc0] underline">
                  recent orders
                </Link>{' '}
                and edit your{' '}
                <Link href="/my-account?tab=details" className="text-[#1f7fc0] underline">
                  name, WhatsApp number and password
                </Link>
                .
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg bg-slate-100 p-4">
                  <p className="text-[13px] text-slate-500">Orders</p>
                  <p className="text-2xl font-bold">{orders.length}</p>
                </div>
                <div className="rounded-lg bg-slate-100 p-4">
                  <p className="text-[13px] text-slate-500">Total ordered</p>
                  <p className="text-2xl font-bold">{money(orders.filter((o) => o.status !== 'rejected').reduce((a, o) => a + o.total, 0))}</p>
                </div>
                <div className="rounded-lg bg-slate-100 p-4">
                  <p className="text-[13px] text-slate-500">WhatsApp</p>
                  <p className="truncate text-base font-bold">{me.whatsapp || <Link href="/my-account?tab=details" className="text-[#1f7fc0] underline">Add number</Link>}</p>
                </div>
              </div>
              <Link href="/shop" className="inline-block rounded-full bg-[#2aa3c9] px-6 py-2.5 text-sm font-bold text-white hover:bg-[#1f7fc0]">
                Browse research compounds
              </Link>
            </div>
          )}

          {tab === 'orders' &&
            (orders.length ? (
              <div className="-mx-2 overflow-x-auto">
                <table className="w-full text-left text-[14px]">
                  <thead className="text-slate-500">
                    <tr className="border-b border-slate-200">
                      <th className="px-2 py-2">Order</th>
                      <th className="px-2 py-2">Date</th>
                      <th className="px-2 py-2">Status</th>
                      <th className="px-2 py-2">Items</th>
                      <th className="px-2 py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o) => {
                      const items = JSON.parse(o.items) as CartItem[];
                      return (
                        <tr key={o.id} className="border-b border-slate-100 align-top">
                          <td className="px-2 py-3 font-semibold">#{o.id}</td>
                          <td className="px-2 py-3 whitespace-nowrap">{new Date(o.created_at).toLocaleDateString('en-US', { dateStyle: 'medium' })}</td>
                          <td className="px-2 py-3">{STATUS[o.status] ?? o.status}</td>
                          <td className="px-2 py-3">
                            {items.map((i) => (
                              <div key={i.slug + i.variant}>
                                {i.qty} × {i.name}
                                {i.variant ? ` (${i.variant})` : ''}
                              </div>
                            ))}
                          </td>
                          <td className="px-2 py-3 text-right font-semibold tabular-nums">
                            {money(o.total)}
                            {o.discount_code && <div className="text-[12px] font-normal text-slate-500">{o.discount_code}</div>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="space-y-3 text-[15px]">
                <p>No orders yet.</p>
                <Link href="/shop" className="inline-block rounded-full bg-[#2aa3c9] px-6 py-2.5 text-sm font-bold text-white hover:bg-[#1f7fc0]">
                  Browse products
                </Link>
              </div>
            ))}

          {tab === 'details' && (
            <div className="grid gap-8 lg:grid-cols-2">
              <div>
                <h2 className="mb-4 text-lg font-bold">Account details</h2>
                <DetailsForm name={me.name} whatsapp={me.whatsapp} email={me.email} />
              </div>
              <div>
                <h2 className="mb-4 text-lg font-bold">Change password</h2>
                <PasswordForm />
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
