import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Activation scope: plot an activation f(x) and its derivative f'(x).
   - Pick sigmoid / tanh / ReLU / GELU: both curves redraw.
   - Drag the vertical marker to read f(x) and the slope f'(x).
   - "softmax" swaps to a 3-logit panel showing the normalized output.
   ------------------------------------------------------------------ */

type Act = 'sigmoid' | 'tanh' | 'relu' | 'gelu' | 'softmax';

const COLORS = {
  f: '#4f46e5',
  d: '#10b981',
  grid: 'rgba(128,128,128,0.18)',
  axis: 'rgba(128,128,128,0.5)',
  marker: '#0ea5e9',
};

// Abramowitz-Stegun erf approximation (for exact-ish GELU)
function erf(x: number) {
  const s = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-ax * ax);
  return s * y;
}

const F: Record<Exclude<Act, 'softmax'>, (x: number) => number> = {
  sigmoid: (x) => 1 / (1 + Math.exp(-x)),
  tanh: (x) => Math.tanh(x),
  relu: (x) => Math.max(0, x),
  gelu: (x) => 0.5 * x * (1 + erf(x / Math.SQRT2)),
};
const D: Record<Exclude<Act, 'softmax'>, (x: number) => number> = {
  sigmoid: (x) => { const s = 1 / (1 + Math.exp(-x)); return s * (1 - s); },
  tanh: (x) => 1 - Math.tanh(x) ** 2,
  relu: (x) => (x > 0 ? 1 : 0),
  gelu: (x) => {
    const cdf = 0.5 * (1 + erf(x / Math.SQRT2));
    const pdf = Math.exp(-(x * x) / 2) / Math.sqrt(2 * Math.PI);
    return cdf + x * pdf;
  },
};

export default function ActivationDerivativeScope() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [act, setAct] = useState<Act>('sigmoid');
  const [mx, setMx] = useState(1.2);
  const [logits, setLogits] = useState<[number, number, number]>([2.0, 1.0, 0.2]);
  const draggingRef = useRef(false);
  const sizeRef = useRef({ w: 480, h: 320, ox: 240, oy: 160, sx: 36, sy: 60 });

  const XMIN = -6, XMAX = 6, YMIN = -1.5, YMAX = 2;

  const toPx = (x: number, y: number) => {
    const { ox, oy, sx, sy } = sizeRef.current;
    return { x: ox + x * sx, y: oy - y * sy };
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h, ox, oy, sx } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);
    if (act === 'softmax') return; // softmax rendered as HTML bars

    // grid
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    for (let gx = XMIN; gx <= XMAX; gx++) {
      const X = toPx(gx, 0).x;
      ctx.beginPath(); ctx.moveTo(X, 0); ctx.lineTo(X, h); ctx.stroke();
    }
    for (let gy = Math.ceil(YMIN); gy <= YMAX; gy++) {
      const Y = toPx(0, gy).y;
      ctx.beginPath(); ctx.moveTo(0, Y); ctx.lineTo(w, Y); ctx.stroke();
    }
    // axes
    ctx.strokeStyle = COLORS.axis;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, oy); ctx.lineTo(w, oy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ox, 0); ctx.lineTo(ox, h); ctx.stroke();

    const f = F[act], d = D[act];
    // f(x)
    ctx.strokeStyle = COLORS.f; ctx.lineWidth = 3; ctx.beginPath();
    let started = false;
    for (let px = 0; px <= w; px += 2) {
      const x = (px - ox) / sx;
      if (x < XMIN || x > XMAX) continue;
      const p = toPx(x, f(x));
      if (!started) { ctx.moveTo(p.x, p.y); started = true; } else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
    // f'(x)
    ctx.strokeStyle = COLORS.d; ctx.lineWidth = 2.5; ctx.setLineDash([6, 4]); ctx.beginPath();
    started = false;
    for (let px = 0; px <= w; px += 2) {
      const x = (px - ox) / sx;
      if (x < XMIN || x > XMAX) continue;
      const p = toPx(x, d(x));
      if (!started) { ctx.moveTo(p.x, p.y); started = true; } else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke(); ctx.setLineDash([]);

    // marker
    const markX = toPx(mx, 0).x;
    ctx.strokeStyle = COLORS.marker; ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(markX, 0); ctx.lineTo(markX, h); ctx.stroke(); ctx.setLineDash([]);
    const pf = toPx(mx, f(mx));
    ctx.beginPath(); ctx.arc(pf.x, pf.y, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = COLORS.f; ctx.stroke();
    const pd = toPx(mx, d(mx));
    ctx.beginPath(); ctx.arc(pd.x, pd.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.d; ctx.fill();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 520);
      const h = Math.round(w * 0.66);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const sx = w / (XMAX - XMIN);
      const sy = h / (YMAX - YMIN);
      const ox = w / 2;
      const oy = h + YMIN * sy; // pixel row of y = 0
      sizeRef.current = { w, h, ox, oy, sx, sy };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(draw, [act, mx]);

  const pointer = (e: PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return e.clientX - rect.left;
  };
  const onDown = (e: PointerEvent) => {
    if (act === 'softmax') return;
    draggingRef.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const { ox, sx } = sizeRef.current;
    setMx(Math.max(XMIN, Math.min(XMAX, (pointer(e) - ox) / sx)));
    e.preventDefault();
  };
  const onMove = (e: PointerEvent) => {
    if (!draggingRef.current) return;
    const { ox, sx } = sizeRef.current;
    setMx(Math.max(XMIN, Math.min(XMAX, (pointer(e) - ox) / sx)));
  };
  const onUp = () => { draggingRef.current = false; };

  // softmax
  const exps = logits.map((l) => Math.exp(l - Math.max(...logits)));
  const sumE = exps.reduce((s, v) => s + v, 0);
  const probs = exps.map((v) => v / sumE);

  const fval = act === 'softmax' ? 0 : F[act](mx);
  const dval = act === 'softmax' ? 0 : D[act](mx);

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap gap-2">
        {(['sigmoid', 'tanh', 'relu', 'gelu', 'softmax'] as Act[]).map((m) => (
          <button
            key={m}
            onClick={() => setAct(m)}
            class={`rounded-lg px-3 py-1.5 text-sm font-semibold capitalize transition ${
              act === m ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      {act !== 'softmax' ? (
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
            <p class="text-muted">
              Solid indigo is the activation <strong>f(x)</strong>; dashed green is its derivative
              <strong> f′(x)</strong>. Drag anywhere to move the blue marker.
            </p>
            <div class="rounded-lg bg-surface-2 p-3">
              <div class="flex justify-between"><span class="text-muted">x</span><strong>{mx.toFixed(2)}</strong></div>
              <div class="flex justify-between"><span style="color:#4f46e5">f(x)</span><strong>{fval.toFixed(3)}</strong></div>
              <div class="flex justify-between"><span style="color:#10b981">f′(x)</span><strong>{dval.toFixed(3)}</strong></div>
              <p class="mt-1 text-xs text-muted">
                {dval < 0.02
                  ? 'Slope ≈ 0 here — gradients almost vanish, so learning stalls (a "saturated" region).'
                  : 'Healthy slope — gradients flow and the weight feeding this unit can learn.'}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div class="space-y-3 text-sm">
          <p class="text-muted">
            Softmax turns a vector of scores (logits) into a probability distribution that sums to 1.
            Slide the three class scores and watch the probabilities compete.
          </p>
          {logits.map((l, i) => (
            <label key={i} class="block">
              <span class="mb-1 block text-muted">logit z{i + 1} = {l.toFixed(1)}</span>
              <input
                type="range" min={-4} max={4} step={0.1} value={l}
                onInput={(e) => {
                  const v = parseFloat((e.target as HTMLInputElement).value);
                  setLogits((prev) => prev.map((p, j) => (j === i ? v : p)) as [number, number, number]);
                }}
                class="w-full accent-[#4f46e5]"
              />
            </label>
          ))}
          <div class="space-y-2">
            {probs.map((p, i) => (
              <div key={i}>
                <div class="mb-0.5 flex justify-between text-xs text-muted">
                  <span>class {i + 1}</span><span class="font-mono">{(p * 100).toFixed(1)}%</span>
                </div>
                <div class="h-4 w-full overflow-hidden rounded bg-surface-2">
                  <div class="h-full bg-brand" style={`width:${(p * 100).toFixed(1)}%`} />
                </div>
              </div>
            ))}
            <p class="text-xs text-muted">Probabilities always sum to 100% — that is what makes softmax a distribution.</p>
          </div>
        </div>
      )}
    </div>
  );
}
