import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   SVD ellipse studio.
   - Every matrix A = U Σ Vᵀ acts on the unit circle as three moves:
     rotate (Vᵀ) → scale by singular values σ₁, σ₂ (Σ) → rotate (U).
   - Sliders set the two rotation angles and the two singular values.
   - Step buttons reveal the circle morphing into an ellipse one factor
     at a time, with the principal axes (σ₁, σ₂) drawn on the ellipse.
   ------------------------------------------------------------------ */

type Vec = { x: number; y: number };
type Stage = 0 | 1 | 2 | 3; // 0 circle, 1 after Vᵀ, 2 after Σ, 3 after U (full)

const COLORS = {
  circle: 'rgba(14,165,233,0.9)',
  ellipse: '#10b981',
  a1: '#4f46e5',
  a2: '#0ea5e9',
  grid: 'rgba(128,128,128,0.16)',
  axis: 'rgba(128,128,128,0.5)',
};

const rot = (th: number) => {
  const c = Math.cos(th), s = Math.sin(th);
  return (v: Vec): Vec => ({ x: c * v.x - s * v.y, y: s * v.x + c * v.y });
};

export default function SvdEllipseStudio() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [thV, setThV] = useState(0.5);     // Vᵀ angle (degrees handled in UI)
  const [s1, setS1] = useState(2.2);
  const [s2, setS2] = useState(0.9);
  const [thU, setThU] = useState(0.9);     // U angle
  const [stage, setStage] = useState<Stage>(3);
  const sizeRef = useRef({ w: 480, h: 360, scale: 36, ox: 240, oy: 180 });

  const toPx = (v: Vec) => {
    const { scale, ox, oy } = sizeRef.current;
    return { x: ox + v.x * scale, y: oy - v.y * scale };
  };

  // map a unit-circle point through the stages
  const mapPoint = (v: Vec): Vec => {
    let p = v;
    if (stage >= 1) p = rot(thV)(p);        // apply Vᵀ (a rotation)
    if (stage >= 2) p = { x: p.x * s1, y: p.y * s2 }; // Σ
    if (stage >= 3) p = rot(thU)(p);        // U
    return p;
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

    // faint original unit circle for reference
    ctx.strokeStyle = 'rgba(14,165,233,0.25)';
    ctx.lineWidth = 1.5;
    traceLoop(ctx, toPx, (v) => v);

    // current shape
    const isCircle = stage === 0;
    ctx.strokeStyle = isCircle ? COLORS.circle : COLORS.ellipse;
    ctx.lineWidth = 2.5;
    traceLoop(ctx, toPx, mapPoint);

    // two reference dots on the circle (the eventual principal directions)
    const origin = { x: ox, y: oy };
    const e1 = mapPoint({ x: 1, y: 0 });
    const e2 = mapPoint({ x: 0, y: 1 });
    arrow(ctx, origin, toPx(e1), COLORS.a1, 3);
    arrow(ctx, origin, toPx(e2), COLORS.a2, 3);
    if (stage >= 2) {
      label(ctx, toPx(e1), 'σ₁', COLORS.a1);
      label(ctx, toPx(e2), 'σ₂', COLORS.a2);
    }
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
      const scale = Math.max(26, Math.min(50, w / 11));
      sizeRef.current = { w, h, scale, ox: w / 2, oy: h / 2 };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(draw, [thV, s1, s2, thU, stage]);

  const stageNames = ['Unit circle', 'after Vᵀ (rotate)', 'after Σ (scale)', 'after U (rotate)'];
  const deg = (r: number) => `${Math.round((r * 180) / Math.PI)}°`;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap gap-2">
        {([0, 1, 2, 3] as Stage[]).map((st) => (
          <button
            key={st}
            onClick={() => setStage(st)}
            class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              stage === st ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
            }`}
          >
            {st === 0 ? 'Circle' : st === 1 ? '+ Vᵀ' : st === 2 ? '+ Σ' : '+ U'}
          </button>
        ))}
      </div>
      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />
        <div class="space-y-3 text-sm">
          <p class="text-muted">Stepping through <span class="font-mono">A = U Σ Vᵀ</span>. Current: <strong>{stageNames[stage]}</strong>.</p>
          <label class="block">
            <span class="mb-1 block text-muted">Vᵀ rotation = {deg(thV)}</span>
            <input type="range" min={-1.57} max={1.57} step={0.01} value={thV} onInput={(e) => setThV(parseFloat((e.target as HTMLInputElement).value))} class="w-full accent-[#4f46e5]" />
          </label>
          <div class="grid grid-cols-2 gap-3">
            <label class="block">
              <span class="mb-1 block text-muted">σ₁ = {s1.toFixed(1)}</span>
              <input type="range" min={0.2} max={3} step={0.1} value={s1} onInput={(e) => setS1(parseFloat((e.target as HTMLInputElement).value))} class="w-full accent-[#10b981]" />
            </label>
            <label class="block">
              <span class="mb-1 block text-muted">σ₂ = {s2.toFixed(1)}</span>
              <input type="range" min={0.2} max={3} step={0.1} value={s2} onInput={(e) => setS2(parseFloat((e.target as HTMLInputElement).value))} class="w-full accent-[#10b981]" />
            </label>
          </div>
          <label class="block">
            <span class="mb-1 block text-muted">U rotation = {deg(thU)}</span>
            <input type="range" min={-1.57} max={1.57} step={0.01} value={thU} onInput={(e) => setThU(parseFloat((e.target as HTMLInputElement).value))} class="w-full accent-[#0ea5e9]" />
          </label>
          <div class="rounded-lg bg-surface-2 p-3 text-xs text-muted">
            The singular values σ₁, σ₂ are the ellipse's <strong>semi-axis lengths</strong> — how far the matrix can stretch a unit vector. Their ratio is the <strong>condition number</strong>; a tiny σ₂ means the matrix nearly flattens space.
          </div>
        </div>
      </div>
    </div>
  );
}

function traceLoop(ctx: CanvasRenderingContext2D, toPx: (v: Vec) => Vec, f: (v: Vec) => Vec) {
  ctx.beginPath();
  const N = 96;
  for (let i = 0; i <= N; i++) {
    const th = (i / N) * Math.PI * 2;
    const q = toPx(f({ x: Math.cos(th), y: Math.sin(th) }));
    if (i === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y);
  }
  ctx.stroke();
}
function arrow(ctx: CanvasRenderingContext2D, from: Vec, to: Vec, color: string, width: number) {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const head = 10;
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(to.x - head * Math.cos(angle - 0.4), to.y - head * Math.sin(angle - 0.4));
  ctx.lineTo(to.x - head * Math.cos(angle + 0.4), to.y - head * Math.sin(angle + 0.4));
  ctx.closePath(); ctx.fill();
}
function label(ctx: CanvasRenderingContext2D, at: Vec, text: string, color: string) {
  ctx.font = '600 14px Inter, sans-serif';
  ctx.fillStyle = color;
  ctx.fillText(text, at.x + 10, at.y - 8);
}
