import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Series convergence track.
   - Pick a series; each partial sum S_N is plotted as a dot on a
     horizontal number line.
   - PLAY animates N upward; dots either crowd toward a marked limit
     (indigo target line) or march off to the right (divergence).
   - Shows the running value S_N and the latest term a_N.
   - requestAnimationFrame drives play; the id lives in a ref and is
     cancelled on unmount.
   ------------------------------------------------------------------ */

type SeriesId = 'geoHalf' | 'geoTwoThird' | 'harmonic' | 'altHarmonic';

interface SeriesDef {
  id: SeriesId;
  label: string;
  // the n-th term, n starting at 1
  term: (n: number) => number;
  // finite limit, or null if it diverges
  limit: number | null;
  // window of the number line to show [min, max]
  view: [number, number];
  blurb: string;
}

const SERIES: SeriesDef[] = [
  {
    id: 'geoHalf',
    label: 'Σ (1/2)ⁿ',
    term: (n) => Math.pow(0.5, n),
    limit: 1,
    view: [0, 1.25],
    blurb: 'Geometric, r = 1/2. Converges to a/(1−r) = (1/2)/(1/2) = 1.',
  },
  {
    id: 'geoTwoThird',
    label: 'Σ (2/3)ⁿ',
    term: (n) => Math.pow(2 / 3, n),
    limit: 2,
    view: [0, 2.4],
    blurb: 'Geometric, r = 2/3. Converges to a/(1−r) = (2/3)/(1/3) = 2.',
  },
  {
    id: 'harmonic',
    label: 'Σ 1/n',
    term: (n) => 1 / n,
    limit: null,
    view: [0, 5],
    blurb: 'The harmonic series. Terms shrink, yet the sum grows without bound — it diverges.',
  },
  {
    id: 'altHarmonic',
    label: 'Σ (−1)ⁿ⁺¹/n',
    term: (n) => (n % 2 === 1 ? 1 : -1) / n,
    limit: Math.LN2,
    view: [0, 1.1],
    blurb: 'Alternating harmonic. The partial sums hop above and below, closing in on ln 2 ≈ 0.693.',
  },
];

const COLORS = {
  dot: '#10b981', // emerald — partial sums
  limit: '#4f46e5', // indigo — target / limit
  secondary: '#0ea5e9', // sky — latest dot highlight
  line: 'rgba(128,128,128,0.55)',
  tick: 'rgba(128,128,128,0.35)',
  text: 'rgba(128,128,128,0.95)',
};

const MAX_N = 60;

export default function SeriesConvergenceTrack() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const sizeRef = useRef({ w: 480, h: 220 });

  const [seriesId, setSeriesId] = useState<SeriesId>('geoHalf');
  const [n, setN] = useState(1);
  const [playing, setPlaying] = useState(false);

  const series = SERIES.find((s) => s.id === seriesId)!;

  // ---- compute partial sums S_1 .. S_n ----
  const partials: number[] = [];
  {
    let acc = 0;
    for (let i = 1; i <= n; i++) {
      acc += series.term(i);
      partials.push(acc);
    }
  }
  const currentSum = partials[partials.length - 1] ?? 0;
  const currentTerm = series.term(n);

  // ---- draw the number line + dots ----
  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);

    const padL = 24;
    const padR = 24;
    const lineY = h - 64;
    const [vmin, vmax] = series.view;
    const toX = (val: number) => {
      const clamped = Math.max(vmin, Math.min(vmax, val));
      return padL + ((clamped - vmin) / (vmax - vmin)) * (w - padL - padR);
    };

    // number line
    ctx.strokeStyle = COLORS.line;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(padL, lineY);
    ctx.lineTo(w - padR, lineY);
    ctx.stroke();

    // ticks + labels
    ctx.fillStyle = COLORS.text;
    ctx.font = '500 11px Inter, sans-serif';
    ctx.textAlign = 'center';
    const span = vmax - vmin;
    const step = span <= 1.3 ? 0.25 : span <= 2.6 ? 0.5 : 1;
    for (let v = 0; v <= vmax + 1e-9; v += step) {
      if (v < vmin - 1e-9) continue;
      const x = toX(v);
      ctx.strokeStyle = COLORS.tick;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, lineY - 5);
      ctx.lineTo(x, lineY + 5);
      ctx.stroke();
      ctx.fillStyle = COLORS.text;
      ctx.fillText(v.toFixed(2).replace(/\.00$/, '').replace(/0$/, ''), x, lineY + 20);
    }

    // limit / target line (if convergent)
    if (series.limit !== null) {
      const lx = toX(series.limit);
      ctx.strokeStyle = COLORS.limit;
      ctx.setLineDash([5, 4]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(lx, 16);
      ctx.lineTo(lx, lineY + 8);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = COLORS.limit;
      ctx.font = '600 12px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`limit ${series.limit.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')}`, lx, 12);
    } else {
      ctx.fillStyle = COLORS.limit;
      ctx.font = '600 12px Inter, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('→ ∞ (diverges)', w - padR, 14);
    }

    // partial-sum dots — older fade, latest is highlighted
    for (let i = 0; i < partials.length; i++) {
      const val = partials[i];
      const x = toX(val);
      const isLast = i === partials.length - 1;
      // stagger vertically a touch so overlapping dots are visible
      const y = lineY - 14 - (i % 6) * 3;
      const age = (i + 1) / partials.length;
      ctx.beginPath();
      ctx.arc(x, y, isLast ? 6.5 : 3.5, 0, Math.PI * 2);
      ctx.fillStyle = isLast ? COLORS.secondary : COLORS.dot;
      ctx.globalAlpha = isLast ? 1 : 0.25 + 0.55 * age;
      ctx.fill();
      ctx.globalAlpha = 1;
      if (isLast) {
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#fff';
        ctx.stroke();
        // drop-line from dot to the number line
        ctx.strokeStyle = COLORS.secondary;
        ctx.setLineDash([2, 3]);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, lineY);
        ctx.stroke();
        ctx.setLineDash([]);
        // S_N label
        ctx.fillStyle = COLORS.secondary;
        ctx.font = '600 12px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`S${subscript(n)}`, x, y - 12);
      }
    }
  };

  // ---- responsive sizing with devicePixelRatio ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 560);
      const h = Math.round(Math.max(200, Math.min(240, w * 0.5)));
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

  // redraw whenever state changes
  useEffect(draw, [seriesId, n]);

  // ---- play animation via requestAnimationFrame ----
  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    const tick = (now: number) => {
      if (now - last > 320) {
        last = now;
        setN((prev) => {
          if (prev >= MAX_N) {
            setPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [playing]);

  // ---- cleanup any stray frame on unmount ----
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const pickSeries = (id: SeriesId) => {
    setPlaying(false);
    setSeriesId(id);
    setN(1);
  };

  const togglePlay = () => {
    if (!playing && n >= MAX_N) setN(1);
    setPlaying((p) => !p);
  };

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap gap-2">
        {SERIES.map((s) => (
          <button
            key={s.id}
            onClick={() => pickSeries(s.id)}
            class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              seriesId === s.id ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <canvas ref={canvasRef} class="touch-none w-full rounded-xl bg-surface-2" />

      <div class="mt-3 flex flex-wrap items-center gap-3">
        <button
          onClick={togglePlay}
          class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white transition hover:opacity-90"
        >
          {playing ? '❚❚ Pause' : '▶ Play'}
        </button>
        <label class="flex flex-1 items-center gap-2 text-sm">
          <span class="text-muted whitespace-nowrap">terms N = {n}</span>
          <input
            type="range"
            min={1}
            max={MAX_N}
            step={1}
            value={n}
            onInput={(e) => {
              setPlaying(false);
              setN(parseInt((e.target as HTMLInputElement).value, 10));
            }}
            class="w-full accent-[#10b981]"
          />
        </label>
      </div>

      <div class="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
        <Readout label={`S${subscript(n)} (partial sum)`} value={currentSum.toFixed(4)} color={COLORS.secondary} />
        <Readout label={`a${subscript(n)} (latest term)`} value={fmtTerm(currentTerm)} color={COLORS.dot} />
        <Readout
          label="target"
          value={series.limit === null ? 'diverges' : series.limit.toFixed(4)}
          color={COLORS.limit}
        />
      </div>

      <p class="mt-3 rounded-lg bg-surface-2 p-3 text-xs text-muted">{series.blurb}</p>
    </div>
  );
}

function Readout({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div class="rounded-lg bg-surface-2 px-3 py-2">
      <span class="text-muted" style={color ? `color:${color}` : ''}>
        {label}
      </span>
      <div class="font-mono font-semibold text-text">{value}</div>
    </div>
  );
}

// pretty-print a (possibly negative, possibly tiny) term
function fmtTerm(t: number): string {
  if (Math.abs(t) < 1e-4) return t.toExponential(2);
  return t.toFixed(4);
}

// turn an integer into a unicode subscript, e.g. 12 -> ₁₂
function subscript(num: number): string {
  const map: Record<string, string> = {
    '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
    '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
  };
  return String(num)
    .split('')
    .map((d) => map[d] ?? d)
    .join('');
}
