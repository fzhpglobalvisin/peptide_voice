import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getProductById } from '@/lib/catalog';
import { saveProduct } from '@/app/admin/actions';

export default async function EditProduct({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const isNew = id === 'new';
  const p = isNew ? null : getProductById(Number(id));
  if (!isNew && !p) notFound();

  const label = 'block text-xs font-semibold text-white/70';
  return (
    <div className="max-w-2xl">
      <Link href="/admin/products" className="text-xs text-cyan-text">← Products</Link>
      <h1 className="mt-2 font-head text-2xl font-bold">{isNew ? 'Add product' : `Edit ${p!.name}`}</h1>
      <form action={saveProduct} className="mt-5 space-y-4 rounded-xl border border-white/10 bg-[#0a1120] p-5">
        <input type="hidden" name="id" value={p?.id ?? ''} />
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={label}>
            Name
            <input name="name" required defaultValue={p?.name} className="field mt-1" />
          </label>
          <label className={label}>
            Slug (optional)
            <input name="slug" defaultValue={p?.slug} className="field mt-1" />
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          <label className={label}>
            Category
            <select name="category" defaultValue={p?.category ?? 'peptide'} className="field mt-1">
              <option value="peptide">Peptide</option>
              <option value="blend">Blend</option>
              <option value="supply">Lab supply</option>
            </select>
          </label>
          <label className={label}>
            Min price
            <input name="price_min" type="number" step="0.01" defaultValue={p?.price_min} className="field mt-1" />
          </label>
          <label className={label}>
            Max price
            <input name="price_max" type="number" step="0.01" defaultValue={p?.price_max} className="field mt-1" />
          </label>
          <label className={label}>
            Purity
            <input name="purity" defaultValue={p?.purity ?? '99%'} className="field mt-1" />
          </label>
        </div>
        <label className={label}>
          Options — one per line as <code>label | price</code> (e.g. <code>10mg | 60.50</code>). Leave empty for single-price items.
          <textarea name="variants" rows={4} defaultValue={p?.variants.map((v) => `${v.label} | ${v.price}`).join('\n')} className="field mt-1 font-mono" />
        </label>
        <label className={label}>
          Image URL (leave empty to use the drawn vial)
          <input name="image_url" type="url" defaultValue={p?.image_url ?? ''} className="field mt-1" />
        </label>
        <label className={label}>
          Description — research-use wording only; no health or effect claims
          <textarea name="description" rows={4} defaultValue={p?.description} className="field mt-1" />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="is_best_seller" defaultChecked={p?.is_best_seller} /> Show in Best Sellers
        </label>
        <button className="btn-primary">Save product</button>
      </form>
    </div>
  );
}
