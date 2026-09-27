import { redirect } from 'next/navigation';
import { getAdminSession, missingAuthConfig } from '@/lib/auth';
import { adminUsernames } from '@/lib/admin-users';
import { AdminAuthCard } from '@/components/admin/AdminAuthCard';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin sign in', robots: { index: false } };

/**
 * Account chips on the login page: shown in development, hidden on the live site
 * unless ADMIN_SHOW_ACCOUNTS=on (they reveal user IDs, never passwords).
 */
function showAccountChips() {
  const v = process.env.ADMIN_SHOW_ACCOUNTS;
  if (v === 'on') return true;
  if (v === 'off') return false;
  return process.env.NODE_ENV !== 'production';
}

export default async function AdminLogin({ searchParams }: { searchParams: Promise<{ reset?: string }> }) {
  const missing = await missingAuthConfig();
  if (!missing.length && (await getAdminSession())) redirect('/admin');
  const { reset } = await searchParams;
  let accounts: string[] = [];
  if (!missing.length && showAccountChips()) {
    try {
      accounts = await adminUsernames();
    } catch {}
  }

  const notice =
    missing.length > 0 ? (
      <div className="rounded-lg border border-amber-300/40 bg-amber-400/15 p-3 text-[13px] text-amber-50" role="alert">
        <p className="font-bold">Missing settings in .env:</p>
        <ul className="mt-1 list-disc pl-4">
          {missing.map((m) => (
            <li key={m}>
              <code>{m}</code>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-amber-50/80">Add them, then restart the server (env files are read at startup).</p>
      </div>
    ) : reset === '1' ? (
      <p className="rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-3 py-2 text-[13px] text-emerald-100" role="status">
        Password updated. Sign in with your new password.
      </p>
    ) : null;

  return (
    <main
      className="grid min-h-screen place-items-center px-4 py-10"
      style={{ background: 'radial-gradient(circle at 15% 10%, #7c3aed 0, transparent 45%), radial-gradient(circle at 90% 90%, #db2777 0, transparent 40%), linear-gradient(135deg, #3b0f6b, #5b1a86 45%, #2a0a4a)' }}
    >
      <AdminAuthCard accounts={accounts} inviteEnabled={!!process.env.ADMIN_INVITE_CODE?.trim()} notice={notice} />
    </main>
  );
}
