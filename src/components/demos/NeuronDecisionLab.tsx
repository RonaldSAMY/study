import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   The neuron as a tiny linear model (healthcare framing).
   Two features per patient: tumor size (x1) and cell uniformity (x2).
   The neuron computes  z = w1*x1 + w2*x2 + b,  then  a = sigmoid(z).
   - Slide the weights and bias: the decision LINE (z = 0) tips/shifts
     and the shaded regions (predicted probability) update live.
   - Drag the white "new patient" dot to read its weighted sum & output.
   ------------------------------------------------------------------ */

type Vec = { x: number; y: number };

const COLORS = {
  pos: '#4f46e5', // indigo  -> class 1 (malignant)
  neg: '#0ea5e9', // sky     -> class 0 (benign)
  line: '#10b981',
  grid: 'rgba(128,128,128,0.18)',
  axis: 'rgba(128,128,128,0.5)',
};

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

// fixed two-class dataset in feature space (x1, x2), both in roughly [0, 5]
const DATA: { x: number; y: number; c: 0 | 1 }[] = [
  { x: 1.0, y: 1.2, c: 0 }, { x: 1.4, y: 0.8, c: 0 }, { x: 0.8, y: 1.8, c: 0 },
  { x: 1.8, y: 1.5, c: 0 }, { x: 1.2, y: 2.2, c: 0 }, { x: 2.0, y: 1.0, c: 0 },
  { x: 3.6, y: 3.4, c: 1 }, { x: 4.1, y: 2.9, c: 1 }, { x: 3.2, y: 4.0, c: 1 },
  { x: 4.3, y: 3.8, c: 1 }, { x: 3.8, y: 2.6, c: 1 }, { x: 2.9, y: 3.6, c: 1 },
];

export default function NeuronDecisionLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [w1, setW1] = useState(1.0);
  const [w2, setW2] = useState(1.0);
  const [b, setB] = useState(-5.0);
  const [pt, setPt] = useState<Vec>({ x: 2.6, y: 2.6 });
  const draggingRef = useRef(false);
  const sizeRef = useRef({ w: 480, h: 360, scale: 64, ox: 40, oy: 320 });

  const toPx = (v: Vec) => {
    const { scale, ox, oy } = sizeRef.current;
    return { x: ox + v.x * scale, y: oy - v.y * scale };
  };
  const toMath = (px: number, py: number): Vec => {
    const { scale, ox, oy } = sizeRef.current;
    return {
      x: Math.max(0, Math.min(5, (px - ox) / scale)),
      y: Math.max(0, Math.min(5, (oy - py) / scale)),
    };
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h, scale, ox, oy } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);

    // shaded decision regions: probability of class 1
    const cell = 12;
    for (let px = 0; px < w; px += cell) {
      for (let py = 0; py < h; py += cell) {
        const mx = (px + cell / 2 - ox) / scale;
        const my = (oy - (py + cell / 2)) / scale;
        const a = sigmoid(w1 * mx + w2 * my + b);
        // lerp sky (a=0) -> indigo (a=1)
        const r = Math.round(14 + (79 - 14) * a);
        const g = Math.round(165 + (70 - 165) * a);
        const bl = Math.round(233 + (229 - 233) * a);
        ctx.fillStyle = `rgba(${r},${g},${bl},0.20)`;
        ctx.fillRect(px, py, cell, cell);
      }
    }

    // grid
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    for (let gx = 0; gx <= 5; gx++) {
      const X = ox + gx * scale;
      ctx.beginPath(); ctx.moveTo(X, 0); ctx.lineTo(X, h); ctx.stroke();
    }
    for (let gy = 0; gy <= 5; gy++) {
      const Y = oy - gy * scale;
      ctx.beginPath(); ctx.moveTo(0, Y); ctx.lineTo(w, Y); ctx.stroke();
    }
    // axes
    ctx.strokeStyle = COLORS.axis;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(ox, 0); ctx.lineTo(ox, h); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, oy); ctx.lineTo(w, oy); ctx.stroke();
    ctx.fillStyle = 'rgba(128,128,128,0.9)';
    ctx.font = '600 11px Inter, sans-serif';
    ctx.fillText('tumor size →', ox + 6, oy - 6);
    ctx.save();
    ctx.translate(ox + 12, 16); ctx.fillText('cell uniformity →', 0, 0); ctx.restore();

    // decision line: w1*x1 + w2*x2 + b = 0
    ctx.strokeStyle = COLORS.line;
    ctx.lineWidth = 3;
    ctx.beginPath();
    if (Math.abs(w2) > 1e-6) {
      const y0 = -(w1 * 0 + b) / w2;
      const y5 = -(w1 * 5 + b) / w2;
      const p0 = toPx({ x: 0, y: y0 });
      const p5 = toPx({ x: 5, y: y5 });
      ctx.moveTo(p0.x, p0.y); ctx.lineTo(p5.x, p5.y);
    } else if (Math.abs(w1) > 1e-6) {
      const xline = -b / w1;
      const p0 = toPx({ x: xline, y: 0 });
      const p5 = toPx({ x: xline, y: 5 });
      ctx.moveTo(p0.x, p0.y); ctx.lineTo(p5.x, p5.y);
    }
    ctx.stroke();

    // data points
    for (const d of DATA) {
      const p = toPx(d);
      ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = d.c === 1 ? COLORS.pos : COLORS.neg;
      ctx.fill();
      ctx.lineWidth = 1.5; ctx.strokeStyle = '#fff'; ctx.stroke();
    }

    // draggable "new patient"
    const pp = toPx(pt);
    ctx.beginPath(); ctx.arc(pp.x, pp.y, 9, 0, Math.PI * 2);
    ctx.fillStyle = '#fff'; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = '#111827'; ctx.stroke();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 520);
      const h = Math.round(w * 0.78);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const ox = 40, oy = h - 40;
      const scale = Math.min((w - ox - 16) / 5, (oy - 16) / 5);
      sizeRef.current = { w, h, scale, ox, oy };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(draw, [w1, w2, b, pt]);

  const pointer = (e: PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { px: e.clientX - rect.left, py: e.clientY - rect.top };
  };
  const onDown = (e: PointerEvent) => {
    const { px, py } = pointer(e);
    const pp = toPx(pt);
    if (Math.hypot(pp.x - px, pp.y - py) < 22) {
      draggingRef.current = true;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      e.preventDefault();
    }
  };
  const onMove = (e: PointerEvent) => {
    if (!draggingRef.current) return;
    const { px, py } = pointer(e);
    setPt(toMath(px, py));
  };
  const onUp = () => { draggingRef.current = false; };

  const z = w1 * pt.x + w2 * pt.y + b;
  const a = sigmoid(z);

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
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
            Indigo dots are malignant, sky dots benign. Tip the green decision line with the weights,
            shift it with the bias, then drag the white dot (a new patient).
          </p>
          <Slider label={`w₁ (size weight) = ${w1.toFixed(2)}`} min={-3} max={3} step={0.1} value={w1} onInput={setW1} />
          <Slider label={`w₂ (uniformity weight) = ${w2.toFixed(2)}`} min={-3} max={3} step={0.1} value={w2} onInput={setW2} />
          <Slider label={`b (bias) = ${b.toFixed(1)}`} min={-12} max={4} step={0.2} value={b} onInput={setB} />
          <div class="rounded-lg bg-surface-2 p-3">
            <div class="flex justify-between"><span class="text-muted">z = w·x + b</span><strong>{z.toFixed(2)}</strong></div>
            <div class="flex justify-between"><span class="text-muted">a = σ(z)</span><strong>{a.toFixed(3)}</strong></div>
            <p class="mt-1 text-xs text-muted">
              {a > 0.5 ? 'Output > 0.5 → predicts malignant.' : 'Output < 0.5 → predicts benign.'} The green
              line is exactly where z = 0 and a = 0.5.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Slider({ label, min, max, step, value, onInput }: {
  label: string; min: number; max: number; step: number; value: number; onInput: (v: number) => void;
}) {
  return (
    <label class="block">
      <span class="mb-1 block text-muted">{label}</span>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onInput={(e) => onInput(parseFloat((e.target as HTMLInputElement).value))}
        class="w-full accent-[#4f46e5]"
      />
    </label>
  );
}
