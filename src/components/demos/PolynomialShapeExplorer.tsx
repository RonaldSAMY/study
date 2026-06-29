import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Interactive polynomial shape explorer.
   - Choose the degree (1–5).
   - Slide each coefficient and watch the curve bend.
   - Turning points (local peaks & valleys) are detected numerically
     and marked with emerald dots; the readout reports end behavior.
   Crisp, responsive canvas — same conventions as VectorPlayground.
   ------------------------------------------------------------------ */

type Pt = { x: number; y: number };

const COLORS = {
  curve: '#4f46e5',   // indigo
  turn: '#10b981',    // emerald
  grid: 'rgba(128,128,128,0.18)',
  axis: 'rgba(128,128,128,0.5)',
};

const MAX_DEG = 5;

export default function PolynomialShapeExplorer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [degree, setDegree] = useState(3);
  // coeffs[i] is the coefficient of x^i. Length MAX_DEG + 1.
  const [coeffs, setCoeffs] = useState<number[]>([0, -1, 0, 0.2, 0, 0]);
  const sizeRef = useRef({ w: 480, h: 360, scale: 24, ox: 240, oy: 180 });

  // evaluate using only terms up to the chosen degree
  const f = (x: number) => {
    let y = 0;
    for (let i = 0; i <= degree; i++) y += coeffs[i] * Math.pow(x, i);
    return y;
  };

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

    // ---- the polynomial curve ----
    ctx.strokeStyle = COLORS.curve;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    let started = false;
    for (let px = 0; px <= w; px += 2) {
      const mx = toMathX(px);
      const py = toPx({ x: mx, y: f(mx) }).y;
      if (py < -4000 || py > H + 4000) { started = false; continue; }
      if (!started) { ctx.moveTo(px, py); started = true; } else { ctx.lineTo(px, py); }
    }
    ctx.stroke();

    // ---- turning points: sign changes of the numeric derivative ----
    const turns = findTurningPoints(f, toMathX(0), toMathX(w));
    for (const tx of turns) {
      dot(ctx, toPx({ x: tx, y: f(tx) }), COLORS.turn, 5);
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
      const scale = Math.max(20, Math.min(40, w / 13));
      sizeRef.current = { w, h: ht, scale, ox: w / 2, oy: ht / 2 };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(draw, [degree, coeffs]);

  const setCoeff = (i: number, v: number) =>
    setCoeffs((c) => c.map((old, j) => (j === i ? v : old)));

  // ---- live readout ----
  const lead = coeffs[degree];
  const turns = findTurningPoints(f, -1000, 1000);
  const endBehavior = (() => {
    if (Math.abs(lead) < 1e-9) return 'flat (leading coefficient is 0)';
    const even = degree % 2 === 0;
    if (even) return lead > 0 ? 'both ends rise ↑↑' : 'both ends fall ↓↓';
    return lead > 0 ? 'falls left, rises right ↓↑' : 'rises left, falls right ↑↓';
  })();

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <span class="text-sm text-muted">degree:</span>
        {[1, 2, 3, 4, 5].map((d) => (
          <button
            key={d}
            onClick={() => setDegree(d)}
            class={`h-8 w-8 rounded-lg text-sm font-semibold transition ${
              degree === d ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
            }`}
          >
            {d}
          </button>
        ))}
      </div>

      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

        <div class="space-y-3 text-sm">
          <p class="text-muted">
            Slide each coefficient. <span style={`color:${COLORS.turn}`} class="font-semibold">Green dots</span>{' '}
            mark turning points — a degree-n curve has at most n − 1 of them.
          </p>

          {Array.from({ length: degree + 1 }, (_, i) => i)
            .reverse()
            .map((i) => (
              <label key={i} class="block">
                <span class="mb-1 block text-muted">
                  {i === 0 ? 'constant' : `x${supers(i)}`} coefficient = {coeffs[i].toFixed(1)}
                </span>
                <input
                  type="range" min={-2} max={2} step={0.1} value={coeffs[i]}
                  onInput={(e) => setCoeff(i, parseFloat((e.target as HTMLInputElement).value))}
                  class="w-full"
                  style={`accent-color:${COLORS.curve}`}
                />
              </label>
            ))}

          <div class="space-y-1 rounded-lg bg-surface-2 p-3">
            <div class="flex items-center justify-between">
              <span class="text-muted">turning points</span>
              <strong class="font-mono">{turns.length} <span class="text-muted">/ max {Math.max(0, degree - 1)}</span></strong>
            </div>
            <div class="flex items-center justify-between border-t border-border pt-1">
              <span class="text-muted">end behavior</span>
              <strong class="text-xs">{endBehavior}</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function supers(n: number) {
  const map: Record<string, string> = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵' };
  return n === 1 ? '' : String(n).split('').map((d) => map[d]).join('');
}

// numerically locate local extrema by scanning for slope sign changes
function findTurningPoints(f: (x: number) => number, xMin: number, xMax: number): number[] {
  const out: number[] = [];
  const N = 1600;
  const dx = (xMax - xMin) / N;
  let prevSlope = 0;
  for (let i = 1; i <= N; i++) {
    const x = xMin + i * dx;
    const slope = f(x) - f(x - dx);
    if (i > 1 && prevSlope * slope < 0) {
      out.push(x - dx / 2);
    }
    prevSlope = slope;
  }
  return out;
}

function dot(ctx: CanvasRenderingContext2D, at: Pt, color: string, r = 5) {
  ctx.beginPath(); ctx.arc(at.x, at.y, r, 0, Math.PI * 2);
  ctx.fillStyle = color; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
}
