import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Circles: radius, circumference, area and π.
   - Drag the rim handle (or slide) to change the radius r.
   - Live C = 2πr and A = πr².
   - Press "Roll it out" to roll the circle one full turn; the path it
     traces is its circumference — and it is always ≈ 3.14 diameters
     long. That ratio IS π.
   ------------------------------------------------------------------ */

const COLORS = {
  circle: '#4f46e5',
  roll: '#0ea5e9',
  trace: '#10b981',
};

export default function CircleUnrollDemo() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [r, setR] = useState(1.4);
  const [playing, setPlaying] = useState(false);
  const sizeRef = useRef({ w: 480, h: 400 });
  const cfg = useRef({ scale: 26, cxTop: 130, cyTop: 110, baseY: 320, x0: 40 });
  const progRef = useRef(0); // 0..1 of one full roll
  const rafRef = useRef<number | null>(null);
  const dragRef = useRef(false);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);
    const { scale, cxTop, cyTop, baseY, x0 } = cfg.current;
    const rPx = r * scale;
    const d = 2 * rPx;
    const C = 2 * Math.PI * rPx;

    // ---- static reference circle (top-left) ----
    ctx.strokeStyle = COLORS.circle;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cxTop, cyTop, rPx, 0, Math.PI * 2); ctx.stroke();
    // radius line + handle
    ctx.strokeStyle = COLORS.circle; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cxTop, cyTop); ctx.lineTo(cxTop + rPx, cyTop); ctx.stroke();
    ctx.fillStyle = COLORS.circle; ctx.font = '700 12px Inter, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText(`r = ${r.toFixed(2)}`, cxTop + rPx / 2, cyTop - 4);
    handle(ctx, cxTop + rPx, cyTop, COLORS.circle);
    dot(ctx, cxTop, cyTop, COLORS.circle);

    // ---- baseline ----
    ctx.strokeStyle = 'rgba(128,128,128,0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x0, baseY); ctx.lineTo(w - 10, baseY); ctx.stroke();

    // diameter tick marks along the full circumference length
    const fullLen = C;
    ctx.strokeStyle = 'rgba(128,128,128,0.45)';
    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 10px Inter, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (let i = 1; i * d <= fullLen + 0.5; i++) {
      const x = x0 + i * d;
      ctx.beginPath(); ctx.moveTo(x, baseY - 5); ctx.lineTo(x, baseY + 5); ctx.stroke();
      ctx.fillText(`${i}d`, x, baseY + 7);
    }

    // traced (unrolled) circumference so far
    const dist = C * progRef.current;
    ctx.strokeStyle = COLORS.trace;
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(x0, baseY); ctx.lineTo(x0 + dist, baseY); ctx.stroke();

    // rolling circle
    const ccx = x0 + rPx + dist;
    const ccy = baseY - rPx;
    ctx.strokeStyle = COLORS.roll; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(ccx, ccy, rPx, 0, Math.PI * 2); ctx.stroke();
    // a spoke to visualize rolling
    const ang = -Math.PI / 2 + (dist / rPx);
    ctx.strokeStyle = COLORS.roll; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(ccx, ccy);
    ctx.lineTo(ccx + rPx * Math.cos(ang), ccy + rPx * Math.sin(ang)); ctx.stroke();
    dot(ctx, ccx, ccy, COLORS.roll);

    // end label when (nearly) complete
    if (progRef.current > 0.02) {
      ctx.fillStyle = COLORS.trace;
      ctx.font = '700 12px Inter, sans-serif';
      ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
      ctx.fillText(`length so far = ${(dist / scale).toFixed(2)}`, x0, baseY - 10);
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 560);
      const h = Math.round(w * 0.82);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const x0 = 40;
      const rMax = 2;
      const scale = Math.min(36, (w - x0 - 16) / (2 * Math.PI * rMax + 2 * rMax));
      sizeRef.current = { w, h };
      cfg.current = { scale, cxTop: Math.max(120, w * 0.26), cyTop: h * 0.26, baseY: h * 0.8, x0 };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  useEffect(draw, [r]);

  // animation loop
  useEffect(() => {
    if (!playing) return;
    progRef.current = 0;
    let last = performance.now();
    const step = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      progRef.current = Math.min(1, progRef.current + dt / 3.2);
      draw();
      if (progRef.current >= 1) {
        setPlaying(false);
        rafRef.current = null;
        return;
      }
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [playing]);

  const pointer = (e: PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { px: e.clientX - rect.left, py: e.clientY - rect.top };
  };
  const onDown = (e: PointerEvent) => {
    const { scale, cxTop, cyTop } = cfg.current;
    const { px, py } = pointer(e);
    if (Math.hypot(px - (cxTop + r * scale), py - cyTop) < 26) {
      dragRef.current = true;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      e.preventDefault();
    }
  };
  const onMove = (e: PointerEvent) => {
    if (!dragRef.current) return;
    const { scale, cxTop } = cfg.current;
    const { px } = pointer(e);
    const v = (px - cxTop) / scale;
    setR(Math.max(0.5, Math.min(2, Math.round(v * 20) / 20)));
  };
  const onUp = () => { dragRef.current = false; };

  const C = 2 * Math.PI * r;
  const A = Math.PI * r * r;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-3">
        <button
          onClick={() => setPlaying((p) => !p)}
          class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white"
        >
          {playing ? 'Rolling…' : 'Roll it out ▶'}
        </button>
        <span class="text-xs text-muted">One full turn traces the circumference ≈ 3.14 diameters.</span>
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
          <label class="block">
            <span class="mb-1 block text-muted">radius r = {r.toFixed(2)}</span>
            <input type="range" min={0.5} max={2} step={0.05} value={r}
              onInput={(e) => setR(parseFloat((e.target as HTMLInputElement).value))}
              class="w-full accent-[#4f46e5]" />
          </label>
          <div class="grid grid-cols-2 gap-2">
            <Readout label="diameter d" value={(2 * r).toFixed(2)} />
            <Readout label="C = 2πr" value={C.toFixed(2)} color={COLORS.trace} />
            <Readout label="A = πr²" value={A.toFixed(2)} />
            <Readout label="C ÷ d" value={(C / (2 * r)).toFixed(4)} />
          </div>
          <p class="rounded-lg bg-surface-2 p-3 text-xs text-muted">
            C ÷ d is always 3.14159… no matter the size. That constant is <strong>π</strong>.
          </p>
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
function dot(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
  ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2);
  ctx.fillStyle = color; ctx.fill();
}
function handle(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
  ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2);
  ctx.fillStyle = '#fff'; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = color; ctx.stroke();
}
