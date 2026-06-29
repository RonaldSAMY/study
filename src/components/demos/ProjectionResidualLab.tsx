import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Projection & residual lab.
   - Drag the point p (sky) and the line direction d (indigo).
   - The projection of p onto the line through the origin is drawn in
     green, and the residual p - proj is drawn as a dashed segment with
     a right-angle marker, showing it is perpendicular to the line.
   - Readouts show the residual length (the least-squares error) and
     the right-angle (dot product ≈ 0) condition.
   ------------------------------------------------------------------ */

type Vec = { x: number; y: number };

const COLORS = {
  dir: '#4f46e5',
  point: '#0ea5e9',
  proj: '#10b981',
  residual: 'rgba(220,38,38,0.85)',
  grid: 'rgba(128,128,128,0.16)',
  axis: 'rgba(128,128,128,0.5)',
};

export default function ProjectionResidualLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [p, setP] = useState<Vec>({ x: 1, y: 3 });
  const [d, setD] = useState<Vec>({ x: 3, y: 1 });
  const dragRef = useRef<null | 'p' | 'd'>(null);
  const sizeRef = useRef({ w: 480, h: 360, scale: 36, ox: 240, oy: 180 });

  const toPx = (v: Vec) => {
    const { scale, ox, oy } = sizeRef.current;
    return { x: ox + v.x * scale, y: oy - v.y * scale };
  };
  const toMath = (px: number, py: number): Vec => {
    const { scale, ox, oy } = sizeRef.current;
    return { x: Math.round(((px - ox) / scale) * 2) / 2, y: Math.round(((oy - py) / scale) * 2) / 2 };
  };

  const dLen2 = d.x * d.x + d.y * d.y || 1;
  const tproj = (p.x * d.x + p.y * d.y) / dLen2;
  const proj = { x: d.x * tproj, y: d.y * tproj };
  const resid = { x: p.x - proj.x, y: p.y - proj.y };
  const residLen = Math.hypot(resid.x, resid.y);
  const perpDot = resid.x * d.x + resid.y * d.y;

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h, scale, ox, oy } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);

    ctx.strokeStyle = COLORS.grid; ctx.lineWidth = 1;
    for (let gx = ox % scale; gx < w; gx += scale) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke(); }
    for (let gy = oy % scale; gy < h; gy += scale) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke(); }
    ctx.strokeStyle = COLORS.axis; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, oy); ctx.lineTo(w, oy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ox, 0); ctx.lineTo(ox, h); ctx.stroke();

    const origin = { x: ox, y: oy };

    // the subspace: full line through origin along d
    const far = 40;
    ctx.strokeStyle = 'rgba(79,70,229,0.35)';
    ctx.lineWidth = 2;
    const l0 = toPx({ x: -d.x * far, y: -d.y * far });
    const l1 = toPx({ x: d.x * far, y: d.y * far });
    ctx.beginPath(); ctx.moveTo(l0.x, l0.y); ctx.lineTo(l1.x, l1.y); ctx.stroke();

    // residual (dashed red) from proj to p
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = COLORS.residual;
    ctx.lineWidth = 2;
    drawSeg(ctx, toPx(proj), toPx(p));
    ctx.setLineDash([]);

    // right-angle marker at the foot of the projection
    drawRightAngle(ctx, toPx, proj, d, resid);

    // projection vector (green)
    arrow(ctx, origin, toPx(proj), COLORS.proj, 3);
    label(ctx, toPx(proj), 'proj', COLORS.proj);

    // direction handle + point
    arrow(ctx, origin, toPx(d), COLORS.dir, 3.5);
    label(ctx, toPx(d), 'd', COLORS.dir);
    arrow(ctx, origin, toPx(p), COLORS.point, 3);
    label(ctx, toPx(p), 'p', COLORS.point);

    handle(ctx, toPx(p), COLORS.point);
    handle(ctx, toPx(d), COLORS.dir);
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
      const scale = Math.max(22, Math.min(42, w / 13));
      sizeRef.current = { w, h, scale, ox: w / 2, oy: h / 2 };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(draw, [p, d]);

  const pointer = (e: PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { px: e.clientX - rect.left, py: e.clientY - rect.top };
  };
  const onDown = (e: PointerEvent) => {
    const { px, py } = pointer(e);
    const dp = dist(toPx(p), { x: px, y: py });
    const dd = dist(toPx(d), { x: px, y: py });
    if (dp < 22 && dp <= dd) dragRef.current = 'p';
    else if (dd < 22) dragRef.current = 'd';
    if (dragRef.current) {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      e.preventDefault();
    }
  };
  const onMove = (e: PointerEvent) => {
    if (!dragRef.current) return;
    const { px, py } = pointer(e);
    const m = toMath(px, py);
    if (dragRef.current === 'p') setP(m);
    else setD(m);
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
          <p class="text-muted">Drag the point <strong>p</strong> and the direction <strong>d</strong>. The green shadow is the closest point on the line; the red dashed segment is the error.</p>
          <div class="grid grid-cols-2 gap-2">
            <Readout label="p" color={COLORS.point} value={`(${p.x}, ${p.y})`} />
            <Readout label="d" color={COLORS.dir} value={`(${d.x}, ${d.y})`} />
            <Readout label="proj" color={COLORS.proj} value={`(${proj.x.toFixed(2)}, ${proj.y.toFixed(2)})`} />
            <Readout label="residual ‖r‖" value={residLen.toFixed(2)} />
          </div>
          <div class="rounded-lg bg-surface-2 p-3">
            <div class="flex justify-between"><span class="text-muted">r · d</span><strong>{perpDot.toFixed(3)}</strong></div>
            <p class="mt-1 text-xs text-muted">
              The residual is always perpendicular to the line, so <span class="font-mono">r · d = 0</span>. That perpendicularity is exactly what makes the projection the <strong>closest</strong> point — the heart of least squares.
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

function drawRightAngle(
  ctx: CanvasRenderingContext2D,
  toPx: (v: Vec) => Vec,
  foot: Vec,
  d: Vec,
  resid: Vec,
) {
  const dl = Math.hypot(d.x, d.y) || 1;
  const rl = Math.hypot(resid.x, resid.y) || 1;
  if (rl < 0.2) return;
  const ud = { x: d.x / dl, y: d.y / dl };
  const ur = { x: resid.x / rl, y: resid.y / rl };
  const s = 0.4; // marker size in math units
  const c1 = { x: foot.x + ud.x * s, y: foot.y + ud.y * s };
  const c2 = { x: foot.x + ud.x * s + ur.x * s, y: foot.y + ud.y * s + ur.y * s };
  const c3 = { x: foot.x + ur.x * s, y: foot.y + ur.y * s };
  ctx.strokeStyle = 'rgba(128,128,128,0.8)';
  ctx.lineWidth = 1.5;
  const p1 = toPx(c1), p2 = toPx(c2), p3 = toPx(c3);
  ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.lineTo(p3.x, p3.y); ctx.stroke();
}

function arrow(ctx: CanvasRenderingContext2D, from: Vec, to: Vec, color: string, width: number) {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const head = 11;
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(to.x - head * Math.cos(angle - 0.4), to.y - head * Math.sin(angle - 0.4));
  ctx.lineTo(to.x - head * Math.cos(angle + 0.4), to.y - head * Math.sin(angle + 0.4));
  ctx.closePath(); ctx.fill();
}
function drawSeg(ctx: CanvasRenderingContext2D, from: Vec, to: Vec) {
  ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke();
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
