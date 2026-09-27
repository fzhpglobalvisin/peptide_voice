export function Ticker() {
  const item = (
    <span className="flex shrink-0 items-center gap-6 pr-6">
      <span>🇺🇸 All Products Shipped From The USA 🇺🇸</span>
      <span>Verified Purity</span>
      <span>•</span>
      <span>COA Available</span>
      <span className="rounded-full bg-white px-3 py-0.5 text-navy">Free Shipping on Orders Over $300</span>
    </span>
  );
  return (
    <div className="overflow-hidden bg-navy py-2 text-[13px] font-bold text-white sm:text-sm" aria-label="Store announcements">
      <div className="flex w-max animate-ticker motion-reduce:animate-none">
        {item}
        {item}
        {item}
        {item}
        {item}
        {item}
      </div>
    </div>
  );
}
