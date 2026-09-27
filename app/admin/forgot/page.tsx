import { ForgotForm } from '@/components/admin/SignInButton';
import { AuthCard } from '@/components/admin/AuthCard';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Forgot login', robots: { index: false } };

export default function ForgotPage() {
  return (
    <AuthCard title="Forgot your login?" subtitle="Enter the admin's recovery email. We'll send your username and a link to set a new password.">
      <ForgotForm />
      <p className="mt-5 text-[11px] leading-relaxed text-white/40">
        No access to that email? Whoever manages the server can reset it with{' '}
        <code className="text-white/60">npm run reset-admin -- &lt;username&gt; &lt;new-password&gt;</code>.
      </p>
    </AuthCard>
  );
}
