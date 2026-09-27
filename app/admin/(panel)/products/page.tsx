import Link from 'next/link';
import { listProducts } from '@/lib/catalog';
import { priceLabel } from '@/lib/types';
import { toggleProductStatus } from '@/app/admin/actions';

export default async function ProductsAdmin() {
  const products = await listProducts({ includeRetired: true });
  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-head text-2xl font-bold">Products ({products.length})</h1>
        <Link href="/admin/products/new" className="btn-primary">+ Add product</Link>
      </div>
      <div className="mt-4 overflow-x-auto rounded-xl border border-white/10 bg-[#0a1120]">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-white/10 text-white/50">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-2 py-2">Category</th>
              <th className="px-2 py-2">Price</th>
              <th className="px-2 py-2">Options</th>
              <th className="px-2 py-2">Best seller</th>
              <th className="px-2 py-2">Status</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className={`border-b border-white/5 ${p.status === 'retired' ? 'opacity-50' : ''}`}>
                <td className="px-4 py-2 font-semibold">{p.name}</td>
                <td className="px-2 py-2">{p.category}</td>
                <td className="px-2 py-2 tabular-nums">{priceLabel(p)}</td>
                <td className="px-2 py-2">{p.variants.length || '—'}</td>
                <td className="px-2 py-2">{p.is_best_seller ? '★' : ''}</td>
                <td className="px-2 py-2">{p.status}</td>
                <td className="flex justify-end gap-2 px-4 py-2">
                  <Link href={`/admin/products/${p.id}`} className="rounded bg-white/10 px-2 py-1 hover:bg-white/20">Edit</Link>
                  <form action={toggleProductStatus}>
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="status" value={p.status === 'active' ? 'retired' : 'active'} />
                    <button className="rounded bg-white/10 px-2 py-1 hover:bg-white/20">{p.status === 'active' ? 'Retire' : 'Restore'}</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
