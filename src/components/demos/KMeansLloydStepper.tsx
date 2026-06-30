import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Interactive k-Means (Lloyd's algorithm) stepper.
   - A fixed 2D cloud of points (regenerable with a new seed).
   - Pick k = 2..4 centroids.
   - Step the algorithm by hand: the button alternates between
     "Assign" (color each point by its nearest centroid) and
     "Update" (move each centroid to the mean of its points).
   - Auto-run option, plus reset / new-seeds.
   - Readouts: k, iteration, current phase, and inertia (WCSS),
     which should decrease over iterations.
   Canvas conventions copied from VectorPlayground.
   ------------------------------------------------------------------ */

type Pt = { x: number; y: number };
type Phase = 'assign' | 'update';

// cluster palette (indigo, sky, emerald, amber)
const CLUSTER_COLORS = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b'];
const COLORS = {
  grid: 'rgba(128,128,128,0.16)',
  link: 'rgba(128,128,128,0.35)',
  unassigned: 'rgba(128,128,128,0.55)',
};

// ---- tiny seeded PRNG so a "seed" reproduces the same cloud ----
function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

// gaussian-ish blob via averaging
function makePoints(seed: number): Pt[] {
  const rnd = mulberry32(seed);
  // three loose blobs in math space roughly [0,10] x [0,10]
  const centers = [
    { x: 2.6, y: 7.2 },
    { x: 7.6, y: 7.6 },
    { x: 4.8, y: 2.6 },
  ];
  const pts: Pt[] = [];
  for (const c of centers) {
    for (let i = 0; i < 18; i++) {
      const g = () => (rnd() + rnd() + rnd() - 1.5) * 1.7;
      pts.push({ x: c.x + g(), y: c.y + g() });
    }
  }
  return pts;
}

function makeCentroids(seed: number, k: number, pts: Pt[]): Pt[] {
  const rnd = mulberry32(seed * 7919 + k * 104729 + 1);
  // pick k distinct points as starting centroids
  const idx = pts.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx.slice(0, k).map((i) => ({ ...pts[i] }));
}

function nearest(p: Pt, cents: Pt[]): number {
  let best = 0;
  let bd = Infinity;
  for (let j = 0; j < cents.length; j++) {
    const dx = p.x - cents[j].x;
    const dy = p.y - cents[j].y;
    const d = dx * dx + dy * dy;
    if (d < bd) {
      bd = d;
      best = j;
    }
  }
  return best;
}

function computeInertia(pts: Pt[], labels: number[], cents: Pt[]): number {
  let sum = 0;
  for (let i = 0; i < pts.length; i++) {
    const c = cents[labels[i]];
    if (!c) continue;
    const dx = pts[i].x - c.x;
    const dy = pts[i].y - c.y;
    sum += dx * dx + dy * dy;
  }
  return sum;
}

export default function KMeansLloydStepper() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [k, setK] = useState(3);
  const [seed, setSeed] = useState(7);

  const [points, setPoints] = useState<Pt[]>(() => makePoints(7));
  const [centroids, setCentroids] = useState<Pt[]>(() =>
    makeCentroids(7, 3, makePoints(7)),
  );
  const [labels, setLabels] = useState<number[]>([]); // empty = not yet assigned
  const [phase, setPhase] = useState<Phase>('assign');
  const [iteration, setIteration] = useState(0);
  const [inertia, setInertia] = useState<number | null>(null);
  const [converged, setConverged] = useState(false);
  const [auto, setAuto] = useState(false);

  const sizeRef = useRef({ w: 480, h: 380, scale: 36, ox: 12, oy: 368 });
  const rafRef = useRef<number | null>(null);

  // math space [0,10] -> pixels
  const toPx = (p: Pt) => {
    const { scale, ox, oy } = sizeRef.current;
    return { x: ox + p.x * scale, y: oy - p.y * scale };
  };

  // ---- one click of the algorithm ----
  const doStep = () => {
    if (converged) return;
    if (phase === 'assign') {
      const newLabels = points.map((p) => nearest(p, centroids));
      setLabels(newLabels);
      setInertia(computeInertia(points, newLabels, centroids));
      setPhase('update');
    } else {
      // update: move each centroid to the mean of its assigned points
      const newCents = centroids.map((c, j) => {
        const owned = points.filter((_, i) => labels[i] === j);
        if (owned.length === 0) return c; // keep empty centroid put
        const mx = owned.reduce((s, p) => s + p.x, 0) / owned.length;
        const my = owned.reduce((s, p) => s + p.y, 0) / owned.length;
        return { x: mx, y: my };
      });
      // detect convergence: centroids barely moved
      let moved = 0;
      for (let j = 0; j < newCents.length; j++) {
        moved += Math.hypot(newCents[j].x - centroids[j].x, newCents[j].y - centroids[j].y);
      }
      setCentroids(newCents);
      setInertia(computeInertia(points, labels, newCents));
      setIteration((n) => n + 1);
      setPhase('assign');
      if (moved < 1e-4) setConverged(true);
    }
  };

  const reset = (opts?: { newCloud?: boolean }) => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setAuto(false);
    const nextSeed = seed + 1;
    setSeed(nextSeed);
    const pts = opts?.newCloud ? makePoints(nextSeed) : points;
    if (opts?.newCloud) setPoints(pts);
    setCentroids(makeCentroids(nextSeed, k, pts));
    setLabels([]);
    setPhase('assign');
    setIteration(0);
    setInertia(null);
    setConverged(false);
  };

  // changing k re-seeds the centroids on the current cloud
  const changeK = (nk: number) => {
    setAuto(false);
    setK(nk);
    setCentroids(makeCentroids(seed, nk, points));
    setLabels([]);
    setPhase('assign');
    setIteration(0);
    setInertia(null);
    setConverged(false);
  };

  // ---- auto-run loop (paced with setTimeout + raf-safe cleanup) ----
  useEffect(() => {
    if (!auto || converged) return;
    const id = window.setTimeout(() => doStep(), 650);
    return () => window.clearTimeout(id);
    // re-runs after each state change while auto is on
  }, [auto, phase, iteration, converged, centroids, labels]);

  useEffect(() => {
    if (converged) setAuto(false);
  }, [converged]);

  // ---- drawing ----
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
    for (let gx = 0; gx <= 10; gx++) {
      const x = ox + gx * scale;
      ctx.beginPath(); ctx.moveTo(x, oy - 10 * scale); ctx.lineTo(x, oy); ctx.stroke();
    }
    for (let gy = 0; gy <= 10; gy++) {
      const y = oy - gy * scale;
      ctx.beginPath(); ctx.moveTo(ox, y); ctx.lineTo(ox + 10 * scale, y); ctx.stroke();
    }

    const hasLabels = labels.length === points.length;

    // faint links from points to their centroid (only once assigned)
    if (hasLabels) {
      ctx.strokeStyle = COLORS.link;
      ctx.lineWidth = 1;
      for (let i = 0; i < points.length; i++) {
        const c = centroids[labels[i]];
        if (!c) continue;
        const a = toPx(points[i]);
        const b = toPx(c);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
    }

    // points
    for (let i = 0; i < points.length; i++) {
      const p = toPx(points[i]);
      const col = hasLabels ? CLUSTER_COLORS[labels[i]] : COLORS.unassigned;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = col;
      ctx.fill();
    }

    // centroids as larger ringed X markers
    for (let j = 0; j < centroids.length; j++) {
      const c = toPx(centroids[j]);
      const col = CLUSTER_COLORS[j];
      // ring
      ctx.beginPath();
      ctx.arc(c.x, c.y, 11, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = col;
      ctx.stroke();
      // X
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = col;
      ctx.beginPath();
      ctx.moveTo(c.x - 5, c.y - 5); ctx.lineTo(c.x + 5, c.y + 5);
      ctx.moveTo(c.x + 5, c.y - 5); ctx.lineTo(c.x - 5, c.y + 5);
      ctx.stroke();
    }
  };

  // ---- responsive sizing with devicePixelRatio ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 520);
      const h = Math.round(w * 0.82);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const pad = 14;
      const scale = (Math.min(w, h) - pad * 2) / 10;
      sizeRef.current = { w, h, scale, ox: pad, oy: h - pad };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // redraw whenever state changes
  useEffect(draw, [points, centroids, labels, phase, k]);

  const nextLabel = converged ? 'Converged' : phase === 'assign' ? 'Assign points' : 'Update centroids';

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      {/* controls */}
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <button
          onClick={doStep}
          disabled={converged}
          class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
            converged
              ? 'cursor-not-allowed bg-surface-2 text-muted opacity-60'
              : 'bg-brand text-white hover:opacity-90'
          }`}
        >
          {nextLabel}
        </button>
        <button
          onClick={() => setAuto((a) => !a)}
          disabled={converged}
          class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
            auto ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
          } ${converged ? 'cursor-not-allowed opacity-60' : ''}`}
        >
          {auto ? 'Pause' : 'Auto-run'}
        </button>
        <button
          onClick={() => reset({ newCloud: false })}
          class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted transition hover:text-text"
        >
          New seeds
        </button>
        <button
          onClick={() => reset({ newCloud: true })}
          class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted transition hover:text-text"
        >
          New points
        </button>

        <div class="ml-auto flex items-center gap-1">
          <span class="mr-1 text-sm text-muted">k =</span>
          {[2, 3, 4].map((nk) => (
            <button
              key={nk}
              onClick={() => changeK(nk)}
              class={`h-8 w-8 rounded-lg text-sm font-semibold transition ${
                k === nk ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
              }`}
            >
              {nk}
            </button>
          ))}
        </div>
      </div>

      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

        <div class="space-y-3 text-sm">
          <p class="text-muted">
            Click the button to run Lloyd&rsquo;s algorithm one step at a time. It alternates between
            <strong> assigning</strong> points to the nearest center and <strong>updating</strong> each
            center to the mean of its points.
          </p>
          <div class="grid grid-cols-2 gap-2">
            <Readout label="clusters k" value={String(k)} />
            <Readout label="iteration" value={String(iteration)} />
            <Readout
              label="next phase"
              value={converged ? 'done' : phase === 'assign' ? 'assign' : 'update'}
            />
            <Readout label="inertia (WCSS)" value={inertia === null ? '—' : inertia.toFixed(2)} />
          </div>

          <div class="rounded-lg bg-surface-2 p-3">
            <p class="text-xs text-muted">
              {converged
                ? 'Centroids stopped moving — the algorithm reached a (local) minimum. Inertia is as low as this run can go.'
                : labels.length === 0
                  ? 'Points start grey (unassigned). Press the button to color them by their nearest center.'
                  : 'Watch the inertia shrink as centroids drift to the heart of each colored group.'}
            </p>
          </div>

          <div class="flex flex-wrap gap-2">
            {Array.from({ length: k }, (_, j) => (
              <span key={j} class="flex items-center gap-1.5 text-xs text-muted">
                <span
                  class="inline-block h-3 w-3 rounded-full"
                  style={`background:${CLUSTER_COLORS[j]}`}
                />
                cluster {j + 1}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Readout({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div class="rounded-lg bg-surface-2 px-3 py-2">
      <span class="text-muted" style={color ? `color:${color}` : ''}>
        {label}
      </span>
      <div class="font-mono font-semibold">{value}</div>
    </div>
  );
}
