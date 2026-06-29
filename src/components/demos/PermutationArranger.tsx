import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Permutations playground.
   - Choose n items and r slots to fill (an ordered line-up).
   - Watch the "choices remaining" count down: n, n-1, n-2 …
   - Live formula nPr = n! / (n-r)! and the running product.
   - For small cases, the actual arrangements are listed.
   ------------------------------------------------------------------ */

const COLORS = {
  brand: '#4f46e5',
  emerald: '#10b981',
  line: 'rgba(128,128,128,0.45)',
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

export default function PermutationArranger() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 480, h: 200 });
  const [n, setN] = useState(5);
  const [r, setR] = useState(3);

  const rr = Math.min(r, n);
  const value = nPr(n, rr);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);

    const slots = rr;
    const boxW = Math.min(56, (w - 24) / Math.max(slots, 1) - 12);
    const gap = 12;
    const totalW = slots * boxW + (slots - 1) * gap;
    const startX = (w - totalW) / 2;
    const y = h * 0.42;

    for (let i = 0; i < slots; i++) {
      const x = startX + i * (boxW + gap);
      // slot box
      ctx.fillStyle = i === 0 ? COLORS.brand : 'rgba(79,70,229,0.12)';
      ctx.strokeStyle = COLORS.brand;
      ctx.lineWidth = 2;
      roundRect(ctx, x, y, boxW, boxW, 10);
      ctx.fill();
      ctx.stroke();

      // position label
      ctx.fillStyle = 'rgba(128,128,128,0.85)';
      ctx.font = '12px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(ordinal(i + 1), x + boxW / 2, y + boxW + 16);

      // choices-remaining number inside
      ctx.fillStyle = i === 0 ? '#fff' : COLORS.brand;
      ctx.font = '600 18px Inter, sans-serif';
      ctx.fillText(`${n - i}`, x + boxW / 2, y + boxW / 2 + 6);

      // × between boxes
      if (i < slots - 1) {
        ctx.fillStyle = 'rgba(128,128,128,0.8)';
        ctx.font = '600 16px Inter, sans-serif';
        ctx.fillText('×', x + boxW + gap / 2, y + boxW / 2 + 6);
      }
    }
    ctx.textAlign = 'left';

    // caption
    ctx.fillStyle = 'rgba(128,128,128,0.85)';
    ctx.font = '12px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('choices available for each position', w / 2, y - 14);
    ctx.textAlign = 'left';
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 560);
      const h = Math.round(w * 0.42);
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

  // small enumeration of arrangements (letters A, B, C …)
  const items = Array.from({ length: n }, (_, i) => String.fromCharCode(65 + i));
  const arrangements: string[] = [];
  if (value <= 60) {
    const used = new Array(n).fill(false);
    const cur: string[] = [];
    const rec = () => {
      if (cur.length === rr) {
        arrangements.push(cur.join(''));
        return;
      }
      for (let i = 0; i < n; i++) {
        if (used[i]) continue;
        used[i] = true;
        cur.push(items[i]);
        rec();
        cur.pop();
        used[i] = false;
      }
    };
    rec();
  }

  const product = Array.from({ length: rr }, (_, i) => n - i).join(' × ') || '1';

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

        <div class="space-y-3 text-sm">
          <p class="text-muted">Line up r of your n items in order. Watch the choices shrink.</p>

          <label class="block">
            <span class="mb-1 block text-muted">n (items to choose from) = {n}</span>
            <input
              type="range" min={1} max={8} step={1} value={n}
              onInput={(e) => setN(parseInt((e.target as HTMLInputElement).value, 10))}
              class="w-full accent-[#4f46e5]"
            />
          </label>
          <label class="block">
            <span class="mb-1 block text-muted">r (positions to fill) = {rr}</span>
            <input
              type="range" min={1} max={n} step={1} value={rr}
              onInput={(e) => setR(parseInt((e.target as HTMLInputElement).value, 10))}
              class="w-full accent-[#10b981]"
            />
          </label>

          <Readout label="Running product" value={`${product} = ${value}`} />
          <Readout
            label="Formula"
            value={`${n}! / (${n}−${rr})! = ${factorial(n)} / ${factorial(n - rr)} = ${value}`}
          />
        </div>
      </div>

      {arrangements.length > 0 ? (
        <div class="mt-4">
          <p class="mb-2 text-sm text-muted">
            All {arrangements.length} arrangements of {rr} from {'{'}{items.join(', ')}{'}'}:
          </p>
          <div class="flex flex-wrap gap-1.5">
            {arrangements.map((s) => (
              <span key={s} class="rounded-md bg-surface-2 px-2 py-1 font-mono text-xs">
                {s}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <p class="mt-4 text-xs text-muted">
          That is {value.toLocaleString()} arrangements — far too many to list. Lower n or r to see them all.
        </p>
      )}
    </div>
  );
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div class="rounded-lg bg-brand-soft px-3 py-2">
      <span class="text-muted">{label}</span>
      <div class="font-mono text-sm font-semibold text-brand">{value}</div>
    </div>
  );
}

function ordinal(i: number) {
  return ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'][i - 1] ?? `${i}th`;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
