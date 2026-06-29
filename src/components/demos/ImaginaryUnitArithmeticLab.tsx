import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Imaginary-unit arithmetic lab.
   - Set z = a + bi and w = c + di with sliders.
   - Toggle between z + w and z · w.
   - See the operands (indigo, sky) and the result (emerald) plotted
     on the complex plane, plus the algebra worked out numerically.
   ------------------------------------------------------------------ */

type Op = 'add' | 'mul';

const COLORS = {
  z: '#4f46e5',
  w: '#0ea5e9',
  result: '#10b981',
  grid: 'rgba(128,128,128,0.18)',
  axis: 'rgba(128,128,128,0.5)',
};

export default function ImaginaryUnitArithmeticLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [a, setA] = useState(2);
  const [b, setB] = useState(1);
  const [c, setC] = useState(1);
  const [d, setD] = useState(2);
  const [op, setOp] = useState<Op>('add');
  const sizeRef = useRef({ w: 480, h: 360, scale: 36, ox: 240, oy: 180 });

  // result of the chosen operation
  const res =
    op === 'add'
      ? { re: a + c, im: b + d }
      : { re: a * c - b * d, im: a * d + b * c };

  const toPx = (re: number, im: number) => {
    const { scale, ox, oy } = sizeRef.current;
    return { x: ox + re * scale, y: oy - im * scale };
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h, scale, ox, oy } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);

    // grid
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    for (let gx = ox % scale; gx < w; gx += scale) {
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke();
    }
    for (let gy = oy % scale; gy < h; gy += scale) {
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke();
    }
    // axes
    ctx.strokeStyle = COLORS.axis;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, oy); ctx.lineTo(w, oy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ox, 0); ctx.lineTo(ox, h); ctx.stroke();
    ctx.font = '600 12px Inter, sans-serif';
    ctx.fillStyle = 'rgba(128,128,128,0.9)';
    ctx.fillText('real', w - 34, oy - 8);
    ctx.fillText('imaginary', ox + 8, 14);

    const origin = { x: ox, y: oy };
    arrow(ctx, origin, toPx(res.re, res.im), COLORS.result, 3);
    label(ctx, toPx(res.re, res.im), op === 'add' ? 'z + w' : 'z · w', COLORS.result);

    arrow(ctx, origin, toPx(a, b), COLORS.z, 3.5);
    arrow(ctx, origin, toPx(c, d), COLORS.w, 3.5);
    label(ctx, toPx(a, b), 'z', COLORS.z);
    label(ctx, toPx(c, d), 'w', COLORS.w);
    dot(ctx, toPx(a, b), COLORS.z);
    dot(ctx, toPx(c, d), COLORS.w);
    dot(ctx, toPx(res.re, res.im), COLORS.result);
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
      const scale = Math.max(18, Math.min(34, w / 16));
      sizeRef.current = { w, h, scale, ox: w / 2, oy: h / 2 };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(draw, [a, b, c, d, op]);

  const fmt = (re: number, im: number) =>
    `${re}${im >= 0 ? ' + ' : ' − '}${Math.abs(im)}i`;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap gap-2">
        {(['add', 'mul'] as Op[]).map((m) => (
          <button
            key={m}
            onClick={() => setOp(m)}
            class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              op === m ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
            }`}
          >
            {m === 'add' ? 'z + w' : 'z · w'}
          </button>
        ))}
      </div>

      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

        <div class="space-y-3 text-sm">
          <div class="grid grid-cols-2 gap-2">
            <Readout label="z" color={COLORS.z} value={fmt(a, b)} />
            <Readout label="w" color={COLORS.w} value={fmt(c, d)} />
          </div>

          <Slider label={`a (real of z) = ${a}`} value={a} set={setA} />
          <Slider label={`b (imag of z) = ${b}`} value={b} set={setB} />
          <Slider label={`c (real of w) = ${c}`} value={c} set={setC} />
          <Slider label={`d (imag of w) = ${d}`} value={d} set={setD} />

          <div class="rounded-lg bg-surface-2 p-3">
            {op === 'add' ? (
              <p class="text-xs text-muted">
                Add the real parts and the imaginary parts separately:
                <br />({a}) + ({c}) = {a + c} real, ({b}) + ({d}) = {b + d} imaginary.
              </p>
            ) : (
              <p class="text-xs text-muted">
                FOIL and use i² = −1:
                <br />(ac − bd) = ({a}·{c} − {b}·{d}) = {a * c - b * d} real,
                <br />(ad + bc) = ({a}·{d} + {b}·{c}) = {a * d + b * c} imaginary.
              </p>
            )}
            <div class="mt-2 flex justify-between">
              <span class="text-muted">{op === 'add' ? 'z + w' : 'z · w'}</span>
              <strong style={`color:${COLORS.result}`}>{fmt(res.re, res.im)}</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Slider({
  label, value, set,
}: { label: string; value: number; set: (n: number) => void }) {
  return (
    <label class="block">
      <span class="mb-1 block text-muted">{label}</span>
      <input
        type="range" min={-4} max={4} step={1} value={value}
        onInput={(e) => set(parseInt((e.target as HTMLInputElement).value, 10))}
        class="w-full accent-[#4f46e5]"
      />
    </label>
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
  const head = 11;
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
function dot(ctx: CanvasRenderingContext2D, at: { x: number; y: number }, color: string) {
  ctx.beginPath(); ctx.arc(at.x, at.y, 5, 0, Math.PI * 2);
  ctx.fillStyle = '#fff'; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = color; ctx.stroke();
}
function label(ctx: CanvasRenderingContext2D, at: { x: number; y: number }, text: string, color: string) {
  ctx.font = '600 14px Inter, sans-serif';
  ctx.fillStyle = color;
  ctx.fillText(text, at.x + 10, at.y - 8);
}
