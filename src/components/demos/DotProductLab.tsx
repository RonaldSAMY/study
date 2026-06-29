import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Dot-product lab.
   - Drag the tips of vector u (indigo) and v (sky).
   - Live readout of u·v, the angle between them, and the projection
     of v onto u (the dashed drop-line + emerald shadow).
   - Distinct from VectorPlayground: single-purpose, projection-first.
   ------------------------------------------------------------------ */

type Vec = { x: number; y: number };

const COLORS = {
  u: '#4f46e5',
  v: '#0ea5e9',
  proj: '#10b981',
  grid: 'rgba(128,128,128,0.18)',
  axis: 'rgba(128,128,128,0.5)',
};

export default function DotProductLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [u, setU] = useState<Vec>({ x: 4, y: 1 });
  const [v, setV] = useState<Vec>({ x: 1, y: 3 });
  const dragRef = useRef<null | 'u' | 'v'>(null);
  const sizeRef = useRef({ w: 480, h: 360, scale: 36, ox: 240, oy: 180 });

  const toPx = (p: Vec) => {
    const { scale, ox, oy } = sizeRef.current;
    return { x: ox + p.x * scale, y: oy - p.y * scale };
  };
  const toMath = (px: number, py: number): Vec => {
    const { scale, ox, oy } = sizeRef.current;
    return { x: Math.round(((px - ox) / scale) * 2) / 2, y: Math.round(((oy - py) / scale) * 2) / 2 };
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h, scale, ox, oy } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);

    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    for (let gx = ox % scale; gx < w; gx += scale) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke(); }
    for (let gy = oy % scale; gy < h; gy += scale) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke(); }
    ctx.strokeStyle = COLORS.axis;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, oy); ctx.lineTo(w, oy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ox, 0); ctx.lineTo(ox, h); ctx.stroke();

    const origin = { x: ox, y: oy };

    // projection of v onto u
    const uLen2 = u.x * u.x + u.y * u.y || 1;
    const t = (u.x * v.x + u.y * v.y) / uLen2;
    const proj = { x: u.x * t, y: u.y * t };

    // drop line from v to its shadow
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(128,128,128,0.7)';
    drawSeg(ctx, toPx(v), toPx(proj));
    ctx.setLineDash([]);
    // the projection (shadow) along u
    arrow(ctx, origin, toPx(proj), COLORS.proj, 4);
    label(ctx, toPx(proj), 'proj', COLORS.proj);

    // base vectors
    arrow(ctx, origin, toPx(u), COLORS.u, 3.5);
    arrow(ctx, origin, toPx(v), COLORS.v, 3.5);
    label(ctx, toPx(u), 'u', COLORS.u);
    label(ctx, toPx(v), 'v', COLORS.v);
    handle(ctx, toPx(u), COLORS.u);
    handle(ctx, toPx(v), COLORS.v);
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
      const scale = Math.max(24, Math.min(44, w / 13));
      sizeRef.current = { w, h, scale, ox: w / 2, oy: h / 2 };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(draw, [u, v]);

  const pointer = (e: PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { px: e.clientX - rect.left, py: e.clientY - rect.top };
  };
  const onDown = (e: PointerEvent) => {
    const { px, py } = pointer(e);
    const du = dist(toPx(u), { x: px, y: py });
    const dv = dist(toPx(v), { x: px, y: py });
    if (du < 22 && du <= dv) dragRef.current = 'u';
    else if (dv < 22) dragRef.current = 'v';
    if (dragRef.current) { (e.target as HTMLElement).setPointerCapture(e.pointerId); e.preventDefault(); }
  };
  const onMove = (e: PointerEvent) => {
    if (!dragRef.current) return;
    const { px, py } = pointer(e);
    const m = toMath(px, py);
    if (dragRef.current === 'u') setU(m); else setV(m);
  };
  const onUp = () => { dragRef.current = null; };

  const dot = u.x * v.x + u.y * v.y;
  const magU = Math.hypot(u.x, u.y);
  const magV = Math.hypot(v.x, v.y);
  const cos = magU && magV ? Math.min(1, Math.max(-1, dot / (magU * magV))) : 0;
  const angle = (Math.acos(cos) * 180) / Math.PI;
  const scalarProj = magU ? dot / magU : 0;

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
          <p class="text-muted">Drag the dots. The emerald shadow is v's projection onto u.</p>
          <div class="grid grid-cols-2 gap-2">
            <Readout label="u" color={COLORS.u} value={`(${u.x}, ${u.y})`} />
            <Readout label="v" color={COLORS.v} value={`(${v.x}, ${v.y})`} />
            <Readout label="‖u‖" value={magU.toFixed(2)} />
            <Readout label="‖v‖" value={magV.toFixed(2)} />
          </div>
          <div class="rounded-lg bg-surface-2 p-3 space-y-1">
            <div class="flex justify-between"><span class="text-muted">u · v</span><strong>{dot.toFixed(2)}</strong></div>
            <div class="flex justify-between"><span class="text-muted">angle</span><strong>{angle.toFixed(1)}°</strong></div>
            <div class="flex justify-between"><span class="text-muted">cos θ</span><strong>{cos.toFixed(3)}</strong></div>
            <div class="flex justify-between"><span class="text-muted">projection length</span><strong>{scalarProj.toFixed(2)}</strong></div>
            <p class="mt-1 text-xs text-muted">
              {dot > 0.001 ? 'Positive → the two point a similar way (acute angle).'
                : dot < -0.001 ? 'Negative → they pull in opposing directions (obtuse angle).'
                : 'Zero → perpendicular: no agreement at all.'}
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
  ctx.font = '600 14px Inter, sans-serif'; ctx.fillStyle = color; ctx.fillText(text, at.x + 10, at.y - 8);
}
function dist(p: Vec, q: Vec) { return Math.hypot(p.x - q.x, p.y - q.y); }
