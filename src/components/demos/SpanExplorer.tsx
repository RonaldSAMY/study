import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Span explorer.
   - Two base vectors v1 (indigo) and v2 (sky).
   - Sliders pick weights c1, c2; the emerald dot is c1·v1 + c2·v2.
   - "Parallel" preset makes v2 a multiple of v1 → the span collapses
     from the whole plane to a single line.
   - Toggle shades the reachable set (line or plane).
   ------------------------------------------------------------------ */

type Vec = { x: number; y: number };

const COLORS = {
  v1: '#4f46e5',
  v2: '#0ea5e9',
  point: '#10b981',
  span: 'rgba(16,185,129,0.14)',
  grid: 'rgba(128,128,128,0.18)',
  axis: 'rgba(128,128,128,0.5)',
};

export default function SpanExplorer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [parallel, setParallel] = useState(false);
  const [showSpan, setShowSpan] = useState(true);
  const [c1, setC1] = useState(1);
  const [c2, setC2] = useState(1);
  const sizeRef = useRef({ w: 480, h: 360, scale: 30, ox: 240, oy: 180 });

  const v1: Vec = { x: 2, y: 1 };
  const v2: Vec = parallel ? { x: -3, y: -1.5 } : { x: -1, y: 2 };

  const toPx = (p: Vec) => {
    const { scale, ox, oy } = sizeRef.current;
    return { x: ox + p.x * scale, y: oy - p.y * scale };
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

    // span shading
    if (showSpan) {
      if (parallel) {
        // a single line through origin in direction v1
        const far = { x: v1.x * 100, y: v1.y * 100 };
        const farN = { x: -v1.x * 100, y: -v1.y * 100 };
        ctx.strokeStyle = COLORS.point;
        ctx.lineWidth = 6; ctx.globalAlpha = 0.25;
        ctx.beginPath(); ctx.moveTo(toPx(farN).x, toPx(farN).y); ctx.lineTo(toPx(far).x, toPx(far).y); ctx.stroke();
        ctx.globalAlpha = 1;
      } else {
        ctx.fillStyle = COLORS.span;
        ctx.fillRect(0, 0, w, h); // independent vectors span the whole plane
      }
    }

    const origin = { x: ox, y: oy };
    const result = { x: c1 * v1.x + c2 * v2.x, y: c1 * v1.y + c2 * v2.y };

    // scaled component vectors (dashed) to build the parallelogram path
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(128,128,128,0.6)';
    drawSeg(ctx, toPx({ x: c1 * v1.x, y: c1 * v1.y }), toPx(result));
    drawSeg(ctx, toPx({ x: c2 * v2.x, y: c2 * v2.y }), toPx(result));
    ctx.setLineDash([]);

    arrow(ctx, origin, toPx(v1), COLORS.v1, 3.5);
    arrow(ctx, origin, toPx(v2), COLORS.v2, 3.5);
    label(ctx, toPx(v1), 'v₁', COLORS.v1);
    label(ctx, toPx(v2), 'v₂', COLORS.v2);

    // result point
    const rp = toPx(result);
    ctx.beginPath(); ctx.arc(rp.x, rp.y, 7, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.point; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
    label(ctx, rp, 'c₁v₁+c₂v₂', COLORS.point);
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
      const scale = Math.max(20, Math.min(36, w / 16));
      sizeRef.current = { w, h, scale, ox: w / 2, oy: h / 2 };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(draw, [c1, c2, parallel, showSpan]);

  const result = { x: c1 * v1.x + c2 * v2.x, y: c1 * v1.y + c2 * v2.y };

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap gap-2">
        <button
          onClick={() => setParallel(false)}
          class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${!parallel ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'}`}
        >Independent (plane)</button>
        <button
          onClick={() => setParallel(true)}
          class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${parallel ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'}`}
        >Parallel (line)</button>
        <button
          onClick={() => setShowSpan((s) => !s)}
          class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${showSpan ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'}`}
        >{showSpan ? 'Hide span' : 'Show span'}</button>
      </div>

      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />
        <div class="space-y-3 text-sm">
          <label class="block">
            <span class="mb-1 block text-muted">weight c₁ = {c1.toFixed(1)}</span>
            <input type="range" min={-3} max={3} step={0.1} value={c1}
              onInput={(e) => setC1(parseFloat((e.target as HTMLInputElement).value))}
              class="w-full accent-[#4f46e5]" />
          </label>
          <label class="block">
            <span class="mb-1 block text-muted">weight c₂ = {c2.toFixed(1)}</span>
            <input type="range" min={-3} max={3} step={0.1} value={c2}
              onInput={(e) => setC2(parseFloat((e.target as HTMLInputElement).value))}
              class="w-full accent-[#0ea5e9]" />
          </label>
          <div class="rounded-lg bg-surface-2 p-3">
            <div class="flex justify-between"><span class="text-muted">reached point</span>
              <strong>({result.x.toFixed(1)}, {result.y.toFixed(1)})</strong></div>
            <p class="mt-1 text-xs text-muted">
              {parallel
                ? 'v₂ is a multiple of v₁, so every mix lands on ONE line — most of the plane is unreachable.'
                : 'v₁ and v₂ point different ways, so the right weights can reach ANY point in the plane.'}
            </p>
          </div>
        </div>
      </div>
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
function label(ctx: CanvasRenderingContext2D, at: Vec, text: string, color: string) {
  ctx.font = '600 13px Inter, sans-serif'; ctx.fillStyle = color; ctx.fillText(text, at.x + 10, at.y - 8);
}
