import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Loss response lab (image classifier framing).
   True label y is 0 or 1. Drag the predicted probability p and watch
   two losses respond:
       MSE            = (p - y)^2
       cross-entropy  = -[ y log p + (1-y) log(1-p) ]
   Both curves are plotted over p in (0,1); a marker tracks the drag.
   ------------------------------------------------------------------ */

const COLORS = {
  mse: '#0ea5e9',
  ce: '#4f46e5',
  marker: '#10b981',
  grid: 'rgba(128,128,128,0.18)',
  axis: 'rgba(128,128,128,0.5)',
};

const eps = 1e-4;
const clampP = (p: number) => Math.max(eps, Math.min(1 - eps, p));
const mse = (p: number, y: number) => (p - y) ** 2;
const ce = (p: number, y: number) => -(y * Math.log(clampP(p)) + (1 - y) * Math.log(1 - clampP(p)));

export default function LossResponseLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [p, setP] = useState(0.6);
  const [y, setY] = useState<0 | 1>(1);
  const draggingRef = useRef(false);
  const sizeRef = useRef({ w: 480, h: 320, ox: 44, oy: 290, sx: 400, sy: 60 });

  const YMAX = 4.5; // cap so the log curve stays on screen
  const toPx = (px: number, py: number) => {
    const { ox, oy, sx, sy } = sizeRef.current;
    return { x: ox + px * sx, y: oy - py * sy };
  };

  const drawCurve = (ctx: CanvasRenderingContext2D, f: (p: number) => number, color: string, dash: number[]) => {
    const { w, ox, sx } = sizeRef.current;
    ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.setLineDash(dash); ctx.beginPath();
    let started = false;
    for (let pxp = ox; pxp <= ox + sx; pxp += 2) {
      const pp = (pxp - ox) / sx;
      if (pp <= 0 || pp >= 1) continue;
      const v = Math.min(YMAX, f(pp));
      const q = toPx(pp, v);
      if (!started) { ctx.moveTo(q.x, q.y); started = true; } else ctx.lineTo(q.x, q.y);
      if (pxp > w) break;
    }
    ctx.stroke(); ctx.setLineDash([]);
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h, ox, oy, sx } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);

    // grid (p axis)
    ctx.strokeStyle = COLORS.grid; ctx.lineWidth = 1;
    for (let g = 0; g <= 10; g++) {
      const X = ox + (g / 10) * sx;
      ctx.beginPath(); ctx.moveTo(X, 0); ctx.lineTo(X, oy); ctx.stroke();
    }
    for (let g = 0; g <= YMAX; g++) {
      const Y = toPx(0, g).y;
      ctx.beginPath(); ctx.moveTo(ox, Y); ctx.lineTo(ox + sx, Y); ctx.stroke();
    }
    // axes
    ctx.strokeStyle = COLORS.axis; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(ox, 0); ctx.lineTo(ox, oy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox + sx, oy); ctx.stroke();
    ctx.fillStyle = 'rgba(128,128,128,0.9)'; ctx.font = '600 11px Inter, sans-serif';
    ctx.fillText('predicted probability p →', ox + 6, oy + 22);
    ctx.fillText('loss', 6, 14);

    drawCurve(ctx, (pp) => mse(pp, y), COLORS.mse, []);
    drawCurve(ctx, (pp) => ce(pp, y), COLORS.ce, [7, 4]);

    // marker line at p
    const mxPx = toPx(clampP(p), 0).x;
    ctx.strokeStyle = COLORS.marker; ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(mxPx, 0); ctx.lineTo(mxPx, oy); ctx.stroke(); ctx.setLineDash([]);
    const mMse = toPx(clampP(p), Math.min(YMAX, mse(p, y)));
    const mCe = toPx(clampP(p), Math.min(YMAX, ce(p, y)));
    ctx.beginPath(); ctx.arc(mMse.x, mMse.y, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = COLORS.mse; ctx.stroke();
    ctx.beginPath(); ctx.arc(mCe.x, mCe.y, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = COLORS.ce; ctx.stroke();

    // true label tick
    const ty = toPx(y, 0);
    ctx.beginPath(); ctx.arc(ty.x, oy, 5, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.marker; ctx.fill();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 520);
      const h = Math.round(w * 0.66);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const ox = 44, oy = h - 30;
      const sx = w - ox - 14;
      const sy = (oy - 12) / YMAX;
      sizeRef.current = { w, h, ox, oy, sx, sy };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(draw, [p, y]);

  const pointer = (e: PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return e.clientX - rect.left;
  };
  const setFromPx = (px: number) => {
    const { ox, sx } = sizeRef.current;
    setP(Math.max(0.001, Math.min(0.999, (px - ox) / sx)));
  };
  const onDown = (e: PointerEvent) => {
    draggingRef.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setFromPx(pointer(e)); e.preventDefault();
  };
  const onMove = (e: PointerEvent) => { if (draggingRef.current) setFromPx(pointer(e)); };
  const onUp = () => { draggingRef.current = false; };

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <span class="text-sm text-muted">True label:</span>
        {([1, 0] as (0 | 1)[]).map((v) => (
          <button
            key={v}
            onClick={() => setY(v)}
            class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              y === v ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
            }`}
          >
            {v === 1 ? 'y = 1 (cat)' : 'y = 0 (not cat)'}
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
          <p class="text-muted">
            Drag left/right to set the model's predicted probability <strong>p</strong>. Solid sky is
            MSE; dashed indigo is cross-entropy. The green dot on the axis marks the true label.
          </p>
          <div class="rounded-lg bg-surface-2 p-3">
            <div class="flex justify-between"><span class="text-muted">p</span><strong>{p.toFixed(3)}</strong></div>
            <div class="flex justify-between"><span style="color:#0ea5e9">MSE</span><strong>{mse(p, y).toFixed(3)}</strong></div>
            <div class="flex justify-between"><span style="color:#4f46e5">cross-entropy</span><strong>{ce(p, y).toFixed(3)}</strong></div>
            <p class="mt-1 text-xs text-muted">
              {(y === 1 ? p < 0.1 : p > 0.9)
                ? 'Confident and wrong: cross-entropy shoots toward ∞ while MSE barely passes 1. That steep penalty is why classifiers use cross-entropy.'
                : 'When the prediction matches the label, both losses fall toward 0.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
