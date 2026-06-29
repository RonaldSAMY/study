import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Grid-warp studio for linear transformations.
   - Drag the tips of the two column vectors î (indigo) and ĵ (sky):
     together they ARE the 2x2 matrix [î | ĵ].
   - An "Animate" button morphs space from the identity to the matrix
     so you can watch the grid bend while lines stay straight, parallel
     and evenly spaced.
   - A small reference shape (a flag) rides along to show the warp.
   ------------------------------------------------------------------ */

type Vec = { x: number; y: number };

const COLORS = {
  i: '#4f46e5',
  j: '#0ea5e9',
  shape: '#10b981',
  grid0: 'rgba(128,128,128,0.16)',
  grid1: 'rgba(79,70,229,0.30)',
  axis: 'rgba(128,128,128,0.5)',
};

// reference shape (a little "F" flag) in math coords
const SHAPE: Vec[] = [
  { x: 0, y: 0 }, { x: 0, y: 2 }, { x: 1.4, y: 2 }, { x: 1.4, y: 1.5 },
  { x: 0.5, y: 1.5 }, { x: 0.5, y: 1.1 }, { x: 1.1, y: 1.1 }, { x: 1.1, y: 0.6 },
  { x: 0.5, y: 0.6 }, { x: 0.5, y: 0 },
];

export default function GridWarpStudio() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [icol, setI] = useState<Vec>({ x: 1.2, y: 0.4 });
  const [jcol, setJ] = useState<Vec>({ x: -0.6, y: 1.3 });
  const [t, setT] = useState(1); // 0 = identity, 1 = full matrix
  const dragRef = useRef<null | 'i' | 'j'>(null);
  const rafRef = useRef<number | null>(null);
  const sizeRef = useRef({ w: 480, h: 360, scale: 36, ox: 240, oy: 180 });

  const toPx = (v: Vec) => {
    const { scale, ox, oy } = sizeRef.current;
    return { x: ox + v.x * scale, y: oy - v.y * scale };
  };
  const toMath = (px: number, py: number): Vec => {
    const { scale, ox, oy } = sizeRef.current;
    return { x: Math.round(((px - ox) / scale) * 2) / 2, y: Math.round(((oy - py) / scale) * 2) / 2 };
  };

  // interpolated matrix between identity and [i | j]
  const M = () => {
    const a = 1 + (icol.x - 1) * t;
    const c = 0 + (icol.y - 0) * t;
    const b = 0 + (jcol.x - 0) * t;
    const d = 1 + (jcol.y - 1) * t;
    return { a, b, c, d };
  };
  const apply = (v: Vec): Vec => {
    const { a, b, c, d } = M();
    return { x: a * v.x + b * v.y, y: c * v.x + d * v.y };
  };

  const det = icol.x * jcol.y - icol.y * jcol.x;

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h, oy, ox } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);

    const N = 6;
    // transformed grid: vertical then horizontal families
    ctx.strokeStyle = COLORS.grid1;
    ctx.lineWidth = 1;
    for (let gx = -N; gx <= N; gx++) {
      ctx.beginPath();
      const p0 = toPx(apply({ x: gx, y: -N }));
      const p1 = toPx(apply({ x: gx, y: N }));
      ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
    }
    for (let gy = -N; gy <= N; gy++) {
      ctx.beginPath();
      const p0 = toPx(apply({ x: -N, y: gy }));
      const p1 = toPx(apply({ x: N, y: gy }));
      ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
    }

    // axes (untransformed reference)
    ctx.strokeStyle = COLORS.axis;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, oy); ctx.lineTo(w, oy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ox, 0); ctx.lineTo(ox, h); ctx.stroke();

    // transformed shape
    ctx.beginPath();
    SHAPE.forEach((p, i) => {
      const q = toPx(apply(p));
      if (i === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y);
    });
    ctx.closePath();
    ctx.fillStyle = 'rgba(16,185,129,0.18)';
    ctx.fill();
    ctx.strokeStyle = COLORS.shape;
    ctx.lineWidth = 2;
    ctx.stroke();

    const origin = toPx({ x: 0, y: 0 });
    const iTip = apply({ x: 1, y: 0 });
    const jTip = apply({ x: 0, y: 1 });
    arrow(ctx, origin, toPx(iTip), COLORS.i, 3.5);
    arrow(ctx, origin, toPx(jTip), COLORS.j, 3.5);
    label(ctx, toPx(iTip), 'î', COLORS.i);
    label(ctx, toPx(jTip), 'ĵ', COLORS.j);
    // draggable handles shown at full-matrix tips
    handle(ctx, toPx(icol), COLORS.i);
    handle(ctx, toPx(jcol), COLORS.j);
  };

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
      const scale = Math.max(22, Math.min(40, w / 13));
      sizeRef.current = { w, h, scale, ox: w / 2, oy: h / 2 };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  useEffect(draw, [icol, jcol, t]);

  const animate = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    let from = 0;
    const start = performance.now();
    const dur = 900;
    setT(0);
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / dur);
      const eased = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      setT(from + eased * (1 - from));
      if (k < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
  };

  const pointer = (e: PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { px: e.clientX - rect.left, py: e.clientY - rect.top };
  };
  const onDown = (e: PointerEvent) => {
    if (t < 0.999) setT(1); // snap to full matrix to drag handles meaningfully
    const { px, py } = pointer(e);
    const d1 = dist(toPx(icol), { x: px, y: py });
    const d2 = dist(toPx(jcol), { x: px, y: py });
    if (d1 < 22 && d1 <= d2) dragRef.current = 'i';
    else if (d2 < 22) dragRef.current = 'j';
    if (dragRef.current) {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      e.preventDefault();
    }
  };
  const onMove = (e: PointerEvent) => {
    if (!dragRef.current) return;
    const { px, py } = pointer(e);
    const m = toMath(px, py);
    if (dragRef.current === 'i') setI(m);
    else setJ(m);
  };
  const onUp = () => { dragRef.current = null; };

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-3">
        <button
          onClick={animate}
          class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white transition hover:opacity-90"
        >
          ▶ Animate the warp
        </button>
        <span class="font-mono text-sm text-muted">
          M = [{icol.x} {jcol.x}; {icol.y} {jcol.y}]
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
          <p class="text-muted">Drag î and ĵ — the columns of the matrix. The whole grid follows, but stays made of straight, parallel, evenly-spaced lines.</p>
          <div class="grid grid-cols-2 gap-2">
            <Readout label="column î" color={COLORS.i} value={`(${icol.x}, ${icol.y})`} />
            <Readout label="column ĵ" color={COLORS.j} value={`(${jcol.x}, ${jcol.y})`} />
            <Readout label="det (area ×)" value={det.toFixed(2)} />
            <Readout label="orientation" value={det < 0 ? 'flipped' : det === 0 ? 'collapsed' : 'kept'} />
          </div>
          <div class="rounded-lg bg-surface-2 p-3 text-xs text-muted">
            The green flag is carried along by the transformation. A negative determinant means space was <strong>flipped</strong> like a mirror; a zero determinant <strong>flattens</strong> everything onto a line.
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

function arrow(ctx: CanvasRenderingContext2D, from: Vec, to: Vec, color: string, width: number) {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const head = 11;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(to.x - head * Math.cos(angle - 0.4), to.y - head * Math.sin(angle - 0.4));
  ctx.lineTo(to.x - head * Math.cos(angle + 0.4), to.y - head * Math.sin(angle + 0.4));
  ctx.closePath(); ctx.fill();
}
function handle(ctx: CanvasRenderingContext2D, at: Vec, color: string) {
  ctx.beginPath(); ctx.arc(at.x, at.y, 7, 0, Math.PI * 2);
  ctx.fillStyle = '#fff'; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = color; ctx.stroke();
}
function label(ctx: CanvasRenderingContext2D, at: Vec, text: string, color: string) {
  ctx.font = '600 14px Inter, sans-serif';
  ctx.fillStyle = color;
  ctx.fillText(text, at.x + 10, at.y - 8);
}
function dist(p: Vec, q: Vec) { return Math.hypot(p.x - q.x, p.y - q.y); }
