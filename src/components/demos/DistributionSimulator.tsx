import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Distribution simulator.
   - Pick a random variable: a single die, the sum of two dice, or the
     number of heads in 10 coin flips (a Binomial).
   - Roll once, 100×, or 1000× (animated) and watch the empirical
     histogram (sky bars) converge to the theoretical distribution
     (emerald markers) — the law of large numbers, intuitively.
   ------------------------------------------------------------------ */

type ExpId = 'die' | 'sum2' | 'coin';

type Experiment = {
  id: ExpId;
  label: string;
  values: number[];     // the outcomes X can take
  probs: number[];      // theoretical P(X = value)
  expected: number;     // E[X]
  sample: () => number; // returns an index into values
};

const COLORS = {
  bar: '#0ea5e9',       // sky — empirical
  theory: '#10b981',    // emerald — theoretical
  grid: 'rgba(128,128,128,0.18)',
  axis: 'rgba(128,128,128,0.5)',
  text: 'rgba(128,128,128,0.9)',
};

// --- build the three experiments ---
function makeDie(): Experiment {
  const values = [1, 2, 3, 4, 5, 6];
  const probs = values.map(() => 1 / 6);
  return {
    id: 'die',
    label: 'Single die',
    values,
    probs,
    expected: 3.5,
    sample: () => Math.floor(Math.random() * 6), // index 0..5
  };
}

function makeSum2(): Experiment {
  const values = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const ways = [1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1];
  const probs = ways.map((w) => w / 36);
  return {
    id: 'sum2',
    label: 'Sum of two dice',
    values,
    probs,
    expected: 7,
    sample: () => {
      const a = Math.floor(Math.random() * 6) + 1;
      const b = Math.floor(Math.random() * 6) + 1;
      return a + b - 2; // index for sum 2..12
    },
  };
}

function makeCoin(): Experiment {
  const n = 10;
  const values: number[] = [];
  const probs: number[] = [];
  // binomial(10, 0.5): P(k) = C(10,k) / 2^10
  let c = 1; // C(10, 0)
  const denom = Math.pow(2, n);
  for (let k = 0; k <= n; k++) {
    values.push(k);
    probs.push(c / denom);
    c = (c * (n - k)) / (k + 1); // next binomial coefficient
  }
  return {
    id: 'coin',
    label: 'Heads in 10 flips',
    values,
    probs,
    expected: 5,
    sample: () => {
      let heads = 0;
      for (let i = 0; i < n; i++) if (Math.random() < 0.5) heads++;
      return heads; // index 0..10
    },
  };
}

const EXPERIMENTS: Record<ExpId, Experiment> = {
  die: makeDie(),
  sum2: makeSum2(),
  coin: makeCoin(),
};

export default function DistributionSimulator() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [expId, setExpId] = useState<ExpId>('die');
  const [counts, setCounts] = useState<number[]>(() => EXPERIMENTS.die.values.map(() => 0));
  const [rolling, setRolling] = useState(false);

  const exp = EXPERIMENTS[expId];
  const sizeRef = useRef({ w: 480, h: 320 });
  const rafRef = useRef<number | null>(null);
  const remainingRef = useRef(0);

  const total = counts.reduce((s, c) => s + c, 0);
  const empiricalMean =
    total > 0 ? exp.values.reduce((s, v, i) => s + v * counts[i], 0) / total : 0;

  // ---- stop any running animation ----
  const stopAnim = () => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    remainingRef.current = 0;
    setRolling(false);
  };

  // ---- switch experiment (resets counts) ----
  const pickExperiment = (id: ExpId) => {
    stopAnim();
    setExpId(id);
    setCounts(EXPERIMENTS[id].values.map(() => 0));
  };

  const reset = () => {
    stopAnim();
    setCounts(exp.values.map(() => 0));
  };

  // ---- add n samples in one go ----
  const addSamples = (n: number) => {
    setCounts((prev) => {
      const next = prev.slice();
      for (let i = 0; i < n; i++) next[exp.sample()]++;
      return next;
    });
  };

  const rollOnce = () => {
    if (rolling) return;
    addSamples(1);
  };
  const roll100 = () => {
    if (rolling) return;
    addSamples(100);
  };

  // ---- animated batch rolling for 1000× ----
  const runMany = (n: number) => {
    if (rolling) return;
    remainingRef.current = n;
    setRolling(true);
    const step = () => {
      if (remainingRef.current <= 0) {
        stopAnim();
        return;
      }
      const batch = Math.min(remainingRef.current, 25);
      remainingRef.current -= batch;
      addSamples(batch);
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
  };

  // ---- draw the histogram ----
  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);

    const padL = 34, padR = 12, padT = 18, padB = 30;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;
    const n = exp.values.length;

    const tot = counts.reduce((s, c) => s + c, 0);
    const maxTheory = Math.max(...exp.probs);
    const maxEmp = tot > 0 ? Math.max(...counts) / tot : 0;
    const yMax = Math.max(maxTheory, maxEmp) * 1.15 || 1;

    const yToPx = (p: number) => padT + plotH - (p / yMax) * plotH;
    const slot = plotW / n;
    const barW = slot * 0.66;

    // y gridlines + labels
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    const ticks = 4;
    for (let t = 0; t <= ticks; t++) {
      const p = (yMax * t) / ticks;
      const y = yToPx(p);
      ctx.strokeStyle = COLORS.grid;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
      ctx.fillStyle = COLORS.text;
      ctx.fillText(`${Math.round(p * 100)}%`, padL - 6, y);
    }

    // baseline axis
    ctx.strokeStyle = COLORS.axis;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(padL, padT + plotH);
    ctx.lineTo(w - padR, padT + plotH);
    ctx.stroke();

    // empirical bars
    ctx.fillStyle = COLORS.bar;
    for (let i = 0; i < n; i++) {
      const p = tot > 0 ? counts[i] / tot : 0;
      const x = padL + i * slot + (slot - barW) / 2;
      const y = yToPx(p);
      const barH = padT + plotH - y;
      if (barH > 0) ctx.fillRect(x, y, barW, barH);
    }

    // theoretical overlay: connecting line + markers
    ctx.strokeStyle = COLORS.theory;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const cx = padL + i * slot + slot / 2;
      const cy = yToPx(exp.probs[i]);
      if (i === 0) ctx.moveTo(cx, cy);
      else ctx.lineTo(cx, cy);
    }
    ctx.stroke();
    ctx.fillStyle = COLORS.theory;
    for (let i = 0; i < n; i++) {
      const cx = padL + i * slot + slot / 2;
      const cy = yToPx(exp.probs[i]);
      ctx.beginPath();
      ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // x axis labels (thin out if crowded)
    ctx.fillStyle = COLORS.text;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = '11px Inter, sans-serif';
    const everyOther = slot < 26 && n > 8;
    for (let i = 0; i < n; i++) {
      if (everyOther && i % 2 === 1) continue;
      const cx = padL + i * slot + slot / 2;
      ctx.fillText(String(exp.values[i]), cx, padT + plotH + 6);
    }
  };

  // ---- responsive sizing with devicePixelRatio ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 620);
      const h = Math.round(Math.max(220, Math.min(360, w * 0.6)));
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

  // redraw whenever the data or experiment changes
  useEffect(draw, [counts, expId]);

  // cleanup animation on unmount
  useEffect(() => () => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      {/* experiment picker */}
      <div class="mb-3 flex flex-wrap gap-2">
        {(Object.keys(EXPERIMENTS) as ExpId[]).map((id) => (
          <button
            key={id}
            onClick={() => pickExperiment(id)}
            class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              expId === id ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
            }`}
          >
            {EXPERIMENTS[id].label}
          </button>
        ))}
      </div>

      <div class="grid gap-4 md:grid-cols-[1fr,auto] md:items-start">
        <div>
          <canvas ref={canvasRef} class="touch-none w-full rounded-xl bg-surface-2" />
          <div class="mt-2 flex flex-wrap items-center gap-4 text-xs text-muted">
            <span class="flex items-center gap-1.5">
              <span class="inline-block h-2.5 w-3.5 rounded-sm" style={`background:${COLORS.bar}`} />
              empirical (your rolls)
            </span>
            <span class="flex items-center gap-1.5">
              <span class="inline-block h-2.5 w-3.5 rounded-sm" style={`background:${COLORS.theory}`} />
              theoretical P(X = x)
            </span>
          </div>
        </div>

        <div class="space-y-3 text-sm md:w-56">
          {/* controls */}
          <div class="grid grid-cols-2 gap-2">
            <button
              onClick={rollOnce}
              disabled={rolling}
              class="rounded-lg bg-brand px-3 py-2 font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              Roll once
            </button>
            <button
              onClick={roll100}
              disabled={rolling}
              class="rounded-lg bg-surface-2 px-3 py-2 font-semibold text-text transition hover:text-brand disabled:opacity-50"
            >
              Roll 100×
            </button>
            <button
              onClick={() => runMany(1000)}
              disabled={rolling}
              class="rounded-lg bg-surface-2 px-3 py-2 font-semibold text-text transition hover:text-brand disabled:opacity-50"
            >
              {rolling ? 'Rolling…' : 'Run 1000×'}
            </button>
            <button
              onClick={reset}
              class="rounded-lg border border-border px-3 py-2 font-semibold text-muted transition hover:text-text"
            >
              Reset
            </button>
          </div>

          {/* readouts */}
          <div class="space-y-2">
            <Readout label="samples" value={total.toLocaleString()} />
            <Readout
              label="empirical mean"
              color={COLORS.bar}
              value={total > 0 ? empiricalMean.toFixed(3) : '—'}
            />
            <Readout label="E[X] (theory)" color={COLORS.theory} value={exp.expected.toFixed(3)} />
          </div>

          <p class="text-xs text-muted">
            Keep rolling: the sky bars settle onto the emerald distribution, and the empirical mean
            closes in on E[X].
          </p>
        </div>
      </div>
    </div>
  );
}

function Readout({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div class="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2">
      <span class="text-muted" style={color ? `color:${color}` : ''}>{label}</span>
      <span class="font-mono font-semibold">{value}</span>
    </div>
  );
}
