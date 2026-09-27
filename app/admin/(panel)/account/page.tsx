import { requireAdmin } from '@/lib/auth';
import { getAdminById } from '@/lib/admin-users';
import { mailConfigured } from '@/lib/mailer';
import { AccountForm, PasswordForm } from '@/components/admin/SignInButton';
import { DemoDataPanel } from '@/components/admin/DemoDataPanel';
import { demoCounts } from '@/lib/demo-data';

export default async function AccountPage() {
  const session = await requireAdmin();
  const [me, demo] = await Promise.all([getAdminById(session.user.id).then((a) => a!), demoCounts()]);

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="font-head text-2xl font-bold">Account</h1>

      {!me.email && (
        <p className="rounded-lg border border-amber-400/40 bg-amber-400/10 p-3 text-xs text-amber-100">
          Add a recovery email below, otherwise “Forgot username or password” can&apos;t reach you.
        </p>
      )}
      {!mailConfigured() && (
        <p className="rounded-lg border border-white/10 bg-white/5 p-3 text-xs text-white/60">
          Email sending (SMTP) isn&apos;t set up yet, so reset emails are only printed in the server terminal during development. Add the SMTP_* settings to send real emails.
        </p>
      )}

      <section className="rounded-xl border border-white/10 bg-[#0a1120] p-5">
        <h2 className="mb-4 text-sm font-bold">Login details</h2>
        <AccountForm username={me.username} email={me.email} />
      </section>

      <section className="rounded-xl border border-white/10 bg-[#0a1120] p-5">
        <h2 className="mb-4 text-sm font-bold">Change password</h2>
        <PasswordForm />
      </section>

      <section id="demo-data" className="rounded-xl border border-white/10 bg-[#0a1120] p-5">
        <h2 className="mb-3 text-sm font-bold">Demo data</h2>
        <DemoDataPanel counts={demo} />
      </section>
    </div>
  );
}
