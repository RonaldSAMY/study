import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Basis & span tiler.
   - Drag the tips of two basis vectors e1 (indigo) and e2 (sky).
   - The plane is tiled by all integer combinations m·e1 + n·e2.
   - The shaded parallelogram is the "tile"; its area = |det|.
   - When the two vectors become parallel, the span collapses to a
     line (rank drops from 2 to 1) and the tiling degenerates.
   ------------------------------------------------------------------ */

type Vec = { x: number; y: number };

const COLORS = {
  e1: '#4f46e5',
  e2: '#0ea5e9',
  tile: 'rgba(16,185,129,0.16)',
  tileEdge: '#10b981',
  lattice: 'rgba(79,70,229,0.55)',
  grid: 'rgba(128,128,128,0.16)',
  axis: 'rgba(128,128,128,0.5)',
};

export default function BasisSpanTiler() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [e1, setE1] = useState<Vec>({ x: 2, y: 0.5 });
  const [e2, setE2] = useState<Vec>({ x: -0.5, y: 1.5 });
  const dragRef = useRef<null | 'e1' | 'e2'>(null);
  const sizeRef = useRef({ w: 480, h: 360, scale: 36, ox: 240, oy: 180 });

  const toPx = (v: Vec) => {
    const { scale, ox, oy } = sizeRef.current;
    return { x: ox + v.x * scale, y: oy - v.y * scale };
  };
  const toMath = (px: number, py: number): Vec => {
    const { scale, ox, oy } = sizeRef.current;
    return { x: Math.round(((px - ox) / scale) * 2) / 2, y: Math.round(((oy - py) / scale) * 2) / 2 };
  };

  const det = e1.x * e2.y - e1.y * e2.x;
  const dependent = Math.abs(det) < 0.06;

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h, scale, ox, oy } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);

    // faint background grid
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    for (let gx = ox % scale; gx < w; gx += scale) {
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke();
    }
    for (let gy = oy % scale; gy < h; gy += scale) {
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke();
    }
    ctx.strokeStyle = COLORS.axis;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, oy); ctx.lineTo(w, oy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ox, 0); ctx.lineTo(ox, h); ctx.stroke();

    const R = 7; // how many tiles each direction

    if (dependent) {
      // span is a line: draw the line through origin along the longer vector
      const base = Math.hypot(e1.x, e1.y) >= Math.hypot(e2.x, e2.y) ? e1 : e2;
      const len = Math.hypot(base.x, base.y) || 1;
      const u = { x: base.x / len, y: base.y / len };
      const far = 40;
      ctx.strokeStyle = COLORS.tileEdge;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      const p0 = toPx({ x: u.x * -far, y: u.y * -far });
      const p1 = toPx({ x: u.x * far, y: u.y * far });
      ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
      // lattice points fall ON the line only
      ctx.fillStyle = COLORS.lattice;
      for (let m = -R; m <= R; m++) {
        for (let n = -R; n <= R; n++) {
          const p = toPx({ x: m * e1.x + n * e2.x, y: m * e1.y + n * e2.y });
          ctx.beginPath(); ctx.arc(p.x, p.y, 2.4, 0, Math.PI * 2); ctx.fill();
        }
      }
    } else {
      // shaded fundamental tile (the unit parallelogram)
      const o = toPx({ x: 0, y: 0 });
      const a = toPx(e1);
      const ab = toPx({ x: e1.x + e2.x, y: e1.y + e2.y });
      const b = toPx(e2);
      ctx.fillStyle = COLORS.tile;
      ctx.beginPath();
      ctx.moveTo(o.x, o.y); ctx.lineTo(a.x, a.y); ctx.lineTo(ab.x, ab.y); ctx.lineTo(b.x, b.y);
      ctx.closePath(); ctx.fill();

      // tiling: parallelogram edges in both families
      ctx.strokeStyle = 'rgba(16,185,129,0.35)';
      ctx.lineWidth = 1;
      for (let n = -R; n <= R; n++) {
        const s = toPx({ x: -R * e1.x + n * e2.x, y: -R * e1.y + n * e2.y });
        const t = toPx({ x: R * e1.x + n * e2.x, y: R * e1.y + n * e2.y });
        ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(t.x, t.y); ctx.stroke();
      }
      for (let m = -R; m <= R; m++) {
        const s = toPx({ x: m * e1.x - R * e2.x, y: m * e1.y - R * e2.y });
        const t = toPx({ x: m * e1.x + R * e2.x, y: m * e1.y + R * e2.y });
        ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(t.x, t.y); ctx.stroke();
      }
      // lattice points
      ctx.fillStyle = COLORS.lattice;
      for (let m = -R; m <= R; m++) {
        for (let n = -R; n <= R; n++) {
          const p = toPx({ x: m * e1.x + n * e2.x, y: m * e1.y + n * e2.y });
          if (p.x < -4 || p.x > w + 4 || p.y < -4 || p.y > h + 4) continue;
          ctx.beginPath(); ctx.arc(p.x, p.y, 2.4, 0, Math.PI * 2); ctx.fill();
        }
      }
    }

    const origin = { x: ox, y: oy };
    arrow(ctx, origin, toPx(e1), COLORS.e1, 3.5);
    arrow(ctx, origin, toPx(e2), COLORS.e2, 3.5);
    label(ctx, toPx(e1), 'e₁', COLORS.e1);
    label(ctx, toPx(e2), 'e₂', COLORS.e2);
    handle(ctx, toPx(e1), COLORS.e1);
    handle(ctx, toPx(e2), COLORS.e2);
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
      const scale = Math.max(24, Math.min(46, w / 12));
      sizeRef.current = { w, h, scale, ox: w / 2, oy: h / 2 };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(draw, [e1, e2]);

  const pointer = (e: PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { px: e.clientX - rect.left, py: e.clientY - rect.top };
  };
  const onDown = (e: PointerEvent) => {
    const { px, py } = pointer(e);
    const d1 = dist(toPx(e1), { x: px, y: py });
    const d2 = dist(toPx(e2), { x: px, y: py });
    if (d1 < 22 && d1 <= d2) dragRef.current = 'e1';
    else if (d2 < 22) dragRef.current = 'e2';
    if (dragRef.current) {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      e.preventDefault();
    }
  };
  const onMove = (e: PointerEvent) => {
    if (!dragRef.current) return;
    const { px, py } = pointer(e);
    const m = toMath(px, py);
    if (dragRef.current === 'e1') setE1(m);
    else setE2(m);
  };
  const onUp = () => { dragRef.current = null; };

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
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
          <p class="text-muted">Drag the two basis vectors. Every dot is an integer combination <span class="font-mono">m·e₁ + n·e₂</span>.</p>
          <div class="grid grid-cols-2 gap-2">
            <Readout label="e₁" color={COLORS.e1} value={`(${e1.x}, ${e1.y})`} />
            <Readout label="e₂" color={COLORS.e2} value={`(${e2.x}, ${e2.y})`} />
            <Readout label="det" value={det.toFixed(2)} />
            <Readout label="tile area" value={Math.abs(det).toFixed(2)} />
          </div>
          <div class={`rounded-lg p-3 ${dependent ? 'bg-geometry/10 text-geometry' : 'bg-surface-2'}`}>
            <div class="flex justify-between">
              <span class="text-muted">rank</span>
              <strong>{dependent ? '1 (collapsed)' : '2 (full)'}</strong>
            </div>
            <p class="mt-1 text-xs text-muted">
              {dependent
                ? 'The vectors are parallel (dependent). Their span is only a line — the plane cannot be reached.'
                : 'The vectors are independent. Together they reach every point in the plane.'}
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
