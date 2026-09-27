import { listCoas } from '@/lib/catalog';
import { PageHero } from '@/components/site/PageHero';
import { CoaTable } from '@/components/site/CoaTable';

export const revalidate = 60;
export const metadata = { title: 'COAs' };

export default function CoasPage() {
  return (
    <>
      <PageHero title="COAs" />
      <section className="px-4 py-10" style={{ background: 'radial-gradient(circle at 80% 20%, #0c1a3d 0, transparent 50%), #000' }}>
        <div className="mx-auto max-w-[960px] text-center">
          <span className="inline-block rounded-full border border-cyan-brand px-3 py-1 text-xs font-extrabold uppercase text-cyan-text">Verified Testing</span>
          <p className="mx-auto mt-3 max-w-md text-[15px] text-white/80">
            Access current third-party testing records for available research products. Search by product name or browse the complete COA list below.
          </p>
        </div>
        <CoaTable coas={listCoas()} />
      </section>
    </>
  );
}
