import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Lagrange-multiplier / constrained-optimization demo.
   Maximize output  f(x,y) = x · y   (e.g. value from two investments)
   subject to a budget line  x + y = B.
   - Curved lines = contours of f (where output is constant).
   - Straight line = the budget constraint you MUST stay on.
   - Drag the point along the line; the best spot is where a contour is
     exactly TANGENT to the line — there ∇f is parallel to ∇g.
   ------------------------------------------------------------------ */

const COLORS = {
  contour: 'rgba(79,70,229,0.55)',
  contourBest: '#f59e0b',
  line: '#0ea5e9',
  point: '#10b981',
  gradF: '#4f46e5',
  gradG: '#0ea5e9',
  grid: 'rgba(128,128,128,0.16)',
  axis: 'rgba(128,128,128,0.5)',
};

export default function LagrangeConstraintDemo() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [B, setB] = useState(8);
  const [t, setT] = useState(0.32); // position along the line, 0..1
  const dragRef = useRef(false);
  const sizeRef = useRef({ w: 420, h: 420, s: 38, ox: 30, oy: 390 });

  const RANGE = 10;
  // point on the line x + y = B parameterised by t (x from 0..B)
  const px = t * B;
  const py = B - px;
  const fVal = px * py;
  const optX = B / 2; // analytic optimum
  const atOptimum = Math.abs(px - optX) < 0.25;

  const toPx = (x: number, y: number) => {
    const { s, ox, oy } = sizeRef.current;
    return { x: ox + x * s, y: oy - y * s };
  };
  const toMath = (cx: number, cy: number) => {
    const { s, ox, oy } = sizeRef.current;
    return { x: (cx - ox) / s, y: (oy - cy) / s };
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);

    // grid
    ctx.strokeStyle = COLORS.grid; ctx.lineWidth = 1;
    for (let i = 0; i <= RANGE; i++) {
      const v = toPx(i, 0); const hpt = toPx(0, i);
      ctx.beginPath(); ctx.moveTo(v.x, toPx(0, 0).y); ctx.lineTo(v.x, toPx(0, RANGE).y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(toPx(0, 0).x, hpt.y); ctx.lineTo(toPx(RANGE, 0).x, hpt.y); ctx.stroke();
    }
    // axes
    ctx.strokeStyle = COLORS.axis; ctx.lineWidth = 1.5;
    const o = toPx(0, 0);
    ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.lineTo(toPx(RANGE, 0).x, o.y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.lineTo(o.x, toPx(0, RANGE).y); ctx.stroke();

    // contours of f = xy for several levels (xy = c -> y = c/x)
    const best = optX * optX; // value at optimum
    const levels = [4, 9, 16, best, 30, 42];
    for (const c of levels) {
      const isBest = Math.abs(c - best) < 0.5;
      ctx.strokeStyle = isBest ? COLORS.contourBest : COLORS.contour;
      ctx.lineWidth = isBest ? 2.5 : 1.5;
      ctx.beginPath();
      let first = true;
      for (let x = 0.4; x <= RANGE; x += 0.05) {
        const y = c / x;
        if (y < 0 || y > RANGE) { first = true; continue; }
        const p = toPx(x, y);
        if (first) { ctx.moveTo(p.x, p.y); first = false; } else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }

    // constraint line x + y = B
    ctx.strokeStyle = COLORS.line; ctx.lineWidth = 3;
    const x0 = Math.max(0, B - RANGE), x1 = Math.min(RANGE, B);
    const a = toPx(x0, B - x0), b = toPx(x1, B - x1);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();

    // gradient vectors at the point  ∇f = (y, x), ∇g = (1,1)
    const pp = toPx(px, py);
    const gf = { x: py, y: px };
    const gn = Math.hypot(gf.x, gf.y) || 1;
    const scaleF = 2.4 / gn;
    drawArrow(ctx, pp, toPx(px + gf.x * scaleF, py + gf.y * scaleF), COLORS.gradF, '∇f');
    drawArrow(ctx, pp, toPx(px + 1.4 * 0.7, py + 1.4 * 0.7), COLORS.gradG, '∇g');

    // the draggable point
    ctx.beginPath(); ctx.arc(pp.x, pp.y, 8, 0, Math.PI * 2);
    ctx.fillStyle = atOptimum ? COLORS.contourBest : COLORS.point; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 440);
      const h = w;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const pad = 30;
      const s = (w - pad - 12) / RANGE;
      sizeRef.current = { w, h, s, ox: pad, oy: h - pad };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(draw, [B, t]);

  const setFromPointer = (e: PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const m = toMath(e.clientX - rect.left, e.clientY - rect.top);
    // project onto the line: choose x clamped to valid range
    const x = Math.max(Math.max(0, B - RANGE), Math.min(Math.min(RANGE, B), m.x));
    setT(B > 0 ? x / B : 0);
  };
  const onDown = (e: PointerEvent) => {
    dragRef.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setFromPointer(e); e.preventDefault();
  };
  const onMove = (e: PointerEvent) => { if (dragRef.current) setFromPointer(e); };
  const onUp = () => { dragRef.current = false; };

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2"
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} />

        <div class="space-y-3 text-sm">
          <p class="text-muted">Drag the green point along the blue budget line. Maximize output <strong>f = x·y</strong>.</p>
          <label class="block">
            <span class="mb-1 block text-muted">budget B (x + y = {B})</span>
            <input type="range" min={4} max={14} step={1} value={B}
              onInput={(e) => setB(parseInt((e.target as HTMLInputElement).value))}
              class="w-full accent-[#0ea5e9]" />
          </label>
          <div class="grid grid-cols-2 gap-2">
            <Readout label="x" value={px.toFixed(2)} />
            <Readout label="y" value={py.toFixed(2)} />
            <Readout label="output f = x·y" value={fVal.toFixed(2)} />
            <Readout label="best possible" value={(optX * optX).toFixed(2)} />
          </div>
          <div class="rounded-lg bg-surface-2 p-3">
            <p class="text-xs text-muted">
              {atOptimum
                ? '🎯 Tangent! Here ∇f is parallel to ∇g — that is the Lagrange condition ∇f = λ∇g.'
                : 'Slide toward the orange contour: the optimum is where the contour just kisses the line (gradients line up).'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div class="rounded-lg bg-surface-2 px-3 py-2">
      <span class="text-muted">{label}</span>
      <div class="font-mono font-semibold">{value}</div>
    </div>
  );
}

function drawArrow(ctx: CanvasRenderingContext2D, from: { x: number; y: number }, to: { x: number; y: number }, color: string, text: string) {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const head = 9;
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(to.x - head * Math.cos(angle - 0.4), to.y - head * Math.sin(angle - 0.4));
  ctx.lineTo(to.x - head * Math.cos(angle + 0.4), to.y - head * Math.sin(angle + 0.4));
  ctx.closePath(); ctx.fill();
  ctx.font = '600 12px Inter, sans-serif';
  ctx.fillText(text, to.x + 4, to.y - 4);
}
