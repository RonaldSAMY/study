import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Dot & cross product lab for games.
   - Drag vector f (indigo) = a guard's FACING direction.
   - Drag vector t (sky)    = direction to a TARGET.
   - Live readouts: dot, angle, cross-z, projection length, and a
     "in front / behind" + "to the left / right" verdict.
   Canvas conventions from VectorPlayground.
   ------------------------------------------------------------------ */

type Vec = { x: number; y: number };

const COLORS = {
  f: '#4f46e5',
  t: '#0ea5e9',
  proj: '#10b981',
  grid: 'rgba(128,128,128,0.18)',
  axis: 'rgba(128,128,128,0.5)',
};

export default function DotCrossFacingLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [f, setF] = useState<Vec>({ x: 3, y: 0 });
  const [t, setT] = useState<Vec>({ x: 2, y: 2 });
  const dragRef = useRef<null | 'f' | 't'>(null);
  const sizeRef = useRef({ w: 480, h: 360, scale: 36, ox: 240, oy: 180 });

  const toPx = (v: Vec) => {
    const { scale, ox, oy } = sizeRef.current;
    return { x: ox + v.x * scale, y: oy - v.y * scale };
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

    ctx.strokeStyle = COLORS.grid; ctx.lineWidth = 1;
    for (let gx = ox % scale; gx < w; gx += scale) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke(); }
    for (let gy = oy % scale; gy < h; gy += scale) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke(); }
    ctx.strokeStyle = COLORS.axis; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, oy); ctx.lineTo(w, oy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ox, 0); ctx.lineTo(ox, h); ctx.stroke();

    const origin = { x: ox, y: oy };

    // projection of t onto f, drawn in green
    const fLen2 = f.x * f.x + f.y * f.y || 1;
    const s = (f.x * t.x + f.y * t.y) / fLen2;
    const proj = { x: f.x * s, y: f.y * s };
    ctx.setLineDash([4, 4]); ctx.strokeStyle = 'rgba(128,128,128,0.7)';
    ctx.beginPath(); ctx.moveTo(toPx(t).x, toPx(t).y); ctx.lineTo(toPx(proj).x, toPx(proj).y); ctx.stroke();
    ctx.setLineDash([]);
    arrow(ctx, origin, toPx(proj), COLORS.proj, 2.5);

    arrow(ctx, origin, toPx(f), COLORS.f, 3.5);
    arrow(ctx, origin, toPx(t), COLORS.t, 3.5);
    label(ctx, toPx(f), 'facing f', COLORS.f);
    label(ctx, toPx(t), 'to target t', COLORS.t);

    handle(ctx, toPx(f), COLORS.f);
    handle(ctx, toPx(t), COLORS.t);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 560);
      const h = Math.round(w * 0.72);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr; canvas.height = h * dpr;
      canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
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

  useEffect(draw, [f, t]);

  const pointer = (e: PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { px: e.clientX - rect.left, py: e.clientY - rect.top };
  };
  const onDown = (e: PointerEvent) => {
    const { px, py } = pointer(e);
    const df = dist(toPx(f), { x: px, y: py });
    const dt = dist(toPx(t), { x: px, y: py });
    if (df < 22 && df <= dt) dragRef.current = 'f';
    else if (dt < 22) dragRef.current = 't';
    if (dragRef.current) { (e.target as HTMLElement).setPointerCapture(e.pointerId); e.preventDefault(); }
  };
  const onMove = (e: PointerEvent) => {
    if (!dragRef.current) return;
    const { px, py } = pointer(e);
    const m = toMath(px, py);
    if (dragRef.current === 'f') setF(m); else setT(m);
  };
  const onUp = () => { dragRef.current = null; };

  const dot = f.x * t.x + f.y * t.y;
  const cross = f.x * t.y - f.y * t.x;
  const magF = Math.hypot(f.x, f.y);
  const magT = Math.hypot(t.x, t.y);
  const angle = magF && magT ? (Math.acos(Math.min(1, Math.max(-1, dot / (magF * magT)))) * 180) / Math.PI : 0;
  const projLen = magF ? dot / magF : 0;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} />

        <div class="space-y-3 text-sm">
          <p class="text-muted">Drag <span style={`color:${COLORS.f}`} class="font-semibold">f</span> (a guard's facing) and <span style={`color:${COLORS.t}`} class="font-semibold">t</span> (direction to a target).</p>
          <div class="grid grid-cols-2 gap-2">
            <Readout label="f · t (dot)" value={dot.toFixed(2)} />
            <Readout label="angle" value={`${angle.toFixed(1)}°`} />
            <Readout label="f × t (z)" value={cross.toFixed(2)} />
            <Readout label="proj of t on f" color={COLORS.proj} value={projLen.toFixed(2)} />
          </div>
          <div class="rounded-lg bg-surface-2 p-3 space-y-1">
            <div class="flex justify-between"><span class="text-muted">in front / behind</span>
              <strong>{dot > 0.001 ? 'IN FRONT' : dot < -0.001 ? 'BEHIND' : 'EXACTLY SIDE-ON'}</strong></div>
            <div class="flex justify-between"><span class="text-muted">to the…</span>
              <strong>{cross > 0.001 ? 'LEFT' : cross < -0.001 ? 'RIGHT' : 'STRAIGHT AHEAD'}</strong></div>
            <p class="mt-1 text-xs text-muted">Dot sign = in front (+) or behind (−). Cross-z sign = left (+) or right (−). Together they place the target in any of four quadrants around the guard.</p>
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
  ctx.beginPath(); ctx.moveTo(to.x, to.y);
  ctx.lineTo(to.x - head * Math.cos(angle - 0.4), to.y - head * Math.sin(angle - 0.4));
  ctx.lineTo(to.x - head * Math.cos(angle + 0.4), to.y - head * Math.sin(angle + 0.4));
  ctx.closePath(); ctx.fill();
}
function handle(ctx: CanvasRenderingContext2D, at: Vec, color: string) {
  ctx.beginPath(); ctx.arc(at.x, at.y, 7, 0, Math.PI * 2);
  ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = color; ctx.stroke();
}
function label(ctx: CanvasRenderingContext2D, at: Vec, text: string, color: string) {
  ctx.font = '600 13px Inter, sans-serif'; ctx.fillStyle = color; ctx.fillText(text, at.x + 10, at.y - 8);
}
function dist(p: Vec, q: Vec) { return Math.hypot(p.x - q.x, p.y - q.y); }
