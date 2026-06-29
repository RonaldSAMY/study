import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Interactive "limit zoom" explorer.
   - Plots f(x) = (x^2 - 1)/(x - 1), which equals x + 1 everywhere
     EXCEPT at x = 1, where it has a removable hole. The value heads
     toward L = 2 as x → 1, even though f is not defined AT x = 1.
   - Drag (or scrub) the indigo x-marker toward c = 1 and watch the
     readout for f(x) home in on 2.
   - The ZOOM slider magnifies the view around c, so the learner can
     literally watch the value approach the limit at finer scales.
   - "Approach from left / right" buttons surface the one-sided limits.
   Canvas conventions copied from VectorPlayground (dpr scaling,
   responsive resize, redraw-on-state, pointer drag, touch-none).
   ------------------------------------------------------------------ */

const C = 1; // the point we approach
const L = 2; // the value f heads toward
const f = (x: number) => x + 1; // = (x^2 - 1)/(x - 1) for x ≠ 1

const COLORS = {
  curve: '#10b981',
  marker: '#4f46e5',
  guide: '#0ea5e9',
  target: 'rgba(79,70,229,0.45)',
  grid: 'rgba(128,128,128,0.18)',
  axis: 'rgba(128,128,128,0.5)',
  text: 'rgba(120,120,130,0.95)',
};

type Pt = { x: number; y: number };

export default function LimitZoomExplorer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [xPos, setXPos] = useState(2.4); // current x of the marker
  const [zoomExp, setZoomExp] = useState(0); // zoom = 2^zoomExp
  const draggingRef = useRef(false);
  const sizeRef = useRef({ w: 480, h: 346, baseScale: 40 });

  const scaleFor = (z: number) => sizeRef.current.baseScale * Math.pow(2, z);
  const scale = () => scaleFor(zoomExp);
  const halfRangeX = () => sizeRef.current.w / 2 / scale();

  // ---- coordinate helpers (math space <-> pixels), centered on c ----
  const toPx = (p: Pt): Pt => {
    const { w, h } = sizeRef.current;
    const s = scale();
    return { x: w / 2 + (p.x - C) * s, y: h / 2 - (p.y - L) * s };
  };
  const toMathX = (px: number) => C + (px - sizeRef.current.w / 2) / scale();

  // keep the marker inside the visible window (zooming homes it in on c)
  const clampX = (x: number, z = zoomExp) => {
    const lim = (sizeRef.current.w / 2 / scaleFor(z)) * 0.9;
    return C + Math.max(-lim, Math.min(lim, x - C));
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    const s = scale();
    ctx.clearRect(0, 0, w, h);

    // visible math ranges
    const hx = w / 2 / s;
    const hy = h / 2 / s;
    const xMin = C - hx, xMax = C + hx;
    const yMin = L - hy, yMax = L + hy;

    // ---- adaptive grid ----
    const step = niceStep((xMax - xMin) / 7);
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    for (let gx = Math.ceil(xMin / step) * step; gx <= xMax; gx += step) {
      const px = toPx({ x: gx, y: 0 }).x;
      ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, h); ctx.stroke();
    }
    for (let gy = Math.ceil(yMin / step) * step; gy <= yMax; gy += step) {
      const py = toPx({ x: 0, y: gy }).y;
      ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(w, py); ctx.stroke();
    }

    // ---- true axes (only when the origin is in view) ----
    ctx.strokeStyle = COLORS.axis;
    ctx.lineWidth = 1.4;
    if (yMin <= 0 && yMax >= 0) {
      const py = toPx({ x: 0, y: 0 }).y;
      ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(w, py); ctx.stroke();
    }
    if (xMin <= 0 && xMax >= 0) {
      const px = toPx({ x: 0, y: 0 }).x;
      ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, h); ctx.stroke();
    }

    // ---- target cross-hair at (c, L) ----
    const cPx = toPx({ x: C, y: L });
    ctx.setLineDash([3, 4]);
    ctx.strokeStyle = COLORS.target;
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(cPx.x, 0); ctx.lineTo(cPx.x, h); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, cPx.y); ctx.lineTo(w, cPx.y); ctx.stroke();
    ctx.setLineDash([]);

    // ---- the curve f(x) = x + 1 ----
    ctx.strokeStyle = COLORS.curve;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let px = 0; px <= w; px++) {
      const mx = toMathX(px);
      const py = toPx({ x: mx, y: f(mx) }).y;
      if (px === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // ---- removable hole at (c, L): open circle ----
    ctx.beginPath();
    ctx.arc(cPx.x, cPx.y, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = COLORS.curve;
    ctx.stroke();

    // ---- the x-marker and its dashed guide lines ----
    const fx = f(xPos);
    const mPx = toPx({ x: xPos, y: fx });
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = COLORS.guide;
    ctx.lineWidth = 1.6;
    // vertical guide down to the x-axis side
    ctx.beginPath(); ctx.moveTo(mPx.x, mPx.y); ctx.lineTo(mPx.x, h); ctx.stroke();
    // horizontal guide across to the y-axis side
    ctx.beginPath(); ctx.moveTo(mPx.x, mPx.y); ctx.lineTo(0, mPx.y); ctx.stroke();
    ctx.setLineDash([]);

    // marker dot with white ring (the drag handle)
    ctx.beginPath(); ctx.arc(mPx.x, mPx.y, 7, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.marker; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = '#ffffff'; ctx.stroke();

    // value tags on the canvas
    ctx.font = '600 12px Inter, system-ui, sans-serif';
    ctx.fillStyle = COLORS.guide;
    ctx.fillText(`f(x) = ${fmt(fx)}`, 6, Math.max(14, mPx.y - 8));
    ctx.fillStyle = COLORS.marker;
    ctx.fillText(`x = ${fmt(xPos)}`, Math.min(w - 96, mPx.x + 8), h - 8);
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
      sizeRef.current = { w, h, baseScale: (w / 2) / 6 };
      setXPos((x) => clampX(x));
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // redraw on any state change
  useEffect(draw, [xPos, zoomExp]);

  // ---- pointer scrubbing (drag the marker along x) ----
  const pointerX = (e: PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return e.clientX - rect.left;
  };
  const onDown = (e: PointerEvent) => {
    draggingRef.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setXPos(clampX(toMathX(pointerX(e))));
    e.preventDefault();
  };
  const onMove = (e: PointerEvent) => {
    if (!draggingRef.current) return;
    setXPos(clampX(toMathX(pointerX(e))));
  };
  const onUp = () => { draggingRef.current = false; };

  // ---- button helpers ----
  const stepCloser = () =>
    setXPos((x) => {
      const off = x - C;
      const next = Math.abs(off) < 1e-6 ? (off >= 0 ? 0.5 : -0.5) : off / 2;
      return clampX(C + next);
    });
  const fromLeft = () => setXPos(clampX(C - Math.max(0.6, halfRangeX() * 0.7)));
  const fromRight = () => setXPos(clampX(C + Math.max(0.6, halfRangeX() * 0.7)));
  const onZoom = (v: number) => { setZoomExp(v); setXPos((x) => clampX(x, v)); };

  // ---- live values ----
  const off = xPos - C;
  const side = off < 0 ? 'left' : off > 0 ? 'right' : 'at';
  const eps = Math.max(1e-7, Math.abs(off));
  const fLeft = f(C - eps);
  const fRight = f(C + eps);
  const zoom = Math.pow(2, zoomExp);

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap gap-2">
        <button onClick={fromLeft}
          class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted transition hover:text-text">
          ← approach from left
        </button>
        <button onClick={fromRight}
          class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted transition hover:text-text">
          approach from right →
        </button>
        <button onClick={stepCloser}
          class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white transition hover:opacity-90">
          step ½ closer to 1
        </button>
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
          <p class="text-muted">
            Drag the indigo dot toward <strong class="text-text">x = 1</strong>, then crank the
            zoom. The green curve has an open <strong class="text-text">hole</strong> at x = 1 — yet
            the value still heads straight for 2.
          </p>

          <label class="block">
            <span class="mb-1 block text-muted">
              zoom around x = 1 · {zoom < 1000 ? `${zoom.toFixed(0)}×` : `${(zoom / 1000).toFixed(1)}k×`}
            </span>
            <input
              type="range" min={0} max={12} step={1} value={zoomExp}
              onInput={(e) => onZoom(parseInt((e.target as HTMLInputElement).value))}
              class="w-full accent-[#10b981]"
            />
          </label>

          <div class="grid grid-cols-2 gap-2">
            <Readout label="x" color={COLORS.marker} value={fmt(xPos)} />
            <Readout label="f(x)" color={COLORS.guide} value={fmt(f(xPos))} />
            <Readout label="distance |x − 1|" value={fmt(Math.abs(off))} />
            <Readout label="side" value={side === 'at' ? 'on the hole' : side} />
          </div>

          <div class="rounded-lg bg-brand-soft p-3">
            <div class="flex items-center justify-between">
              <span class="text-muted">as x → 1, &nbsp; f(x) →</span>
              <strong class="text-lg text-brand">{L}</strong>
            </div>
            <p class="mt-1 text-xs text-muted">
              The closer x gets to 1, the closer f(x) gets to 2 — from <em>either</em> side.
            </p>
          </div>

          <div class="grid grid-cols-2 gap-2 text-xs">
            <div class="rounded-lg bg-surface-2 px-3 py-2">
              <span class="text-muted">left limit · x → 1⁻</span>
              <div class="font-mono font-semibold">{fmt(fLeft)}</div>
            </div>
            <div class="rounded-lg bg-surface-2 px-3 py-2">
              <span class="text-muted">right limit · x → 1⁺</span>
              <div class="font-mono font-semibold">{fmt(fRight)}</div>
            </div>
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

// pick a "nice" 1/2/5 × 10^k step for the visible range
function niceStep(raw: number): number {
  if (!(raw > 0) || !isFinite(raw)) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const nice = norm < 1.5 ? 1 : norm < 3.5 ? 2 : norm < 7.5 ? 5 : 10;
  return nice * mag;
}

// format with enough precision to watch values home in on the limit
function fmt(n: number): string {
  if (!isFinite(n)) return '—';
  const a = Math.abs(n);
  if (a !== 0 && a < 1e-4) return n.toExponential(2);
  return n.toFixed(a < 10 ? 5 : 3);
}
