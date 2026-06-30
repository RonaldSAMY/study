import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Interactive 1D logistic-regression playground.
   - Drag points horizontally along the x-axis; click a point to flip
     its class (class 0 = sky, class 1 = indigo).
   - Sliders set the weight w and bias b.
   - The sigmoid curve sigma(w·x + b) is drawn over a probability axis
     (0..1), with a p = 0.5 line and the vertical decision boundary.
   - Live readouts: w, b, boundary x, and average log-loss.
   - "Fit (gradient step)" runs a few gradient-descent steps on w, b.
   ------------------------------------------------------------------ */

type Pt = { x: number; y: 0 | 1 };

const COLORS = {
  c0: '#0ea5e9', // sky  -> class 0
  c1: '#4f46e5', // indigo -> class 1
  curve: '#10b981', // emerald
  grid: 'rgba(128,128,128,0.18)',
  axis: 'rgba(128,128,128,0.5)',
  half: 'rgba(128,128,128,0.6)',
  boundary: '#10b981',
};

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

const initialPoints = (): Pt[] => [
  { x: -4.2, y: 0 },
  { x: -3.0, y: 0 },
  { x: -1.8, y: 0 },
  { x: -0.6, y: 1 },
  { x: 1.0, y: 0 },
  { x: 1.6, y: 1 },
  { x: 2.8, y: 1 },
  { x: 4.0, y: 1 },
];

export default function SigmoidLogisticLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [points, setPoints] = useState<Pt[]>(initialPoints());
  const [w, setW] = useState(1.2);
  const [b, setB] = useState(-0.3);
  const dragRef = useRef<number | null>(null);
  const movedRef = useRef(false);
  // math x-range and pixel geometry
  const sizeRef = useRef({ w: 480, h: 320, padL: 44, padR: 16, padT: 16, padB: 36, xMin: -6, xMax: 6 });

  // ---- coordinate helpers (math <-> pixels) ----
  const xToPx = (x: number) => {
    const { w: cw, padL, padR, xMin, xMax } = sizeRef.current;
    const plotW = cw - padL - padR;
    return padL + ((x - xMin) / (xMax - xMin)) * plotW;
  };
  const pxToX = (px: number) => {
    const { w: cw, padL, padR, xMin, xMax } = sizeRef.current;
    const plotW = cw - padL - padR;
    return xMin + ((px - padL) / plotW) * (xMax - xMin);
  };
  const pToPy = (p: number) => {
    const { h: ch, padT, padB } = sizeRef.current;
    const plotH = ch - padT - padB;
    return padT + (1 - p) * plotH; // p=1 at top, p=0 at bottom
  };

  // ---- log-loss (binary cross-entropy), averaged over points ----
  const logLoss = (() => {
    if (points.length === 0) return 0;
    let sum = 0;
    for (const pt of points) {
      const p = sigmoid(w * pt.x + b);
      const pc = Math.min(1 - 1e-7, Math.max(1e-7, p));
      sum += -(pt.y * Math.log(pc) + (1 - pt.y) * Math.log(1 - pc));
    }
    return sum / points.length;
  })();

  const boundaryX = Math.abs(w) < 1e-6 ? null : -b / w;

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w: cw, h: ch, padL, padR, padT, padB, xMin, xMax } = sizeRef.current;
    ctx.clearRect(0, 0, cw, ch);

    const plotLeft = padL;
    const plotRight = cw - padR;
    const yTop = pToPy(1);
    const yBot = pToPy(0);

    // grid: horizontal probability lines
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.font = '11px Inter, sans-serif';
    ctx.fillStyle = 'rgba(128,128,128,0.85)';
    for (const p of [0, 0.25, 0.5, 0.75, 1]) {
      const y = pToPy(p);
      ctx.beginPath(); ctx.moveTo(plotLeft, y); ctx.lineTo(plotRight, y); ctx.stroke();
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      ctx.fillText(p.toFixed(2), plotLeft - 6, y);
    }
    // vertical x grid + labels at integers
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (let gx = Math.ceil(xMin); gx <= Math.floor(xMax); gx += 2) {
      const px = xToPx(gx);
      ctx.strokeStyle = COLORS.grid;
      ctx.beginPath(); ctx.moveTo(px, yTop); ctx.lineTo(px, yBot); ctx.stroke();
      ctx.fillText(String(gx), px, yBot + 6);
    }

    // axis baseline (p = 0)
    ctx.strokeStyle = COLORS.axis; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(plotLeft, yBot); ctx.lineTo(plotRight, yBot); ctx.stroke();

    // p = 0.5 reference line (dashed)
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = COLORS.half; ctx.lineWidth = 1.25;
    const yHalf = pToPy(0.5);
    ctx.beginPath(); ctx.moveTo(plotLeft, yHalf); ctx.lineTo(plotRight, yHalf); ctx.stroke();
    ctx.setLineDash([]);

    // decision boundary (vertical line where w·x + b = 0)
    if (boundaryX !== null && boundaryX >= xMin && boundaryX <= xMax) {
      const bx = xToPx(boundaryX);
      ctx.strokeStyle = COLORS.boundary; ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(bx, yTop); ctx.lineTo(bx, yBot); ctx.stroke();
      ctx.setLineDash([]);
    }

    // sigmoid curve
    ctx.strokeStyle = COLORS.curve; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath();
    let first = true;
    for (let px = plotLeft; px <= plotRight; px += 1) {
      const x = pxToX(px);
      const p = sigmoid(w * x + b);
      const y = pToPy(p);
      if (first) { ctx.moveTo(px, y); first = false; } else { ctx.lineTo(px, y); }
    }
    ctx.stroke();

    // data points (plotted at their true class height 0 or 1)
    for (const pt of points) {
      const px = xToPx(pt.x);
      const py = pToPy(pt.y);
      const color = pt.y === 1 ? COLORS.c1 : COLORS.c0;
      ctx.beginPath(); ctx.arc(px, py, 7, 0, Math.PI * 2);
      ctx.fillStyle = '#fff'; ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = color; ctx.stroke();
    }
  };

  // ---- responsive sizing with devicePixelRatio ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const cw = Math.min(parent.clientWidth, 560);
      const ch = Math.round(cw * 0.66);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = cw * dpr;
      canvas.height = ch * dpr;
      canvas.style.width = `${cw}px`;
      canvas.style.height = `${ch}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { ...sizeRef.current, w: cw, h: ch };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // redraw whenever state changes
  useEffect(draw, [points, w, b]);

  // ---- pointer interaction: drag horizontally, click to toggle class ----
  const pointer = (e: PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { px: e.clientX - rect.left, py: e.clientY - rect.top };
  };

  const nearestPoint = (px: number, py: number) => {
    let best = -1;
    let bestD = 20; // hit radius in px
    points.forEach((pt, i) => {
      const d = Math.hypot(xToPx(pt.x) - px, pToPy(pt.y) - py);
      if (d < bestD) { bestD = d; best = i; }
    });
    return best;
  };

  const onDown = (e: PointerEvent) => {
    const { px, py } = pointer(e);
    const i = nearestPoint(px, py);
    if (i >= 0) {
      dragRef.current = i;
      movedRef.current = false;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      e.preventDefault();
    }
  };
  const onMove = (e: PointerEvent) => {
    const i = dragRef.current;
    if (i === null) return;
    const { px } = pointer(e);
    const { xMin, xMax } = sizeRef.current;
    const nx = Math.min(xMax, Math.max(xMin, Math.round(pxToX(px) * 10) / 10));
    movedRef.current = true;
    setPoints((ps) => ps.map((p, idx) => (idx === i ? { ...p, x: nx } : p)));
  };
  const onUp = () => {
    const i = dragRef.current;
    if (i !== null && !movedRef.current) {
      // a click without dragging toggles the class
      setPoints((ps) => ps.map((p, idx) => (idx === i ? { ...p, y: (p.y === 1 ? 0 : 1) as 0 | 1 } : p)));
    }
    dragRef.current = null;
  };

  // ---- one batch of gradient-descent steps to reduce the loss ----
  const fitStep = () => {
    let cw = w;
    let cb = b;
    const lr = 0.5;
    const n = points.length || 1;
    for (let step = 0; step < 12; step++) {
      let gw = 0;
      let gb = 0;
      for (const pt of points) {
        const p = sigmoid(cw * pt.x + cb);
        const err = p - pt.y; // gradient of BCE w.r.t. z
        gw += err * pt.x;
        gb += err;
      }
      cw -= (lr * gw) / n;
      cb -= (lr * gb) / n;
    }
    setW(Math.round(cw * 100) / 100);
    setB(Math.round(cb * 100) / 100);
  };

  const reset = () => {
    setPoints(initialPoints());
    setW(1.2);
    setB(-0.3);
  };

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <button
          onClick={fitStep}
          class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white transition hover:opacity-90"
        >
          Fit (gradient step)
        </button>
        <button
          onClick={reset}
          class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted transition hover:text-text"
        >
          Reset
        </button>
        <span class="ml-auto flex items-center gap-3 text-xs text-muted">
          <span class="flex items-center gap-1">
            <span class="inline-block h-3 w-3 rounded-full border-2" style={`border-color:${COLORS.c0}`} /> class 0
          </span>
          <span class="flex items-center gap-1">
            <span class="inline-block h-3 w-3 rounded-full border-2" style={`border-color:${COLORS.c1}`} /> class 1
          </span>
        </span>
      </div>

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
          <p class="text-muted">Drag points sideways; click a point to flip its class.</p>

          <label class="block">
            <span class="mb-1 block text-muted">weight w = {w.toFixed(2)}</span>
            <input
              type="range" min={-5} max={5} step={0.05} value={w}
              onInput={(e) => setW(parseFloat((e.target as HTMLInputElement).value))}
              class="w-full accent-[#4f46e5]"
            />
          </label>
          <label class="block">
            <span class="mb-1 block text-muted">bias b = {b.toFixed(2)}</span>
            <input
              type="range" min={-5} max={5} step={0.05} value={b}
              onInput={(e) => setB(parseFloat((e.target as HTMLInputElement).value))}
              class="w-full accent-[#0ea5e9]"
            />
          </label>

          <div class="grid grid-cols-2 gap-2">
            <Readout label="w" value={w.toFixed(2)} color={COLORS.c1} />
            <Readout label="b" value={b.toFixed(2)} color={COLORS.c0} />
            <Readout label="boundary x" value={boundaryX === null ? '—' : boundaryX.toFixed(2)} />
            <Readout label="avg log-loss" value={logLoss.toFixed(3)} color={COLORS.curve} />
          </div>

          <p class="rounded-lg bg-surface-2 p-3 text-xs text-muted">
            Press <strong class="text-text">Fit</strong> a few times: watch w and b shift the curve so the
            boundary lands between the two classes and the log-loss drops.
          </p>
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
