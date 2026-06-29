import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Interactive quadratic explorer for y = a x² + b x + c.
   - Slide a, b, c and watch the parabola reshape live.
   - The vertex (emerald) and the real roots (sky dots on the x-axis)
     update instantly, along with the discriminant readout.
   Crisp, responsive canvas — same conventions as VectorPlayground.
   ------------------------------------------------------------------ */

type Pt = { x: number; y: number };

const COLORS = {
  curve: '#4f46e5',   // indigo
  vertex: '#10b981',  // emerald
  root: '#0ea5e9',    // sky
  grid: 'rgba(128,128,128,0.18)',
  axis: 'rgba(128,128,128,0.5)',
};

export default function QuadraticParabolaExplorer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [a, setA] = useState(0.5);
  const [b, setB] = useState(-1);
  const [c, setC] = useState(-2);
  const sizeRef = useRef({ w: 480, h: 360, scale: 24, ox: 240, oy: 180 });

  const f = (x: number) => a * x * x + b * x + c;

  // ---- coordinate helpers (math space <-> pixels) ----
  const toPx = (p: Pt): Pt => {
    const { scale, ox, oy } = sizeRef.current;
    return { x: ox + p.x * scale, y: oy - p.y * scale };
  };
  const toMathX = (px: number): number => {
    const { scale, ox } = sizeRef.current;
    return (px - ox) / scale;
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h: H, scale, ox, oy } = sizeRef.current;
    ctx.clearRect(0, 0, w, H);

    // grid
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    for (let gx = ox % scale; gx < w; gx += scale) {
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke();
    }
    for (let gy = oy % scale; gy < H; gy += scale) {
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke();
    }
    // axes
    ctx.strokeStyle = COLORS.axis;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, oy); ctx.lineTo(w, oy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ox, 0); ctx.lineTo(ox, H); ctx.stroke();

    // ---- the parabola ----
    ctx.strokeStyle = COLORS.curve;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    let started = false;
    for (let px = 0; px <= w; px += 2) {
      const mx = toMathX(px);
      const py = toPx({ x: mx, y: f(mx) }).y;
      if (py < -3000 || py > H + 3000) { started = false; continue; }
      if (!started) { ctx.moveTo(px, py); started = true; } else { ctx.lineTo(px, py); }
    }
    ctx.stroke();

    // ---- roots (where it crosses y = 0) ----
    if (Math.abs(a) > 1e-9) {
      const disc = b * b - 4 * a * c;
      if (disc >= 0) {
        const r1 = (-b - Math.sqrt(disc)) / (2 * a);
        const r2 = (-b + Math.sqrt(disc)) / (2 * a);
        for (const r of disc === 0 ? [r1] : [r1, r2]) {
          dot(ctx, toPx({ x: r, y: 0 }), COLORS.root, 6);
        }
      }
      // ---- vertex ----
      const vx = -b / (2 * a);
      const vPx = toPx({ x: vx, y: f(vx) });
      // axis of symmetry
      ctx.save();
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = 'rgba(16,185,129,0.5)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(vPx.x, 0); ctx.lineTo(vPx.x, H); ctx.stroke();
      ctx.restore();
      handle(ctx, vPx, COLORS.vertex);
      label(ctx, vPx, 'vertex', COLORS.vertex);
    }
  };

  // ---- responsive sizing with devicePixelRatio ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 560);
      const ht = Math.round(w * 0.72);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = ht * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${ht}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const scale = Math.max(16, Math.min(34, w / 17));
      sizeRef.current = { w, h: ht, scale, ox: w / 2, oy: ht * 0.62 };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(draw, [a, b, c]);

  // ---- live readout ----
  const disc = b * b - 4 * a * c;
  const vx = Math.abs(a) > 1e-9 ? -b / (2 * a) : NaN;
  const vy = Math.abs(a) > 1e-9 ? f(vx) : NaN;
  const rootText = (() => {
    if (Math.abs(a) < 1e-9) return 'not a parabola (a = 0)';
    if (disc < 0) return 'no real roots';
    if (disc === 0) return `one root: x = ${vx.toFixed(2)}`;
    const r1 = (-b - Math.sqrt(disc)) / (2 * a);
    const r2 = (-b + Math.sqrt(disc)) / (2 * a);
    return `x = ${r1.toFixed(2)} and x = ${r2.toFixed(2)}`;
  })();

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

        <div class="space-y-3 text-sm">
          <p class="text-muted">
            Slide the coefficients of <span class="font-mono">y = a x² + b x + c</span> and watch the
            shape, <span style={`color:${COLORS.vertex}`} class="font-semibold">vertex</span> and
            <span style={`color:${COLORS.root}`} class="font-semibold"> roots</span> move.
          </p>

          <Slider label="a" value={a} min={-2} max={2} step={0.1} accent={COLORS.curve} onInput={setA} />
          <Slider label="b" value={b} min={-6} max={6} step={0.1} accent={COLORS.curve} onInput={setB} />
          <Slider label="c" value={c} min={-6} max={6} step={0.1} accent={COLORS.curve} onInput={setC} />

          <div class="space-y-2 rounded-lg bg-surface-2 p-3">
            <div class="flex items-center justify-between">
              <span style={`color:${COLORS.vertex}`} class="font-semibold">vertex</span>
              <strong class="font-mono">
                {Number.isNaN(vx) ? '—' : `(${vx.toFixed(2)}, ${vy.toFixed(2)})`}
              </strong>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-muted">discriminant b² − 4ac</span>
              <strong class="font-mono">{disc.toFixed(2)}</strong>
            </div>
            <div class="flex items-center justify-between border-t border-border pt-2">
              <span style={`color:${COLORS.root}`} class="font-semibold">roots</span>
              <strong class="font-mono text-xs">{rootText}</strong>
            </div>
            <p class="mt-1 text-xs text-muted">
              {disc > 0 ? 'Positive discriminant → the parabola crosses the x-axis twice.'
                : disc === 0 ? 'Zero discriminant → it just touches the x-axis once.'
                : 'Negative discriminant → it never reaches the x-axis (no real roots).'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Slider({ label, value, min, max, step, accent, onInput }: {
  label: string; value: number; min: number; max: number; step: number; accent: string;
  onInput: (v: number) => void;
}) {
  return (
    <label class="block">
      <span class="mb-1 block text-muted">{label} = {value.toFixed(1)}</span>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onInput={(e) => onInput(parseFloat((e.target as HTMLInputElement).value))}
        class="w-full"
        style={`accent-color:${accent}`}
      />
    </label>
  );
}

// ---- canvas drawing primitives ----
function dot(ctx: CanvasRenderingContext2D, at: Pt, color: string, r = 5) {
  ctx.beginPath(); ctx.arc(at.x, at.y, r, 0, Math.PI * 2);
  ctx.fillStyle = color; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
}
function handle(ctx: CanvasRenderingContext2D, at: Pt, color: string) {
  ctx.beginPath(); ctx.arc(at.x, at.y, 7, 0, Math.PI * 2);
  ctx.fillStyle = '#fff'; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = color; ctx.stroke();
}
function label(ctx: CanvasRenderingContext2D, at: Pt, text: string, color: string) {
  ctx.font = '600 13px Inter, sans-serif';
  ctx.fillStyle = color;
  ctx.fillText(text, at.x + 10, at.y - 8);
}
