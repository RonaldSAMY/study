import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated local search over a bumpy 1-D landscape.
   - The curve f(x) has several peaks. A walker starts somewhere and tries
     to climb to the highest point.
   - "Hill climbing": only ever steps to a strictly higher neighbour — and
     so gets trapped on the first peak it reaches (a local maximum).
   - "Simulated annealing": sometimes accepts a downhill move, with a
     probability that shrinks as the temperature cools — letting it cross
     valleys and find the global peak.
   - Trajectory is precomputed with a seeded RNG so Play / Step / Back /
     Reset are perfectly reproducible. A live caption narrates each move.
   ------------------------------------------------------------------ */

type Mode = 'hill' | 'anneal';
const COLORS = { curve: '#4f46e5', path: 'rgba(14,165,233,0.55)', cur: '#0ea5e9', best: '#10b981', reject: 'rgba(244,63,94,0.7)' };

const X_MIN = 0;
const X_MAX = 10;
// A deliberately multimodal landscape: tallest peak is near the right.
const f = (x: number): number => Math.sin(1.6 * x) * 2.2 + Math.sin(0.7 * x + 0.6) * 1.6 + x * 0.35;

// deterministic PRNG so runs are reproducible
function mulberry32(seed: number) {
  let s = seed >>> 0;
  return () => {
    s |= 0; s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Step = { x: number; fx: number; proposed: number; fp: number; accepted: boolean; temp: number; bestX: number };

function runTrajectory(mode: Mode, startX: number, seed: number): Step[] {
  const rand = mulberry32(seed);
  const steps: Step[] = [];
  let x = startX;
  let bestX = x;
  const N = mode === 'hill' ? 60 : 160;
  let temp = 4;
  for (let i = 0; i < N; i++) {
    const stepSize = mode === 'hill' ? 0.18 : 1.4;
    let proposed = x + (rand() * 2 - 1) * stepSize;
    proposed = Math.max(X_MIN, Math.min(X_MAX, proposed));
    const fx = f(x), fp = f(proposed);
    const delta = fp - fx;
    let accepted: boolean;
    if (mode === 'hill') {
      accepted = delta > 0;
    } else {
      accepted = delta > 0 || rand() < Math.exp(delta / temp);
    }
    if (accepted) x = proposed;
    if (f(x) > f(bestX)) bestX = x;
    steps.push({ x, fx: f(x), proposed, fp, accepted, temp, bestX });
    if (mode === 'anneal') temp *= 0.965;
    // hill climbing: stop early once truly stuck (many rejects) handled by length
  }
  return steps;
}

export default function AdvLocalSearch() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 560, h: 280, padL: 28, padB: 24, padT: 12, padR: 12 });
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);

  const [mode, setMode] = useState<Mode>('hill');
  const [startX, setStartX] = useState(1.5);
  const [seed, setSeed] = useState(7);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  idxRef.current = idx;

  const steps = runTrajectory(mode, startX, seed);

  // landscape extents for scaling
  let fLo = Infinity, fHi = -Infinity;
  for (let xx = X_MIN; xx <= X_MAX; xx += 0.05) { const v = f(xx); if (v < fLo) fLo = v; if (v > fHi) fHi = v; }

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h, padL, padB, padT, padR } = sizeRef.current;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const sx = (x: number) => padL + (x - X_MIN) / (X_MAX - X_MIN) * (w - padL - padR);
    const sy = (v: number) => padT + (1 - (v - fLo) / (fHi - fLo)) * (h - padT - padB);

    // curve
    ctx.strokeStyle = COLORS.curve;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    let first = true;
    for (let xx = X_MIN; xx <= X_MAX + 0.001; xx += 0.04) {
      const px = sx(xx), py = sy(f(xx));
      if (first) { ctx.moveTo(px, py); first = false; } else ctx.lineTo(px, py);
    }
    ctx.stroke();

    const k = idxRef.current;
    // path so far (small dots)
    for (let i = 0; i < k; i++) {
      const s = steps[i];
      ctx.fillStyle = COLORS.path;
      ctx.beginPath();
      ctx.arc(sx(s.x), sy(s.fx), 2.6, 0, Math.PI * 2);
      ctx.fill();
    }

    if (k > 0) {
      const s = steps[k - 1];
      // rejected proposal marker
      if (!s.accepted) {
        ctx.fillStyle = COLORS.reject;
        ctx.beginPath();
        ctx.arc(sx(s.proposed), sy(s.fp), 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = COLORS.reject;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(sx(s.x), sy(s.fx));
        ctx.lineTo(sx(s.proposed), sy(s.fp));
        ctx.stroke();
      }
      // best-so-far star
      const bx = sx(s.bestX), by = sy(f(s.bestX));
      ctx.fillStyle = COLORS.best;
      ctx.beginPath();
      ctx.arc(bx, by, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
      // current walker
      ctx.fillStyle = COLORS.cur;
      ctx.beginPath();
      ctx.arc(sx(s.x), sy(s.fx), 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.stroke();
    } else {
      ctx.fillStyle = COLORS.cur;
      ctx.beginPath();
      ctx.arc(sx(startX), sy(f(startX)), 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.stroke();
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 600);
      const h = 280;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { ...sizeRef.current, w, h };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(draw, [mode, startX, seed, idx]);

  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 90 / speed;
    const tick = (t: number) => {
      if (!lastRef.current) lastRef.current = t;
      if (t - lastRef.current >= interval) {
        lastRef.current = t;
        const next = idxRef.current + 1;
        if (next > steps.length) { setIdx(steps.length); setPlaying(false); return; }
        setIdx(next);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
  }, [playing, speed, steps.length]);

  const reset = () => { setPlaying(false); setIdx(0); lastRef.current = 0; };
  const stepF = () => { setPlaying(false); setIdx((v) => Math.min(steps.length, v + 1)); };
  const stepB = () => { setPlaying(false); setIdx((v) => Math.max(0, v - 1)); };
  const play = () => { if (idx >= steps.length) setIdx(0); lastRef.current = 0; setPlaying((p) => !p); };

  const globalBestX = (() => { let bx = X_MIN; for (let xx = X_MIN; xx <= X_MAX; xx += 0.01) if (f(xx) > f(bx)) bx = xx; return bx; })();
  const cur = idx > 0 ? steps[idx - 1] : null;
  const caption = idx === 0
    ? `${mode === 'hill' ? 'Hill climbing' : 'Simulated annealing'} from x = ${startX.toFixed(1)}. ${mode === 'hill' ? 'It only ever steps uphill.' : 'It may step downhill while the temperature is high.'} Press Play.`
    : (() => {
        const s = steps[idx - 1];
        const dir = s.fp >= s.fx ? 'uphill' : 'downhill';
        if (s.accepted && s.proposed !== s.x) return `step ${idx}: proposed x=${s.proposed.toFixed(2)} (${dir}) -> accepted. Now at f=${s.fx.toFixed(2)}.${mode === 'anneal' ? ` T=${s.temp.toFixed(2)}.` : ''}`;
        if (s.accepted) return `step ${idx}: proposed an uphill move -> accepted. f=${s.fx.toFixed(2)}.`;
        return `step ${idx}: proposed x=${s.proposed.toFixed(2)} (downhill) -> rejected, stay put.${mode === 'anneal' ? ` T=${s.temp.toFixed(2)} (acceptance shrinking).` : ''}`;
      })();
  const done = idx >= steps.length && steps.length > 0;
  const reachedGlobal = cur ? Math.abs(cur.bestX - globalBestX) < 0.4 : false;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-3">
        <div class="flex gap-1">
          {(['hill', 'anneal'] as Mode[]).map((m) => (
            <button key={m} onClick={() => { setMode(m); setIdx(0); setPlaying(false); }} class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${mode === m ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'}`}>
              {m === 'hill' ? 'Hill climbing' : 'Simulated annealing'}
            </button>
          ))}
        </div>
        <label class="flex items-center gap-2 text-xs text-muted">start {startX.toFixed(1)}
          <input type="range" min={X_MIN} max={X_MAX} step={0.5} value={startX} onInput={(e) => { setStartX(parseFloat((e.target as HTMLInputElement).value)); setIdx(0); setPlaying(false); }} class="w-28 accent-[#4f46e5]" />
        </label>
        <button onClick={() => { setSeed((s) => s + 1); setIdx(0); setPlaying(false); }} class="rounded-lg bg-surface-2 px-3 py-1.5 text-xs font-semibold text-muted hover:text-text">🎲 reseed</button>
      </div>

      <div class="overflow-x-auto">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />
      </div>

      <div class="mt-2 flex flex-wrap gap-3 text-xs text-muted">
        <span class="flex items-center gap-1"><span class="inline-block h-3 w-3 rounded-full" style="background:#0ea5e9" /> current</span>
        <span class="flex items-center gap-1"><span class="inline-block h-3 w-3 rounded-full" style="background:#10b981" /> best so far</span>
        <span class="flex items-center gap-1"><span class="inline-block h-3 w-3 rounded-full" style="background:rgba(244,63,94,0.7)" /> rejected move</span>
      </div>

      <p class="mt-3 min-h-[3rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">{caption}</p>
      {done && (
        <p class="mt-2 rounded-lg bg-brand-soft px-3 py-2 text-sm font-semibold text-text">
          {reachedGlobal
            ? `Reached the global peak near x=${globalBestX.toFixed(1)} (f≈${f(globalBestX).toFixed(2)}). `
            : `Stuck near a local peak at x=${cur ? cur.bestX.toFixed(1) : '—'} (f≈${cur ? f(cur.bestX).toFixed(2) : '—'}); the global peak is near x=${globalBestX.toFixed(1)}. `}
          {mode === 'hill' ? 'Hill climbing never goes downhill, so it cannot leave a local maximum.' : 'Annealing crossed valleys early, then settled as it cooled.'}
        </p>
      )}

      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={stepB} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏮ Back</button>
        <button onClick={play} class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90">{playing ? '⏸ Pause' : '▶ Play'}</button>
        <button onClick={stepF} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏭ Step</button>
        <button onClick={reset} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">↺ Reset</button>
        <label class="ml-auto flex items-center gap-2 text-xs text-muted">speed
          <input type="range" min={0.5} max={3} step={0.5} value={speed} onInput={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))} class="w-24 accent-[#4f46e5]" />
        </label>
      </div>
      <p class="mt-2 text-center text-xs text-muted">Try starting at x≈1.5 in both modes: hill climbing stalls on the first bump, annealing pushes on to the tallest peak.</p>
    </div>
  );
}
