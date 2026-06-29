import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   u-substitution visualizer.
   - Pick an integral, then pick a candidate for u.
   - Only the substitution whose derivative is "already there" cancels
     cleanly: the x-space integrand (top, indigo) becomes a tidy
     u-space integrand (bottom, emerald) — and the shaded AREA is
     unchanged. Drag the upper limit to confirm it holds everywhere.
   Crisp, responsive canvas — same conventions as VectorPlayground.
   ------------------------------------------------------------------ */

const COLORS = {
  x: '#4f46e5', // indigo
  u: '#10b981', // emerald
  shade: 'rgba(79,70,229,0.18)',
  shadeU: 'rgba(16,185,129,0.18)',
  grid: 'rgba(128,128,128,0.18)',
  axis: 'rgba(128,128,128,0.5)',
};

type Candidate = { label: string; note: string };

type Example = {
  id: string;
  story: string;
  integrand: string; // x-space, unicode
  fx: (x: number) => number;
  a: number;
  bMax: number;
  bInit: number;
  candidates: Candidate[];
  validIdx: number;
  u: (x: number) => number; // valid substitution
  gu: (u: number) => number; // transformed integrand
  transformed: string; // u-space label
};

const EXAMPLES: Record<string, Example> = {
  rocket: {
    id: 'rocket',
    story: 'Rocket thrust ramps up as 2t·e^(t²). The work it does is the area under the curve.',
    integrand: '2x · e^(x²)',
    fx: (x) => 2 * x * Math.exp(x * x),
    a: 0,
    bMax: 1.3,
    bInit: 1,
    candidates: [
      { label: 'u = x²', note: 'du = 2x dx — and a 2x dx is sitting right there. It cancels!' },
      { label: 'u = 2x', note: 'du = 2 dx, but the integrand has an e^(x²) that never becomes a u. Stuck.' },
      { label: 'u = e^(x²)', note: 'du = 2x·e^(x²) dx — that eats the WHOLE integrand, leaving ∫du. Works too, but x² is the clean pick.' },
    ],
    validIdx: 0,
    u: (x) => x * x,
    gu: (u) => Math.exp(u),
    transformed: '∫ eᵘ du',
  },
  pollution: {
    id: 'pollution',
    story: 'A pollutant accumulates at rate 2x/(1+x²). Total build-up is the area under this curve.',
    integrand: '2x / (1 + x²)',
    fx: (x) => (2 * x) / (1 + x * x),
    a: 0,
    bMax: 2.5,
    bInit: 2,
    candidates: [
      { label: 'u = 1 + x²', note: 'du = 2x dx — exactly the numerator. The integral collapses to ∫ du/u.' },
      { label: 'u = 2x', note: 'du = 2 dx, but the denominator keeps an x². No cancellation.' },
      { label: 'u = x', note: 'du = dx changes nothing — you have not simplified anything.' },
    ],
    validIdx: 0,
    u: (x) => 1 + x * x,
    gu: (u) => 1 / u,
    transformed: '∫ 1/u du',
  },
  compound: {
    id: 'compound',
    story: 'A signal grows as 3x²·(x³+1)². The energy delivered is the area beneath it.',
    integrand: '3x² · (x³ + 1)²',
    fx: (x) => 3 * x * x * Math.pow(x * x * x + 1, 2),
    a: 0,
    bMax: 1.2,
    bInit: 1,
    candidates: [
      { label: 'u = x³ + 1', note: 'du = 3x² dx — the 3x² out front is exactly du. Clean!' },
      { label: 'u = x³', note: 'du = 3x² dx, but the (x³+1)² still hides a +1. Messier than needed.' },
      { label: 'u = 3x²', note: 'du = 6x dx, which is nowhere in the integrand. Dead end.' },
    ],
    validIdx: 0,
    u: (x) => x * x * x + 1,
    gu: (u) => u * u,
    transformed: '∫ u² du',
  },
};

function simpson(f: (x: number) => number, a: number, b: number, n = 200) {
  if (b <= a) return 0;
  const m = n % 2 === 0 ? n : n + 1;
  const h = (b - a) / m;
  let s = f(a) + f(b);
  for (let i = 1; i < m; i++) s += (i % 2 === 0 ? 2 : 4) * f(a + i * h);
  return (h / 3) * s;
}

export default function USubstitutionVisualizer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [exKey, setExKey] = useState<keyof typeof EXAMPLES>('rocket');
  const [pick, setPick] = useState<number | null>(null);
  const [b, setB] = useState(EXAMPLES.rocket.bInit);
  const sizeRef = useRef({ w: 480, h: 420 });

  const ex = EXAMPLES[exKey];
  const correct = pick === ex.validIdx;

  const switchExample = (k: keyof typeof EXAMPLES) => {
    setExKey(k);
    setPick(null);
    setB(EXAMPLES[k].bInit);
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);

    const showU = correct;
    const pad = 8;
    const gap = 14;
    const panelH = showU ? (h - gap) / 2 : h - 2 * pad;
    const top = { x: pad, y: pad, w: w - 2 * pad, h: panelH };
    const bot = { x: pad, y: pad + panelH + gap, w: w - 2 * pad, h: panelH };

    // --- top: x-space ---
    const xLo = ex.a;
    const xHi = ex.bMax;
    drawPanel(ctx, top, ex.fx, xLo, xHi, ex.a, b, COLORS.x, COLORS.shade, 'x', `area = ∫ ${ex.integrand} dx`);

    // --- bottom: u-space (only when correct) ---
    if (showU) {
      const uA = ex.u(ex.a);
      const uB = ex.u(b);
      const uHi = ex.u(ex.bMax);
      drawPanel(ctx, bot, ex.gu, ex.u(ex.a), uHi, uA, uB, COLORS.u, COLORS.shadeU, 'u', `same area = ${ex.transformed}`);
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 560);
      const ht = Math.round(w * 0.84);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = ht * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${ht}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w, h: ht };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(draw, [exKey, pick, b]);

  const areaX = simpson(ex.fx, ex.a, b);
  const areaU = correct ? simpson(ex.gu, ex.u(ex.a), ex.u(b)) : NaN;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap gap-2">
        {(Object.keys(EXAMPLES) as (keyof typeof EXAMPLES)[]).map((k) => (
          <button
            key={k}
            onClick={() => switchExample(k)}
            class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              exKey === k ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
            }`}
          >
            ∫ {EXAMPLES[k].integrand} dx
          </button>
        ))}
      </div>

      <p class="mb-3 text-sm text-muted">{ex.story}</p>

      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

        <div class="space-y-3 text-sm">
          <p class="font-semibold text-text">Pick what to call u:</p>
          <div class="flex flex-col gap-2">
            {ex.candidates.map((c, i) => {
              const chosen = pick === i;
              const good = i === ex.validIdx;
              let cls = 'rounded-lg border px-3 py-2 text-left font-mono text-sm transition ';
              if (!chosen) cls += 'border-border bg-surface-2 text-muted hover:text-text';
              else if (good) cls += 'border-calculus/50 bg-calculus/10 text-calculus';
              else cls += 'border-geometry/50 bg-geometry/10 text-geometry';
              return (
                <button key={i} class={cls} onClick={() => setPick(i)}>
                  {c.label}
                </button>
              );
            })}
          </div>

          {pick !== null && (
            <div class="animate-fade-up rounded-lg bg-surface-2 p-3 text-xs leading-relaxed">
              <strong class={correct ? 'text-calculus' : 'text-geometry'}>
                {correct ? 'Clean substitution! ' : 'Hmm. '}
              </strong>
              {ex.candidates[pick].note}
            </div>
          )}

          <label class="block">
            <span class="mb-1 block text-muted">upper limit b = {b.toFixed(2)}</span>
            <input
              type="range"
              min={ex.a + 0.1}
              max={ex.bMax}
              step={0.05}
              value={b}
              onInput={(e) => setB(parseFloat((e.target as HTMLInputElement).value))}
              class="w-full accent-[#10b981]"
            />
          </label>

          <div class="space-y-1 rounded-lg bg-surface-2 p-3">
            <div class="flex justify-between">
              <span style={`color:${COLORS.x}`} class="font-semibold">x-area</span>
              <strong class="font-mono">{areaX.toFixed(3)}</strong>
            </div>
            <div class="flex justify-between">
              <span style={`color:${COLORS.u}`} class="font-semibold">u-area</span>
              <strong class="font-mono">{correct ? areaU.toFixed(3) : '—'}</strong>
            </div>
            <p class="mt-1 text-xs text-muted">
              {correct
                ? 'Identical — the substitution just relabels the axis. The area never moved.'
                : 'Choose the u whose derivative already appears, and the bottom u-graph unlocks.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

type Rect = { x: number; y: number; w: number; h: number };

function drawPanel(
  ctx: CanvasRenderingContext2D,
  r: Rect,
  f: (x: number) => number,
  xLo: number,
  xHi: number,
  shadeLo: number,
  shadeHi: number,
  color: string,
  shade: string,
  axisName: string,
  caption: string,
) {
  // auto y-range from samples (integrands are >= 0 on these domains)
  let yMax = 0;
  const N = 120;
  for (let i = 0; i <= N; i++) {
    const x = xLo + ((xHi - xLo) * i) / N;
    yMax = Math.max(yMax, f(x));
  }
  yMax = yMax * 1.15 || 1;

  const X = (x: number) => r.x + ((x - xLo) / (xHi - xLo)) * r.w;
  const Y = (y: number) => r.y + r.h - (y / yMax) * (r.h - 16);

  // frame + grid
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  for (let i = 1; i < 5; i++) {
    const gx = r.x + (r.w * i) / 5;
    ctx.beginPath(); ctx.moveTo(gx, r.y); ctx.lineTo(gx, r.y + r.h); ctx.stroke();
  }
  // axis (bottom)
  ctx.strokeStyle = COLORS.axis;
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(r.x, r.y + r.h); ctx.lineTo(r.x + r.w, r.y + r.h); ctx.stroke();

  // shaded area under f between shadeLo..shadeHi
  ctx.fillStyle = shade;
  ctx.beginPath();
  ctx.moveTo(X(shadeLo), Y(0));
  const M = 80;
  for (let i = 0; i <= M; i++) {
    const x = shadeLo + ((shadeHi - shadeLo) * i) / M;
    ctx.lineTo(X(x), Y(Math.max(0, f(x))));
  }
  ctx.lineTo(X(shadeHi), Y(0));
  ctx.closePath();
  ctx.fill();

  // curve
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  for (let i = 0; i <= N; i++) {
    const x = xLo + ((xHi - xLo) * i) / N;
    const px = X(x);
    const py = Y(Math.max(0, f(x)));
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();

  // caption + axis label
  ctx.font = '600 12px Inter, sans-serif';
  ctx.fillStyle = color;
  ctx.fillText(caption, r.x + 6, r.y + 14);
  ctx.fillStyle = 'rgba(128,128,128,0.8)';
  ctx.fillText(axisName, r.x + r.w - 12, r.y + r.h - 4);
}
