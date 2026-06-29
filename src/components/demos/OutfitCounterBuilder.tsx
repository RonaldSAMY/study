import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Counting Principles playground.
   - Adjust how many choices each "category" has (tops, bottoms, shoes…).
   - Toggle between the RULE OF PRODUCT (AND — combine one from each)
     and the RULE OF SUM (OR — pick from exactly one category).
   - A live tree on the canvas shows the branching explode.
   ------------------------------------------------------------------ */

type Mode = 'product' | 'sum';

const COLORS = {
  brand: '#4f46e5',
  sky: '#0ea5e9',
  emerald: '#10b981',
  line: 'rgba(128,128,128,0.45)',
};

const PALETTE = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b'];

export default function OutfitCounterBuilder() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 480, h: 300 });
  const [counts, setCounts] = useState<number[]>([3, 2, 2]);
  const [mode, setMode] = useState<Mode>('product');

  const labels = ['Tops', 'Bottoms', 'Shoes', 'Hats'];

  const total =
    mode === 'product'
      ? counts.reduce((acc, c) => acc * c, 1)
      : counts.reduce((acc, c) => acc + c, 0);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);

    const levels = counts.length;
    const colGap = w / (levels + 1);

    if (mode === 'product') {
      // tree: each leaf of level i branches into counts[i+1] children
      type Node = { x: number; y: number };
      let prev: Node[] = [{ x: colGap * 0.5, y: h / 2 }];
      // root marker
      ctx.fillStyle = COLORS.brand;
      ctx.beginPath();
      ctx.arc(prev[0].x, prev[0].y, 5, 0, Math.PI * 2);
      ctx.fill();

      for (let lvl = 0; lvl < levels; lvl++) {
        const c = counts[lvl];
        const next: Node[] = [];
        const color = PALETTE[lvl % PALETTE.length];
        const x = colGap * (lvl + 1.5);
        const totalLeaves = prev.length * c;
        // cap drawn leaves so the picture stays readable
        const drawCap = 26;
        let drawn = 0;
        prev.forEach((p, pi) => {
          for (let j = 0; j < c; j++) {
            const idx = pi * c + j;
            const y = ((idx + 1) / (totalLeaves + 1)) * h;
            if (drawn < drawCap) {
              ctx.strokeStyle = COLORS.line;
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.moveTo(p.x, p.y);
              ctx.lineTo(x, y);
              ctx.stroke();
              ctx.fillStyle = color;
              ctx.beginPath();
              ctx.arc(x, y, lvl === levels - 1 ? 4 : 3.5, 0, Math.PI * 2);
              ctx.fill();
              drawn++;
            }
            next.push({ x, y });
          }
        });
        prev = next;
      }
    } else {
      // sum: separate clusters, no combining
      let drawnRows = 0;
      const totalItems = counts.reduce((a, c) => a + c, 0);
      counts.forEach((c, lvl) => {
        const color = PALETTE[lvl % PALETTE.length];
        for (let j = 0; j < c; j++) {
          const y = ((drawnRows + 1) / (totalItems + 1)) * h;
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(w * 0.18 + lvl * 0.001, y, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = 'rgba(128,128,128,0.85)';
          ctx.font = '12px Inter, sans-serif';
          ctx.fillText(`${labels[lvl] ?? 'Group'} option ${j + 1}`, w * 0.18 + 14, y + 4);
          drawnRows++;
        }
      });
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 560);
      const h = Math.round(w * 0.62);
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

  useEffect(draw, [counts, mode]);

  const setCount = (i: number, v: number) =>
    setCounts((cs) => cs.map((c, j) => (j === i ? v : c)));
  const addCategory = () => setCounts((cs) => (cs.length >= 4 ? cs : [...cs, 2]));
  const removeCategory = () => setCounts((cs) => (cs.length <= 1 ? cs : cs.slice(0, -1)));

  const expr =
    mode === 'product' ? counts.join(' × ') : counts.join(' + ');

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap gap-2">
        {(['product', 'sum'] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              mode === m ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
            }`}
          >
            {m === 'product' ? 'Rule of product (AND)' : 'Rule of sum (OR)'}
          </button>
        ))}
      </div>

      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

        <div class="space-y-3 text-sm">
          <p class="text-muted">
            {mode === 'product'
              ? 'You wear one item from EACH category. Slide to see the outfits multiply.'
              : 'You pick exactly ONE item from ONE category. The totals add.'}
          </p>

          {counts.map((c, i) => (
            <label key={i} class="block">
              <span class="mb-1 block text-muted">
                {labels[i] ?? `Category ${i + 1}`}: {c} choice{c === 1 ? '' : 's'}
              </span>
              <input
                type="range"
                min={1}
                max={6}
                step={1}
                value={c}
                onInput={(e) => setCount(i, parseInt((e.target as HTMLInputElement).value, 10))}
                class="w-full accent-[#4f46e5]"
              />
            </label>
          ))}

          <div class="flex gap-2">
            <button
              onClick={addCategory}
              disabled={counts.length >= 4}
              class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted transition hover:text-text disabled:opacity-40"
            >
              + category
            </button>
            <button
              onClick={removeCategory}
              disabled={counts.length <= 1}
              class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted transition hover:text-text disabled:opacity-40"
            >
              − category
            </button>
          </div>

          <Readout
            label={mode === 'product' ? 'Total outfits' : 'Total single choices'}
            value={`${expr} = ${total}`}
          />
        </div>
      </div>
    </div>
  );
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div class="rounded-lg bg-brand-soft px-3 py-2">
      <span class="text-muted">{label}</span>
      <div class="font-mono text-base font-semibold text-brand">{value}</div>
    </div>
  );
}
