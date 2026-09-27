'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { createProduct, setProductStatus, updateProduct, type ProductInput } from '@/lib/catalog';
import { setOrderStatus } from '@/lib/analytics';
import { MIN_CUSTOMER_PASSWORD, setCustomerPassword } from '@/lib/customers';
import type { Category, Variant } from '@/lib/types';

const CATS: Category[] = ['peptide', 'blend', 'supply'];
const STATUSES = ['pending_review', 'invoiced', 'paid', 'shipped', 'rejected'];

function parseVariants(raw: string): Variant[] {
  // One per line: "5mg | 40.00"
  return raw
    .split('\n')
    .map((l) => l.split('|').map((x) => x.trim()))
    .filter(([label, price]) => label && !Number.isNaN(Number(price)))
    .map(([label, price]) => ({ label: label.slice(0, 60), price: Math.round(Number(price) * 100) / 100 }))
    .slice(0, 20);
}

function readProduct(fd: FormData): ProductInput {
  const variants = parseVariants(String(fd.get('variants') ?? ''));
  const prices = variants.map((v) => v.price);
  const min = Number(fd.get('price_min')) || (prices.length ? Math.min(...prices) : 0);
  const max = Number(fd.get('price_max')) || (prices.length ? Math.max(...prices) : min);
  const category = String(fd.get('category'));
  return {
    name: String(fd.get('name') ?? '').trim().slice(0, 120),
    slug: String(fd.get('slug') ?? '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 120) || undefined,
    category: CATS.includes(category as Category) ? (category as Category) : 'peptide',
    price_min: Math.min(min, max),
    price_max: Math.max(min, max),
    variants,
    purity: String(fd.get('purity') ?? '99%').slice(0, 20),
    description: String(fd.get('description') ?? '').slice(0, 3000),
    image_url: String(fd.get('image_url') ?? '').trim() || null,
    is_best_seller: fd.get('is_best_seller') === 'on',
  };
}

function refresh() {
  revalidatePath('/', 'layout');
}

export async function saveProduct(fd: FormData) {
  await requireAdmin();
  const id = Number(fd.get('id'));
  const p = readProduct(fd);
  if (!p.name || !p.price_min) throw new Error('Name and price are required');
  if (id) updateProduct(id, p);
  else createProduct(p);
  refresh();
  redirect('/admin/products');
}

export async function toggleProductStatus(fd: FormData) {
  await requireAdmin();
  setProductStatus(Number(fd.get('id')), fd.get('status') === 'retired' ? 'retired' : 'active');
  refresh();
}

export async function updateOrderStatus(fd: FormData) {
  await requireAdmin();
  const status = String(fd.get('status'));
  if (!STATUSES.includes(status)) return;
  setOrderStatus(Number(fd.get('id')), status);
  revalidatePath('/admin/leads');
}

/** Admin sets a new password for a customer who asked on WhatsApp ("Lost your password?"). */
export async function adminSetCustomerPassword(_prev: { error?: string; ok?: string }, fd: FormData): Promise<{ error?: string; ok?: string }> {
  await requireAdmin();
  const id = Number(fd.get('id'));
  const pw = String(fd.get('password') ?? '');
  if (!id) return { error: 'Missing customer.' };
  if (pw.length < MIN_CUSTOMER_PASSWORD) return { error: `At least ${MIN_CUSTOMER_PASSWORD} characters.` };
  setCustomerPassword(id, pw);
  revalidatePath('/admin/customers');
  return { ok: 'Password set. Send it to the customer on WhatsApp; they can change it in My Account.' };
}
