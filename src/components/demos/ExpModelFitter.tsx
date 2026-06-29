import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Interactive exponential-model fitter.
   - Fixed scatter of sample data (weekly viral case counts).
   - Drag sliders for the initial amount a and the growth rate k to
     fit the model y = a * e^(k*t) over the points.
   - Live "fit error" (sum of squared residuals) shrinks as you improve.
   - Toggle "log scale (y)": the exponential straightens into a line.
   ------------------------------------------------------------------ */

const COLORS = {
  model: '#10b981',  // emerald — fitted curve
  data: '#4f46e5',   // indigo — data points
  accent: '#0ea5e9', // sky — secondary
  grid: 'rgba(128,128,128,0.18)',
  axis: 'rgba(128,128,128,0.55)',
  text: 'rgba(128,128,128,0.9)',
};

// Fixed sample data: weekly reported cases (roughly y = 8 * e^(0.55 t) + noise).
const DATA: { t: number; y: number }[] = [
  { t: 0, y: 9 },
  { t: 1, y: 13 },
  { t: 2, y: 26 },
  { t: 3, y: 41 },
  { t: 4, y: 78 },
  { t: 5, y: 121 },
  { t: 6, y: 230 },
  { t: 7, y: 360 },
  { t: 8, y: 640 },
];

const T_MAX = 8;
const Y_MAX = 700;          // top of the linear y-axis
const Y_MIN_LOG = 1;        // bottom of the log y-axis

export default function ExpModelFitter() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [a, setA] = useState(8);
  const [k, setK] = useState(0.4);
  const [logScale, setLogScale] = useState(false);
  const sizeRef = useRef({ w: 480, h: 360, padL: 48, padR: 16, padT: 16, padB: 36 });

  // ---- coordinate helpers (data space -> pixels) ----
  const xPx = (t: number) => {
    const { w, padL, padR } = sizeRef.current;
    const plotW = w - padL - padR;
    return padL + (t / T_MAX) * plotW;
  };
  const yPx = (y: number) => {
    const { h, padT, padB } = sizeRef.current;
    const plotH = h - padT - padB;
    if (logScale) {
      const lo = Math.log10(Y_MIN_LOG);
      const hi = Math.log10(Y_MAX);
      const v = Math.log10(Math.max(y, 1e-6));
      const frac = (v - lo) / (hi - lo);
      return padT + plotH * (1 - Math.min(1, Math.max(0, frac)));
    }
    const frac = y / Y_MAX;
    return padT + plotH * (1 - Math.min(1, Math.max(0, frac)));
  };

  const model = (t: number) => a * Math.exp(k * t);

  // Sum of squared residuals between data and current model.
  const sse = DATA.reduce((acc, d) => {
    const r = d.y - model(d.t);
    return acc + r * r;
  }, 0);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h, padL, padR, padT, padB } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);

    const plotLeft = padL;
    const plotRight = w - padR;
    const plotTop = padT;
    const plotBottom = h - padB;

    ctx.font = '11px Inter, sans-serif';
    ctx.textBaseline = 'middle';

    // ---- horizontal grid + y labels ----
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    const yTicks = logScale ? [1, 10, 100, 700] : [0, 175, 350, 525, 700];
    ctx.fillStyle = COLORS.text;
    ctx.textAlign = 'right';
    for (const yt of yTicks) {
      const py = yPx(yt);
      ctx.beginPath();
      ctx.moveTo(plotLeft, py);
      ctx.lineTo(plotRight, py);
      ctx.stroke();
      ctx.fillText(String(yt), plotLeft - 6, py);
    }

    // ---- vertical grid + x labels ----
    ctx.textAlign = 'center';
    for (let t = 0; t <= T_MAX; t += 2) {
      const px = xPx(t);
      ctx.strokeStyle = COLORS.grid;
      ctx.beginPath();
      ctx.moveTo(px, plotTop);
      ctx.lineTo(px, plotBottom);
      ctx.stroke();
      ctx.fillStyle = COLORS.text;
      ctx.fillText(`${t}`, px, plotBottom + 14);
    }

    // ---- axes ----
    ctx.strokeStyle = COLORS.axis;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(plotLeft, plotTop);
    ctx.lineTo(plotLeft, plotBottom);
    ctx.lineTo(plotRight, plotBottom);
    ctx.stroke();

    // axis titles
    ctx.fillStyle = COLORS.text;
    ctx.textAlign = 'center';
    ctx.fillText('week (t)', (plotLeft + plotRight) / 2, h - 4);

    // ---- model curve (emerald) ----
    ctx.strokeStyle = COLORS.model;
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    let started = false;
    for (let i = 0; i <= 120; i++) {
      const t = (i / 120) * T_MAX;
      const px = xPx(t);
      const py = yPx(model(t));
      if (py < plotTop - 40 || py > plotBottom + 40) {
        // keep clipping graceful but still continue the path
      }
      if (!started) {
        ctx.moveTo(px, py);
        started = true;
      } else {
        ctx.lineTo(px, py);
      }
    }
    ctx.stroke();

    // ---- residual lines + data points (indigo) ----
    for (const d of DATA) {
      const px = xPx(d.t);
      const pyData = yPx(d.y);
      const pyModel = yPx(model(d.t));
      // residual
      ctx.strokeStyle = 'rgba(14,165,233,0.45)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(px, pyData);
      ctx.lineTo(px, pyModel);
      ctx.stroke();
      ctx.setLineDash([]);
      // point
      ctx.beginPath();
      ctx.arc(px, pyData, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.data;
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#fff';
      ctx.stroke();
    }
  };

  // ---- responsive sizing with devicePixelRatio ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 560);
      const h = Math.round(w * 0.72);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w, h, padL: 48, padR: 16, padT: 16, padB: 36 };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // redraw whenever state changes
  useEffect(draw, [a, k, logScale]);

  // a friendly quality message based on the error
  const quality =
    sse < 2000
      ? 'Excellent fit! 🎯'
      : sse < 20000
      ? 'Getting close — keep tuning.'
      : sse < 100000
      ? 'Warmer…'
      : 'Way off — try adjusting k.';

  // doubling time of the current model (if growing)
  const doubling = k > 0 ? Math.log(2) / k : null;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setLogScale((v) => !v)}
          class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
            logScale ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
          }`}
        >
          {logScale ? 'log scale (y) ✓' : 'log scale (y)'}
        </button>
        <span class="text-xs text-muted">
          {logScale ? 'Log axis — the exponential becomes a straight line.' : 'Linear axis — the exponential curves upward.'}
        </span>
      </div>

      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

        <div class="space-y-4 text-sm">
          <p class="text-muted">
            Slide <span style={`color:${COLORS.model}`} class="font-semibold">a</span> and{' '}
            <span style={`color:${COLORS.model}`} class="font-semibold">k</span> to fit the curve{' '}
            <span class="font-mono">y = a·e^(k·t)</span> to the{' '}
            <span style={`color:${COLORS.data}`} class="font-semibold">data points</span>.
          </p>

          <label class="block">
            <span class="mb-1 block text-muted">initial amount a = {a.toFixed(1)}</span>
            <input
              type="range" min={1} max={30} step={0.5} value={a}
              onInput={(e) => setA(parseFloat((e.target as HTMLInputElement).value))}
              class="w-full accent-[#10b981]"
            />
          </label>

          <label class="block">
            <span class="mb-1 block text-muted">growth rate k = {k.toFixed(2)}</span>
            <input
              type="range" min={-0.2} max={1} step={0.01} value={k}
              onInput={(e) => setK(parseFloat((e.target as HTMLInputElement).value))}
              class="w-full accent-[#10b981]"
            />
          </label>

          <div class="rounded-lg bg-surface-2 p-3">
            <div class="flex justify-between">
              <span class="text-muted">fit error (SSE)</span>
              <strong class="font-mono">{sse.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong>
            </div>
            <p class="mt-1 text-xs text-muted">{quality}</p>
            {doubling && (
              <p class="mt-1 text-xs text-muted">
                doubling time ≈ <strong>{doubling.toFixed(2)}</strong> weeks
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
