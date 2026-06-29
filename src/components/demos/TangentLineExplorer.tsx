import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Interactive tangent-line explorer.
   - Pick a function: x², sin(x), or x³ − x.
   - Drag the point P along the curve (changes a).
   - Shrink h with the slider: the SECANT (sky) rotates into the
     TANGENT (emerald) as h → 0.
   - Live readout shows the secant slope converging on f'(a).
   Crisp, responsive canvas — same conventions as VectorPlayground.
   ------------------------------------------------------------------ */

type FnKey = 'square' | 'sin' | 'cubic';

const COLORS = {
  curve: '#4f46e5',   // indigo
  secant: '#0ea5e9',  // sky
  tangent: '#10b981', // emerald
  grid: 'rgba(128,128,128,0.18)',
  axis: 'rgba(128,128,128,0.5)',
};

const FUNCS: Record<FnKey, { label: string; f: (x: number) => number; df: (x: number) => number }> = {
  square: { label: 'f(x) = x²', f: (x) => x * x, df: (x) => 2 * x },
  sin: { label: 'f(x) = sin(x)', f: (x) => Math.sin(x), df: (x) => Math.cos(x) },
  cubic: { label: 'f(x) = x³ − x', f: (x) => x * x * x - x, df: (x) => 3 * x * x - 1 },
};

type Pt = { x: number; y: number };

export default function TangentLineExplorer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fnKey, setFnKey] = useState<FnKey>('square');
  const [a, setA] = useState(1);
  const [h, setH] = useState(2);
  const draggingRef = useRef(false);
  const sizeRef = useRef({ w: 480, h: 360, scale: 36, ox: 240, oy: 220 });

  const fn = FUNCS[fnKey];

  // ---- coordinate helpers (math space <-> pixels) ----
  const toPx = (p: Pt): Pt => {
    const { scale, ox, oy } = sizeRef.current;
    return { x: ox + p.x * scale, y: oy - p.y * scale };
  };
  const toMathX = (px: number): number => {
    const { scale, ox } = sizeRef.current;
    return (px - ox) / scale;
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h: H, scale, ox, oy } = sizeRef.current;
    ctx.clearRect(0, 0, w, H);

    // grid
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    for (let gx = ox % scale; gx < w; gx += scale) {
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke();
    }
    for (let gy = oy % scale; gy < H; gy += scale) {
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke();
    }
    // axes
    ctx.strokeStyle = COLORS.axis;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, oy); ctx.lineTo(w, oy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ox, 0); ctx.lineTo(ox, H); ctx.stroke();

    const xMin = toMathX(0);
    const xMax = toMathX(w);

    // ---- the curve ----
    ctx.strokeStyle = COLORS.curve;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    let started = false;
    for (let px = 0; px <= w; px += 2) {
      const mx = toMathX(px);
      const py = toPx({ x: mx, y: fn.f(mx) }).y;
      if (py < -2000 || py > H + 2000) { started = false; continue; }
      if (!started) { ctx.moveTo(px, py); started = true; } else { ctx.lineTo(px, py); }
    }
    ctx.stroke();

    const fa = fn.f(a);
    const P = { x: a, y: fa };

    // ---- secant line through P and Q = (a+h, f(a+h)) ----
    const b = a + h;
    const fb = fn.f(b);
    const Q = { x: b, y: fb };
    if (Math.abs(h) > 1e-9) {
      const secSlope = (fb - fa) / h;
      drawLineThrough(ctx, P, secSlope, xMin, xMax, toPx, COLORS.secant, 2.5, [7, 5]);
      // run / rise helper dashes
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(128,128,128,0.6)';
      ctx.lineWidth = 1.5;
      const Ppx = toPx(P);
      const Qpx = toPx(Q);
      ctx.beginPath(); ctx.moveTo(Ppx.x, Ppx.y); ctx.lineTo(Qpx.x, Ppx.y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(Qpx.x, Ppx.y); ctx.lineTo(Qpx.x, Qpx.y); ctx.stroke();
      ctx.setLineDash([]);
      // point Q
      dot(ctx, Qpx, COLORS.secant);
      label(ctx, Qpx, 'Q', COLORS.secant);
    }

    // ---- tangent line at P ----
    drawLineThrough(ctx, P, fn.df(a), xMin, xMax, toPx, COLORS.tangent, 3, []);

    // ---- draggable point P ----
    const Ppx = toPx(P);
    handle(ctx, Ppx, COLORS.tangent);
    label(ctx, Ppx, 'P', COLORS.tangent);
  };

  // ---- responsive sizing with devicePixelRatio ----
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
      const scale = Math.max(28, Math.min(52, w / 9));
      sizeRef.current = { w, h: ht, scale, ox: w / 2, oy: ht * 0.62 };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // redraw whenever state changes
  useEffect(draw, [fnKey, a, h]);

  // ---- pointer dragging (P moves horizontally along the curve) ----
  const pointer = (e: PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { px: e.clientX - rect.left, py: e.clientY - rect.top };
  };
  const clampSnapX = (x: number) => {
    const { w } = sizeRef.current;
    const xMin = toMathX(0) + 0.3;
    const xMax = toMathX(w) - 0.3;
    const snapped = Math.round(x * 10) / 10; // snap to nearest 0.1
    return Math.max(xMin, Math.min(xMax, snapped));
  };
  const onDown = (e: PointerEvent) => {
    const { px, py } = pointer(e);
    const Ppx = toPx({ x: a, y: fn.f(a) });
    if (Math.hypot(Ppx.x - px, Ppx.y - py) < 26) {
      draggingRef.current = true;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      e.preventDefault();
    }
  };
  const onMove = (e: PointerEvent) => {
    if (!draggingRef.current) return;
    const { px } = pointer(e);
    setA(clampSnapX(toMathX(px)));
  };
  const onUp = () => { draggingRef.current = false; };

  // ---- live numeric readout ----
  const fa = fn.f(a);
  const secSlope = Math.abs(h) > 1e-9 ? (fn.f(a + h) - fa) / h : NaN;
  const trueSlope = fn.df(a);
  const gap = Math.abs(secSlope - trueSlope);

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap gap-2">
        {(Object.keys(FUNCS) as FnKey[]).map((k) => (
          <button
            key={k}
            onClick={() => setFnKey(k)}
            class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              fnKey === k ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
            }`}
          >
            {FUNCS[k].label}
          </button>
        ))}
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
            Drag point <span style={`color:${COLORS.tangent}`} class="font-semibold">P</span> along the
            curve, then slide <strong>h</strong> toward 0.
          </p>

          <label class="block">
            <span class="mb-1 block text-muted">gap h = {h.toFixed(2)}</span>
            <input
              type="range" min={0.05} max={3} step={0.05} value={h}
              onInput={(e) => setH(parseFloat((e.target as HTMLInputElement).value))}
              class="w-full accent-[#0ea5e9]"
            />
          </label>

          <div class="grid grid-cols-2 gap-2">
            <Readout label="a" value={a.toFixed(2)} color={COLORS.tangent} />
            <Readout label="f(a)" value={fa.toFixed(2)} color={COLORS.curve} />
          </div>

          <div class="space-y-2 rounded-lg bg-surface-2 p-3">
            <div class="flex items-center justify-between">
              <span style={`color:${COLORS.secant}`} class="font-semibold">secant slope</span>
              <strong class="font-mono">{Number.isNaN(secSlope) ? '—' : secSlope.toFixed(3)}</strong>
            </div>
            <div class="flex items-center justify-between">
              <span style={`color:${COLORS.tangent}`} class="font-semibold">f′(a) (true)</span>
              <strong class="font-mono">{trueSlope.toFixed(3)}</strong>
            </div>
            <div class="flex items-center justify-between border-t border-border pt-2">
              <span class="text-muted">difference</span>
              <strong class="font-mono">{Number.isNaN(gap) ? '—' : gap.toFixed(3)}</strong>
            </div>
            <p class="mt-1 text-xs text-muted">
              {gap < 0.05
                ? 'h is tiny — the secant has become the tangent. That limit is the derivative.'
                : 'Shrink h: watch the sky secant rotate onto the emerald tangent.'}
            </p>
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

// ---- canvas drawing primitives ----
function drawLineThrough(
  ctx: CanvasRenderingContext2D,
  p: Pt,
  slope: number,
  xMin: number,
  xMax: number,
  toPx: (p: Pt) => Pt,
  color: string,
  width: number,
  dash: number[],
) {
  const y0 = p.y + slope * (xMin - p.x);
  const y1 = p.y + slope * (xMax - p.x);
  const a = toPx({ x: xMin, y: y0 });
  const b = toPx({ x: xMax, y: y1 });
  ctx.save();
  ctx.setLineDash(dash);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  ctx.restore();
}
function dot(ctx: CanvasRenderingContext2D, at: Pt, color: string) {
  ctx.beginPath(); ctx.arc(at.x, at.y, 5, 0, Math.PI * 2);
  ctx.fillStyle = color; ctx.fill();
}
function handle(ctx: CanvasRenderingContext2D, at: Pt, color: string) {
  ctx.beginPath(); ctx.arc(at.x, at.y, 7, 0, Math.PI * 2);
  ctx.fillStyle = '#fff'; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = color; ctx.stroke();
}
function label(ctx: CanvasRenderingContext2D, at: Pt, text: string, color: string) {
  ctx.font = '600 14px Inter, sans-serif';
  ctx.fillStyle = color;
  ctx.fillText(text, at.x + 10, at.y - 8);
}
