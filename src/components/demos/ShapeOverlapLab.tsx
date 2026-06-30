import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Drag two shapes; they light up red when they overlap.
   Three narrow-phase tests, switchable:
     - AABB  : axis-aligned boxes (overlap on x AND y intervals)
     - Circle: distance between centers vs sum of radii
     - SAT   : two ROTATED boxes via the Separating Axis Theorem
   Centers are stored as fractions of the canvas so it survives resize.
   No animation loop is needed — we redraw on every drag.
   ------------------------------------------------------------------ */

type Mode = 'aabb' | 'circle' | 'sat';
type Vec = { x: number; y: number };

const COLORS = {
  a: '#4f46e5',     // indigo
  b: '#0ea5e9',     // sky
  hit: '#ef4444',   // red  – overlapping
  clear: '#10b981', // emerald – separated
  text: '#334155',
};

// fixed sizes in pixels (half-extents / radius)
const HALF = { hx: 56, hy: 40 };
const RAD = { a: 48, b: 40 };

export default function ShapeOverlapLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<Mode>('aabb');
  const [angle, setAngle] = useState(30); // degrees, box B in SAT mode
  const [aPos, setAPos] = useState<Vec>({ x: 0.36, y: 0.5 });
  const [bPos, setBPos] = useState<Vec>({ x: 0.64, y: 0.5 });
  const dragRef = useRef<null | 'a' | 'b'>(null);
  const sizeRef = useRef({ w: 480, h: 320 });

  const px = (p: Vec): Vec => ({ x: p.x * sizeRef.current.w, y: p.y * sizeRef.current.h });

  // ---- geometry helpers ----
  const obbCorners = (c: Vec, hx: number, hy: number, deg: number): Vec[] => {
    const r = (deg * Math.PI) / 180;
    const cos = Math.cos(r), sin = Math.sin(r);
    return [
      { x: -hx, y: -hy }, { x: hx, y: -hy }, { x: hx, y: hy }, { x: -hx, y: hy },
    ].map((o) => ({ x: c.x + o.x * cos - o.y * sin, y: c.y + o.x * sin + o.y * cos }));
  };

  const projectOnto = (pts: Vec[], axis: Vec): { min: number; max: number } => {
    let min = Infinity, max = -Infinity;
    for (const p of pts) {
      const d = p.x * axis.x + p.y * axis.y;
      if (d < min) min = d;
      if (d > max) max = d;
    }
    return { min, max };
  };

  // returns { hit, depth }  depth>0 = penetration; depth<0 = gap (separation)
  const test = (): { hit: boolean; depth: number; label: string } => {
    const A = px(aPos), B = px(bPos);
    if (mode === 'circle') {
      const d = Math.hypot(A.x - B.x, A.y - B.y);
      const sum = RAD.a + RAD.b;
      const depth = sum - d;
      return { hit: depth > 0, depth, label: 'distance vs r₁+r₂' };
    }
    if (mode === 'aabb') {
      const dx = Math.abs(A.x - B.x), dy = Math.abs(A.y - B.y);
      const ox = HALF.hx + HALF.hx - dx; // overlap on x
      const oy = HALF.hy + HALF.hy - dy; // overlap on y
      const hit = ox > 0 && oy > 0;
      const depth = hit ? Math.min(ox, oy) : Math.max(-ox, -oy) * -1;
      return { hit, depth, label: 'overlap on x AND y' };
    }
    // SAT: box A axis-aligned, box B rotated by `angle`
    const cA = obbCorners(A, HALF.hx, HALF.hy, 0);
    const cB = obbCorners(B, HALF.hx, HALF.hy, angle);
    const axes: Vec[] = [];
    const pushAxis = (deg: number) => {
      const r = (deg * Math.PI) / 180;
      axes.push({ x: Math.cos(r), y: Math.sin(r) });
      axes.push({ x: -Math.sin(r), y: Math.cos(r) });
    };
    pushAxis(0);
    pushAxis(angle);
    let minOverlap = Infinity;
    let separated = false;
    for (const ax of axes) {
      const pa = projectOnto(cA, ax);
      const pb = projectOnto(cB, ax);
      const overlap = Math.min(pa.max, pb.max) - Math.max(pa.min, pb.min);
      if (overlap <= 0) { separated = true; minOverlap = Math.min(minOverlap, overlap); }
      else minOverlap = Math.min(minOverlap, overlap);
    }
    return { hit: !separated, depth: minOverlap, label: 'no separating axis found' };
  };

  // ---- drawing ----
  const drawBox = (ctx: CanvasRenderingContext2D, c: Vec, deg: number, stroke: string, fill: string) => {
    const cs = obbCorners(c, HALF.hx, HALF.hy, deg);
    ctx.beginPath();
    cs.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.closePath();
    ctx.fillStyle = fill; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = stroke; ctx.stroke();
  };
  const drawCircle = (ctx: CanvasRenderingContext2D, c: Vec, r: number, stroke: string, fill: string) => {
    ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
    ctx.fillStyle = fill; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = stroke; ctx.stroke();
  };

  const withAlpha = (hex: string, a: number) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);

    const r = test();
    const A = px(aPos), B = px(bPos);
    const sA = r.hit ? COLORS.hit : COLORS.a;
    const sB = r.hit ? COLORS.hit : COLORS.b;
    const fillA = withAlpha(r.hit ? COLORS.hit : COLORS.a, 0.18);
    const fillB = withAlpha(r.hit ? COLORS.hit : COLORS.b, 0.18);

    if (mode === 'circle') {
      drawCircle(ctx, A, RAD.a, sA, fillA);
      drawCircle(ctx, B, RAD.b, sB, fillB);
    } else if (mode === 'aabb') {
      drawBox(ctx, A, 0, sA, fillA);
      drawBox(ctx, B, 0, sB, fillB);
    } else {
      drawBox(ctx, A, 0, sA, fillA);
      drawBox(ctx, B, angle, sB, fillB);
    }

    // centers
    for (const c of [A, B]) {
      ctx.beginPath(); ctx.arc(c.x, c.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = r.hit ? COLORS.hit : '#64748b'; ctx.fill();
    }

    // banner
    ctx.font = '700 16px Inter, sans-serif';
    ctx.fillStyle = r.hit ? COLORS.hit : COLORS.clear;
    ctx.fillText(r.hit ? 'OVERLAP' : 'CLEAR', 12, 24);
  };

  // ---- sizing ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 560);
      const h = Math.round(w * 0.62);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w, h };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // redraw on any state change
  useEffect(draw, [mode, angle, aPos, bPos]);

  // ---- pointer dragging ----
  const contains = (pt: Vec, c: Vec, which: 'a' | 'b'): boolean => {
    if (mode === 'circle') return Math.hypot(pt.x - c.x, pt.y - c.y) <= (which === 'a' ? RAD.a : RAD.b);
    const deg = mode === 'sat' && which === 'b' ? angle : 0;
    const r = (-deg * Math.PI) / 180;
    const dx = pt.x - c.x, dy = pt.y - c.y;
    const lx = dx * Math.cos(r) - dy * Math.sin(r);
    const ly = dx * Math.sin(r) + dy * Math.cos(r);
    return Math.abs(lx) <= HALF.hx && Math.abs(ly) <= HALF.hy;
  };

  const pointer = (e: PointerEvent): Vec => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onDown = (e: PointerEvent) => {
    const pt = pointer(e);
    const A = px(aPos), B = px(bPos);
    if (contains(pt, B, 'b')) dragRef.current = 'b';
    else if (contains(pt, A, 'a')) dragRef.current = 'a';
    if (dragRef.current) {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      e.preventDefault();
    }
  };
  const onMove = (e: PointerEvent) => {
    if (!dragRef.current) return;
    const pt = pointer(e);
    const { w, h } = sizeRef.current;
    const frac = { x: Math.min(1, Math.max(0, pt.x / w)), y: Math.min(1, Math.max(0, pt.y / h)) };
    if (dragRef.current === 'a') setAPos(frac); else setBPos(frac);
  };
  const onUp = () => { dragRef.current = null; };

  const r = test();
  const modes: { id: Mode; label: string }[] = [
    { id: 'aabb', label: 'AABB' },
    { id: 'circle', label: 'Circle' },
    { id: 'sat', label: 'SAT (rotated)' },
  ];

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap gap-2">
        {modes.map((m) => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              mode === m.id ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
            }`}
          >
            {m.label}
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
          <p class="text-muted">Drag either shape. They turn red the instant the test reports a hit.</p>
          <Readout
            label="Result"
            value={r.hit ? 'OVERLAP' : 'separated'}
            color={r.hit ? COLORS.hit : COLORS.clear}
          />
          <Readout
            label={r.hit ? 'Penetration' : 'Separation'}
            value={`${Math.abs(r.depth).toFixed(0)} px`}
          />
          <Readout label="Test" value={r.label} />

          {mode === 'sat' && (
            <label class="block">
              <span class="mb-1 block text-muted">box B angle = {angle}°</span>
              <input
                type="range" min={0} max={90} step={1} value={angle}
                onInput={(e) => setAngle(parseInt((e.target as HTMLInputElement).value, 10))}
                class="w-full accent-[#0ea5e9]"
              />
            </label>
          )}

          <p class="text-xs text-muted">
            {mode === 'aabb' && 'Boxes touch only if their x-ranges AND y-ranges both overlap — two cheap interval checks.'}
            {mode === 'circle' && 'Circles touch only if the centre distance is less than the sum of radii — one square root.'}
            {mode === 'sat' && 'Rotated boxes touch only if NO axis separates them. We test 4 edge normals; one clean gap means no collision.'}
          </p>
        </div>
      </div>
    </div>
  );
}

function Readout({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div class="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2">
      <span class="text-muted">{label}</span>
      <span class="font-mono font-semibold" style={color ? `color:${color}` : ''}>{value}</span>
    </div>
  );
}
