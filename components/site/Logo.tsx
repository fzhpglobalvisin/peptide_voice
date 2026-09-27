export function Logo({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 220 110" className={className} role="img" aria-label="Ridgeline Fit">
      <defs>
        <linearGradient id="lg-m" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7cc3ff" />
          <stop offset="1" stopColor="#1e4fb8" />
        </linearGradient>
        <linearGradient id="lg-t" x1="0" x2="1">
          <stop offset="0" stopColor="#e8f1ff" />
          <stop offset="1" stopColor="#8fb8ff" />
        </linearGradient>
      </defs>
      <path d="M35 62 L78 18 L98 38 L112 26 L150 62 Z" fill="none" stroke="url(#lg-m)" strokeWidth="3" />
      <g stroke="#5aa2ff" strokeWidth="1" opacity="0.8">
        <line x1="78" y1="18" x2="90" y2="44" />
        <line x1="90" y1="44" x2="112" y2="26" />
        <line x1="90" y1="44" x2="70" y2="52" />
        <line x1="112" y1="26" x2="124" y2="48" />
        <line x1="124" y1="48" x2="100" y2="54" />
      </g>
      {[
        [78, 18],
        [90, 44],
        [112, 26],
        [70, 52],
        [124, 48],
        [100, 54],
      ].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="2.6" fill="#9fd0ff" />
      ))}
      <text x="110" y="82" textAnchor="middle" fontSize="24" fontStyle="italic" fontWeight="900" fill="url(#lg-t)" fontFamily="Arial Black, sans-serif" letterSpacing="1">
        RIDGELINE
      </text>
      <text x="110" y="104" textAnchor="middle" fontSize="22" fontStyle="italic" fontWeight="900" fill="#3d7bd8" fontFamily="Arial Black, sans-serif">
        FIT
      </text>
    </svg>
  );
}
