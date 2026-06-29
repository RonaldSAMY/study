import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Exponential growth vs. a log scale.
   - Slide the growth rate r in y = A·e^(r·t).
   - Toggle the vertical axis between LINEAR and LOGARITHMIC.
   - On a linear axis exponentials shoot off the chart; on a log axis
     the very same curve becomes a straight line — the trick behind
     Richter and decibel scales.
   Crisp, responsive canvas — same conventions as VectorPlayground.
   ------------------------------------------------------------------ */

const COLORS = {
  curve: '#4f46e5',   // indigo
  accent: '#10b981',  // emerald
  grid: 'rgba(128,128,128,0.18)',
  axis: 'rgba(128,128,128,0.5)',
};

const A = 1;       // starting amount
const T_MAX = 10;  // time span

export default function ExponentialGrowthLogScale() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [r, setR] = useState(0.4);
  const [logScale, setLogScale] = useState(false);
  const sizeRef = useRef({ w: 480, h: 360, padL: 44, padB: 30, padT: 16, padR: 16 });

  const value = (t: number) => A * Math.exp(r * t);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h, padL, padB, padT, padR } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);

    const plotW = w - padL - padR;
    const plotH = h - padT - padB;
    const x0 = padL;
    const yBase = padT + plotH; // bottom

    // value range
    const vMaxLin = Math.max(value(T_MAX), value(0), 2);
    // for log scale we plot log10(value); pick bounds covering the data
    const logMin = Math.min(Math.log10(value(0)), Math.log10(value(T_MAX)), -1);
    const logMax = Math.max(Math.log10(value(0)), Math.log10(value(T_MAX)), 1);

    const tx = (t: number) => x0 + (t / T_MAX) * plotW;
    const ty = (v: number) => {
      if (logScale) {
        const lg = Math.log10(Math.max(v, 1e-6));
        return yBase - ((lg - logMin) / (logMax - logMin)) * plotH;
      }
      return yBase - (v / vMaxLin) * plotH;
    };

    // grid + y labels
    ctx.strokeStyle = COLORS.grid; ctx.lineWidth = 1;
    ctx.font = '11px Inter, sans-serif'; ctx.fillStyle = 'rgba(128,128,128,0.9)';
    const ticks = 5;
    for (let i = 0; i <= ticks; i++) {
      const yy = yBase - (i / ticks) * plotH;
      ctx.beginPath(); ctx.moveTo(x0, yy); ctx.lineTo(x0 + plotW, yy); ctx.stroke();
      let labelVal: number;
      if (logScale) {
        const lg = logMin + (i / ticks) * (logMax - logMin);
        labelVal = Math.pow(10, lg);
      } else {
        labelVal = (i / ticks) * vMaxLin;
      }
      ctx.fillText(fmtAxis(labelVal), 4, yy + 4);
    }
    // x axis labels
    for (let t = 0; t <= T_MAX; t += 2) {
      ctx.fillText(String(t), tx(t) - 4, yBase + 18);
    }

    // axes
    ctx.strokeStyle = COLORS.axis; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x0, padT); ctx.lineTo(x0, yBase); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x0, yBase); ctx.lineTo(x0 + plotW, yBase); ctx.stroke();

    // the curve
    ctx.strokeStyle = COLORS.curve; ctx.lineWidth = 3;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    let started = false;
    for (let px = 0; px <= plotW; px += 2) {
      const t = (px / plotW) * T_MAX;
      const yy = ty(value(t));
      if (yy < padT - 2000 || yy > yBase + 2000) { started = false; continue; }
      if (!started) { ctx.moveTo(x0 + px, yy); started = true; } else { ctx.lineTo(x0 + px, yy); }
    }
    ctx.stroke();

    // axis caption
    ctx.fillStyle = COLORS.accent; ctx.font = '600 12px Inter, sans-serif';
    ctx.fillText(logScale ? 'log scale → straight line' : 'linear scale → curve', x0 + 8, padT + 14);
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

  useEffect(draw, [r, logScale]);

  const doubling = r > 0 ? Math.log(2) / r : NaN;
  const halfLife = r < 0 ? Math.log(2) / -r : NaN;
  const finalVal = value(T_MAX);

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap gap-2">
        <button
          onClick={() => setLogScale(false)}
          class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
            !logScale ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
          }`}
        >
          Linear scale
        </button>
        <button
          onClick={() => setLogScale(true)}
          class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
            logScale ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
          }`}
        >
          Log scale
        </button>
      </div>

      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

        <div class="space-y-3 text-sm">
          <p class="text-muted">
            Curve is <span class="font-mono">y = e^(r·t)</span>. Slide the growth rate, then flip the
            vertical axis between linear and log.
          </p>

          <label class="block">
            <span class="mb-1 block text-muted">growth rate r = {r.toFixed(2)} {r < 0 ? '(decay)' : r > 0 ? '(growth)' : ''}</span>
            <input
              type="range" min={-0.5} max={0.8} step={0.02} value={r}
              onInput={(e) => setR(parseFloat((e.target as HTMLInputElement).value))}
              class="w-full"
              style={`accent-color:${COLORS.curve}`}
            />
          </label>

          <div class="space-y-1 rounded-lg bg-surface-2 p-3">
            <div class="flex items-center justify-between">
              <span class="text-muted">value at t = {T_MAX}</span>
              <strong class="font-mono">{fmtAxis(finalVal)}×</strong>
            </div>
            <div class="flex items-center justify-between border-t border-border pt-1">
              <span class="text-muted">{r >= 0 ? 'doubling time' : 'half-life'}</span>
              <strong class="font-mono">
                {r > 0 ? `${doubling.toFixed(2)}` : r < 0 ? `${halfLife.toFixed(2)}` : '—'}
              </strong>
            </div>
            <p class="mt-1 text-xs text-muted">
              {logScale
                ? 'On a log axis, equal vertical steps mean equal multiplications — so exponential growth looks perfectly straight, and the slope is r.'
                : 'On a linear axis, the curve bends sharply upward (or decays toward zero). Same data, very different picture.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function fmtAxis(x: number) {
  if (x >= 1000) return x.toExponential(1);
  if (x >= 10) return x.toFixed(0);
  if (x >= 1) return x.toFixed(1);
  return x.toFixed(2);
}
