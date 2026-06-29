import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Taylor approximation builder.
   - Pick a target function (sin x, eˣ, cos x).
   - The slider adds Taylor terms (centred at 0); the emerald polynomial
     hugs the indigo target over a wider and wider window.
   - Drag the sample point to watch the approximation error collapse
     as the degree climbs.
   Crisp, responsive canvas — same conventions as VectorPlayground.
   ------------------------------------------------------------------ */

const COLORS = {
  target: '#4f46e5', // indigo
  poly: '#10b981', // emerald
  sample: '#0ea5e9', // sky
  grid: 'rgba(128,128,128,0.18)',
  axis: 'rgba(128,128,128,0.5)',
};

type FnKey = 'sin' | 'exp' | 'cos';

type Target = {
  label: string;
  story: string;
  f: (x: number) => number;
  // k-th term (k = 0,1,2,...) of the Maclaurin series, as a function of x
  term: (k: number, x: number) => number;
  termLabel: (k: number) => string;
  yRange: number;
};

function fact(n: number): number {
  let f = 1;
  for (let i = 2; i <= n; i++) f *= i;
  return f;
}

const TARGETS: Record<FnKey, Target> = {
  sin: {
    label: 'sin x',
    story: 'A calculator has no "sin" button inside — it sums a few Taylor terms: x − x³/6 + x⁵/120 − …',
    f: Math.sin,
    term: (k, x) => {
      // only odd powers survive: term index k → power 2k+1
      const p = 2 * k + 1;
      return (Math.pow(-1, k) * Math.pow(x, p)) / fact(p);
    },
    termLabel: (k) => {
      const p = 2 * k + 1;
      const sign = k % 2 === 0 ? '+' : '−';
      return `${sign} x^${p}/${p}!`;
    },
    yRange: 2.2,
  },
  exp: {
    label: 'eˣ',
    story: 'eˣ is built the same way: 1 + x + x²/2 + x³/6 + … — exactly the sum from the 1/n! series.',
    f: Math.exp,
    term: (k, x) => Math.pow(x, k) / fact(k),
    termLabel: (k) => (k === 0 ? '1' : `+ x^${k}/${k}!`),
    yRange: 7,
  },
  cos: {
    label: 'cos x',
    story: 'cos x uses only even powers: 1 − x²/2 + x⁴/24 − … Each pair of terms tightens the fit.',
    f: Math.cos,
    term: (k, x) => {
      const p = 2 * k;
      return (Math.pow(-1, k) * Math.pow(x, p)) / fact(p);
    },
    termLabel: (k) => {
      const p = 2 * k;
      const sign = k % 2 === 0 ? '+' : '−';
      return p === 0 ? '1' : `${sign} x^${p}/${p}!`;
    },
    yRange: 2.2,
  },
};

export default function TaylorApproximationBuilder() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [key, setKey] = useState<FnKey>('sin');
  const [terms, setTerms] = useState(2);
  const [x0, setX0] = useState(3);
  const draggingRef = useRef(false);
  const sizeRef = useRef({ w: 480, h: 340, scale: 36, ox: 240, oy: 170 });

  const t = TARGETS[key];

  const poly = (x: number) => {
    let s = 0;
    for (let k = 0; k < terms; k++) s += t.term(k, x);
    return s;
  };

  const toPxX = (x: number) => sizeRef.current.ox + x * sizeRef.current.scale;
  const toPxY = (y: number) => sizeRef.current.oy - y * sizeRef.current.scale;
  const toMathX = (px: number) => (px - sizeRef.current.ox) / sizeRef.current.scale;

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h, ox, oy, scale } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);

    // grid
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    for (let gx = ox % scale; gx < w; gx += scale) {
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke();
    }
    for (let gy = oy % scale; gy < h; gy += scale) {
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke();
    }
    // axes
    ctx.strokeStyle = COLORS.axis;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, oy); ctx.lineTo(w, oy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ox, 0); ctx.lineTo(ox, h); ctx.stroke();

    const yClip = t.yRange * 1.6;

    // target curve
    plot(ctx, t.f, w, toMathX, toPxX, toPxY, COLORS.target, 3, yClip);
    // taylor polynomial
    plot(ctx, poly, w, toMathX, toPxX, toPxY, COLORS.poly, 3, yClip);

    // sample point: target vs poly
    const fy = t.f(x0);
    const py = poly(x0);
    const sx = toPxX(x0);
    // dashed error bar
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(128,128,128,0.7)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(sx, toPxY(fy)); ctx.lineTo(sx, toPxY(py)); ctx.stroke();
    ctx.setLineDash([]);
    dot(ctx, { x: sx, y: toPxY(fy) }, COLORS.target);
    dot(ctx, { x: sx, y: toPxY(clamp(py, -yClip, yClip)) }, COLORS.poly);
    // draggable handle on the sample x (on the x-axis)
    handle(ctx, { x: sx, y: oy }, COLORS.sample);

    // legend
    ctx.font = '600 12px Inter, sans-serif';
    ctx.fillStyle = COLORS.target;
    ctx.fillText(t.label, 10, 16);
    ctx.fillStyle = COLORS.poly;
    ctx.fillText(`Taylor (${terms} term${terms > 1 ? 's' : ''})`, 10, 32);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 560);
      const ht = Math.round(w * 0.66);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = ht * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${ht}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const scale = Math.max(20, Math.min(40, w / 14));
      sizeRef.current = { w, h: ht, scale, ox: w / 2, oy: ht * 0.5 };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(draw, [key, terms, x0]);

  // ---- drag sample point along x-axis ----
  const pointer = (e: PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { px: e.clientX - rect.left, py: e.clientY - rect.top };
  };
  const onDown = (e: PointerEvent) => {
    const { px, py } = pointer(e);
    const sx = toPxX(x0);
    if (Math.hypot(sx - px, sizeRef.current.oy - py) < 30) {
      draggingRef.current = true;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      e.preventDefault();
    }
  };
  const onMove = (e: PointerEvent) => {
    if (!draggingRef.current) return;
    const { px } = pointer(e);
    const x = Math.round(toMathX(px) * 10) / 10;
    const lim = sizeRef.current.w / sizeRef.current.scale / 2 - 0.3;
    setX0(Math.max(-lim, Math.min(lim, x)));
  };
  const onUp = () => { draggingRef.current = false; };

  const fy = t.f(x0);
  const py = poly(x0);
  const err = Math.abs(fy - py);

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap gap-2">
        {(Object.keys(TARGETS) as FnKey[]).map((k) => (
          <button
            key={k}
            onClick={() => setKey(k)}
            class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              key === k ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
            }`}
          >
            {TARGETS[k].label}
          </button>
        ))}
      </div>

      <p class="mb-3 text-sm text-muted">{t.story}</p>

      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas
          ref={canvasRef}
          class="touch-none rounded-xl bg-surface-2"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        />

        <div class="space-y-3 text-sm">
          <label class="block">
            <span class="mb-1 block text-muted">Taylor terms = {terms}</span>
            <input
              type="range"
              min={1}
              max={10}
              step={1}
              value={terms}
              onInput={(e) => setTerms(parseInt((e.target as HTMLInputElement).value))}
              class="w-full accent-[#10b981]"
            />
          </label>

          <p class="text-xs text-muted">Drag the sky dot on the x-axis to move the test point.</p>

          <div class="grid grid-cols-2 gap-2">
            <Readout label={`${t.label} at x=${x0.toFixed(1)}`} value={fy.toFixed(4)} color={COLORS.target} />
            <Readout label="polynomial" value={py.toFixed(4)} color={COLORS.poly} />
          </div>

          <div class="rounded-lg bg-surface-2 p-3">
            <div class="flex justify-between">
              <span class="text-muted">error |f − P|</span>
              <strong class="font-mono">{err < 1e-4 ? err.toExponential(1) : err.toFixed(4)}</strong>
            </div>
            <p class="mt-1 text-xs text-muted">
              {err < 0.01
                ? 'Essentially perfect here — more terms keep widening the matched window.'
                : 'Add terms (or drag closer to 0): the emerald curve squeezes onto the target.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Readout({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div class="rounded-lg bg-surface-2 px-3 py-2">
      <span class="text-muted" style={color ? `color:${color}` : ''}>{label}</span>
      <div class="font-mono font-semibold">{value}</div>
    </div>
  );
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function plot(
  ctx: CanvasRenderingContext2D,
  f: (x: number) => number,
  w: number,
  toMathX: (px: number) => number,
  toPxX: (x: number) => number,
  toPxY: (y: number) => number,
  color: string,
  width: number,
  yClip: number,
) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  let started = false;
  for (let px = 0; px <= w; px += 2) {
    const x = toMathX(px);
    const y = f(x);
    if (!isFinite(y) || y > yClip || y < -yClip) { started = false; continue; }
    const py = toPxY(y);
    if (!started) { ctx.moveTo(px, py); started = true; } else { ctx.lineTo(px, py); }
  }
  ctx.stroke();
}

function dot(ctx: CanvasRenderingContext2D, at: { x: number; y: number }, color: string) {
  ctx.beginPath(); ctx.arc(at.x, at.y, 4.5, 0, Math.PI * 2);
  ctx.fillStyle = color; ctx.fill();
}

function handle(ctx: CanvasRenderingContext2D, at: { x: number; y: number }, color: string) {
  ctx.beginPath(); ctx.arc(at.x, at.y, 7, 0, Math.PI * 2);
  ctx.fillStyle = '#fff'; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = color; ctx.stroke();
}
