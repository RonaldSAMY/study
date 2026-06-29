import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Least-squares line fitter (crop yield vs fertilizer).
   - Drag the two emerald handles to tilt and shift the line.
   - Grey segments are residuals; the readout sums their squares (SSE).
   - "snap to best fit" jumps to the least-squares line (minimum SSE).
   ------------------------------------------------------------------ */

const COLORS = {
  point: '#0ea5e9',
  line: '#4f46e5',
  handle: '#10b981',
  resid: 'rgba(239,68,68,0.55)',
  axis: 'rgba(128,128,128,0.5)',
  grid: 'rgba(128,128,128,0.18)',
};

const XMIN = 0, XMAX = 10, YMIN = 0, YMAX = 12;
const XL = 1, XR = 9; // fixed x-positions of the two draggable handles

// fixed scatter: fertilizer (x) vs yield (y)
const DATA: { x: number; y: number }[] = [
  { x: 1, y: 3.0 }, { x: 2, y: 3.4 }, { x: 3, y: 5.1 }, { x: 4, y: 4.8 },
  { x: 5, y: 6.4 }, { x: 6, y: 6.1 }, { x: 7, y: 7.9 }, { x: 8, y: 7.3 },
  { x: 9, y: 9.2 }, { x: 5.5, y: 5.3 },
];

// least-squares slope/intercept
function bestFit() {
  const n = DATA.length;
  const mx = DATA.reduce((s, d) => s + d.x, 0) / n;
  const my = DATA.reduce((s, d) => s + d.y, 0) / n;
  let num = 0, den = 0;
  DATA.forEach((d) => { num += (d.x - mx) * (d.y - my); den += (d.x - mx) ** 2; });
  const slope = num / den;
  return { slope, intercept: my - slope * mx };
}

export default function LeastSquaresFitter() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // line stored as the two handle heights at x = XL and x = XR
  const [yL, setYL] = useState(2.5);
  const [yR, setYR] = useState(6.0);
  const dragRef = useRef<null | 'L' | 'R'>(null);
  const sizeRef = useRef({ w: 480, h: 340, pad: 38 });

  const slope = (yR - yL) / (XR - XL);
  const intercept = yL - slope * XL;
  const at = (x: number) => intercept + slope * x;

  const xToPx = (x: number) => {
    const { w, pad } = sizeRef.current;
    return pad + ((x - XMIN) / (XMAX - XMIN)) * (w - 2 * pad);
  };
  const yToPx = (y: number) => {
    const { h, pad } = sizeRef.current;
    return h - pad - ((y - YMIN) / (YMAX - YMIN)) * (h - 2 * pad);
  };
  const pxToY = (py: number) => {
    const { h, pad } = sizeRef.current;
    return YMIN + ((h - pad - py) / (h - 2 * pad)) * (YMAX - YMIN);
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h, pad } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);

    // grid
    ctx.strokeStyle = COLORS.grid; ctx.lineWidth = 1;
    ctx.fillStyle = 'rgba(128,128,128,0.85)';
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'center';
    for (let x = XMIN; x <= XMAX; x += 2) {
      ctx.beginPath(); ctx.moveTo(xToPx(x), pad); ctx.lineTo(xToPx(x), h - pad); ctx.stroke();
      ctx.fillText(`${x}`, xToPx(x), h - pad + 16);
    }
    ctx.textAlign = 'right';
    for (let y = YMIN; y <= YMAX; y += 3) {
      ctx.beginPath(); ctx.moveTo(pad, yToPx(y)); ctx.lineTo(w - pad, yToPx(y)); ctx.stroke();
      ctx.fillText(`${y}`, pad - 6, yToPx(y) + 4);
    }
    // axis labels
    ctx.textAlign = 'center';
    ctx.fillText('fertilizer (kg/plot)', (xToPx(XMIN) + xToPx(XMAX)) / 2, h - 6);

    // residuals
    ctx.strokeStyle = COLORS.resid; ctx.lineWidth = 2;
    DATA.forEach((d) => {
      ctx.beginPath();
      ctx.moveTo(xToPx(d.x), yToPx(d.y));
      ctx.lineTo(xToPx(d.x), yToPx(at(d.x)));
      ctx.stroke();
    });

    // line
    ctx.strokeStyle = COLORS.line; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(xToPx(XMIN), yToPx(at(XMIN)));
    ctx.lineTo(xToPx(XMAX), yToPx(at(XMAX)));
    ctx.stroke();

    // data points
    DATA.forEach((d) => {
      ctx.beginPath(); ctx.arc(xToPx(d.x), yToPx(d.y), 5, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.point; ctx.fill();
      ctx.lineWidth = 1.5; ctx.strokeStyle = '#fff'; ctx.stroke();
    });

    // handles
    [[XL, yL], [XR, yR]].forEach(([x, y]) => {
      ctx.beginPath(); ctx.arc(xToPx(x), yToPx(y), 8, 0, Math.PI * 2);
      ctx.fillStyle = '#fff'; ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = COLORS.handle; ctx.stroke();
    });
    ctx.textAlign = 'left';
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 600);
      const h = Math.round(Math.min(w * 0.72, 360));
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w, h, pad: 38 };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(draw, [yL, yR]);

  const pointer = (e: PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { px: e.clientX - rect.left, py: e.clientY - rect.top };
  };
  const onDown = (e: PointerEvent) => {
    const { px, py } = pointer(e);
    const dL = Math.hypot(xToPx(XL) - px, yToPx(yL) - py);
    const dR = Math.hypot(xToPx(XR) - px, yToPx(yR) - py);
    if (dL < 26 && dL <= dR) dragRef.current = 'L';
    else if (dR < 26) dragRef.current = 'R';
    if (dragRef.current) {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      e.preventDefault();
    }
  };
  const onMove = (e: PointerEvent) => {
    if (!dragRef.current) return;
    const { py } = pointer(e);
    const y = Math.max(YMIN, Math.min(YMAX, pxToY(py)));
    if (dragRef.current === 'L') setYL(y); else setYR(y);
  };
  const onUp = () => { dragRef.current = null; };

  const sse = DATA.reduce((s, d) => s + (d.y - at(d.x)) ** 2, 0);
  const fit = bestFit();
  const bestSse = DATA.reduce((s, d) => s + (d.y - (fit.intercept + fit.slope * d.x)) ** 2, 0);
  const snap = () => {
    setYL(fit.intercept + fit.slope * XL);
    setYR(fit.intercept + fit.slope * XR);
  };
  const atBest = Math.abs(sse - bestSse) < 0.02;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <button onClick={snap} class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white">snap to best fit</button>
        <span class="ml-auto rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold">yield vs fertilizer</span>
      </div>

      <canvas
        ref={canvasRef}
        class="touch-none rounded-xl bg-surface-2"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      />

      <div class="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <Readout label="slope" value={slope.toFixed(2)} />
        <Readout label="intercept" value={intercept.toFixed(2)} />
        <Readout label="SSE (your line)" color={atBest ? COLORS.handle : undefined} value={sse.toFixed(2)} />
        <Readout label="best SSE" color={COLORS.line} value={bestSse.toFixed(2)} />
      </div>
      <p class="mt-2 rounded-lg bg-surface-2 p-3 text-xs text-muted">
        {atBest
          ? 'This is the least-squares line: no other slope/intercept gives a smaller sum of squared residuals.'
          : 'Drag the handles to shrink the red residuals. Squaring punishes big misses most — chase the lowest SSE.'}
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
