'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import {
  changePassword,
  login,
  logout,
  requestReset,
  resetPassword,
  updateAccount,
  type FormState,
} from '@/app/admin/login/actions';

type Action = (prev: FormState, fd: FormData) => Promise<FormState>;

function Messages({ state }: { state: FormState }) {
  return (
    <>
      {state.error && (
        <p className="rounded-md bg-red-500/10 px-3 py-2 text-xs text-red-300" role="alert">
          {state.error}
        </p>
      )}
      {state.ok && (
        <p className="rounded-md bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300" role="status">
          {state.ok}
        </p>
      )}
    </>
  );
}

function Field(props: { label: string; name: string; type?: string; autoComplete?: string; defaultValue?: string; required?: boolean; autoFocus?: boolean; minLength?: number }) {
  const { label, ...input } = props;
  return (
    <label className="block text-xs font-semibold text-white/70">
      {label}
      <input {...input} type={input.type ?? 'text'} className="field mt-1" />
    </label>
  );
}

function useForm(action: Action) {
  return useActionState<FormState, FormData>(action, {});
}

export function LoginForm() {
  const [state, action, pending] = useForm(login);
  return (
    <form action={action} className="mt-6 space-y-3">
      <Field label="Username" name="username" autoComplete="username" required autoFocus />
      <Field label="Password" name="password" type="password" autoComplete="current-password" required />
      <Messages state={state} />
      <button disabled={pending} className="btn-primary w-full">
        {pending ? 'Signing in…' : 'Sign in'}
      </button>
      <p className="text-center">
        <Link href="/admin/forgot" className="text-xs text-cyan-text hover:underline">
          Forgot username or password?
        </Link>
      </p>
    </form>
  );
}

export function ForgotForm() {
  const [state, action, pending] = useForm(requestReset);
  return (
    <form action={action} className="mt-6 space-y-3">
      <Field label="Admin email address" name="email" type="email" autoComplete="email" required autoFocus />
      <Messages state={state} />
      <button disabled={pending} className="btn-primary w-full">
        {pending ? 'Sending…' : 'Email me my username and a reset link'}
      </button>
      <p className="text-center">
        <Link href="/admin/login" className="text-xs text-cyan-text hover:underline">
          ← Back to sign in
        </Link>
      </p>
    </form>
  );
}

export function ResetForm({ token }: { token: string }) {
  const [state, action, pending] = useForm(resetPassword);
  return (
    <form action={action} className="mt-6 space-y-3">
      <input type="hidden" name="token" value={token} />
      <Field label="New password (10+ characters)" name="password" type="password" autoComplete="new-password" required minLength={10} autoFocus />
      <Field label="Repeat new password" name="confirm" type="password" autoComplete="new-password" required minLength={10} />
      <Messages state={state} />
      <button disabled={pending} className="btn-primary w-full">
        {pending ? 'Saving…' : 'Set new password'}
      </button>
    </form>
  );
}

export function AccountForm({ username, email }: { username: string; email: string }) {
  const [state, action, pending] = useForm(updateAccount);
  return (
    <form action={action} className="space-y-3">
      <Field label="Username" name="username" defaultValue={username} autoComplete="username" required />
      <Field label="Recovery email (used for “Forgot username or password”)" name="email" type="email" defaultValue={email} autoComplete="email" />
      <Field label="Current password (to confirm)" name="current" type="password" autoComplete="current-password" required />
      <Messages state={state} />
      <button disabled={pending} className="btn-primary">
        {pending ? 'Saving…' : 'Save details'}
      </button>
    </form>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useForm(changePassword);
  return (
    <form action={action} className="space-y-3">
      <Field label="Current password" name="current" type="password" autoComplete="current-password" required />
      <Field label="New password (10+ characters)" name="password" type="password" autoComplete="new-password" required minLength={10} />
      <Field label="Repeat new password" name="confirm" type="password" autoComplete="new-password" required minLength={10} />
      <Messages state={state} />
      <button disabled={pending} className="btn-primary">
        {pending ? 'Saving…' : 'Change password'}
      </button>
    </form>
  );
}

export function SignOutButton() {
  return (
    <form action={logout}>
      <button className="text-xs text-white/60 hover:text-white">Sign out</button>
    </form>
  );
}
