import { useEffect, useMemo, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Principal-axes cloud (PCA in 2D).
   - A point cloud is shaped by three sliders: spread along its main
     direction, spread across it, and a rotation angle.
   - PCA is computed live from the cloud's covariance matrix: the two
     principal axes (eigenvectors, length ∝ √variance) are drawn, and
     every point's projection onto the top component (PC1) is shown as
     a tick on that axis — the 1-D summary PCA would keep.
   ------------------------------------------------------------------ */

type Vec = { x: number; y: number };

const COLORS = {
  point: 'rgba(14,165,233,0.75)',
  pc1: '#4f46e5',
  pc2: '#10b981',
  proj: 'rgba(79,70,229,0.30)',
  grid: 'rgba(128,128,128,0.16)',
  axis: 'rgba(128,128,128,0.5)',
};

// deterministic standard-normal base cloud (Box–Muller, fixed seed)
function makeBase(n: number): Vec[] {
  let seed = 1337;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  const out: Vec[] = [];
  for (let i = 0; i < n; i++) {
    const u1 = Math.max(1e-6, rnd()), u2 = rnd();
    const r = Math.sqrt(-2 * Math.log(u1));
    out.push({ x: r * Math.cos(2 * Math.PI * u2), y: r * Math.sin(2 * Math.PI * u2) });
  }
  return out;
}

export default function PrincipalAxesCloud() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [spread1, setSpread1] = useState(2.4);
  const [spread2, setSpread2] = useState(0.7);
  const [theta, setTheta] = useState(0.5);
  const sizeRef = useRef({ w: 480, h: 360, scale: 36, ox: 240, oy: 180 });

  const base = useMemo(() => makeBase(140), []);

  const points = useMemo<Vec[]>(() => {
    const c = Math.cos(theta), s = Math.sin(theta);
    return base.map((p) => {
      const x = p.x * spread1, y = p.y * spread2;
      return { x: c * x - s * y, y: s * x + c * y };
    });
  }, [base, spread1, spread2, theta]);

  // covariance + symmetric-2x2 eigen-decomposition
  const pca = useMemo(() => {
    const n = points.length;
    let mx = 0, my = 0;
    for (const p of points) { mx += p.x; my += p.y; }
    mx /= n; my /= n;
    let sxx = 0, syy = 0, sxy = 0;
    for (const p of points) {
      const dx = p.x - mx, dy = p.y - my;
      sxx += dx * dx; syy += dy * dy; sxy += dx * dy;
    }
    sxx /= n; syy /= n; sxy /= n;
    const tr = sxx + syy;
    const det = sxx * syy - sxy * sxy;
    const disc = Math.sqrt(Math.max(0, tr * tr / 4 - det));
    const l1 = tr / 2 + disc;
    const l2 = tr / 2 - disc;
    const evec = (l: number): Vec => {
      if (Math.abs(sxy) > 1e-9) return norm({ x: l - syy, y: sxy });
      return sxx >= syy ? { x: 1, y: 0 } : { x: 0, y: 1 };
    };
    return { mean: { x: mx, y: my }, l1, l2, v1: evec(l1), v2: evec(l2) };
  }, [points]);

  const toPx = (v: Vec) => {
    const { scale, ox, oy } = sizeRef.current;
    return { x: ox + v.x * scale, y: oy - v.y * scale };
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

    const { mean, l1, l2, v1, v2 } = pca;

    // PC1 line through the mean
    const far = 40;
    ctx.strokeStyle = 'rgba(79,70,229,0.30)'; ctx.lineWidth = 2;
    const a0 = toPx({ x: mean.x - v1.x * far, y: mean.y - v1.y * far });
    const a1 = toPx({ x: mean.x + v1.x * far, y: mean.y + v1.y * far });
    ctx.beginPath(); ctx.moveTo(a0.x, a0.y); ctx.lineTo(a1.x, a1.y); ctx.stroke();

    // projection ticks onto PC1
    ctx.strokeStyle = COLORS.proj; ctx.lineWidth = 1;
    for (const p of points) {
      const dx = p.x - mean.x, dy = p.y - mean.y;
      const t = dx * v1.x + dy * v1.y;
      const foot = { x: mean.x + v1.x * t, y: mean.y + v1.y * t };
      const a = toPx(p), b = toPx(foot);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }

    // points
    ctx.fillStyle = COLORS.point;
    for (const p of points) {
      const q = toPx(p);
      ctx.beginPath(); ctx.arc(q.x, q.y, 2.6, 0, Math.PI * 2); ctx.fill();
    }
    // feet on PC1 (the kept 1-D coordinates)
    ctx.fillStyle = COLORS.pc1;
    for (const p of points) {
      const dx = p.x - mean.x, dy = p.y - mean.y;
      const t = dx * v1.x + dy * v1.y;
      const foot = toPx({ x: mean.x + v1.x * t, y: mean.y + v1.y * t });
      ctx.beginPath(); ctx.arc(foot.x, foot.y, 2, 0, Math.PI * 2); ctx.fill();
    }

    // principal axes (length ∝ √variance)
    const o = toPx(mean);
    const k = 2; // visual scale of std-dev
    arrow(ctx, o, toPx({ x: mean.x + v1.x * Math.sqrt(l1) * k, y: mean.y + v1.y * Math.sqrt(l1) * k }), COLORS.pc1, 3.5);
    arrow(ctx, o, toPx({ x: mean.x + v2.x * Math.sqrt(l2) * k, y: mean.y + v2.y * Math.sqrt(l2) * k }), COLORS.pc2, 3);
    label(ctx, toPx({ x: mean.x + v1.x * Math.sqrt(l1) * k, y: mean.y + v1.y * Math.sqrt(l1) * k }), 'PC1', COLORS.pc1);
    label(ctx, toPx({ x: mean.x + v2.x * Math.sqrt(l2) * k, y: mean.y + v2.y * Math.sqrt(l2) * k }), 'PC2', COLORS.pc2);
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
      const scale = Math.max(20, Math.min(38, w / 14));
      sizeRef.current = { w, h, scale, ox: w / 2, oy: h / 2 };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(draw, [points, pca]);

  const total = pca.l1 + pca.l2 || 1;
  const explained = (pca.l1 / total) * 100;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />
        <div class="space-y-3 text-sm">
          <p class="text-muted">Shape the cloud. PCA finds its widest direction (PC1) automatically; the faint lines drop each point onto it.</p>
          <label class="block">
            <span class="mb-1 block text-muted">main spread = {spread1.toFixed(1)}</span>
            <input type="range" min={0.4} max={3} step={0.1} value={spread1} onInput={(e) => setSpread1(parseFloat((e.target as HTMLInputElement).value))} class="w-full accent-[#4f46e5]" />
          </label>
          <label class="block">
            <span class="mb-1 block text-muted">cross spread = {spread2.toFixed(1)}</span>
            <input type="range" min={0.1} max={3} step={0.1} value={spread2} onInput={(e) => setSpread2(parseFloat((e.target as HTMLInputElement).value))} class="w-full accent-[#10b981]" />
          </label>
          <label class="block">
            <span class="mb-1 block text-muted">rotation = {Math.round((theta * 180) / Math.PI)}°</span>
            <input type="range" min={0} max={3.14} step={0.01} value={theta} onInput={(e) => setTheta(parseFloat((e.target as HTMLInputElement).value))} class="w-full accent-[#0ea5e9]" />
          </label>
          <div class="rounded-lg bg-surface-2 p-3">
            <div class="flex justify-between"><span class="text-muted">variance on PC1</span><strong>{pca.l1.toFixed(2)}</strong></div>
            <div class="flex justify-between"><span class="text-muted">variance on PC2</span><strong>{pca.l2.toFixed(2)}</strong></div>
            <div class="flex justify-between"><span class="text-muted">PC1 explains</span><strong>{explained.toFixed(0)}%</strong></div>
            <p class="mt-1 text-xs text-muted">Keeping only PC1 keeps {explained.toFixed(0)}% of the spread while halving the dimensions.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function norm(v: Vec): Vec { const L = Math.hypot(v.x, v.y) || 1; return { x: v.x / L, y: v.y / L }; }
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
function label(ctx: CanvasRenderingContext2D, at: Vec, text: string, color: string) {
  ctx.font = '600 13px Inter, sans-serif';
  ctx.fillStyle = color;
  ctx.fillText(text, at.x + 10, at.y - 8);
}
