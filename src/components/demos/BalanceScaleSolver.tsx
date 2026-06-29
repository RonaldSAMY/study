import { useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Balance-scale equation solver.
   - Each side is (coefficient of x) and (constant units).
   - You apply the SAME operation to both sides; the scale stays level
     because the two sides keep equal value. Solve down to x = N.
   - SVG visual: indigo boxes = x, emerald squares = unit weights.
   ------------------------------------------------------------------ */

type Side = { x: number; c: number };
const PRESETS: { left: Side; right: Side; label: string }[] = [
  { left: { x: 2, c: 3 }, right: { x: 0, c: 11 }, label: '2x + 3 = 11' },
  { left: { x: 3, c: 1 }, right: { x: 0, c: 10 }, label: '3x + 1 = 10' },
  { left: { x: 4, c: 2 }, right: { x: 0, c: 14 }, label: '4x + 2 = 14' },
];

const COLORS = { x: '#4f46e5', unit: '#10b981', beam: '#0ea5e9' };

function fmt(s: Side) {
  const parts: string[] = [];
  if (s.x !== 0) parts.push(`${s.x === 1 ? '' : s.x}x`);
  if (s.c !== 0 || parts.length === 0) parts.push(`${s.c}`);
  return parts.join(' + ').replace('+ -', '− ');
}

export default function BalanceScaleSolver() {
  const [preset, setPreset] = useState(0);
  const [left, setLeft] = useState<Side>(PRESETS[0].left);
  const [right, setRight] = useState<Side>(PRESETS[0].right);

  const reset = (i: number) => {
    setPreset(i);
    setLeft({ ...PRESETS[i].left });
    setRight({ ...PRESETS[i].right });
  };

  const subUnit = () => {
    setLeft((l) => ({ ...l, c: l.c - 1 }));
    setRight((r) => ({ ...r, c: r.c - 1 }));
  };
  const subX = () => {
    setLeft((l) => ({ ...l, x: l.x - 1 }));
    setRight((r) => ({ ...r, x: r.x - 1 }));
  };
  const coeff = Math.max(left.x, right.x);
  const canDivide =
    coeff > 1 && left.x % coeff === 0 && left.c % coeff === 0 && right.x % coeff === 0 && right.c % coeff === 0;
  const divide = () => {
    if (!canDivide) return;
    setLeft((l) => ({ x: l.x / coeff, c: l.c / coeff }));
    setRight((r) => ({ x: r.x / coeff, c: r.c / coeff }));
  };

  const solved = left.x === 1 && left.c === 0 && right.x === 0;

  // ----- render one pan's contents -----
  const renderPan = (s: Side, side: 'L' | 'R') => {
    const items = [];
    for (let i = 0; i < Math.abs(s.x); i++) {
      items.push(
        <div
          key={`x${i}`}
          class="grid h-8 w-8 place-items-center rounded text-sm font-bold text-white"
          style={`background:${COLORS.x}`}
        >
          x
        </div>,
      );
    }
    for (let i = 0; i < Math.abs(s.c); i++) {
      items.push(
        <div
          key={`c${i}`}
          class="h-5 w-5 rounded-sm"
          style={`background:${COLORS.unit}`}
        />,
      );
    }
    return (
      <div class="flex min-h-[64px] flex-1 flex-wrap content-end items-end justify-center gap-1 rounded-xl border border-border bg-surface-2 p-2">
        {items.length ? items : <span class="text-xs text-muted">empty</span>}
      </div>
    );
  };

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap gap-2">
        {PRESETS.map((p, i) => (
          <button
            key={p.label}
            onClick={() => reset(i)}
            class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              preset === i ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* the beam */}
      <div class="mb-2 flex items-center gap-2">
        {renderPan(left, 'L')}
        <div class="grid h-10 w-10 shrink-0 place-items-center rounded-full text-lg font-bold text-white" style={`background:${COLORS.beam}`}>
          =
        </div>
        {renderPan(right, 'R')}
      </div>
      <div class="mb-3 h-1.5 w-full rounded-full" style={`background:${COLORS.beam}`} />

      <div class="mb-3 flex items-center justify-between rounded-xl bg-surface-2 p-3">
        <span class="font-mono text-lg font-bold text-text">
          {fmt(left)} = {fmt(right)}
        </span>
        {solved && (
          <span class="rounded-full bg-brand-soft px-3 py-1 text-sm font-bold text-brand">
            Solved: x = {right.c}
          </span>
        )}
      </div>

      <div class="flex flex-wrap gap-2">
        <button
          onClick={subUnit}
          disabled={left.c <= 0 && right.c <= 0}
          class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-text transition hover:bg-brand-soft disabled:opacity-40"
        >
          − 1 from both sides
        </button>
        <button
          onClick={subX}
          disabled={left.x <= 0 && right.x <= 0}
          class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-text transition hover:bg-brand-soft disabled:opacity-40"
        >
          − x from both sides
        </button>
        <button
          onClick={divide}
          disabled={!canDivide}
          class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-text transition hover:bg-brand-soft disabled:opacity-40"
        >
          ÷ {coeff > 1 ? coeff : '?'} on both sides
        </button>
        <button
          onClick={() => reset(preset)}
          class="ml-auto rounded-lg px-3 py-1.5 text-sm font-semibold text-muted transition hover:text-text"
        >
          reset
        </button>
      </div>

      <p class="mt-3 text-xs text-muted">
        Whatever you do to one side, do to the other — the scale never tips, so the equation stays true.
        Strip away the units, then divide out the x-boxes until a single x stands alone.
      </p>
    </div>
  );
}
