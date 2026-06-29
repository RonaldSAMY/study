import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Euler's formula animator: e^{iθ} = cos θ + i·sin θ.
   - A point sweeps around the unit circle at angle θ.
   - Its shadow on the real axis is cos θ; on the imaginary axis sin θ.
   - Play/pause the sweep, or scrub θ by hand. At θ = π you land on
     −1, the heart of e^{iπ} + 1 = 0.
   ------------------------------------------------------------------ */

const COLORS = {
  point: '#4f46e5',
  cos: '#10b981',
  sin: '#0ea5e9',
  grid: 'rgba(128,128,128,0.18)',
  axis: 'rgba(128,128,128,0.5)',
};

export default function EulerCircleAnimator() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [theta, setTheta] = useState(0.9);
  const [playing, setPlaying] = useState(true);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef<number>(0);
  const thetaRef = useRef(theta);
  const sizeRef = useRef({ w: 480, h: 360, scale: 70, ox: 240, oy: 180 });
  thetaRef.current = theta;

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h, scale, ox, oy } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);

    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    for (let gx = ox % scale; gx < w; gx += scale) {
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke();
    }
    for (let gy = oy % scale; gy < h; gy += scale) {
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke();
    }
    ctx.strokeStyle = COLORS.axis;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, oy); ctx.lineTo(w, oy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ox, 0); ctx.lineTo(ox, h); ctx.stroke();
    ctx.font = '600 12px Inter, sans-serif';
    ctx.fillStyle = 'rgba(128,128,128,0.9)';
    ctx.fillText('Re', w - 24, oy - 8);
    ctx.fillText('Im', ox + 8, 14);

    // unit circle
    ctx.strokeStyle = 'rgba(128,128,128,0.55)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(ox, oy, scale, 0, Math.PI * 2); ctx.stroke();

    const th = thetaRef.current;
    const cx = ox + Math.cos(th) * scale;
    const cy = oy - Math.sin(th) * scale;

    // angle arc
    ctx.strokeStyle = 'rgba(79,70,229,0.5)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(ox, oy, 26, 0, -th, th > 0); ctx.stroke();

    // projections
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = COLORS.cos;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx, oy); ctx.stroke();
    ctx.strokeStyle = COLORS.sin;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(ox, cy); ctx.stroke();
    ctx.setLineDash([]);

    // cos marker on real axis, sin marker on imaginary axis
    markTick(ctx, { x: cx, y: oy }, COLORS.cos);
    markTick(ctx, { x: ox, y: cy }, COLORS.sin);

    // radius to point
    arrow(ctx, { x: ox, y: oy }, { x: cx, y: cy }, COLORS.point, 3);
    handle(ctx, { x: cx, y: cy }, COLORS.point);
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
      const scale = Math.max(48, Math.min(90, Math.min(w * 0.32, h * 0.38)));
      sizeRef.current = { w, h, scale, ox: w / 2, oy: h / 2 };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // animation loop
  useEffect(() => {
    if (!playing) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      return;
    }
    lastRef.current = performance.now();
    const step = (now: number) => {
      const dt = (now - lastRef.current) / 1000;
      lastRef.current = now;
      let next = thetaRef.current + dt * 0.8;
      if (next > Math.PI * 2) next -= Math.PI * 2;
      setTheta(next);
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [playing]);

  useEffect(draw, [theta]);

  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  const deg = ((theta * 180) / Math.PI) % 360;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap gap-2">
        <button
          onClick={() => setPlaying((p) => !p)}
          class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white transition hover:opacity-90"
        >
          {playing ? '⏸ Pause' : '▶ Play'}
        </button>
        <button
          onClick={() => { setPlaying(false); setTheta(Math.PI); }}
          class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted transition hover:text-text"
        >
          Jump to θ = π
        </button>
      </div>

      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

        <div class="space-y-3 text-sm">
          <label class="block">
            <span class="mb-1 block text-muted">θ = {theta.toFixed(2)} rad ({deg.toFixed(0)}°)</span>
            <input
              type="range" min={0} max={Math.PI * 2} step={0.01} value={theta}
              onInput={(e) => { setPlaying(false); setTheta(parseFloat((e.target as HTMLInputElement).value)); }}
              class="w-full accent-[#4f46e5]"
            />
          </label>
          <div class="grid grid-cols-2 gap-2">
            <Readout label="cos θ (real)" color={COLORS.cos} value={cos.toFixed(3)} />
            <Readout label="sin θ (imag)" color={COLORS.sin} value={sin.toFixed(3)} />
          </div>
          <div class="rounded-lg bg-surface-2 p-3">
            <div class="flex justify-between">
              <span class="text-muted">e^(iθ)</span>
              <strong class="font-mono">{cos.toFixed(2)} {sin >= 0 ? '+' : '−'} {Math.abs(sin).toFixed(2)}i</strong>
            </div>
            <p class="mt-1 text-xs text-muted">
              The point stays on the unit circle: cos²θ + sin²θ = 1, so |e^(iθ)| = 1 always.
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

// ---- canvas primitives ----
function arrow(ctx: CanvasRenderingContext2D, from: { x: number; y: number }, to: { x: number; y: number }, color: string, width: number) {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const head = 10;
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
function handle(ctx: CanvasRenderingContext2D, at: { x: number; y: number }, color: string) {
  ctx.beginPath(); ctx.arc(at.x, at.y, 7, 0, Math.PI * 2);
  ctx.fillStyle = '#fff'; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = color; ctx.stroke();
}
function markTick(ctx: CanvasRenderingContext2D, at: { x: number; y: number }, color: string) {
  ctx.beginPath(); ctx.arc(at.x, at.y, 4.5, 0, Math.PI * 2);
  ctx.fillStyle = color; ctx.fill();
}
