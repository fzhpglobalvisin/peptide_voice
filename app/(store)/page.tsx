import Link from 'next/link';
import { bestSellers } from '@/lib/catalog';
import { ProductGrid } from '@/components/site/ProductCard';
import { GradientTitle } from '@/components/site/PageHero';
import { Faq } from '@/components/site/Faq';
import { VialArt } from '@/components/site/VialArt';

export const revalidate = 60;

const FEATURES = [
  ['🚚', 'Fast Delivery', 'All compounds shipped in 2-3 business days with tracking.'],
  ['📦', 'Free Shipping', 'On qualifying orders above $300'],
  ['🎧', 'Customer Support', 'Research coordination and technical assistance available.'],
  ['📜', 'Verified Purity', 'Each compound verified for stability and reproducibility, with Certificate of Analysis included.'],
];

export default async function Home() {
  const best = await bestSellers();
  const blend = best.find((p) => p.slug === 'tirz-glp-2') ?? best[0];
  return (
    <>
      {/* Promo banner */}
      <section className="bg-gradient-to-b from-[#06101c] to-[#081a2c] px-4 py-3">
        <div className="relative mx-auto max-w-[900px] overflow-hidden rounded-xl bg-gradient-to-r from-[#1ab4e8] via-[#1aa6ee] to-[#1a7ff0] px-6 py-6 text-center shadow-[0_0_30px_rgba(26,166,238,0.45)]">
          <div className="absolute -right-6 top-0 h-full w-24 skew-x-[-20deg] bg-white/15" aria-hidden />
          <p className="font-head text-2xl font-black uppercase tracking-tight sm:text-4xl">
            🎉 Use code <span className="text-[#ffe14a]">NEW20</span> for 20% off!
          </p>
          <p className="mt-1 text-sm font-medium sm:text-lg">Save instantly on your first order • Limited Time Offer</p>
        </div>
      </section>

      {/* Best sellers */}
      <section id="best-sellers" className="mx-auto max-w-[1140px] px-4 pb-10 pt-12">
        <GradientTitle first="Best" rest="Sellers" className="text-center text-5xl sm:text-6xl" />
        <p className="mx-auto mt-5 max-w-2xl text-center text-[15px] font-medium leading-relaxed text-white sm:text-base">
          Each research peptide or compound is prepared for laboratory studies with consistent purity and verified stability. Ideal for receptor binding studies, molecular kinetics, and intracellular pathway analysis under controlled research environments.
        </p>
        <div className="mt-5">
          <ProductGrid products={best} />
        </div>
        <div className="mt-9 text-center">
          <Link href="/shop" className="inline-block rounded-full bg-[#3aaec9] px-7 py-3 font-head text-lg font-extrabold uppercase text-white hover:bg-cyan-soft">
            Shop All Peptides
          </Link>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto grid max-w-[1140px] grid-cols-2 gap-6 px-4 py-6 text-center sm:grid-cols-4">
        {FEATURES.map(([icon, title, text]) => (
          <div key={title}>
            <div className="text-5xl" aria-hidden>{icon}</div>
            <h3 className="mt-3 text-lg font-semibold">{title}</h3>
            <p className="mt-2 text-[15px] font-medium leading-relaxed">{text}</p>
          </div>
        ))}
      </section>

      {/* Research compounds */}
      <section id="research" className="mx-auto grid max-w-[1140px] gap-6 px-4 py-12 sm:grid-cols-2">
        <div>
          <h2 className="font-head text-3xl font-semibold leading-tight tracking-tighter2 text-[#3aaec9] sm:text-4xl">
            Research Compounds for <br className="hidden sm:block" />
            Controlled Laboratory Studies
          </h2>
          <Link href="/shop" className="mt-5 inline-block rounded-full bg-[#3aaec9] px-5 py-2.5 text-sm font-bold uppercase">
            Browse Research Compounds
          </Link>
        </div>
        <p className="text-[15px] font-medium leading-relaxed sm:text-right">
          Explore our selection of research compounds intended for controlled laboratory investigation, analytical evaluation, and in vitro research applications. Each product includes relevant identification and quality information to support documentation review and structured laboratory workflows. Product specifications and Certificates of Analysis are available for review, where provided, for research verification.
        </p>
      </section>

      {/* Blends banner */}
      <section id="blends" className="mx-auto max-w-[1140px] px-4 pb-16 pt-10">
        <div
          className="relative overflow-visible rounded-2xl px-6 py-10 sm:px-10 sm:py-14"
          style={{ background: "linear-gradient(90deg, rgba(8,30,48,0.95) 30%, rgba(8,30,48,0.5)), url('/images/lab-microscope.jpg') center/cover, linear-gradient(120deg,#0e3550,#2b6b8a 60%,#6b4a2a)" }}
        >
          <div className="max-w-[560px]">
            <h2 className="font-head text-3xl font-semibold leading-tight tracking-tighter2 sm:text-4xl">Curated Peptide Blends for Research Excellence</h2>
            <p className="mt-4 text-[15px] font-semibold leading-relaxed">
              Select peptides and research compounds formulated for controlled in vitro studies. Each product provides reproducible results, verified purity, and stability for experimental applications. Comprehensive guidance ensures consistent methodology and pathway validation in laboratory models.
            </p>
            <div className="mt-5 flex gap-2">
              <Link href="/shop?category=blend" className="pill-white">See All Blends</Link>
              <Link href="/contact" className="pill-white">Contact Us</Link>
            </div>
          </div>
          {blend && (
            <VialArt product={blend} className="pointer-events-none absolute -top-16 right-6 hidden h-80 w-56 rotate-[18deg] drop-shadow-2xl sm:block" />
          )}
        </div>
      </section>

      {/* FAQ */}
      <section
        id="faq"
        className="px-4 py-12"
        style={{ background: "linear-gradient(rgba(0,20,35,0.55), rgba(0,20,35,0.55)), url('/images/dna-background.jpg') center/cover, radial-gradient(circle at 20% 30%, #1f8fb8 0, transparent 35%), radial-gradient(circle at 80% 70%, #0f6f99 0, transparent 40%), #031421" }}
      >
        <div className="mx-auto grid max-w-[1140px] gap-8 sm:grid-cols-2">
          <div>
            <p className="font-alt text-sm font-medium">Frequently Asked Questions</p>
            <h2 className="mt-2 font-head text-4xl font-semibold leading-none tracking-tighter2 sm:text-5xl">Advanced Controlled Laboratory Research</h2>
            <p className="mt-3 font-alt text-[15px] font-medium leading-relaxed">
              Explore research compounds intended for analytical evaluation, molecular investigation, and controlled laboratory studies. Product information supports compound identification, documentation review, and structured experimental workflows conducted under defined research conditions. Strictly for laboratory research use only. Not for human or veterinary use.
            </p>
          </div>
          <Faq />
        </div>
      </section>
    </>
  );
}
