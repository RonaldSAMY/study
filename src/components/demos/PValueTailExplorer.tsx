import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   p-value tail explorer.
   - The bell curve is the sampling distribution of the test statistic
     ASSUMING the null hypothesis is true (a fair process).
   - Drag the observed statistic (emerald line). The shaded tail area
     is the p-value: the chance of data this extreme if the null holds.
   - Toggle one- vs two-tailed.
   ------------------------------------------------------------------ */

const COLORS = {
  curve: '#4f46e5',
  shade: 'rgba(16,185,129,0.35)',
  marker: '#10b981',
  crit: '#ef4444',
  axis: 'rgba(128,128,128,0.5)',
  grid: 'rgba(128,128,128,0.18)',
};

const XMIN = -4;
const XMAX = 4;

const pdf = (x: number) => Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);

// standard normal CDF via erf approximation (Abramowitz & Stegun 7.1.26)
function cdf(x: number) {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = pdf(x);
  const prob =
    d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return x >= 0 ? 1 - prob : prob;
}

export default function PValueTailExplorer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [z, setZ] = useState(1.6);
  const [twoTailed, setTwoTailed] = useState(false);
  const dragRef = useRef(false);
  const sizeRef = useRef({ w: 480, h: 300, pad: 36 });

  const xToPx = (x: number) => {
    const { w, pad } = sizeRef.current;
    return pad + ((x - XMIN) / (XMAX - XMIN)) * (w - 2 * pad);
  };
  const pxToX = (px: number) => {
    const { w, pad } = sizeRef.current;
    return XMIN + ((px - pad) / (w - 2 * pad)) * (XMAX - XMIN);
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h, pad } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);
    const baseY = h - 30;
    const peak = pdf(0);
    const yScale = (baseY - 24) / peak;
    const yToPx = (y: number) => baseY - y * yScale;

    // grid + x labels
    ctx.strokeStyle = COLORS.grid; ctx.lineWidth = 1;
    ctx.fillStyle = 'rgba(128,128,128,0.85)';
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'center';
    for (let x = XMIN; x <= XMAX; x++) {
      ctx.beginPath(); ctx.moveTo(xToPx(x), 18); ctx.lineTo(xToPx(x), baseY); ctx.stroke();
      ctx.fillText(`${x}`, xToPx(x), baseY + 16);
    }
    ctx.fillText('test statistic (σ from the null)', xToPx(0), baseY + 30);

    // shaded tail(s)
    const shadeTail = (from: number, to: number) => {
      ctx.fillStyle = COLORS.shade;
      ctx.beginPath();
      ctx.moveTo(xToPx(from), baseY);
      for (let px = xToPx(from); px <= xToPx(to); px += 2) {
        const x = pxToX(px);
        ctx.lineTo(px, yToPx(pdf(x)));
      }
      ctx.lineTo(xToPx(to), baseY);
      ctx.closePath();
      ctx.fill();
    };
    if (twoTailed) {
      shadeTail(Math.abs(z), XMAX);
      shadeTail(XMIN, -Math.abs(z));
    } else {
      shadeTail(z, XMAX);
    }

    // bell curve
    ctx.strokeStyle = COLORS.curve; ctx.lineWidth = 3; ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let px = xToPx(XMIN); px <= xToPx(XMAX); px += 2) {
      const x = pxToX(px);
      const Y = yToPx(pdf(x));
      if (px === xToPx(XMIN)) ctx.moveTo(px, Y); else ctx.lineTo(px, Y);
    }
    ctx.stroke();

    // axis baseline
    ctx.strokeStyle = COLORS.axis; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(xToPx(XMIN), baseY); ctx.lineTo(xToPx(XMAX), baseY); ctx.stroke();

    // critical line(s) at 5%
    const drawCrit = (cx: number) => {
      ctx.strokeStyle = COLORS.crit; ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(xToPx(cx), 18); ctx.lineTo(xToPx(cx), baseY); ctx.stroke();
      ctx.setLineDash([]);
    };
    if (twoTailed) { drawCrit(1.96); drawCrit(-1.96); } else { drawCrit(1.645); }

    // observed statistic (draggable)
    ctx.strokeStyle = COLORS.marker; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(xToPx(z), 14); ctx.lineTo(xToPx(z), baseY); ctx.stroke();
    ctx.beginPath(); ctx.arc(xToPx(z), yToPx(pdf(z)), 7, 0, Math.PI * 2);
    ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = COLORS.marker; ctx.stroke();
    ctx.fillStyle = COLORS.marker; ctx.font = '600 11px Inter, sans-serif';
    ctx.fillText('observed', xToPx(z), 10);
    ctx.textAlign = 'left';
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 600);
      const h = Math.round(Math.min(w * 0.6, 300));
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w, h, pad: 36 };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(draw, [z, twoTailed]);

  const pointer = (e: PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return e.clientX - rect.left;
  };
  const onDown = (e: PointerEvent) => {
    dragRef.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const x = Math.max(XMIN, Math.min(XMAX, pxToX(pointer(e))));
    setZ(Math.round(x * 100) / 100);
    e.preventDefault();
  };
  const onMove = (e: PointerEvent) => {
    if (!dragRef.current) return;
    const x = Math.max(XMIN, Math.min(XMAX, pxToX(pointer(e))));
    setZ(Math.round(x * 100) / 100);
  };
  const onUp = () => { dragRef.current = false; };

  const pVal = twoTailed ? 2 * (1 - cdf(Math.abs(z))) : 1 - cdf(z);
  const sig = pVal < 0.05;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap gap-2">
        {([false, true] as const).map((tt) => (
          <button
            key={String(tt)}
            onClick={() => setTwoTailed(tt)}
            class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              twoTailed === tt ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
            }`}
          >
            {tt ? 'two-tailed' : 'one-tailed'}
          </button>
        ))}
      </div>

      <canvas
        ref={canvasRef}
        class="touch-none rounded-xl bg-surface-2"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      />

      <div class="mt-3 grid grid-cols-3 gap-2 text-sm">
        <Readout label="observed" color={COLORS.marker} value={z.toFixed(2)} />
        <Readout label="p-value" value={pVal < 0.001 ? '< 0.001' : pVal.toFixed(3)} />
        <Readout label="vs α = 0.05" color={sig ? COLORS.marker : COLORS.crit} value={sig ? 'reject H₀' : 'keep H₀'} />
      </div>
      <p class="mt-2 rounded-lg bg-surface-2 p-3 text-xs text-muted">
        Drag the observed line. The shaded area is the p-value — the probability of a result at least this
        extreme if the null were true. Past the red 5% line, the tail shrinks below α and we reject H₀.
      </p>
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
