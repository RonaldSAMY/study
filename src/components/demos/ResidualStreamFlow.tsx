import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Residual stream & gradient flow explorer.
   - Stack of L blocks. Each block's sub-layer has a local gradient
     factor f (the norm of its Jacobian).
   - Without skip connections, the gradient that reaches the bottom
     layer is f^L  → vanishes (f<1) or explodes (f>1).
   - With residual y = x + F(x), each block multiplies the gradient by
     roughly 1 + (f-1)·s (the identity path keeps it near 1), so the
     gradient survives all the way down.
   We plot gradient magnitude vs depth on a log scale for both cases.
   Canvas conventions copied from VectorPlayground.
   ------------------------------------------------------------------ */

const COLORS = {
  withSkip: '#10b981',
  noSkip: '#4f46e5',
  grid: 'rgba(128,128,128,0.18)',
  axis: 'rgba(128,128,128,0.5)',
};

// blend factor: how much the identity path pulls the per-layer multiplier toward 1
const SKIP_PULL = 0.15;

export default function ResidualStreamFlow() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [layers, setLayers] = useState(16);
  const [factor, setFactor] = useState(0.8);
  const [showSkip, setShowSkip] = useState(true);
  const sizeRef = useRef({ w: 520, h: 320 });

  // per-layer multipliers
  const noSkipMul = factor;
  const skipMul = 1 + (factor - 1) * SKIP_PULL;

  // gradient magnitude reaching depth d (d=0 at output, d=L at input)
  const gradNo = (d: number) => Math.pow(noSkipMul, d);
  const gradSkip = (d: number) => Math.pow(skipMul, d);

  const pad = { L: 46, R: 14, T: 16, B: 34 };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);

    const x0 = pad.L;
    const y0 = h - pad.B;
    const plotW = w - pad.L - pad.R;
    const plotH = h - pad.B - pad.T;

    // y-axis is log10 of gradient magnitude, clamp to a window
    const yMax = 2; // 10^2
    const yMin = -8; // 10^-8
    const toY = (g: number) => {
      const l = Math.log10(Math.max(g, 1e-30));
      const t = (l - yMin) / (yMax - yMin);
      return y0 - Math.min(1, Math.max(0, t)) * plotH;
    };
    const toX = (d: number) => x0 + (d / layers) * plotW;

    // grid + y labels (powers of 10)
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let e = yMin; e <= yMax; e += 2) {
      const y = toY(Math.pow(10, e));
      ctx.strokeStyle = COLORS.grid;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x0 + plotW, y); ctx.stroke();
      ctx.fillStyle = 'rgba(128,128,128,0.85)';
      ctx.fillText(`10^${e}`, x0 - 6, y);
    }
    // unity reference line
    const y1 = toY(1);
    ctx.strokeStyle = 'rgba(128,128,128,0.5)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(x0, y1); ctx.lineTo(x0 + plotW, y1); ctx.stroke();
    ctx.setLineDash([]);

    // axes
    ctx.strokeStyle = COLORS.axis;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x0, pad.T); ctx.lineTo(x0, y0); ctx.lineTo(x0 + plotW, y0); ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(128,128,128,0.85)';
    ctx.fillText('output', x0, y0 + 6);
    ctx.fillText('← depth (layers from output) →', x0 + plotW / 2, y0 + 18);
    ctx.fillText('input', x0 + plotW, y0 + 6);

    const plotCurve = (g: (d: number) => number, color: string) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let d = 0; d <= layers; d++) {
        const X = toX(d);
        const Y = toY(g(d));
        if (d === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
      }
      ctx.stroke();
      // end dot
      const X = toX(layers);
      const Y = toY(g(layers));
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(X, Y, 4.5, 0, Math.PI * 2); ctx.fill();
    };

    plotCurve(gradNo, COLORS.noSkip);
    if (showSkip) plotCurve(gradSkip, COLORS.withSkip);
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

  useEffect(draw, [layers, factor, showSkip]);

  const gNo = gradNo(layers);
  const gSkip = gradSkip(layers);
  const verdict =
    gNo < 1e-4
      ? 'vanished — early layers barely learn'
      : gNo > 1e2
      ? 'exploded — training is unstable'
      : 'healthy';

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setShowSkip((s) => !s)}
          class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
            showSkip ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
          }`}
        >
          {showSkip ? 'Skip connections: ON' : 'Skip connections: OFF'}
        </button>
        <span class="text-xs text-muted">Toggle to see what residuals buy you.</span>
      </div>

      <div class="grid gap-4 md:grid-cols-[1fr,auto] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

        <div class="space-y-3 text-sm md:w-56">
          <label class="block">
            <span class="mb-1 block text-muted">depth L = {layers} blocks</span>
            <input
              type="range" min={2} max={48} step={1} value={layers}
              onInput={(e) => setLayers(parseInt((e.target as HTMLInputElement).value))}
              class="w-full accent-[#4f46e5]"
            />
          </label>
          <label class="block">
            <span class="mb-1 block text-muted">sub-layer factor f = {factor.toFixed(2)}</span>
            <input
              type="range" min={0.5} max={1.2} step={0.01} value={factor}
              onInput={(e) => setFactor(parseFloat((e.target as HTMLInputElement).value))}
              class="w-full accent-[#0ea5e9]"
            />
          </label>

          <div class="grid grid-cols-1 gap-2">
            <Readout label="grad at input — no skip" color={COLORS.noSkip} value={fmt(gNo)} />
            {showSkip && (
              <Readout label="grad at input — with skip" color={COLORS.withSkip} value={fmt(gSkip)} />
            )}
          </div>
          <div class="rounded-lg bg-surface-2 p-3 text-xs">
            <span class="text-muted">No-skip gradient is </span>
            <strong>{verdict}</strong>.
            {showSkip && (
              <> The residual path keeps its gradient near <strong>1</strong>, so even very deep stacks train.</>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function fmt(x: number) {
  if (x === 0) return '0';
  if (x < 1e-3 || x >= 1e4) return x.toExponential(2);
  return x.toFixed(3);
}

function Readout({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div class="rounded-lg bg-surface-2 px-3 py-2">
      <span class="text-muted" style={color ? `color:${color}` : ''}>{label}</span>
      <div class="font-mono font-semibold">{value}</div>
    </div>
  );
}
