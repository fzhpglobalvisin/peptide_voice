'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ADMIN_COOKIE, createSessionToken, missingAuthConfig, requireAdmin, sessionCookieOptions } from '@/lib/auth';
import {
  checkPasswordHash,
  createResetToken,
  getAdminByEmail,
  getAdminById,
  getAdminByUsername,
  passwordProblem,
  resetPasswordWithToken,
  setAccount,
  setPassword,
  verifyLogin,
} from '@/lib/admin-users';
import { sendMail } from '@/lib/mailer';
import { siteUrl } from '@/lib/whatsapp';
import { rateLimit } from '@/lib/store';
import { clientIp } from '@/lib/http';

export interface FormState {
  error?: string;
  ok?: string;
}

const str = (fd: FormData, k: string, max = 200) => String(fd.get(k) ?? '').slice(0, max);
const slow = () => new Promise((r) => setTimeout(r, 600));

// ─────────────── Login / logout ───────────────

export async function login(_prev: FormState, fd: FormData): Promise<FormState> {
  if (missingAuthConfig().length) return { error: 'Admin login is not configured. See the settings listed above.' };
  if (!rateLimit(`login:${await clientIp()}`, 5, 15 * 60 * 1000)) return { error: 'Too many attempts. Please wait 15 minutes and try again.' };

  const username = str(fd, 'username', 100);
  const password = str(fd, 'password');
  if (!username || !password) return { error: 'Enter your username and password.' };

  const user = verifyLogin(username, password);
  if (!user) {
    await slow();
    return { error: 'Incorrect username or password.' };
  }
  (await cookies()).set(ADMIN_COOKIE, createSessionToken(user.id, user.session_version), await sessionCookieOptions());
  redirect('/admin');
}

export async function logout() {
  (await cookies()).delete(ADMIN_COOKIE);
  redirect('/admin/login');
}

// ─────────────── Forgot username / password ───────────────

export async function requestReset(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!rateLimit(`forgot:${await clientIp()}`, 5, 60 * 60 * 1000)) return { error: 'Too many requests. Please try again in an hour.' };
  const email = str(fd, 'email').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Enter a valid email address.' };

  const admin = getAdminByEmail(email);
  let result: Awaited<ReturnType<typeof sendMail>> | null = null;
  if (admin) {
    const { token, minutes } = createResetToken(admin.id);
    const link = `${siteUrl()}/admin/reset?token=${token}`;
    result = await sendMail(
      admin.email,
      'Ridgeline Admin — your username and password reset link',
      `Hello,\n\nSomeone (hopefully you) asked to recover the Ridgeline admin login.\n\nYour username: ${admin.username}\n\nTo set a new password, open this link within ${minutes} minutes:\n${link}\n\nIf you didn't ask for this, you can ignore this email; your password stays the same.\n`,
    );
  } else {
    await slow();
  }

  // Same answer whether or not the email exists, so nobody can probe for the admin address.
  const generic = 'If that email belongs to an admin account, we have sent the username and a reset link to it. The link works for 30 minutes.';
  if (result === 'logged') return { ok: `${generic} (Development: email isn't set up, so the message was printed in the terminal running "npm run dev".)` };
  if (result === 'unconfigured' || result === 'failed') return { error: 'The email could not be sent. Check the SMTP settings, or reset from the server with "npm run reset-admin".' };
  return { ok: generic };
}

export async function resetPassword(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!rateLimit(`reset:${await clientIp()}`, 10, 60 * 60 * 1000)) return { error: 'Too many attempts. Please try again later.' };
  const token = str(fd, 'token', 100);
  const pw = str(fd, 'password');
  const problem = passwordProblem(pw, str(fd, 'confirm'));
  if (problem) return { error: problem };
  if (!resetPasswordWithToken(token, pw)) return { error: 'This reset link has expired or was already used. Request a new one.' };
  (await cookies()).delete(ADMIN_COOKIE);
  redirect('/admin/login?reset=1');
}

// ─────────────── Account page (signed in) ───────────────

export async function updateAccount(_prev: FormState, fd: FormData): Promise<FormState> {
  const session = await requireAdmin();
  const me = getAdminById(session.user.id)!;
  const username = str(fd, 'username', 60).trim();
  const email = str(fd, 'email').trim().toLowerCase();
  if (!/^[a-zA-Z0-9._-]{3,60}$/.test(username)) return { error: 'Username must be 3–60 characters: letters, numbers, dot, dash or underscore.' };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Enter a valid email address.' };
  if (!checkPasswordHash(str(fd, 'current'), me.password_hash)) return { error: 'Your current password is incorrect.' };
  const taken = getAdminByUsername(username);
  if (taken && taken.id !== me.id) return { error: 'That username is already taken.' };
  setAccount(me.id, username, email);
  return { ok: 'Account details saved.' };
}

export async function changePassword(_prev: FormState, fd: FormData): Promise<FormState> {
  const session = await requireAdmin();
  const me = getAdminById(session.user.id)!;
  if (!checkPasswordHash(str(fd, 'current'), me.password_hash)) return { error: 'Your current password is incorrect.' };
  const pw = str(fd, 'password');
  const problem = passwordProblem(pw, str(fd, 'confirm'));
  if (problem) return { error: problem };
  setPassword(me.id, pw);
  // Other devices are signed out; keep this one signed in with a fresh cookie.
  const updated = getAdminById(me.id)!;
  (await cookies()).set(ADMIN_COOKIE, createSessionToken(updated.id, updated.session_version), await sessionCookieOptions());
  return { ok: 'Password changed. Other devices have been signed out.' };
}
