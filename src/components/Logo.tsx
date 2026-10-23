// Dot-grid mark + serif wordmark. Dots grow in size toward the top-right.
const CELLS = (() => {
  const out: { x: number; y: number; s: number; r: number }[] = [];
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      if (r === 0 && c === 0) continue;
      const t = (c + (4 - r)) / 8;
      const s = 3.2 + t * 4.6;
      out.push({ x: c * 10 + 5 - s / 2, y: r * 10 + 5 - s / 2, s, r: s * (0.5 - 0.3 * t) });
    }
  }
  return out;
})();

export default function Logo({ tone = "light" }: { tone?: "light" | "dark" }) {
  const dot = tone === "light" ? "#0f0E0D" : "#8c1d1b";
  const text = tone === "light" ? "#0f0E0D" : "#231f1e";
  return (
    <span className="flex items-center gap-[7px]" aria-label="Reckoner Capital Management">
      <svg viewBox="0 0 50 50" className="h-[25px] w-[25px] md:h-[28px] md:w-[28px]" aria-hidden>
        {CELLS.map((c, i) => (
          <rect key={i} x={c.x} y={c.y} width={c.s} height={c.s} rx={c.r} fill={dot} />
        ))}
      </svg>
      <span className="flex flex-col" style={{ color: text }}>
        <span
          className="text-[31px] font-medium leading-[0.95] tracking-[-0.025em] md:text-[34px]"
          style={{ fontFamily: "var(--font-serif), Georgia, serif" }}
        >
          Barister
        </span>
     
      </span>
    </span>
  );
}