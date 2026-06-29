import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Combinations playground.
   - Pick r people from a group of n for a committee (order ignored).
   - Compare PERMUTATIONS (ordered) vs COMBINATIONS (unordered).
   - See exactly how dividing by r! removes the duplicate orderings.
   - A bar shows how much smaller nCr is than nPr.
   ------------------------------------------------------------------ */

const COLORS = {
  brand: '#4f46e5',
  emerald: '#10b981',
};

function factorial(n: number): number {
  let f = 1;
  for (let i = 2; i <= n; i++) f *= i;
  return f;
}
function nPr(n: number, r: number): number {
  let p = 1;
  for (let i = 0; i < r; i++) p *= n - i;
  return p;
}
function nCr(n: number, r: number): number {
  return Math.round(nPr(n, r) / factorial(r));
}

export default function CommitteeCombinationLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 480, h: 200 });
  const [n, setN] = useState(6);
  const [r, setR] = useState(3);

  const rr = Math.min(r, n);
  const perms = nPr(n, rr);
  const combs = nCr(n, rr);
  const rfact = factorial(rr);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);

    const pad = 16;
    const barH = 30;
    const maxVal = Math.max(perms, 1);
    const fullW = w - pad * 2 - 70;

    const rows = [
      { label: 'Ordered', val: perms, color: COLORS.brand },
      { label: 'Unordered', val: combs, color: COLORS.emerald },
    ];
    rows.forEach((row, i) => {
      const y = pad + i * (barH + 30);
      ctx.fillStyle = 'rgba(128,128,128,0.85)';
      ctx.font = '12px Inter, sans-serif';
      ctx.fillText(row.label, pad, y - 4);
      // track
      ctx.fillStyle = 'rgba(128,128,128,0.15)';
      roundRect(ctx, pad, y, fullW, barH, 8);
      ctx.fill();
      // value bar
      const bw = Math.max(4, (row.val / maxVal) * fullW);
      ctx.fillStyle = row.color;
      roundRect(ctx, pad, y, bw, barH, 8);
      ctx.fill();
      // number
      ctx.fillStyle = COLORS.brand === row.color ? '#fff' : '#0f172a';
      ctx.font = '600 14px Inter, sans-serif';
      ctx.fillText(`${row.val.toLocaleString()}`, pad + 8, y + barH / 2 + 5);
    });

    // divide-by-r! annotation
    ctx.fillStyle = 'rgba(128,128,128,0.9)';
    ctx.font = '600 13px Inter, sans-serif';
    ctx.fillText(`÷ ${rr}! = ÷ ${rfact}`, pad, h - 8);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 560);
      const h = 150;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w, h };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(draw, [n, r]);

  // enumerate committees for small cases
  const items = Array.from({ length: n }, (_, i) => String.fromCharCode(65 + i));
  const committees: string[] = [];
  if (combs <= 56) {
    const cur: string[] = [];
    const rec = (start: number) => {
      if (cur.length === rr) {
        committees.push(cur.join(''));
        return;
      }
      for (let i = start; i < n; i++) {
        cur.push(items[i]);
        rec(i + 1);
        cur.pop();
      }
    };
    rec(0);
  }

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

        <div class="space-y-3 text-sm">
          <p class="text-muted">Choose r from a group of n. Order does not matter for a committee.</p>

          <label class="block">
            <span class="mb-1 block text-muted">n (group size) = {n}</span>
            <input
              type="range" min={1} max={10} step={1} value={n}
              onInput={(e) => setN(parseInt((e.target as HTMLInputElement).value, 10))}
              class="w-full accent-[#4f46e5]"
            />
          </label>
          <label class="block">
            <span class="mb-1 block text-muted">r (committee size) = {rr}</span>
            <input
              type="range" min={0} max={n} step={1} value={rr}
              onInput={(e) => setR(parseInt((e.target as HTMLInputElement).value, 10))}
              class="w-full accent-[#10b981]"
            />
          </label>

          <Readout label="Ordered arrangements (nPr)" value={perms.toLocaleString()} mono />
          <Readout label="Unordered selections (nCr)" value={combs.toLocaleString()} emerald mono />
          <Readout
            label="Why divide?"
            value={`each committee was counted ${rr}! = ${rfact} times`}
          />
        </div>
      </div>

      {committees.length > 0 ? (
        <div class="mt-4">
          <p class="mb-2 text-sm text-muted">
            All {committees.length} committees from {'{'}{items.join(', ')}{'}'}:
          </p>
          <div class="flex flex-wrap gap-1.5">
            {committees.map((s) => (
              <span key={s} class="rounded-md bg-surface-2 px-2 py-1 font-mono text-xs">
                {s}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <p class="mt-4 text-xs text-muted">
          That is {combs.toLocaleString()} committees — too many to list. Lower n or r to see them all.
        </p>
      )}
    </div>
  );
}

function Readout({
  label,
  value,
  emerald,
  mono,
}: {
  label: string;
  value: string;
  emerald?: boolean;
  mono?: boolean;
}) {
  return (
    <div class={`rounded-lg px-3 py-2 ${emerald ? 'bg-[#10b981]/10' : 'bg-brand-soft'}`}>
      <span class="text-muted">{label}</span>
      <div
        class={`font-semibold ${mono ? 'font-mono' : ''} ${emerald ? 'text-[#10b981]' : 'text-brand'}`}
      >
        {value}
      </div>
    </div>
  );
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, h / 2, w / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
