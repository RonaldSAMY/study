import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Rasterize a triangle onto a coarse pixel grid.
   - Drag the three vertices (indigo / sky / emerald).
   - Every grid cell whose CENTER is inside all three edge functions
     gets filled.
   - Toggle barycentric color interpolation (blend the 3 vertex colors).
   - Live filled-pixel count readout.
   ------------------------------------------------------------------ */

type Pt = { x: number; y: number };

const VCOLORS = ['#4f46e5', '#0ea5e9', '#10b981'];
const VRGB = [
  [79, 70, 229],
  [14, 165, 233],
  [16, 185, 129],
];

export default function TrianglePixelRasterizer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // vertices stored in [0,1] fractional canvas coords
  const [verts, setVerts] = useState<Pt[]>([
    { x: 0.18, y: 0.74 },
    { x: 0.82, y: 0.58 },
    { x: 0.46, y: 0.16 },
  ]);
  const [interp, setInterp] = useState(false);
  const [filled, setFilled] = useState(0);
  const dragRef = useRef<number | null>(null);
  const sizeRef = useRef({ w: 520, h: 380, m: 16 });

  const toPx = (p: Pt): Pt => {
    const { w, h, m } = sizeRef.current;
    return { x: m + p.x * (w - 2 * m), y: m + p.y * (h - 2 * m) };
  };
  const toFrac = (px: number, py: number): Pt => {
    const { w, h, m } = sizeRef.current;
    return {
      x: clamp01((px - m) / (w - 2 * m)),
      y: clamp01((py - m) / (h - 2 * m)),
    };
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h, m } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);

    const tri = verts.map(toPx);

    const drawW = w - 2 * m;
    const drawH = h - 2 * m;
    const cols = 20;
    const cell = drawW / cols;
    const rows = Math.floor(drawH / cell);
    const gx0 = m;
    const gy0 = m;

    let count = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const ccx = gx0 + (c + 0.5) * cell;
        const ccy = gy0 + (r + 0.5) * cell;
        const e0 = edge(tri[0], tri[1], { x: ccx, y: ccy });
        const e1 = edge(tri[1], tri[2], { x: ccx, y: ccy });
        const e2 = edge(tri[2], tri[0], { x: ccx, y: ccy });
        const isIn = (e0 >= 0 && e1 >= 0 && e2 >= 0) || (e0 <= 0 && e1 <= 0 && e2 <= 0);
        if (!isIn) continue;
        count++;
        if (interp) {
          const bc = bary(tri[0], tri[1], tri[2], { x: ccx, y: ccy });
          ctx.fillStyle = mixColor(bc);
        } else {
          ctx.fillStyle = 'rgba(79,70,229,0.55)';
        }
        ctx.fillRect(gx0 + c * cell + 0.5, gy0 + r * cell + 0.5, cell - 1, cell - 1);
      }
    }
    if (count !== filled) setFilled(count);

    // grid lines on top (faint)
    ctx.strokeStyle = 'rgba(128,128,128,0.16)';
    ctx.lineWidth = 1;
    for (let c = 0; c <= cols; c++) {
      ctx.beginPath();
      ctx.moveTo(gx0 + c * cell, gy0);
      ctx.lineTo(gx0 + c * cell, gy0 + rows * cell);
      ctx.stroke();
    }
    for (let r = 0; r <= rows; r++) {
      ctx.beginPath();
      ctx.moveTo(gx0, gy0 + r * cell);
      ctx.lineTo(gx0 + cols * cell, gy0 + r * cell);
      ctx.stroke();
    }

    // triangle outline
    ctx.beginPath();
    ctx.moveTo(tri[0].x, tri[0].y);
    ctx.lineTo(tri[1].x, tri[1].y);
    ctx.lineTo(tri[2].x, tri[2].y);
    ctx.closePath();
    ctx.strokeStyle = 'rgba(60,60,60,0.7)';
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // draggable vertex handles
    tri.forEach((p, i) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = VCOLORS[i];
      ctx.stroke();
    });
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 560);
      const h = Math.round(w * 0.74);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w, h, m: 16 };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(draw, [verts, interp]);

  const pointer = (e: PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { px: e.clientX - rect.left, py: e.clientY - rect.top };
  };
  const onDown = (e: PointerEvent) => {
    const { px, py } = pointer(e);
    let best = -1;
    let bestD = 24;
    verts.forEach((v, i) => {
      const p = toPx(v);
      const d = Math.hypot(p.x - px, p.y - py);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    if (best >= 0) {
      dragRef.current = best;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      e.preventDefault();
    }
  };
  const onMove = (e: PointerEvent) => {
    if (dragRef.current === null) return;
    const { px, py } = pointer(e);
    const f = toFrac(px, py);
    setVerts((vs) => vs.map((v, i) => (i === dragRef.current ? f : v)));
  };
  const onUp = () => {
    dragRef.current = null;
  };

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setInterp((v) => !v)}
          class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
            interp ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
          }`}
        >
          {interp ? 'Barycentric color: on' : 'Barycentric color: off'}
        </button>
        <span class="ml-auto text-xs text-muted">Drag the three vertices</span>
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
          <Readout label="Filled pixels" value={`${filled}`} />
          <p class="text-muted">
            A cell is filled when its center passes the inside-test for all three edges. Drag a vertex
            and watch the covered cells update.
          </p>
          {interp ? (
            <p class="text-xs text-muted">
              Each filled pixel blends the three corner colors by its barycentric weights — exactly how
              GPUs interpolate color, depth and texture coordinates.
            </p>
          ) : (
            <p class="text-xs text-muted">
              Flat fill: every covered pixel gets the same color. Turn on barycentric color to see
              per-pixel interpolation.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div class="rounded-lg bg-surface-2 px-3 py-2">
      <span class="text-muted">{label}</span>
      <div class="font-mono text-lg font-semibold text-text">{value}</div>
    </div>
  );
}

// ---- math ----
function edge(a: Pt, b: Pt, p: Pt) {
  return (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
}
function bary(a: Pt, b: Pt, c: Pt, p: Pt) {
  const area = edge(a, b, c);
  if (area === 0) return { w0: 1 / 3, w1: 1 / 3, w2: 1 / 3 };
  return {
    w0: edge(b, c, p) / area,
    w1: edge(c, a, p) / area,
    w2: edge(a, b, p) / area,
  };
}
function mixColor(bc: { w0: number; w1: number; w2: number }) {
  const r = VRGB[0][0] * bc.w0 + VRGB[1][0] * bc.w1 + VRGB[2][0] * bc.w2;
  const g = VRGB[0][1] * bc.w0 + VRGB[1][1] * bc.w1 + VRGB[2][1] * bc.w2;
  const b = VRGB[0][2] * bc.w0 + VRGB[1][2] * bc.w1 + VRGB[2][2] * bc.w2;
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}
function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}
