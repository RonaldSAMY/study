import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Interactive polynomial root builder.
   - Drag the root handles along the x-axis to build  f(x) = a·∏(x - rᵢ).
   - Slide the leading coefficient a (and flip its sign with reflect).
   - Add / remove roots (between 2 and 4).
   - The emerald curve, factored formula and end-behavior note update live.
   ------------------------------------------------------------------ */

const COLORS = {
  curve: '#10b981',   // emerald
  handle: '#4f46e5',  // indigo
  axis2: '#0ea5e9',   // sky (root tick guides)
  grid: 'rgba(128,128,128,0.18)',
  axis: 'rgba(128,128,128,0.5)',
};

// snap to nice half-integers, like VectorPlayground's toMath rounding
const snap = (v: number) => Math.round(v * 2) / 2;

export default function RootBuilderPlot() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [roots, setRoots] = useState<number[]>([-2, 1, 3]);
  const [a, setA] = useState(0.5);
  const dragRef = useRef<number | null>(null);
  // math space: x in [-5,5]; y range adapts each draw
  const sizeRef = useRef({ w: 480, h: 360, sx: 48, oy: 180, ox: 240, yScale: 36 });

  // ---- coordinate helpers (math <-> pixels) ----
  const X_HALF = 5; // show x from -5 to 5
  const xToPx = (x: number) => {
    const { ox, sx } = sizeRef.current;
    return ox + x * sx;
  };
  const yToPx = (y: number) => {
    const { oy, yScale } = sizeRef.current;
    return oy - y * yScale;
  };
  const pxToX = (px: number) => {
    const { ox, sx } = sizeRef.current;
    return (px - ox) / sx;
  };

  // evaluate f(x) = a · ∏(x - rᵢ)
  const f = (x: number) => {
    let y = a;
    for (const r of roots) y *= x - r;
    return y;
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h, ox } = sizeRef.current;

    // --- choose a y-range that keeps the curve visible ---
    let maxAbs = 0;
    for (let px = 0; px <= w; px += 2) {
      const x = pxToX(px);
      const y = Math.abs(f(x));
      if (Number.isFinite(y) && y > maxAbs) maxAbs = y;
    }
    // clamp so a wild curve doesn't flatten everything; keep some headroom
    const yHalf = Math.min(Math.max(maxAbs * 1.1, 2), 60);
    sizeRef.current.yScale = (h / 2) / yHalf;
    sizeRef.current.oy = h / 2;
    const { yScale, oy } = sizeRef.current;

    ctx.clearRect(0, 0, w, h);

    // grid (1 unit in x; adaptive step in y)
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    for (let gx = -X_HALF; gx <= X_HALF; gx++) {
      const px = xToPx(gx);
      ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, h); ctx.stroke();
    }
    const yStep = yHalf > 20 ? 10 : yHalf > 8 ? 5 : yHalf > 3 ? 2 : 1;
    for (let gy = yStep; gy < yHalf; gy += yStep) {
      let py = oy - gy * yScale;
      ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(w, py); ctx.stroke();
      py = oy + gy * yScale;
      ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(w, py); ctx.stroke();
    }

    // axes
    ctx.strokeStyle = COLORS.axis;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, oy); ctx.lineTo(w, oy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ox, 0); ctx.lineTo(ox, h); ctx.stroke();

    // curve
    ctx.strokeStyle = COLORS.curve;
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    let started = false;
    for (let px = 0; px <= w; px += 1.5) {
      const x = pxToX(px);
      const py = yToPx(f(x));
      // avoid drawing huge off-screen jumps
      const clamped = Math.max(-h * 2, Math.min(h * 3, py));
      if (!started) { ctx.moveTo(px, clamped); started = true; }
      else ctx.lineTo(px, clamped);
    }
    ctx.stroke();

    // root handles on the x-axis
    for (const r of roots) {
      const px = xToPx(r);
      // vertical guide
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(14,165,233,0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, h); ctx.stroke();
      ctx.setLineDash([]);
      // handle dot
      ctx.beginPath(); ctx.arc(px, oy, 8, 0, Math.PI * 2);
      ctx.fillStyle = '#fff'; ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = COLORS.handle; ctx.stroke();
      // label
      ctx.font = '600 12px Inter, sans-serif';
      ctx.fillStyle = COLORS.handle;
      ctx.fillText(`x=${fmt(r)}`, px + 10, oy + 20);
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
      const sx = w / (2 * X_HALF); // pixels per x-unit
      sizeRef.current = { w, h, sx, ox: w / 2, oy: h / 2, yScale: 36 };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // redraw whenever state changes
  useEffect(draw, [roots, a]);

  // ---- pointer dragging ----
  const pointer = (e: PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { px: e.clientX - rect.left, py: e.clientY - rect.top };
  };

  const onDown = (e: PointerEvent) => {
    const { px, py } = pointer(e);
    const { oy } = sizeRef.current;
    // pick the nearest root handle if close to the x-axis
    let best = -1;
    let bestDist = 22;
    roots.forEach((r, i) => {
      const d = Math.hypot(xToPx(r) - px, oy - py);
      if (d < bestDist) { bestDist = d; best = i; }
    });
    if (best >= 0) {
      dragRef.current = best;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      e.preventDefault();
    }
  };
  const onMove = (e: PointerEvent) => {
    if (dragRef.current === null) return;
    const { px } = pointer(e);
    const nx = Math.max(-X_HALF, Math.min(X_HALF, snap(pxToX(px))));
    setRoots((rs) => rs.map((r, i) => (i === dragRef.current ? nx : r)));
  };
  const onUp = () => { dragRef.current = null; };

  // ---- add / remove roots ----
  const addRoot = () => {
    setRoots((rs) => (rs.length >= 4 ? rs : [...rs, snap(Math.max(-4, Math.min(4, (rs[rs.length - 1] ?? 0) + 1.5)))]));
  };
  const removeRoot = () => {
    setRoots((rs) => (rs.length <= 2 ? rs : rs.slice(0, -1)));
  };

  // ---- end-behavior description ----
  const degree = roots.length;
  const evenDeg = degree % 2 === 0;
  const positive = a > 0;
  let leftDir: string, rightDir: string;
  if (evenDeg) {
    rightDir = positive ? 'rises' : 'falls';
    leftDir = rightDir; // both ends same way for even degree
  } else {
    rightDir = positive ? 'rises' : 'falls';
    leftDir = positive ? 'falls' : 'rises';
  }

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <button
          onClick={removeRoot}
          disabled={roots.length <= 2}
          class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted transition hover:text-text disabled:opacity-40"
        >
          − root
        </button>
        <button
          onClick={addRoot}
          disabled={roots.length >= 4}
          class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted transition hover:text-text disabled:opacity-40"
        >
          + root
        </button>
        <button
          onClick={() => setA((v) => -v)}
          class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white transition"
        >
          reflect (flip a)
        </button>
        <span class="ml-auto rounded-full bg-brand-soft px-3 py-0.5 text-xs font-semibold text-brand">
          degree {degree}
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
          <p class="text-muted">Drag the indigo dots along the x-axis to move the roots.</p>

          <div class="rounded-lg bg-surface-2 p-3">
            <span class="text-muted">f(x) =</span>
            <div class="mt-1 break-words font-mono font-semibold text-text">
              {fmtA(a)}{roots.map((r) => factor(r)).join('')}
            </div>
          </div>

          <label class="block">
            <span class="mb-1 block text-muted">leading coefficient a = {a.toFixed(2)}</span>
            <input
              type="range" min={-2} max={2} step={0.1} value={a}
              onInput={(e) => setA(parseFloat((e.target as HTMLInputElement).value))}
              class="w-full accent-[#10b981]"
            />
          </label>

          <div class="rounded-lg bg-surface-2 p-3">
            <div class="flex justify-between"><span class="text-muted">roots / x-intercepts</span><strong>{roots.length}</strong></div>
            <div class="mt-1 font-mono text-xs text-text">{roots.map(fmt).join(',  ')}</div>
            <p class="mt-2 text-xs text-muted">
              End behavior: as <strong>x → −∞</strong> the curve <strong>{leftDir}</strong>; as <strong>x → +∞</strong> it <strong>{rightDir}</strong>.
              {' '}(Degree {degree} is {evenDeg ? 'even' : 'odd'}, a is {positive ? 'positive' : 'negative'}.)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- formatting helpers ----
function fmt(v: number) {
  return Number.isInteger(v) ? `${v}` : v.toFixed(1);
}
function factor(r: number) {
  if (r === 0) return '(x)';
  return r > 0 ? `(x − ${fmt(r)})` : `(x + ${fmt(-r)})`;
}
function fmtA(a: number) {
  const r = Math.round(a * 100) / 100;
  if (r === 1) return '';
  if (r === -1) return '−';
  return `${fmt(r)} · `;
}
