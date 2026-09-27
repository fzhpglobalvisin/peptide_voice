import Link from 'next/link';
import { adminForResetToken } from '@/lib/admin-users';
import { ResetForm } from '@/components/admin/SignInButton';
import { AuthCard } from '@/components/admin/AuthCard';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Reset password', robots: { index: false }, referrer: 'no-referrer' };

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const token = ((await searchParams).token ?? '').slice(0, 100);
  const admin = await adminForResetToken(token);

  if (!admin) {
    return (
      <AuthCard title="Link expired" subtitle="This reset link is invalid, expired or was already used.">
        <Link href="/admin/forgot" className="btn-primary mt-6 block text-center">
          Request a new link
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Set a new password" subtitle={`Username: ${admin.username}`}>
      <ResetForm token={token} />
    </AuthCard>
  );
}
