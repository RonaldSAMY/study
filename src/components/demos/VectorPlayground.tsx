import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Interactive 2D vector playground.
   - Drag the tips of vector a (indigo) and b (sky).
   - Toggle between Add (a + b), Scale (k·a) and Dot (a · b) modes.
   - Everything redraws live on a crisp, responsive canvas.
   ------------------------------------------------------------------ */

type Mode = 'add' | 'scale' | 'dot';
type Vec = { x: number; y: number };

const COLORS = {
  a: '#4f46e5',
  b: '#0ea5e9',
  result: '#10b981',
  grid: 'rgba(128,128,128,0.18)',
  axis: 'rgba(128,128,128,0.5)',
};

export default function VectorPlayground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [a, setA] = useState<Vec>({ x: 3, y: 1 });
  const [b, setB] = useState<Vec>({ x: 1, y: 2 });
  const [k, setK] = useState(1.5);
  const [mode, setMode] = useState<Mode>('add');
  const dragRef = useRef<null | 'a' | 'b'>(null);
  const sizeRef = useRef({ w: 480, h: 360, scale: 36, ox: 240, oy: 180 });

  // ---- coordinate helpers (math space <-> pixels) ----
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

    // grid
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    for (let gx = ox % scale; gx < w; gx += scale) {
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke();
    }
    for (let gy = oy % scale; gy < h; gy += scale) {
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke();
    }
    // axes
    ctx.strokeStyle = COLORS.axis;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, oy); ctx.lineTo(w, oy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ox, 0); ctx.lineTo(ox, h); ctx.stroke();

    const origin = { x: ox, y: oy };

    // result / helpers depending on mode
    if (mode === 'add') {
      const sum = { x: a.x + b.x, y: a.y + b.y };
      // parallelogram helper lines
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = 'rgba(128,128,128,0.6)';
      drawSeg(ctx, toPx(a), toPx(sum));
      drawSeg(ctx, toPx(b), toPx(sum));
      ctx.setLineDash([]);
      arrow(ctx, origin, toPx(sum), COLORS.result, 3);
      label(ctx, toPx(sum), 'a + b', COLORS.result);
    } else if (mode === 'scale') {
      const sc = { x: a.x * k, y: a.y * k };
      arrow(ctx, origin, toPx(sc), COLORS.result, 3);
      label(ctx, toPx(sc), `${k.toFixed(1)}·a`, COLORS.result);
    } else if (mode === 'dot') {
      // projection of b onto a
      const aLen2 = a.x * a.x + a.y * a.y || 1;
      const t = (a.x * b.x + a.y * b.y) / aLen2;
      const proj = { x: a.x * t, y: a.y * t };
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(128,128,128,0.7)';
      drawSeg(ctx, toPx(b), toPx(proj));
      ctx.setLineDash([]);
      arrow(ctx, origin, toPx(proj), COLORS.result, 3);
      label(ctx, toPx(proj), 'proj', COLORS.result);
    }

    // base vectors on top
    arrow(ctx, origin, toPx(a), COLORS.a, 3.5);
    arrow(ctx, origin, toPx(b), COLORS.b, 3.5);
    label(ctx, toPx(a), 'a', COLORS.a);
    label(ctx, toPx(b), 'b', COLORS.b);

    // draggable handles
    handle(ctx, toPx(a), COLORS.a);
    handle(ctx, toPx(b), COLORS.b);
  };

  // ---- responsive sizing with devicePixelRatio ----
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

  // redraw whenever state changes
  useEffect(draw, [a, b, k, mode]);

  // ---- pointer dragging ----
  const pointer = (e: PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { px: e.clientX - rect.left, py: e.clientY - rect.top };
  };

  const onDown = (e: PointerEvent) => {
    const { px, py } = pointer(e);
    const da = dist(toPx(a), { x: px, y: py });
    const db = dist(toPx(b), { x: px, y: py });
    if (da < 22 && da <= db) dragRef.current = 'a';
    else if (db < 22) dragRef.current = 'b';
    if (dragRef.current) {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      e.preventDefault();
    }
  };
  const onMove = (e: PointerEvent) => {
    if (!dragRef.current) return;
    const { px, py } = pointer(e);
    const m = toMath(px, py);
    if (dragRef.current === 'a') setA(m);
    else setB(m);
  };
  const onUp = () => { dragRef.current = null; };

  // ---- live numeric readout ----
  const dot = a.x * b.x + a.y * b.y;
  const magA = Math.hypot(a.x, a.y);
  const magB = Math.hypot(b.x, b.y);
  const angle = magA && magB ? (Math.acos(Math.min(1, Math.max(-1, dot / (magA * magB)))) * 180) / Math.PI : 0;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap gap-2">
        {(['add', 'scale', 'dot'] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            class={`rounded-lg px-3 py-1.5 text-sm font-semibold capitalize transition ${
              mode === m ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
            }`}
          >
            {m === 'add' ? 'a + b' : m === 'scale' ? 'k · a' : 'a · b'}
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
          <p class="text-muted">Drag the colored dots to change the vectors.</p>
          <div class="grid grid-cols-2 gap-2">
            <Readout label="a" color={COLORS.a} value={`(${a.x}, ${a.y})`} />
            <Readout label="b" color={COLORS.b} value={`(${b.x}, ${b.y})`} />
            <Readout label="‖a‖" value={magA.toFixed(2)} />
            <Readout label="‖b‖" value={magB.toFixed(2)} />
          </div>

          {mode === 'scale' && (
            <label class="block">
              <span class="mb-1 block text-muted">scalar k = {k.toFixed(1)}</span>
              <input
                type="range" min={-2} max={3} step={0.1} value={k}
                onInput={(e) => setK(parseFloat((e.target as HTMLInputElement).value))}
                class="w-full accent-[#10b981]"
              />
            </label>
          )}

          {mode === 'dot' && (
            <div class="rounded-lg bg-surface-2 p-3">
              <div class="flex justify-between"><span class="text-muted">a · b</span><strong>{dot.toFixed(2)}</strong></div>
              <div class="flex justify-between"><span class="text-muted">angle</span><strong>{angle.toFixed(1)}°</strong></div>
              <p class="mt-1 text-xs text-muted">
                {dot > 0.001 ? 'Positive → pointing a similar way.' : dot < -0.001 ? 'Negative → pointing opposite ways.' : 'Zero → perpendicular!'}
              </p>
            </div>
          )}
          {mode === 'add' && (
            <div class="rounded-lg bg-surface-2 p-3">
              <div class="flex justify-between"><span class="text-muted">a + b</span><strong>({a.x + b.x}, {a.y + b.y})</strong></div>
              <p class="mt-1 text-xs text-muted">Tip-to-tail: walk along a, then along b.</p>
            </div>
          )}
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

// ---- canvas drawing primitives ----
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
