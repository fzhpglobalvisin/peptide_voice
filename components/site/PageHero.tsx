export function PageHero({ title }: { title: string }) {
  return (
    <section
      className="relative grid h-36 place-items-center overflow-hidden sm:h-40"
      style={{
        background:
          "linear-gradient(rgba(40,60,80,0.55), rgba(40,60,80,0.55)), url('/images/hero-molecules.jpg') center/cover, radial-gradient(circle at 25% 40%, #8a9bb0 0 8%, transparent 9%), radial-gradient(circle at 60% 30%, #7d8fa5 0 10%, transparent 11%), radial-gradient(circle at 82% 70%, #6f8298 0 7%, transparent 8%), linear-gradient(120deg, #3b4f66, #58708b 50%, #34475d)",
      }}
    >
      <h1 className="font-head text-4xl font-extrabold uppercase tracking-tight text-white sm:text-5xl">{title}</h1>
    </section>
  );
}

export function GradientTitle({ first, rest, className = '' }: { first: string; rest: string; className?: string }) {
  return (
    <h2 className={`font-head font-semibold tracking-tighter2 ${className}`}>
      <span className="text-[#3aaec9]">{first}</span> <span className="bg-gradient-to-r from-[#8fd3e6] to-[#cfeef7] bg-clip-text text-transparent">{rest}</span>
    </h2>
  );
}
