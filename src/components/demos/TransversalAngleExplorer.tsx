import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Transversal across two parallel lines.
   - Two horizontal parallel "beams" stay fixed.
   - A transversal pivots through the middle; drag the handle (or use
     the slider) to change its angle.
   - Pick an angle-pair relationship and watch the two matching angles
     light up with their measures (equal, or summing to 180°).
   ------------------------------------------------------------------ */

type Pair = 'corresponding' | 'alternate' | 'cointerior';

const COLORS = {
  beam: '#4f46e5',
  trans: '#0ea5e9',
  hi: '#10b981',
};

export default function TransversalAngleExplorer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [deg, setDeg] = useState(58); // angle of transversal from the +x axis (canvas, y-down)
  const [pair, setPair] = useState<Pair>('corresponding');
  const sizeRef = useRef({ w: 480, h: 360 });
  const geomRef = useRef({ hx: 0, hy: 0, cx: 0, my: 0 });
  const dragRef = useRef(false);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);

    const cx = w / 2;
    const y1 = h * 0.3; // top beam
    const y2 = h * 0.7; // bottom beam
    const my = (y1 + y2) / 2;
    const theta = (deg * Math.PI) / 180;
    const dx = Math.cos(theta);
    const dy = Math.sin(theta);
    const xAt = (y: number) => cx + ((y - my) * dx) / dy;
    const px1 = xAt(y1);
    const px2 = xAt(y2);

    // ---- highlighted angle wedges (drawn under the lines) ----
    const wedges = pickWedges(pair, theta);
    drawWedge(ctx, px1, y1, wedges.top[0], wedges.top[1]);
    drawWedge(ctx, px2, y2, wedges.bot[0], wedges.bot[1]);

    // ---- beams (parallel lines) ----
    ctx.strokeStyle = COLORS.beam;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    line(ctx, 0, y1, w, y1);
    line(ctx, 0, y2, w, y2);
    parMark(ctx, w * 0.16, y1);
    parMark(ctx, w * 0.16, y2);

    // ---- transversal ----
    const ext = 1200;
    ctx.strokeStyle = COLORS.trans;
    ctx.lineWidth = 3;
    line(ctx, px1 - dx * ext, y1 - dy * ext, px2 + dx * ext, y2 + dy * ext);

    dot(ctx, px1, y1, COLORS.trans);
    dot(ctx, px2, y2, COLORS.trans);
    const hx = px2 + dx * 78;
    const hy = y2 + dy * 78;
    handle(ctx, hx, hy, COLORS.trans);
    geomRef.current = { hx, hy, cx, my };
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
      sizeRef.current = { w, h };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(draw, [deg, pair]);

  const pointer = (e: PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { px: e.clientX - rect.left, py: e.clientY - rect.top };
  };
  const onDown = (e: PointerEvent) => {
    const g = geomRef.current;
    const { px, py } = pointer(e);
    if (Math.hypot(px - g.hx, py - g.hy) < 28) {
      dragRef.current = true;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      e.preventDefault();
    }
  };
  const onMove = (e: PointerEvent) => {
    if (!dragRef.current) return;
    const g = geomRef.current;
    const { px, py } = pointer(e);
    let ang = (Math.atan2(py - g.my, px - g.cx) * 180) / Math.PI;
    if (ang < 0) ang += 180;
    setDeg(Math.max(20, Math.min(160, ang)));
  };
  const onUp = () => { dragRef.current = false; };

  const info = pairInfo(pair, deg);

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap gap-2">
        {(['corresponding', 'alternate', 'cointerior'] as Pair[]).map((p) => (
          <button
            key={p}
            onClick={() => setPair(p)}
            class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              pair === p ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
            }`}
          >
            {p === 'corresponding' ? 'Corresponding' : p === 'alternate' ? 'Alternate interior' : 'Co-interior'}
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
          <p class="text-muted">Drag the dot on the transversal (or use the slider) to tilt it.</p>
          <label class="block">
            <span class="mb-1 block text-muted">transversal angle = {Math.round(deg)}°</span>
            <input
              type="range" min={20} max={160} step={1} value={deg}
              onInput={(e) => setDeg(parseFloat((e.target as HTMLInputElement).value))}
              class="w-full accent-[#0ea5e9]"
            />
          </label>
          <div class="grid grid-cols-2 gap-2">
            <Readout label="green angle (top)" value={`${info.top}°`} />
            <Readout label="green angle (bottom)" value={`${info.bot}°`} />
          </div>
          <div class="rounded-lg bg-surface-2 p-3">
            <p class="font-semibold text-text">{info.title}</p>
            <p class="mt-1 text-xs text-muted">{info.body}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* Each wedge is [startRad, endRad] in canvas angle convention (0 = +x, growing
   clockwise on screen since y points down). The right beam ray is at 0,
   the left beam ray at π. The transversal points down at θ and up at θ+π. */
function pickWedges(pair: Pair, theta: number) {
  if (pair === 'corresponding') {
    return { top: [0, theta] as const, bot: [0, theta] as const };
  }
  if (pair === 'alternate') {
    return { top: [0, theta] as const, bot: [Math.PI, Math.PI + theta] as const };
  }
  // co-interior: same-side interior angles → supplementary
  return { top: [0, theta] as const, bot: [Math.PI + theta, 2 * Math.PI] as const };
}

function pairInfo(pair: Pair, deg: number) {
  const t = Math.round(deg);
  if (pair === 'corresponding')
    return {
      top: t, bot: t,
      title: 'Corresponding angles are equal',
      body: `Matching corners on the same side both measure ${t}°. Tilt the transversal — they stay identical.`,
    };
  if (pair === 'alternate')
    return {
      top: t, bot: t,
      title: 'Alternate interior angles are equal',
      body: `On opposite sides, between the beams, both measure ${t}°.`,
    };
  return {
    top: t, bot: 180 - t,
    title: 'Co-interior angles are supplementary',
    body: `Same-side interior angles add to 180°: ${t}° + ${180 - t}° = 180°.`,
  };
}

// ---- canvas primitives ----
function drawWedge(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, e: number) {
  const r = 34;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.arc(x, y, r, s, e);
  ctx.closePath();
  ctx.fillStyle = 'rgba(16,185,129,0.22)';
  ctx.fill();
  ctx.strokeStyle = COLORS.hi;
  ctx.lineWidth = 2;
  ctx.stroke();
  // label at the bisector
  const mid = (s + e) / 2;
  const lr = r + 16;
  ctx.fillStyle = COLORS.hi;
  ctx.font = '700 13px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const span = Math.round(((e - s) * 180) / Math.PI);
  ctx.fillText(`${span}°`, x + lr * Math.cos(mid), y + lr * Math.sin(mid));
  ctx.restore();
}
function line(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
}
function dot(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
  ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2);
  ctx.fillStyle = color; ctx.fill();
}
function handle(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
  ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2);
  ctx.fillStyle = '#fff'; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = color; ctx.stroke();
}
function parMark(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save();
  ctx.strokeStyle = COLORS.beam;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 6, y - 6); ctx.lineTo(x + 2, y); ctx.lineTo(x - 6, y + 6);
  ctx.stroke();
  ctx.restore();
}

function Readout({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div class="rounded-lg bg-surface-2 px-3 py-2">
      <span class="text-muted" style={color ? `color:${color}` : ""}>{label}</span>
      <div class="font-mono font-semibold">{value}</div>
    </div>
  );
}
