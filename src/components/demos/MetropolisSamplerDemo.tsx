import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Metropolis sampler exploring a 2D target distribution (a mixture of
   two Gaussians). The chain takes a random step, then accepts or
   rejects it based on the density ratio. Accepted samples pile up into
   a cloud that traces out the target — without ever normalising it.
   ------------------------------------------------------------------ */

const COLORS = {
  chain: '#4f46e5',
  sample: 'rgba(16,185,129,0.5)',
  proposal: '#0ea5e9',
  grid: 'rgba(128,128,128,0.18)',
};

type Vec = { x: number; y: number };

// Two-bump target: unnormalised density we can only EVALUATE.
const MODES: { c: Vec; w: number; s: number }[] = [
  { c: { x: -1.4, y: -0.8 }, w: 1.0, s: 0.7 },
  { c: { x: 1.5, y: 1.0 }, w: 0.8, s: 0.55 },
];

function target(p: Vec): number {
  let d = 0;
  for (const m of MODES) {
    const dx = p.x - m.c.x;
    const dy = p.y - m.c.y;
    d += m.w * Math.exp(-(dx * dx + dy * dy) / (2 * m.s * m.s));
  }
  return d;
}

// standard-normal sample (Box-Muller)
function randn(): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export default function MetropolisSamplerDemo() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const runningRef = useRef(false);
  const curRef = useRef<Vec>({ x: 0, y: 0 });
  const samplesRef = useRef<Vec[]>([]);
  const acceptRef = useRef(0);
  const totalRef = useRef(0);
  const stepRef = useRef(0.6);
  const sizeRef = useRef({ w: 360, h: 360, scale: 50, ox: 180, oy: 180 });

  const [running, setRunning] = useState(false);
  const [step, setStep] = useState(0.6);
  const [count, setCount] = useState(0);
  const [accRate, setAccRate] = useState(0);

  const MAX = 6000;

  const toPx = (p: Vec) => {
    const { scale, ox, oy } = sizeRef.current;
    return { x: ox + p.x * scale, y: oy - p.y * scale };
  };

  const drawAll = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h, scale, ox, oy } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);

    // faint density contours by evaluating target on a coarse grid
    const cells = 44;
    const cw = w / cells;
    let maxD = 0;
    const grid: number[][] = [];
    for (let i = 0; i < cells; i++) {
      grid[i] = [];
      for (let j = 0; j < cells; j++) {
        const mx = (i * cw + cw / 2 - ox) / scale;
        const my = (oy - (j * cw + cw / 2)) / scale;
        const d = target({ x: mx, y: my });
        grid[i][j] = d;
        if (d > maxD) maxD = d;
      }
    }
    for (let i = 0; i < cells; i++) {
      for (let j = 0; j < cells; j++) {
        const a = (grid[i][j] / maxD) * 0.32;
        if (a < 0.01) continue;
        ctx.fillStyle = `rgba(79,70,229,${a.toFixed(3)})`;
        ctx.fillRect(i * cw, j * cw, cw + 1, cw + 1);
      }
    }

    // accepted samples
    ctx.fillStyle = COLORS.sample;
    for (const s of samplesRef.current) {
      const q = toPx(s);
      ctx.beginPath();
      ctx.arc(q.x, q.y, 1.7, 0, Math.PI * 2);
      ctx.fill();
    }

    // current chain position
    const c = toPx(curRef.current);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(c.x, c.y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = COLORS.chain;
    ctx.stroke();
  };

  const iterate = () => {
    if (!runningRef.current) return;
    const cur = curRef.current;
    const s = stepRef.current;
    for (let i = 0; i < 8 && samplesRef.current.length < MAX; i++) {
      const prop: Vec = { x: cur.x + s * randn(), y: cur.y + s * randn() };
      const ratio = target(prop) / (target(cur) || 1e-12);
      totalRef.current++;
      if (Math.random() < Math.min(1, ratio)) {
        cur.x = prop.x;
        cur.y = prop.y;
        acceptRef.current++;
      }
      samplesRef.current.push({ x: cur.x, y: cur.y });
    }
    setCount(samplesRef.current.length);
    setAccRate(totalRef.current ? acceptRef.current / totalRef.current : 0);
    drawAll();
    if (samplesRef.current.length >= MAX) {
      runningRef.current = false;
      setRunning(false);
      return;
    }
    rafRef.current = requestAnimationFrame(iterate);
  };

  const toggle = () => {
    const next = !runningRef.current;
    runningRef.current = next;
    setRunning(next);
    if (next) rafRef.current = requestAnimationFrame(iterate);
  };

  const reset = () => {
    runningRef.current = false;
    setRunning(false);
    curRef.current = { x: 0, y: 0 };
    samplesRef.current = [];
    acceptRef.current = 0;
    totalRef.current = 0;
    setCount(0);
    setAccRate(0);
    drawAll();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.max(240, Math.min(parent.clientWidth, 380));
      const h = w;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w, h, scale: w / 7, ox: w / 2, oy: h / 2 };
      drawAll();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <button
          onClick={toggle}
          class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white transition hover:opacity-90"
        >
          {running ? 'Pause' : 'Run chain'}
        </button>
        <button
          onClick={reset}
          class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted transition hover:text-text"
        >
          Reset
        </button>
      </div>

      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

        <div class="space-y-3 text-sm">
          <p class="text-muted">
            The white dot is the chain. It keeps proposing a nearby step and accepting it
            more often when the target density is higher. Green dots are the samples kept.
          </p>
          <label class="block">
            <span class="mb-1 block text-muted">proposal step size = {step.toFixed(2)}</span>
            <input
              type="range"
              min={0.1}
              max={2}
              step={0.05}
              value={step}
              onInput={(e) => {
                const v = parseFloat((e.target as HTMLInputElement).value);
                setStep(v);
                stepRef.current = v;
              }}
              class="w-full accent-[#4f46e5]"
            />
          </label>
          <div class="grid grid-cols-2 gap-2">
            <Stat label="samples" value={count.toLocaleString()} />
            <Stat label="acceptance" value={`${(accRate * 100).toFixed(0)}%`} color={COLORS.proposal} />
          </div>
          <div class="rounded-lg bg-surface-2 p-3 text-xs text-muted">
            Too small a step and the chain crawls; too large and almost every proposal is
            rejected. A healthy acceptance rate sits around <strong>25–50%</strong>.
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div class="rounded-lg bg-surface-2 px-3 py-2">
      <span class="text-muted" style={color ? `color:${color}` : ''}>
        {label}
      </span>
      <div class="font-mono font-semibold">{value}</div>
    </div>
  );
}
