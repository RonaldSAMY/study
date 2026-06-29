import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Trig wave shaper for y = A·sin(B·x + C).
   - Sliders for amplitude A, angular frequency B, and phase C.
   - The reference wave sin(x) is drawn faintly so changes are obvious.
   - Live readout of amplitude, period (2π/B) and phase shift (-C/B).
   ------------------------------------------------------------------ */

const COLORS = {
  wave: '#4f46e5',
  ref: 'rgba(128,128,128,0.45)',
  grid: 'rgba(128,128,128,0.16)',
  axis: 'rgba(128,128,128,0.55)',
  accent: '#10b981',
};

export default function TrigWaveShaper() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [A, setA] = useState(1.5);
  const [B, setB] = useState(1);
  const [C, setC] = useState(0);
  const sizeRef = useRef({ w: 560, h: 320 });

  // x range shown: -2π .. 2π ; y range: -3 .. 3
  const xMin = -2 * Math.PI, xMax = 2 * Math.PI, yMax = 3;

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);

    const X = (x: number) => ((x - xMin) / (xMax - xMin)) * w;
    const Y = (y: number) => h / 2 - (y / yMax) * (h / 2);

    // grid: vertical lines every π/2
    ctx.strokeStyle = COLORS.grid; ctx.lineWidth = 1;
    for (let x = xMin; x <= xMax + 0.001; x += Math.PI / 2) {
      ctx.beginPath(); ctx.moveTo(X(x), 0); ctx.lineTo(X(x), h); ctx.stroke();
    }
    for (let y = -yMax + 1; y <= yMax - 1; y += 1) {
      ctx.beginPath(); ctx.moveTo(0, Y(y)); ctx.lineTo(w, Y(y)); ctx.stroke();
    }

    // axes
    ctx.strokeStyle = COLORS.axis; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, Y(0)); ctx.lineTo(w, Y(0)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(X(0), 0); ctx.lineTo(X(0), h); ctx.stroke();

    // reference wave sin(x)
    plot(ctx, X, Y, (x) => Math.sin(x), xMin, xMax, COLORS.ref, 2);
    // shaped wave
    plot(ctx, X, Y, (x) => A * Math.sin(B * x + C), xMin, xMax, COLORS.wave, 3);

    // amplitude markers
    ctx.strokeStyle = COLORS.accent; ctx.setLineDash([4, 4]); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, Y(A)); ctx.lineTo(w, Y(A)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, Y(-A)); ctx.lineTo(w, Y(-A)); ctx.stroke();
    ctx.setLineDash([]);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 620);
      const h = Math.round(w * 0.55);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w, h };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(draw, [A, B, C]);

  const period = (2 * Math.PI) / Math.abs(B || 1e-9);
  const phaseShift = -C / (B || 1e-9);

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <canvas ref={canvasRef} class="touch-none w-full rounded-xl bg-surface-2" />

      <div class="mt-4 grid gap-4 sm:grid-cols-3">
        <Slider label={`A (amplitude) = ${A.toFixed(1)}`} min={0} max={2.5} step={0.1} value={A} onChange={setA} />
        <Slider label={`B (frequency) = ${B.toFixed(1)}`} min={0.5} max={4} step={0.1} value={B} onChange={setB} />
        <Slider label={`C (phase) = ${C.toFixed(1)}`} min={-Math.PI} max={Math.PI} step={0.1} value={C} onChange={setC} />
      </div>

      <div class="mt-3 grid grid-cols-3 gap-2 text-sm">
        <Readout label="amplitude" value={A.toFixed(2)} />
        <Readout label="period 2π/B" value={period.toFixed(2)} />
        <Readout label="phase shift −C/B" value={phaseShift.toFixed(2)} />
      </div>
      <p class="mt-2 text-xs text-muted">
        Faint grey is the plain <strong>sin x</strong>. <strong>A</strong> stretches it tall, <strong>B</strong> squeezes it
        sideways (more cycles), and <strong>C</strong> slides it left or right.
      </p>
    </div>
  );
}

function plot(
  ctx: CanvasRenderingContext2D,
  X: (x: number) => number,
  Y: (y: number) => number,
  f: (x: number) => number,
  xMin: number, xMax: number,
  color: string, width: number,
) {
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineJoin = 'round';
  ctx.beginPath();
  let first = true;
  for (let i = 0; i <= 600; i++) {
    const x = xMin + ((xMax - xMin) * i) / 600;
    const px = X(x), py = Y(f(x));
    if (first) { ctx.moveTo(px, py); first = false; } else ctx.lineTo(px, py);
  }
  ctx.stroke();
}

function Slider(
  { label, min, max, step, value, onChange }:
  { label: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void },
) {
  return (
    <label class="block text-sm">
      <span class="mb-1 block text-muted">{label}</span>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onInput={(e) => onChange(parseFloat((e.target as HTMLInputElement).value))}
        class="w-full accent-[#4f46e5]"
      />
    </label>
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
