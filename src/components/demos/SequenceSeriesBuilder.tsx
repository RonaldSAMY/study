import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Sequence & series builder.
   - Toggle ARITHMETIC (add d each step) or GEOMETRIC (multiply by r).
   - Set the first term and the difference/ratio and term count.
   - Bars show each term; the emerald line shows the RUNNING TOTAL
     (the partial sum of the series) building up.
   Crisp, responsive canvas — same conventions as VectorPlayground.
   ------------------------------------------------------------------ */

type Kind = 'arithmetic' | 'geometric';

const COLORS = {
  term: '#4f46e5',   // indigo bars
  sum: '#10b981',    // emerald running total
  grid: 'rgba(128,128,128,0.18)',
  axis: 'rgba(128,128,128,0.5)',
};

export default function SequenceSeriesBuilder() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [kind, setKind] = useState<Kind>('arithmetic');
  const [a1, setA1] = useState(2);
  const [step, setStep] = useState(3); // d for arithmetic, r for geometric (reuse one slider via kind)
  const [ratio, setRatio] = useState(1.5);
  const [n, setN] = useState(8);
  const sizeRef = useRef({ w: 480, h: 360, padL: 40, padB: 28, padT: 16, padR: 12 });

  const terms = (() => {
    const out: number[] = [];
    for (let i = 0; i < n; i++) {
      out.push(kind === 'arithmetic' ? a1 + i * step : a1 * Math.pow(ratio, i));
    }
    return out;
  })();
  const partials = terms.reduce<number[]>((acc, t, i) => {
    acc.push((acc[i - 1] ?? 0) + t);
    return acc;
  }, []);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h, padL, padB, padT, padR } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);

    const plotW = w - padL - padR;
    const plotH = h - padT - padB;
    const yBase = padT + plotH;

    const total = partials[partials.length - 1] ?? 0;
    const maxVal = Math.max(1, total, ...terms.map((t) => Math.abs(t)));
    const minVal = Math.min(0, ...terms, ...partials);
    const range = maxVal - minVal || 1;
    const ty = (v: number) => yBase - ((v - minVal) / range) * plotH;

    // grid
    ctx.strokeStyle = COLORS.grid; ctx.lineWidth = 1;
    ctx.font = '10px Inter, sans-serif'; ctx.fillStyle = 'rgba(128,128,128,0.9)';
    for (let i = 0; i <= 4; i++) {
      const v = minVal + (i / 4) * range;
      const yy = ty(v);
      ctx.beginPath(); ctx.moveTo(padL, yy); ctx.lineTo(padL + plotW, yy); ctx.stroke();
      ctx.fillText(fmt(v), 2, yy + 3);
    }
    // zero axis
    ctx.strokeStyle = COLORS.axis; ctx.lineWidth = 1.5;
    const y0 = ty(0);
    ctx.beginPath(); ctx.moveTo(padL, y0); ctx.lineTo(padL + plotW, y0); ctx.stroke();

    // bars (terms)
    const slot = plotW / n;
    const bw = slot * 0.6;
    ctx.fillStyle = COLORS.term;
    terms.forEach((t, i) => {
      const cx = padL + slot * (i + 0.5);
      const top = ty(Math.max(0, t));
      const bot = ty(Math.min(0, t));
      ctx.fillRect(cx - bw / 2, top, bw, Math.max(1, bot - top));
    });

    // running total line
    ctx.strokeStyle = COLORS.sum; ctx.lineWidth = 3;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    partials.forEach((s, i) => {
      const cx = padL + slot * (i + 0.5);
      const yy = ty(s);
      if (i === 0) ctx.moveTo(cx, yy); else ctx.lineTo(cx, yy);
    });
    ctx.stroke();
    partials.forEach((s, i) => {
      const cx = padL + slot * (i + 0.5);
      dot(ctx, { x: cx, y: ty(s) }, COLORS.sum, 3.5);
    });
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 560);
      const ht = Math.round(w * 0.72);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = ht * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${ht}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { ...sizeRef.current, w, h: ht };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(draw, [kind, a1, step, ratio, n]);

  const total = partials[partials.length - 1] ?? 0;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap gap-2">
        {(['arithmetic', 'geometric'] as Kind[]).map((k) => (
          <button
            key={k}
            onClick={() => setKind(k)}
            class={`rounded-lg px-3 py-1.5 text-sm font-semibold capitalize transition ${
              kind === k ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
            }`}
          >
            {k}
          </button>
        ))}
      </div>

      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

        <div class="space-y-3 text-sm">
          <p class="text-muted">
            <span style={`color:${COLORS.term}`} class="font-semibold">Bars</span> are the terms; the{' '}
            <span style={`color:${COLORS.sum}`} class="font-semibold">green line</span> is the running total
            (the series).
          </p>

          <label class="block">
            <span class="mb-1 block text-muted">first term a₁ = {a1.toFixed(1)}</span>
            <input type="range" min={-5} max={10} step={0.5} value={a1}
              onInput={(e) => setA1(parseFloat((e.target as HTMLInputElement).value))}
              class="w-full" style={`accent-color:${COLORS.term}`} />
          </label>

          {kind === 'arithmetic' ? (
            <label class="block">
              <span class="mb-1 block text-muted">common difference d = {step.toFixed(1)}</span>
              <input type="range" min={-5} max={5} step={0.5} value={step}
                onInput={(e) => setStep(parseFloat((e.target as HTMLInputElement).value))}
                class="w-full" style={`accent-color:${COLORS.term}`} />
            </label>
          ) : (
            <label class="block">
              <span class="mb-1 block text-muted">common ratio r = {ratio.toFixed(2)}</span>
              <input type="range" min={-2} max={2} step={0.05} value={ratio}
                onInput={(e) => setRatio(parseFloat((e.target as HTMLInputElement).value))}
                class="w-full" style={`accent-color:${COLORS.term}`} />
            </label>
          )}

          <label class="block">
            <span class="mb-1 block text-muted">number of terms n = {n}</span>
            <input type="range" min={2} max={14} step={1} value={n}
              onInput={(e) => setN(parseInt((e.target as HTMLInputElement).value))}
              class="w-full" style={`accent-color:${COLORS.term}`} />
          </label>

          <div class="space-y-1 rounded-lg bg-surface-2 p-3">
            <div class="flex items-center justify-between">
              <span class="text-muted">last term</span>
              <strong class="font-mono">{fmt(terms[terms.length - 1] ?? 0)}</strong>
            </div>
            <div class="flex items-center justify-between border-t border-border pt-1">
              <span style={`color:${COLORS.sum}`} class="font-semibold">sum of {n} terms</span>
              <strong class="font-mono">{fmt(total)}</strong>
            </div>
            <p class="mt-1 text-xs text-muted">
              {kind === 'arithmetic'
                ? 'Each term ADDS the same amount, so the total grows in a straight, steady ramp.'
                : Math.abs(ratio) > 1
                ? 'Each term MULTIPLIES, so the total curves upward ever faster.'
                : 'With |r| < 1 the terms shrink — the total creeps toward a finite limit.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function fmt(x: number) {
  if (Math.abs(x) >= 1000) return x.toExponential(1);
  return Math.abs(x - Math.round(x)) < 1e-9 ? String(Math.round(x)) : x.toFixed(1);
}
function dot(ctx: CanvasRenderingContext2D, at: { x: number; y: number }, color: string, r = 4) {
  ctx.beginPath(); ctx.arc(at.x, at.y, r, 0, Math.PI * 2);
  ctx.fillStyle = color; ctx.fill();
}
