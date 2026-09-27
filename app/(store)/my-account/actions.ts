'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  createCustomer,
  currentCustomer,
  endCustomerSession,
  getCustomerByEmail,
  MIN_CUSTOMER_PASSWORD,
  setCustomerPassword,
  startCustomerSession,
  updateCustomerDetails,
  validEmail,
  verifyCustomer,
} from '@/lib/customers';
import { checkPasswordHash } from '@/lib/admin-users';
import { rateLimit } from '@/lib/store';
import { clientIp } from '@/lib/http';

export interface AccountState {
  error?: string;
  ok?: string;
}

const str = (fd: FormData, k: string, max = 200) => String(fd.get(k) ?? '').slice(0, max);
const slow = () => new Promise((r) => setTimeout(r, 500));
/** Hidden "website" field: humans never fill it, bots usually do. */
const isBot = (fd: FormData) => !!str(fd, 'website');

export async function customerLogin(_prev: AccountState, fd: FormData): Promise<AccountState> {
  if (isBot(fd)) return { error: 'Please try again.' };
  if (!rateLimit(`clogin:${await clientIp()}`, 8, 15 * 60 * 1000)) return { error: 'Too many attempts. Please wait 15 minutes and try again.' };
  const email = str(fd, 'email').trim();
  const password = str(fd, 'password');
  if (!email || !password) return { error: 'Please enter your email address and password.' };
  const c = await verifyCustomer(email, password);
  if (!c) {
    await slow();
    return { error: 'Unknown email address or incorrect password.' };
  }
  try {
    await startCustomerSession(c, fd.get('remember') === 'on');
  } catch (e) {
    return { error: (e as Error).message };
  }
  redirect('/my-account');
}

export async function customerRegister(_prev: AccountState, fd: FormData): Promise<AccountState> {
  if (isBot(fd)) return { error: 'Please try again.' };
  if (!rateLimit(`creg:${await clientIp()}`, 5, 60 * 60 * 1000)) return { error: 'Too many sign-ups from this connection. Please try again later.' };
  const email = str(fd, 'email').trim().toLowerCase();
  const password = str(fd, 'password');
  if (!validEmail(email)) return { error: 'Please enter a valid email address.' };
  if (password.length < MIN_CUSTOMER_PASSWORD) return { error: `Password must be at least ${MIN_CUSTOMER_PASSWORD} characters.` };
  if (await getCustomerByEmail(email)) return { error: 'An account is already registered with that email. Please log in.' };
  const c = await createCustomer(email, password);
  try {
    await startCustomerSession(c, true);
  } catch (e) {
    return { error: (e as Error).message };
  }
  redirect('/my-account?welcome=1');
}

export async function customerLogout() {
  await endCustomerSession();
  redirect('/my-account');
}

export async function saveAccountDetails(_prev: AccountState, fd: FormData): Promise<AccountState> {
  const c = await currentCustomer();
  if (!c) redirect('/my-account');
  const whatsapp = str(fd, 'whatsapp', 30).trim();
  if (whatsapp && !/^\+?\d[\d\s()-]{6,}$/.test(whatsapp)) return { error: 'Enter your WhatsApp number with country code, e.g. +923001234567.' };
  await updateCustomerDetails(c.id, str(fd, 'name', 120), whatsapp);
  revalidatePath('/my-account');
  return { ok: 'Account details saved.' };
}

export async function changeCustomerPassword(_prev: AccountState, fd: FormData): Promise<AccountState> {
  const c = await currentCustomer();
  if (!c) redirect('/my-account');
  if (!checkPasswordHash(str(fd, 'current'), c.password_hash)) return { error: 'Your current password is incorrect.' };
  const pw = str(fd, 'password');
  if (pw.length < MIN_CUSTOMER_PASSWORD) return { error: `New password must be at least ${MIN_CUSTOMER_PASSWORD} characters.` };
  if (pw !== str(fd, 'confirm')) return { error: 'The two new passwords do not match.' };
  await setCustomerPassword(c.id, pw);
  const updated = { ...c, session_version: c.session_version + 1 };
  await startCustomerSession(updated, true);
  return { ok: 'Password changed.' };
}
