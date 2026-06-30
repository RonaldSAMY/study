import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Ray-sphere bouncer (2D).
   - Drag the ray's ORIGIN (indigo) and its DIRECTION handle (sky).
   - The ray marches forward, finds the nearest circle ("sphere")
     intersection via the quadratic O + tD, and reflects off the
     surface normal. We trace a few bounces.
   - Readout shows hit/miss and the nearest t to the first surface.
   ------------------------------------------------------------------ */

type Vec = { x: number; y: number };

const COLORS = {
  origin: '#4f46e5',
  dir: '#0ea5e9',
  ray: '#0ea5e9',
  bounce: '#10b981',
  circle: 'rgba(128,128,128,0.35)',
  circleStroke: 'rgba(128,128,128,0.7)',
  normal: '#f59e0b',
};

const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y });
const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y });
const scale = (a: Vec, s: number): Vec => ({ x: a.x * s, y: a.y * s });
const dot = (a: Vec, b: Vec) => a.x * b.x + a.y * b.y;
const len = (a: Vec) => Math.hypot(a.x, a.y);
const norm = (a: Vec): Vec => {
  const l = len(a) || 1;
  return { x: a.x / l, y: a.y / l };
};

type Circle = { c: Vec; r: number };

// nearest positive t for ray O + tD (D unit) hitting a circle, else null
function intersect(O: Vec, D: Vec, circ: Circle): number | null {
  const oc = sub(O, circ.c);
  const b = 2 * dot(D, oc);
  const c = dot(oc, oc) - circ.r * circ.r;
  const disc = b * b - 4 * c; // a = D·D = 1
  if (disc < 0) return null;
  const sq = Math.sqrt(disc);
  const t1 = (-b - sq) / 2;
  const t2 = (-b + sq) / 2;
  const eps = 0.001;
  if (t1 > eps) return t1;
  if (t2 > eps) return t2;
  return null;
}

export default function RaySphereBouncer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [origin, setOrigin] = useState<Vec>({ x: 70, y: 110 });
  const [dirPt, setDirPt] = useState<Vec>({ x: 230, y: 150 });
  const dragRef = useRef<null | 'origin' | 'dir'>(null);
  const sizeRef = useRef({ w: 480, h: 320 });
  const circlesRef = useRef<Circle[]>([]);

  // place circles relative to canvas size
  const buildCircles = (w: number, h: number): Circle[] => [
    { c: { x: w * 0.6, y: h * 0.42 }, r: Math.min(w, h) * 0.16 },
    { c: { x: w * 0.82, y: h * 0.75 }, r: Math.min(w, h) * 0.12 },
    { c: { x: w * 0.42, y: h * 0.78 }, r: Math.min(w, h) * 0.1 },
  ];

  // trace the ray through several bounces; returns first-hit t (or null)
  const trace = (ctx: CanvasRenderingContext2D | null) => {
    const circles = circlesRef.current;
    const { w, h } = sizeRef.current;
    let O = origin;
    let D = norm(sub(dirPt, origin));
    let firstT: number | null = null;
    const maxBounces = 4;
    const farLen = Math.hypot(w, h) * 1.2;

    for (let bounce = 0; bounce <= maxBounces; bounce++) {
      // nearest hit among all circles
      let bestT = Infinity;
      let bestCirc: Circle | null = null;
      for (const circ of circles) {
        const t = intersect(O, D, circ);
        if (t !== null && t < bestT) {
          bestT = t;
          bestCirc = circ;
        }
      }

      const col = bounce === 0 ? COLORS.ray : COLORS.bounce;

      if (!bestCirc) {
        // no hit: draw ray flying off the scene
        const end = add(O, scale(D, farLen));
        if (ctx) arrow(ctx, O, end, col, bounce === 0 ? 3 : 2);
        break;
      }

      const hit = add(O, scale(D, bestT));
      if (bounce === 0) firstT = bestT;
      if (ctx) {
        // segment to hit
        ctx.strokeStyle = col;
        ctx.lineWidth = bounce === 0 ? 3 : 2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(O.x, O.y);
        ctx.lineTo(hit.x, hit.y);
        ctx.stroke();
        // hit point
        ctx.beginPath();
        ctx.arc(hit.x, hit.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = col;
        ctx.fill();
        // surface normal
        const n0 = norm(sub(hit, bestCirc.c));
        ctx.strokeStyle = COLORS.normal;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(hit.x, hit.y);
        ctx.lineTo(hit.x + n0.x * 26, hit.y + n0.y * 26);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // reflect: r = d - 2(d·n)n
      const n = norm(sub(hit, bestCirc.c));
      const r = sub(D, scale(n, 2 * dot(D, n)));
      O = add(hit, scale(n, 0.5)); // nudge off the surface
      D = norm(r);
    }

    return firstT;
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);

    // circles
    for (const circ of circlesRef.current) {
      ctx.beginPath();
      ctx.arc(circ.c.x, circ.c.y, circ.r, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.circle;
      ctx.fill();
      ctx.strokeStyle = COLORS.circleStroke;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // ray + bounces
    trace(ctx);

    // origin + direction handles
    handle(ctx, origin, COLORS.origin);
    handle(ctx, dirPt, COLORS.dir);
    ctx.font = '600 12px Inter, sans-serif';
    ctx.fillStyle = COLORS.origin;
    ctx.fillText('origin', origin.x + 10, origin.y - 10);
    ctx.fillStyle = COLORS.dir;
    ctx.fillText('aim', dirPt.x + 10, dirPt.y - 10);
  };

  // responsive sizing with devicePixelRatio
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 560);
      const h = Math.round(w * 0.66);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const prev = sizeRef.current;
      sizeRef.current = { w, h };
      circlesRef.current = buildCircles(w, h);
      // keep handles inside the new bounds
      setOrigin((o) => ({ x: (o.x / prev.w) * w, y: (o.y / prev.h) * h }));
      setDirPt((d) => ({ x: (d.x / prev.w) * w, y: (d.y / prev.h) * h }));
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(draw, [origin, dirPt]);

  // pointer dragging
  const pointer = (e: PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };
  const onDown = (e: PointerEvent) => {
    const p = pointer(e);
    const dOrigin = len(sub(p, origin));
    const dDir = len(sub(p, dirPt));
    if (dOrigin < 24 && dOrigin <= dDir) dragRef.current = 'origin';
    else if (dDir < 24) dragRef.current = 'dir';
    if (dragRef.current) {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      e.preventDefault();
    }
  };
  const onMove = (e: PointerEvent) => {
    if (!dragRef.current) return;
    const p = pointer(e);
    if (dragRef.current === 'origin') setOrigin(p);
    else setDirPt(p);
  };
  const onUp = () => {
    dragRef.current = null;
  };

  const firstT = trace(null);
  const hit = firstT !== null;

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
          <p class="text-muted">Drag the indigo origin and the sky aim handle. The green ray is the reflection.</p>
          <div class="rounded-lg bg-surface-2 p-3">
            <div class="flex justify-between">
              <span class="text-muted">result</span>
              <strong style={`color:${hit ? COLORS.bounce : '#ef4444'}`}>{hit ? 'HIT' : 'MISS'}</strong>
            </div>
            <div class="flex justify-between">
              <span class="text-muted">nearest t</span>
              <strong class="font-mono">{hit ? firstT!.toFixed(1) : '—'}</strong>
            </div>
            <p class="mt-1 text-xs text-muted">
              {hit
                ? 'The discriminant was positive, so the quadratic had a real root.'
                : 'No positive root: the ray sails past every circle.'}
            </p>
          </div>
          <div class="flex items-center gap-2 text-xs text-muted">
            <span class="inline-block h-2 w-6 rounded" style={`background:${COLORS.normal}`} />
            surface normal at each hit
          </div>
        </div>
      </div>
    </div>
  );
}

function handle(ctx: CanvasRenderingContext2D, at: Vec, color: string) {
  ctx.beginPath();
  ctx.arc(at.x, at.y, 7, 0, Math.PI * 2);
  ctx.fillStyle = '#fff';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = color;
  ctx.stroke();
}

function arrow(ctx: CanvasRenderingContext2D, from: Vec, to: Vec, color: string, width: number) {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const head = 10;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(to.x - head * Math.cos(angle - 0.4), to.y - head * Math.sin(angle - 0.4));
  ctx.lineTo(to.x - head * Math.cos(angle + 0.4), to.y - head * Math.sin(angle + 0.4));
  ctx.closePath();
  ctx.fill();
}
