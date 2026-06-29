import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Solid-of-revolution lab (disk method).
   - Pick a profile curve y = f(x) on [a, b].
   - It spins around the x-axis to sweep out a solid.
   - The slider sets how many disks approximate that solid; each disk
     is a circle of radius f(xᵢ), drawn edge-on as an ellipse.
   - Volume ≈ Σ π f(xᵢ)² Δx converges on the exact ∫ π f(x)² dx.
   Crisp, responsive canvas — same conventions as VectorPlayground.
   ------------------------------------------------------------------ */

const COLORS = {
  curve: '#4f46e5', // indigo
  disk: '#10b981', // emerald
  diskFill: 'rgba(16,185,129,0.16)',
  grid: 'rgba(128,128,128,0.18)',
  axis: 'rgba(128,128,128,0.5)',
};

type ShapeKey = 'vase' | 'nozzle' | 'cone';

type Shape = {
  label: string;
  story: string;
  formula: string;
  f: (x: number) => number;
  a: number;
  b: number;
  exact: number; // exact volume ∫ π f² dx
};

const SHAPES: Record<ShapeKey, Shape> = {
  vase: {
    label: 'y = √x  (bowl)',
    story: 'Spin y = √x to mould a parabolic bowl — the shape of a satellite dish or a wine glass base.',
    formula: 'V = ∫₀⁴ π(√x)² dx = ∫₀⁴ πx dx = 8π ≈ 25.13',
    f: (x) => Math.sqrt(x),
    a: 0,
    b: 4,
    exact: Math.PI * 8,
  },
  nozzle: {
    label: 'y = 1 + ½·sin(x)  (vase)',
    story: 'A gently waving profile spins into a curvy vase — or a rocket nozzle that pinches and flares.',
    formula: 'V = ∫₀^{2π} π(1 + ½sin x)² dx = π(2π + ¼π) = (9π²)/4 ≈ 22.21',
    f: (x) => 1 + 0.5 * Math.sin(x),
    a: 0,
    b: 2 * Math.PI,
    exact: 2.25 * Math.PI * Math.PI, // ∫(1+ .5 sin)^2 = 2π + .25π = 2.25π ; ×π = 2.25π²
  },
  cone: {
    label: 'y = ½·x  (cone)',
    story: 'A straight line through the origin spins into a perfect cone — an ice-cream cone or a party hat.',
    formula: 'V = ∫₀⁴ π(½x)² dx = (π/4)·(64/3) = (16π)/3 ≈ 16.76',
    f: (x) => 0.5 * x,
    a: 0,
    b: 4,
    exact: (Math.PI / 4) * (64 / 3),
  },
};

export default function SolidOfRevolutionLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [shapeKey, setShapeKey] = useState<ShapeKey>('vase');
  const [n, setN] = useState(8);
  const sizeRef = useRef({ w: 480, h: 340 });

  const shape = SHAPES[shapeKey];

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);

    const { a, b, f } = shape;
    // y-range
    let yMax = 0;
    for (let i = 0; i <= 100; i++) yMax = Math.max(yMax, f(a + ((b - a) * i) / 100));
    yMax = yMax * 1.25 || 1;

    const padX = 30;
    const axisY = h / 2;
    const X = (x: number) => padX + ((x - a) / (b - a)) * (w - 2 * padX);
    const R = (y: number) => (y / yMax) * (h / 2 - 16); // radius in px

    // grid
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    for (let i = 0; i <= 6; i++) {
      const gx = padX + ((w - 2 * padX) * i) / 6;
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke();
    }

    // axis of revolution
    ctx.strokeStyle = COLORS.axis;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, axisY); ctx.lineTo(w, axisY); ctx.stroke();

    // disks
    const dx = (b - a) / n;
    const ellW = Math.max(3, ((w - 2 * padX) / n) * 0.5); // half-width of ellipse
    for (let i = 0; i < n; i++) {
      const xc = a + (i + 0.5) * dx; // midpoint sample
      const r = R(f(xc));
      const cx = X(xc);
      // disk body (rectangle band)
      ctx.fillStyle = COLORS.diskFill;
      ctx.fillRect(X(a + i * dx), axisY - r, X(a + (i + 1) * dx) - X(a + i * dx), 2 * r);
      // front ellipse (the circular cross-section seen edge-on)
      ctx.beginPath();
      ctx.ellipse(cx + ((w - 2 * padX) / n) * 0.32, axisY, ellW, r, 0, 0, Math.PI * 2);
      ctx.strokeStyle = COLORS.disk;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // generating curve (top) + mirror (bottom)
    for (const sign of [1, -1]) {
      ctx.strokeStyle = COLORS.curve;
      ctx.lineWidth = sign === 1 ? 3 : 1.5;
      ctx.globalAlpha = sign === 1 ? 1 : 0.45;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i <= 120; i++) {
        const x = a + ((b - a) * i) / 120;
        const px = X(x);
        const py = axisY - sign * R(f(x));
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // label
    ctx.font = '600 12px Inter, sans-serif';
    ctx.fillStyle = COLORS.curve;
    ctx.fillText('y = f(x)', padX + 4, 16);
    ctx.fillStyle = 'rgba(128,128,128,0.8)';
    ctx.fillText('axis of revolution', w - 120, axisY - 6);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 560);
      const ht = Math.round(w * 0.64);
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

  useEffect(draw, [shapeKey, n]);

  // disk-method Riemann sum: Σ π f(xc)² Δx
  const dx = (shape.b - shape.a) / n;
  let approx = 0;
  for (let i = 0; i < n; i++) {
    const xc = shape.a + (i + 0.5) * dx;
    approx += Math.PI * shape.f(xc) * shape.f(xc) * dx;
  }
  const errPct = Math.abs((approx - shape.exact) / shape.exact) * 100;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap gap-2">
        {(Object.keys(SHAPES) as ShapeKey[]).map((k) => (
          <button
            key={k}
            onClick={() => setShapeKey(k)}
            class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              shapeKey === k ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
            }`}
          >
            {SHAPES[k].label}
          </button>
        ))}
      </div>

      <p class="mb-3 text-sm text-muted">{shape.story}</p>

      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

        <div class="space-y-3 text-sm">
          <label class="block">
            <span class="mb-1 block text-muted">disks (slices) n = {n}</span>
            <input
              type="range"
              min={2}
              max={40}
              step={1}
              value={n}
              onInput={(e) => setN(parseInt((e.target as HTMLInputElement).value))}
              class="w-full accent-[#10b981]"
            />
          </label>

          <div class="grid grid-cols-2 gap-2">
            <Readout label="Δx" value={dx.toFixed(3)} />
            <Readout label="disks" value={`${n}`} color={COLORS.disk} />
          </div>

          <div class="space-y-1 rounded-lg bg-surface-2 p-3">
            <div class="flex justify-between">
              <span style={`color:${COLORS.disk}`} class="font-semibold">V ≈ Σ π f(xᵢ)² Δx</span>
              <strong class="font-mono">{approx.toFixed(3)}</strong>
            </div>
            <div class="flex justify-between">
              <span class="text-muted">exact ∫ π f² dx</span>
              <strong class="font-mono">{shape.exact.toFixed(3)}</strong>
            </div>
            <div class="flex justify-between border-t border-border pt-1">
              <span class="text-muted">error</span>
              <strong class="font-mono">{errPct.toFixed(2)}%</strong>
            </div>
            <p class="mt-1 text-xs text-muted">
              {errPct < 0.5
                ? 'Many thin disks — the stack is now indistinguishable from the smooth solid.'
                : 'Add disks: thinner slices hug the true solid and the error shrinks toward 0.'}
            </p>
          </div>

          <p class="font-mono text-xs text-muted">{shape.formula}</p>
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
