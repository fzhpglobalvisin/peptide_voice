import Link from 'next/link';

export default function NotFound() {
  return (
    <section className="grid min-h-[60vh] place-items-center px-4 text-center">
      <div>
        <h1 className="font-head text-4xl font-extrabold text-cyan-text">Not found</h1>
        <p className="mt-2 text-sm text-white/70">That page or product isn&apos;t available.</p>
        <Link href="/shop" className="btn-primary mt-5 inline-block">Back to shop</Link>
      </div>
    </section>
  );
}
