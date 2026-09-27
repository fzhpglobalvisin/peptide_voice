import Link from 'next/link';
import { PageHero, GradientTitle } from '@/components/site/PageHero';

export const metadata = { title: 'About Us' };

const photo = (src: string, fallback: string) => ({ background: `url('${src}') center/cover, ${fallback}` });

export default function About() {
  return (
    <>
      <PageHero title="About Us" />
      <section className="mx-auto grid max-w-[1140px] items-center gap-6 px-4 py-12 sm:grid-cols-2">
        <div className="aspect-[4/3] rounded-2xl" style={photo('/images/about-scientist.jpg', 'linear-gradient(135deg,#0f3b5c,#5ea3c9)')} role="img" aria-label="Scientist working at a microscope" />
        <div>
          <GradientTitle first="Consistent and Verified" rest="Research Compounds" className="text-3xl leading-none" />
          <p className="mt-4 text-[15px] leading-relaxed">
            At Ridgeline FIT, we develop precision peptide programs designed specifically for laboratory workflows and controlled experimental protocols. Each compound is formulated to support reproducibility, stability, and experimental accuracy, enabling researchers to analyze molecular interactions, signaling pathways, and kinetics with confidence.
          </p>
          <p className="mt-3 text-[15px] leading-relaxed">
            Every selection is optimized for seamless integration into research environments, ensuring consistent results, reliable data, and controlled experimental workflows. Our focus is on high-quality materials, reproducibility, and scientifically validated processes.
          </p>
          <h3 className="mt-3 text-sm font-bold">Our Focus</h3>
          <ul className="mt-1 list-disc pl-4 text-[15px] leading-relaxed">
            <li>Laboratory-grade compound formulation</li>
            <li>Controlled experimental protocol integration</li>
            <li>Molecular pathway analysis and peptide kinetics</li>
            <li>Reliable laboratory protocol support for research applications</li>
          </ul>
          <p className="mt-1 text-[15px]">All products are strictly intended for non-clinical research purposes only and are not sold for human or veterinary use.</p>
        </div>
      </section>

      <section className="mx-auto grid max-w-[1140px] items-center gap-6 px-4 py-8 sm:grid-cols-2">
        <div>
          <GradientTitle first="Our" rest="Mission" className="text-3xl" />
          <p className="mt-3 text-[15px] leading-relaxed">
            Our mission is to support research professionals and laboratory teams by providing high-quality, precisely managed materials. Every supply pathway is structured to ensure consistency, operational reliability, and scientific integrity.
          </p>
          <p className="mt-2 text-[15px]">We focus on:</p>
          <ul className="mt-1 list-disc pl-4 text-[15px] leading-relaxed">
            <li>Verified sourcing and documentation-based procedures</li>
            <li>Controlled handling and packaging processes</li>
            <li>Reliability and consistency in experimental workflows</li>
            <li>Transparent practices in non-clinical laboratory operations</li>
          </ul>
          <p className="mt-1 text-[15px]">All materials are strictly intended for controlled research and laboratory applications. No medical or therapeutic claims are made.</p>
        </div>
        <div className="aspect-[4/3] rounded-2xl" style={photo('/images/about-mission.jpg', 'linear-gradient(135deg,#1a4a6b,#9ccbe0)')} role="img" aria-label="Researcher at a laboratory bench" />
      </section>

      <section className="mx-auto max-w-[1140px] px-4 pb-14 pt-6">
        <div className="rounded-2xl px-6 py-10 text-center" style={photo('/images/about-pipette.jpg', 'linear-gradient(120deg,#0d5078,#3d93bf 60%,#8cc7de)')}>
          <h2 className="font-head text-4xl font-semibold leading-tight sm:text-5xl">Explore Your Laboratory Research Pathway</h2>
          <p className="mx-auto mt-4 max-w-lg text-[15px] font-semibold leading-relaxed">
            Discover validated peptide programs designed for precise laboratory and in vitro research. Each compound is developed for reproducibility, controlled experimental conditions, and accurate evaluation of molecular signaling, receptor interactions, and pathway kinetics. Our solutions integrate seamlessly into workflows, ensuring reliable, repeatable results and supporting efficient experimental progress every day.
          </p>
          <Link href="/shop" className="mt-5 inline-block rounded-full border border-white px-4 py-2 text-xs font-bold uppercase underline">
            Explore Research Compounds
          </Link>
        </div>
      </section>
    </>
  );
}
