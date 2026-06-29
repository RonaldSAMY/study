import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Partial-sum convergence visual with a ratio-test indicator.
   - Pick a series Σ aₙ.
   - The slider adds terms; the plotted partial sums Sₙ either settle
     onto a limit (dashed line) or march off to infinity.
   - The ratio-test badge shows |aₙ₊₁ / aₙ| and its limit L, with the
     verdict L<1 converge / L>1 diverge / L=1 inconclusive.
   Crisp, responsive canvas — same conventions as VectorPlayground.
   ------------------------------------------------------------------ */

const COLORS = {
  point: '#4f46e5', // indigo partial sums
  limit: '#10b981', // emerald limit line
  diverge: '#0ea5e9',
  grid: 'rgba(128,128,128,0.18)',
  axis: 'rgba(128,128,128,0.5)',
};

type SeriesKey = 'geometric' | 'factorial' | 'psquare' | 'harmonic';

type Series = {
  label: string;
  story: string;
  term: (n: number) => number; // aₙ for n >= 1
  converges: boolean;
  limit?: number;
  limitLabel?: string;
  ratioL: string; // limiting ratio description
  verdict: string;
};

const SERIES: Record<SeriesKey, Series> = {
  geometric: {
    label: 'Σ (1/2)ⁿ',
    story: 'An echo fades by half each bounce. The total loudness is a geometric series → exactly 1.',
    term: (n) => Math.pow(0.5, n),
    converges: true,
    limit: 1,
    limitLabel: 'sum = 1',
    ratioL: 'L = 1/2',
    verdict: 'L < 1 → converges',
  },
  factorial: {
    label: 'Σ 1/n!',
    story: 'How a calculator builds e: add 1/n! terms. They shrink ferociously fast → e − 1.',
    term: (n) => 1 / factorial(n),
    converges: true,
    limit: Math.E - 1,
    limitLabel: 'sum = e − 1 ≈ 1.718',
    ratioL: 'L = 0',
    verdict: 'L < 1 → converges',
  },
  psquare: {
    label: 'Σ 1/n²',
    story: 'The famous Basel sum. It converges to π²/6 — a way to estimate π from pure counting.',
    term: (n) => 1 / (n * n),
    converges: true,
    limit: (Math.PI * Math.PI) / 6,
    limitLabel: 'sum = π²/6 ≈ 1.645',
    ratioL: 'L = 1',
    verdict: 'L = 1 → ratio test inconclusive (but it converges: p = 2)',
  },
  harmonic: {
    label: 'Σ 1/n',
    story: 'Tiny terms, yet the harmonic series never stops growing — it diverges to infinity.',
    term: (n) => 1 / n,
    converges: false,
    ratioL: 'L = 1',
    verdict: 'L = 1 → inconclusive (and it actually diverges)',
  },
};

function factorial(n: number): number {
  let f = 1;
  for (let i = 2; i <= n; i++) f *= i;
  return f;
}

export default function PartialSumConvergence() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [key, setKey] = useState<SeriesKey>('geometric');
  const [n, setN] = useState(8);
  const sizeRef = useRef({ w: 480, h: 320 });

  const s = SERIES[key];

  // partial sums S_1..S_n
  const sums: number[] = [];
  let acc = 0;
  for (let i = 1; i <= n; i++) {
    acc += s.term(i);
    sums.push(acc);
  }

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);

    const padL = 38;
    const padB = 24;
    const padT = 14;
    const padR = 12;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;

    let yMax = Math.max(...sums, s.limit ?? 0) * 1.12;
    if (!isFinite(yMax) || yMax <= 0) yMax = 1;
    const X = (i: number) => padL + (n <= 1 ? 0 : ((i - 1) / (n - 1)) * plotW);
    const Y = (y: number) => padT + plotH - (y / yMax) * plotH;

    // grid
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    for (let g = 0; g <= 4; g++) {
      const gy = padT + (plotH * g) / 4;
      ctx.beginPath(); ctx.moveTo(padL, gy); ctx.lineTo(w - padR, gy); ctx.stroke();
    }
    // axes
    ctx.strokeStyle = COLORS.axis;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(padL, padT); ctx.lineTo(padL, padT + plotH); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(padL, padT + plotH); ctx.lineTo(w - padR, padT + plotH); ctx.stroke();

    // limit line
    if (s.converges && s.limit !== undefined) {
      ctx.setLineDash([6, 5]);
      ctx.strokeStyle = COLORS.limit;
      ctx.lineWidth = 2;
      const ly = Y(s.limit);
      ctx.beginPath(); ctx.moveTo(padL, ly); ctx.lineTo(w - padR, ly); ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = '600 11px Inter, sans-serif';
      ctx.fillStyle = COLORS.limit;
      ctx.fillText(s.limitLabel ?? 'limit', padL + 6, ly - 5);
    }

    // step line connecting partial sums
    const col = s.converges ? COLORS.point : COLORS.diverge;
    ctx.strokeStyle = col;
    ctx.lineWidth = 2;
    ctx.beginPath();
    sums.forEach((v, idx) => {
      const px = X(idx + 1);
      const py = Y(v);
      if (idx === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();

    // points
    sums.forEach((v, idx) => {
      ctx.beginPath();
      ctx.arc(X(idx + 1), Y(v), 3.5, 0, Math.PI * 2);
      ctx.fillStyle = col;
      ctx.fill();
    });

    // labels
    ctx.font = '11px Inter, sans-serif';
    ctx.fillStyle = 'rgba(128,128,128,0.85)';
    ctx.fillText('Sₙ', padL - 30, padT + 10);
    ctx.fillText('n', w - padR - 10, padT + plotH + 16);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 560);
      const ht = Math.round(w * 0.6);
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

  useEffect(draw, [key, n]);

  const Sn = sums[sums.length - 1] ?? 0;
  const ratio = s.term(n) !== 0 ? Math.abs(s.term(n + 1) / s.term(n)) : 0;
  const gap = s.converges && s.limit !== undefined ? Math.abs(s.limit - Sn) : NaN;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap gap-2">
        {(Object.keys(SERIES) as SeriesKey[]).map((k) => (
          <button
            key={k}
            onClick={() => { setKey(k); setN(8); }}
            class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              key === k ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
            }`}
          >
            {SERIES[k].label}
          </button>
        ))}
      </div>

      <p class="mb-3 text-sm text-muted">{s.story}</p>

      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

        <div class="space-y-3 text-sm">
          <label class="block">
            <span class="mb-1 block text-muted">terms n = {n}</span>
            <input
              type="range"
              min={1}
              max={40}
              step={1}
              value={n}
              onInput={(e) => setN(parseInt((e.target as HTMLInputElement).value))}
              class="w-full accent-[#10b981]"
            />
          </label>

          <div class="grid grid-cols-2 gap-2">
            <Readout label="Sₙ" value={Sn.toFixed(4)} color={COLORS.point} />
            <Readout label="gap to limit" value={Number.isNaN(gap) ? '— (diverges)' : gap.toExponential(1)} />
          </div>

          <div class="space-y-1 rounded-lg bg-surface-2 p-3">
            <div class="flex justify-between">
              <span class="text-muted">|aₙ₊₁ / aₙ|</span>
              <strong class="font-mono">{ratio.toFixed(3)}</strong>
            </div>
            <div class="flex justify-between">
              <span class="text-muted">limiting ratio</span>
              <strong class="font-mono">{s.ratioL}</strong>
            </div>
          </div>

          <div
            class={`rounded-lg border px-3 py-2 text-xs font-semibold ${
              s.converges
                ? 'border-calculus/50 bg-calculus/10 text-calculus'
                : 'border-geometry/50 bg-geometry/10 text-geometry'
            }`}
          >
            {s.verdict}
          </div>
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
