import { redirect } from 'next/navigation';
import { getAdminSession, missingAuthConfig } from '@/lib/auth';
import { LoginForm } from '@/components/admin/SignInButton';
import { AuthCard } from '@/components/admin/AuthCard';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin sign in', robots: { index: false } };

export default async function AdminLogin({ searchParams }: { searchParams: Promise<{ reset?: string }> }) {
  const missing = missingAuthConfig();
  if (!missing.length && (await getAdminSession())) redirect('/admin');
  const { reset } = await searchParams;

  return (
    <AuthCard title="Ridgeline Admin" subtitle="Sign in to manage products, leads and analytics.">
      {missing.length > 0 && (
        <div className="mt-4 rounded-lg border border-amber-400/40 bg-amber-400/10 p-3 text-xs text-amber-100" role="alert">
          <p className="font-bold">Missing settings in .env.local:</p>
          <ul className="mt-1 list-disc pl-4">
            {missing.map((m) => (
              <li key={m}>
                <code>{m}</code>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-amber-100/80">Add them, then stop and restart the dev server (env files are only read at startup).</p>
        </div>
      )}
      {reset === '1' && (
        <p className="mt-4 rounded-md bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300" role="status">
          Password updated. Sign in with your new password.
        </p>
      )}
      <LoginForm />
    </AuthCard>
  );
}
