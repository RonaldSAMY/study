import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Rasterization demo: a triangle drawn over a coarse pixel grid.
   - Drag the three triangle corners.
   - Each grid cell is tested with the three edge functions; cells
     whose center is inside all three edges get filled.
   - Toggle "barycentric color" to shade pixels by their weights.
   ------------------------------------------------------------------ */

type Vec = { x: number; y: number };

const COLORS = {
  v0: '#4f46e5',
  v1: '#0ea5e9',
  v2: '#10b981',
  grid: 'rgba(128,128,128,0.18)',
  edge: '#4f46e5',
};

// signed area * 2 of triangle (a,b,c); positive = counter-clockwise
function edge(a: Vec, b: Vec, p: Vec) {
  return (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
}

export default function TriangleRasterGrid() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // triangle corners in GRID-cell coordinates
  const [v0, setV0] = useState<Vec>({ x: 2, y: 2 });
  const [v1, setV1] = useState<Vec>({ x: 11, y: 4 });
  const [v2, setV2] = useState<Vec>({ x: 5, y: 11 });
  const [bary, setBary] = useState(false);
  const dragRef = useRef<null | 0 | 1 | 2>(null);
  const sizeRef = useRef({ w: 480, h: 480, cell: 32, cols: 14, rows: 14 });

  const toPx = (v: Vec) => {
    const { cell } = sizeRef.current;
    return { x: v.x * cell, y: v.y * cell };
  };
  const toGrid = (px: number, py: number): Vec => {
    const { cell, cols, rows } = sizeRef.current;
    return {
      x: Math.max(0, Math.min(cols, Math.round((px / cell) * 2) / 2)),
      y: Math.max(0, Math.min(rows, Math.round((py / cell) * 2) / 2)),
    };
  };

  const filledCount = useRef(0);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h, cell, cols, rows } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);

    // winding-independent inside test
    const area = edge(v0, v1, v2);
    const sign = area >= 0 ? 1 : -1;
    let count = 0;

    // fill pixels whose center is inside the triangle
    for (let gy = 0; gy < rows; gy++) {
      for (let gx = 0; gx < cols; gx++) {
        const c = { x: gx + 0.5, y: gy + 0.5 };
        const w0 = edge(v1, v2, c) * sign;
        const w1 = edge(v2, v0, c) * sign;
        const w2 = edge(v0, v1, c) * sign;
        if (w0 >= 0 && w1 >= 0 && w2 >= 0) {
          count++;
          const total = w0 + w1 + w2 || 1;
          if (bary) {
            const r = Math.round((w0 / total) * 255);
            const g = Math.round((w1 / total) * 255);
            const b = Math.round((w2 / total) * 255);
            ctx.fillStyle = `rgb(${r},${g},${b})`;
          } else {
            ctx.fillStyle = 'rgba(79,70,229,0.35)';
          }
          ctx.fillRect(gx * cell + 1, gy * cell + 1, cell - 2, cell - 2);
        }
      }
    }
    filledCount.current = count;

    // grid lines
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    for (let gx = 0; gx <= cols; gx++) {
      ctx.beginPath(); ctx.moveTo(gx * cell, 0); ctx.lineTo(gx * cell, h); ctx.stroke();
    }
    for (let gy = 0; gy <= rows; gy++) {
      ctx.beginPath(); ctx.moveTo(0, gy * cell); ctx.lineTo(w, gy * cell); ctx.stroke();
    }

    // triangle outline
    const p0 = toPx(v0), p1 = toPx(v1), p2 = toPx(v2);
    ctx.strokeStyle = COLORS.edge;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
    ctx.closePath(); ctx.stroke();

    handle(ctx, p0, COLORS.v0);
    handle(ctx, p1, COLORS.v1);
    handle(ctx, p2, COLORS.v2);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 460);
      const cols = 14, rows = 14;
      const cell = Math.floor(w / cols);
      const size = cell * cols;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = size * dpr;
      canvas.height = size * dpr;
      canvas.style.width = `${size}px`;
      canvas.style.height = `${size}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w: size, h: size, cell, cols, rows };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(draw, [v0, v1, v2, bary]);

  const pointer = (e: PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { px: e.clientX - rect.left, py: e.clientY - rect.top };
  };
  const onDown = (e: PointerEvent) => {
    const { px, py } = pointer(e);
    const verts = [toPx(v0), toPx(v1), toPx(v2)];
    let best: null | 0 | 1 | 2 = null;
    let bd = 24;
    verts.forEach((p, i) => {
      const d = Math.hypot(p.x - px, p.y - py);
      if (d < bd) { bd = d; best = i as 0 | 1 | 2; }
    });
    dragRef.current = best;
    if (best !== null) {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      e.preventDefault();
    }
  };
  const onMove = (e: PointerEvent) => {
    if (dragRef.current === null) return;
    const { px, py } = pointer(e);
    const g = toGrid(px, py);
    if (dragRef.current === 0) setV0(g);
    else if (dragRef.current === 1) setV1(g);
    else setV2(g);
  };
  const onUp = () => { dragRef.current = null; };

  const total = sizeRef.current.cols * sizeRef.current.rows;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setBary((b) => !b)}
          class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
            bary ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
          }`}
        >
          Barycentric color
        </button>
        <span class="text-sm text-muted">
          Filled pixels: <strong class="text-text">{filledCount.current}</strong> / {total}
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
          <p class="text-muted">Drag the three corners. Each grid cell is a pixel; a pixel is filled when its center sits inside all three edges.</p>
          <Readout label="v0" color={COLORS.v0} value={`(${v0.x}, ${v0.y})`} />
          <Readout label="v1" color={COLORS.v1} value={`(${v1.x}, ${v1.y})`} />
          <Readout label="v2" color={COLORS.v2} value={`(${v2.x}, ${v2.y})`} />
          <p class="text-xs text-muted">
            With "Barycentric color" on, each pixel mixes the three corner colors by its weights — exactly how a GPU interpolates across a triangle.
          </p>
        </div>
      </div>
    </div>
  );
}

function Readout({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div class="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2">
      <span class="font-semibold" style={color ? `color:${color}` : ''}>{label}</span>
      <span class="font-mono">{value}</span>
    </div>
  );
}

function handle(ctx: CanvasRenderingContext2D, at: Vec, color: string) {
  ctx.beginPath(); ctx.arc(at.x, at.y, 7, 0, Math.PI * 2);
  ctx.fillStyle = '#fff'; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = color; ctx.stroke();
}
