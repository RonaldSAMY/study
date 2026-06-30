import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Vectors in games: drag a top-down ship around the play field.
   - Drag the SHIP (indigo) to set its POSITION vector (from origin).
   - Drag the velocity HANDLE (sky) to set its VELOCITY vector.
   - Press "Step" / "Play" to integrate position += velocity and watch
     it move; read speed (magnitude) and the unit direction live.
   Canvas conventions copied from VectorPlayground.
   ------------------------------------------------------------------ */

type Vec = { x: number; y: number };

const COLORS = {
  pos: '#4f46e5',
  vel: '#0ea5e9',
  dir: '#10b981',
  grid: 'rgba(128,128,128,0.18)',
  axis: 'rgba(128,128,128,0.5)',
};

export default function GameVectorEntityLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pos, setPos] = useState<Vec>({ x: -3, y: 2 });
  const [vel, setVel] = useState<Vec>({ x: 4, y: 1 });
  const [playing, setPlaying] = useState(false);
  const dragRef = useRef<null | 'pos' | 'vel'>(null);
  const rafRef = useRef<number | null>(null);
  const sizeRef = useRef({ w: 480, h: 360, scale: 30, ox: 240, oy: 180 });

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

    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    for (let gx = ox % scale; gx < w; gx += scale) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke(); }
    for (let gy = oy % scale; gy < h; gy += scale) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke(); }
    ctx.strokeStyle = COLORS.axis; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, oy); ctx.lineTo(w, oy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ox, 0); ctx.lineTo(ox, h); ctx.stroke();

    const origin = { x: ox, y: oy };
    const shipPx = toPx(pos);
    const tip = toPx({ x: pos.x + vel.x, y: pos.y + vel.y });

    // position vector from origin to ship
    arrow(ctx, origin, shipPx, COLORS.pos, 3);
    label(ctx, shipPx, 'position', COLORS.pos);

    // velocity vector starting at the ship
    arrow(ctx, shipPx, tip, COLORS.vel, 3);
    label(ctx, tip, 'velocity', COLORS.vel);

    // unit direction (length 1) at the ship
    const speed = Math.hypot(vel.x, vel.y) || 1;
    const dirTip = toPx({ x: pos.x + vel.x / speed, y: pos.y + vel.y / speed });
    ctx.setLineDash([4, 4]);
    arrow(ctx, shipPx, dirTip, COLORS.dir, 2);
    ctx.setLineDash([]);

    // the ship itself (a little triangle facing its velocity)
    drawShip(ctx, shipPx, Math.atan2(tip.y - shipPx.y, tip.x - shipPx.x));

    // drag handles
    handle(ctx, shipPx, COLORS.pos);
    handle(ctx, tip, COLORS.vel);
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
      const scale = Math.max(18, Math.min(34, w / 16));
      sizeRef.current = { w, h, scale, ox: w / 2, oy: h / 2 };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(draw, [pos, vel]);

  // simple animation loop: position += velocity * dt, wrap at edges
  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      setPos((p) => {
        let nx = p.x + vel.x * dt;
        let ny = p.y + vel.y * dt;
        const lim = 7.5;
        if (nx > lim) nx = -lim; if (nx < -lim) nx = lim;
        if (ny > lim) ny = -lim; if (ny < -lim) ny = lim;
        return { x: Math.round(nx * 2) / 2, y: Math.round(ny * 2) / 2 };
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [playing, vel]);

  const pointer = (e: PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { px: e.clientX - rect.left, py: e.clientY - rect.top };
  };
  const onDown = (e: PointerEvent) => {
    const { px, py } = pointer(e);
    const tip = toPx({ x: pos.x + vel.x, y: pos.y + vel.y });
    const dShip = dist(toPx(pos), { x: px, y: py });
    const dTip = dist(tip, { x: px, y: py });
    if (dTip < 22 && dTip <= dShip) dragRef.current = 'vel';
    else if (dShip < 24) dragRef.current = 'pos';
    if (dragRef.current) { (e.target as HTMLElement).setPointerCapture(e.pointerId); e.preventDefault(); }
  };
  const onMove = (e: PointerEvent) => {
    if (!dragRef.current) return;
    const { px, py } = pointer(e);
    const m = toMath(px, py);
    if (dragRef.current === 'pos') setPos(m);
    else setVel({ x: m.x - pos.x, y: m.y - pos.y });
  };
  const onUp = () => { dragRef.current = null; };

  const speed = Math.hypot(vel.x, vel.y);
  const ux = speed ? vel.x / speed : 0;
  const uy = speed ? vel.y / speed : 0;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap gap-2">
        <button onClick={() => setPlaying((p) => !p)} class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${playing ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'}`}>
          {playing ? '⏸ Pause' : '▶ Play'}
        </button>
        <button onClick={() => { setPos({ x: -3, y: 2 }); setVel({ x: 4, y: 1 }); setPlaying(false); }} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">↺ Reset</button>
      </div>

      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} />

        <div class="space-y-3 text-sm">
          <p class="text-muted">Drag the <span style={`color:${COLORS.pos}`} class="font-semibold">ship</span> to move it, or drag the <span style={`color:${COLORS.vel}`} class="font-semibold">velocity tip</span> to re-aim it. Hit Play to integrate.</p>
          <div class="grid grid-cols-2 gap-2">
            <Readout label="position" color={COLORS.pos} value={`(${pos.x}, ${pos.y})`} />
            <Readout label="velocity" color={COLORS.vel} value={`(${vel.x.toFixed(1)}, ${vel.y.toFixed(1)})`} />
            <Readout label="speed ‖v‖" value={speed.toFixed(2)} />
            <Readout label="direction (unit)" color={COLORS.dir} value={`(${ux.toFixed(2)}, ${uy.toFixed(2)})`} />
          </div>
          <p class="rounded-lg bg-surface-2 p-3 text-xs text-muted">Speed is the velocity's magnitude. The dashed green arrow is the <strong>unit direction</strong> — same heading, length exactly 1. Multiply it by any speed to build a new velocity.</p>
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
function drawShip(ctx: CanvasRenderingContext2D, at: Vec, rot: number) {
  ctx.save(); ctx.translate(at.x, at.y); ctx.rotate(rot);
  ctx.fillStyle = 'rgba(79,70,229,0.25)'; ctx.strokeStyle = '#4f46e5'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-9, 8); ctx.lineTo(-9, -8); ctx.closePath();
  ctx.fill(); ctx.stroke(); ctx.restore();
}
function handle(ctx: CanvasRenderingContext2D, at: Vec, color: string) {
  ctx.beginPath(); ctx.arc(at.x, at.y, 7, 0, Math.PI * 2);
  ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = color; ctx.stroke();
}
function label(ctx: CanvasRenderingContext2D, at: Vec, text: string, color: string) {
  ctx.font = '600 13px Inter, sans-serif'; ctx.fillStyle = color; ctx.fillText(text, at.x + 10, at.y - 8);
}
function dist(p: Vec, q: Vec) { return Math.hypot(p.x - q.x, p.y - q.y); }
