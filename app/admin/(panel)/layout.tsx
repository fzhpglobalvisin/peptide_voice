import type { ReactNode } from 'react';
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { SignOutButton } from '@/components/admin/SignInButton';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin', robots: { index: false } };

const NAV = [
  ['/admin', 'Analytics'],
  ['/admin/products', 'Products'],
  ['/admin/leads', 'Leads & Orders'],
  ['/admin/customers', 'Customers'],
  ['/admin/account', 'Account'],
];

export default async function PanelLayout({ children }: { children: ReactNode }) {
  const session = await requireAdmin();
  return (
    <div className="min-h-screen bg-[#05080d] text-white">
      <header className="sticky top-0 z-10 border-b border-white/10 bg-[#05080d]/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <Link href="/admin" className="font-head font-extrabold">Ridgeline Admin</Link>
          <nav className="flex gap-1 text-sm">
            {NAV.map(([href, label]) => (
              <Link key={href} href={href} className="rounded-md px-3 py-1.5 text-white/70 hover:bg-white/10 hover:text-white">
                {label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-xs text-white/50 sm:inline">{session.user.name}</span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
