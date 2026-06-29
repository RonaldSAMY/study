import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Rational-function asymptote plotter for y = (a·x + b)/(x − c).
   - Slide a, b, c.
   - The VERTICAL asymptote (x = c) and HORIZONTAL asymptote (y = a)
     are drawn as dashed emerald lines; the curve races toward them.
   - The readout reports the domain restriction and both asymptotes.
   Crisp, responsive canvas — same conventions as VectorPlayground.
   ------------------------------------------------------------------ */

type Pt = { x: number; y: number };

const COLORS = {
  curve: '#4f46e5',     // indigo
  asymptote: '#10b981', // emerald
  grid: 'rgba(128,128,128,0.18)',
  axis: 'rgba(128,128,128,0.5)',
};

export default function RationalAsymptotePlotter() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [a, setA] = useState(1);
  const [b, setB] = useState(1);
  const [c, setC] = useState(2);
  const sizeRef = useRef({ w: 480, h: 360, scale: 28, ox: 240, oy: 180 });

  const f = (x: number) => (a * x + b) / (x - c);

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
    ctx.strokeStyle = COLORS.grid; ctx.lineWidth = 1;
    for (let gx = ox % scale; gx < w; gx += scale) {
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke();
    }
    for (let gy = oy % scale; gy < H; gy += scale) {
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke();
    }
    // axes
    ctx.strokeStyle = COLORS.axis; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, oy); ctx.lineTo(w, oy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ox, 0); ctx.lineTo(ox, H); ctx.stroke();

    // ---- asymptotes ----
    ctx.save();
    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = COLORS.asymptote; ctx.lineWidth = 2;
    // vertical x = c
    const vxPx = toPx({ x: c, y: 0 }).x;
    ctx.beginPath(); ctx.moveTo(vxPx, 0); ctx.lineTo(vxPx, H); ctx.stroke();
    // horizontal y = a
    const hyPx = toPx({ x: 0, y: a }).y;
    ctx.beginPath(); ctx.moveTo(0, hyPx); ctx.lineTo(w, hyPx); ctx.stroke();
    ctx.restore();
    ctx.font = '600 12px Inter, sans-serif';
    ctx.fillStyle = COLORS.asymptote;
    ctx.fillText(`x = ${c.toFixed(1)}`, vxPx + 6, 16);
    ctx.fillText(`y = ${a.toFixed(1)}`, w - 60, hyPx - 6);

    // ---- the curve, drawn in two branches around the vertical asymptote ----
    ctx.strokeStyle = COLORS.curve; ctx.lineWidth = 3;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    let started = false;
    let prevY = 0;
    for (let px = 0; px <= w; px += 1.5) {
      const mx = toMathX(px);
      if (Math.abs(mx - c) < 1e-3) { started = false; continue; }
      const py = toPx({ x: mx, y: f(mx) }).y;
      // break the line when it jumps across the asymptote
      if (started && Math.abs(py - prevY) > H) { started = false; }
      if (py < -3000 || py > H + 3000) { started = false; prevY = py; continue; }
      if (!started) { ctx.moveTo(px, py); started = true; } else { ctx.lineTo(px, py); }
      prevY = py;
    }
    ctx.stroke();
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
      const scale = Math.max(20, Math.min(40, w / 13));
      sizeRef.current = { w, h: ht, scale, ox: w / 2, oy: ht / 2 };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(draw, [a, b, c]);

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

        <div class="space-y-3 text-sm">
          <p class="text-muted">
            Plot of <span class="font-mono">y = (a·x + b)/(x − c)</span>. The dashed
            <span style={`color:${COLORS.asymptote}`} class="font-semibold"> green lines</span> are the
            asymptotes the curve can never cross.
          </p>

          <Slider label="a" value={a} min={-3} max={3} step={0.1} onInput={setA} />
          <Slider label="b" value={b} min={-5} max={5} step={0.1} onInput={setB} />
          <Slider label="c" value={c} min={-4} max={4} step={0.1} onInput={setC} />

          <div class="space-y-1 rounded-lg bg-surface-2 p-3">
            <div class="flex items-center justify-between">
              <span class="text-muted">domain</span>
              <strong class="font-mono">x ≠ {c.toFixed(1)}</strong>
            </div>
            <div class="flex items-center justify-between">
              <span style={`color:${COLORS.asymptote}`} class="font-semibold">vertical asymptote</span>
              <strong class="font-mono">x = {c.toFixed(1)}</strong>
            </div>
            <div class="flex items-center justify-between">
              <span style={`color:${COLORS.asymptote}`} class="font-semibold">horizontal asymptote</span>
              <strong class="font-mono">y = {a.toFixed(1)}</strong>
            </div>
            <p class="mt-1 text-xs text-muted">
              The denominator is zero at x = {c.toFixed(1)}, so that input is forbidden — the curve shoots
              off to infinity there. Far away, it flattens toward y = a.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Slider({ label, value, min, max, step, onInput }: {
  label: string; value: number; min: number; max: number; step: number; onInput: (v: number) => void;
}) {
  return (
    <label class="block">
      <span class="mb-1 block text-muted">{label} = {value.toFixed(1)}</span>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onInput={(e) => onInput(parseFloat((e.target as HTMLInputElement).value))}
        class="w-full"
        style="accent-color:#4f46e5"
      />
    </label>
  );
}
