import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Interactive exponent / scaling visualizer.
   - Slide a linear scale factor s.
   - Watch length grow by s, AREA by s², and VOLUME by s³.
   - A reference unit square/cube is drawn beside the scaled one so
     the s^n explosion is visible, not just numeric.
   Crisp, responsive canvas — same conventions as VectorPlayground.
   ------------------------------------------------------------------ */

const COLORS = {
  length: '#0ea5e9',  // sky
  area: '#4f46e5',    // indigo
  volume: '#10b981',  // emerald
  ref: 'rgba(128,128,128,0.45)',
};

type Dim = 1 | 2 | 3;

export default function ExponentScalingVisualizer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [s, setS] = useState(2);
  const [dim, setDim] = useState<Dim>(2);
  const sizeRef = useRef({ w: 480, h: 360 });

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);

    const pad = 24;
    const unit = Math.min((w - 2 * pad) / 4.4, (h - 2 * pad) / 4.4); // pixels per math-unit
    const baseY = h - pad;

    if (dim === 1) {
      // two bars: reference length 1 and scaled length s
      const x0 = pad + 10;
      ctx.fillStyle = COLORS.ref;
      ctx.fillRect(x0, baseY - 40, unit, 24);
      ctx.fillStyle = COLORS.length;
      ctx.fillRect(x0, baseY - 90, unit * s, 24);
      txt(ctx, 'length 1', x0, baseY - 46, COLORS.ref);
      txt(ctx, `length s = ${fmt(s)}`, x0, baseY - 96, COLORS.length);
    } else if (dim === 2) {
      const x0 = pad + 6;
      // scaled square (drawn first, behind)
      ctx.fillStyle = 'rgba(79,70,229,0.18)';
      ctx.strokeStyle = COLORS.area; ctx.lineWidth = 2.5;
      ctx.fillRect(x0, baseY - unit * s, unit * s, unit * s);
      ctx.strokeRect(x0, baseY - unit * s, unit * s, unit * s);
      // unit grid inside to count copies
      ctx.strokeStyle = 'rgba(79,70,229,0.30)'; ctx.lineWidth = 1;
      for (let i = 1; i < Math.ceil(s); i++) {
        const gx = Math.min(i, s);
        ctx.beginPath(); ctx.moveTo(x0 + unit * gx, baseY); ctx.lineTo(x0 + unit * gx, baseY - unit * s); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x0, baseY - unit * gx); ctx.lineTo(x0 + unit * s, baseY - unit * gx); ctx.stroke();
      }
      // reference unit square
      ctx.strokeStyle = COLORS.ref; ctx.lineWidth = 2;
      ctx.strokeRect(x0, baseY - unit, unit, unit);
      txt(ctx, `area = s² = ${fmt(s * s)}`, x0, baseY - unit * s - 8, COLORS.area);
    } else {
      // isometric-ish cube using simple oblique projection
      const x0 = pad + 30;
      const side = unit * s;
      const dz = side * 0.42;
      const front = { x: x0, y: baseY - side };
      drawCube(ctx, front.x, front.y, side, dz, COLORS.volume, 'rgba(16,185,129,0.16)');
      // reference unit cube
      drawCube(ctx, x0, baseY - unit, unit, unit * 0.42, COLORS.ref, 'rgba(128,128,128,0.10)');
      txt(ctx, `volume = s³ = ${fmt(s * s * s)}`, x0, baseY - side - dz - 8, COLORS.volume);
    }
  };

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
      sizeRef.current = { w, h: ht };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(draw, [s, dim]);

  const n = dim;
  const factor = Math.pow(s, n);

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap gap-2">
        {([1, 2, 3] as Dim[]).map((d) => (
          <button
            key={d}
            onClick={() => setDim(d)}
            class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              dim === d ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
            }`}
          >
            {d === 1 ? 'Length (s¹)' : d === 2 ? 'Area (s²)' : 'Volume (s³)'}
          </button>
        ))}
      </div>

      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

        <div class="space-y-3 text-sm">
          <p class="text-muted">
            Scale every length by <strong>s</strong> and see how much faster size grows in higher
            dimensions — that's the exponent at work.
          </p>

          <label class="block">
            <span class="mb-1 block text-muted">scale factor s = {fmt(s)}</span>
            <input
              type="range" min={1} max={4} step={0.1} value={s}
              onInput={(e) => setS(parseFloat((e.target as HTMLInputElement).value))}
              class="w-full"
              style={`accent-color:${dim === 1 ? COLORS.length : dim === 2 ? COLORS.area : COLORS.volume}`}
            />
          </label>

          <div class="space-y-1 rounded-lg bg-surface-2 p-3">
            <div class="flex items-center justify-between">
              <span class="text-muted">grows by</span>
              <strong class="font-mono">s{sup(n)} = {fmt(factor)}×</strong>
            </div>
            <p class="mt-1 text-xs text-muted">
              Double the size (s = 2): length 2×, area 4×, volume 8×. Each dimension multiplies the
              exponent — and the growth.
            </p>
          </div>

          <div class="rounded-lg bg-surface-2 p-3 text-xs">
            <p class="mb-1 font-semibold text-text">The power rules in action</p>
            <p class="font-mono text-muted">s² · s³ = s⁵ &nbsp;(add exponents)</p>
            <p class="font-mono text-muted">(s²)³ = s⁶ &nbsp;(multiply exponents)</p>
            <p class="font-mono text-muted">s^(1/2) = √s &nbsp;(a root is a fractional power)</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function fmt(x: number) {
  return Math.abs(x - Math.round(x)) < 1e-9 ? String(Math.round(x)) : x.toFixed(2);
}
function sup(n: number) {
  return ({ 1: '¹', 2: '²', 3: '³' } as Record<number, string>)[n] ?? String(n);
}
function txt(ctx: CanvasRenderingContext2D, t: string, x: number, y: number, color: string) {
  ctx.font = '600 13px Inter, sans-serif';
  ctx.fillStyle = color;
  ctx.fillText(t, x, y);
}
function drawCube(ctx: CanvasRenderingContext2D, x: number, y: number, side: number, dz: number, stroke: string, fill: string) {
  // front face
  ctx.fillStyle = fill; ctx.strokeStyle = stroke; ctx.lineWidth = 2;
  ctx.fillRect(x, y, side, side); ctx.strokeRect(x, y, side, side);
  // top face
  ctx.beginPath();
  ctx.moveTo(x, y); ctx.lineTo(x + dz, y - dz); ctx.lineTo(x + side + dz, y - dz); ctx.lineTo(x + side, y);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  // right face
  ctx.beginPath();
  ctx.moveTo(x + side, y); ctx.lineTo(x + side + dz, y - dz); ctx.lineTo(x + side + dz, y + side - dz); ctx.lineTo(x + side, y + side);
  ctx.closePath(); ctx.fill(); ctx.stroke();
}
