import { useEffect, useMemo, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   A "work race": compute fib(n) two ways and watch the effort.
   - Naive recursion (left): every call is replayed in order. The big
     counter shows total calls (≈ 2^n) while the stack stays shallow (n).
   - Iteration (right): a row of cells fills left→right in n steps and
     then sits idle, long finished.
   One precomputed frame list (the recursion call order) drives both via
   play / pause / step / reset / speed. raf autoplay cancelled on unmount.
   ------------------------------------------------------------------ */

type Call = { k: number; d: number };
const C = { rec: '#4f46e5', iter: '#10b981', done: '#10b981', grid: 'rgba(128,128,128,0.18)' };

function recCalls(n: number): Call[] {
  const calls: Call[] = [];
  function f(k: number, d: number) {
    calls.push({ k, d });
    if (k > 1) {
      f(k - 1, d + 1);
      f(k - 2, d + 1);
    }
  }
  f(n, 0);
  return calls;
}
function fibTable(n: number): number[] {
  const dp = [0, 1];
  for (let i = 2; i <= n; i++) dp[i] = dp[i - 1] + dp[i - 2];
  return dp.slice(0, n + 1);
}

export default function RecVsIterRace() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 540, h: 320 });
  const rafRef = useRef<number | null>(null);
  const accRef = useRef(0);
  const lastRef = useRef(0);

  const [n, setN] = useState(6);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(2);

  const calls = useMemo(() => recCalls(n), [n]);
  const dp = useMemo(() => fibTable(n), [n]);
  const framesPerIter = Math.max(1, Math.floor((calls.length - 1) / Math.max(1, n - 1)));

  useEffect(() => {
    setIdx(0);
    setPlaying(false);
  }, [calls]);

  // recursion progress
  const recDone = Math.min(idx + 1, calls.length);
  const curDepth = calls[Math.min(idx, calls.length - 1)]?.d ?? 0;
  // iteration progress: how many cells beyond the two base cells are filled
  const iterProgress = Math.min(n - 1, Math.floor(idx / framesPerIter));
  const iterFilled = Math.min(n, 1 + iterProgress); // index of last filled cell
  const iterFinished = iterFilled >= n;

  useEffect(() => {
    if (!playing) {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      return;
    }
    lastRef.current = performance.now();
    accRef.current = 0;
    const loop = (t: number) => {
      accRef.current += t - lastRef.current;
      lastRef.current = t;
      if (accRef.current >= 450 / speed) {
        accRef.current = 0;
        setIdx((i) => {
          if (i >= calls.length - 1) {
            setPlaying(false);
            return i;
          }
          return i + 1;
        });
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [playing, speed, calls]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 620);
      const h = Math.round(w * 0.6);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(draw, [idx, calls]);

  function draw() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);
    const half = w / 2;

    // divider
    ctx.strokeStyle = C.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(half, 10);
    ctx.lineTo(half, h - 10);
    ctx.stroke();

    // ---------- LEFT: recursion ----------
    ctx.textAlign = 'center';
    ctx.fillStyle = C.rec;
    ctx.font = '700 13px Inter, system-ui, sans-serif';
    ctx.fillText('Naive recursion', half / 2, 22);
    // big call counter
    ctx.fillStyle = '#0f172a';
    ctx.font = '800 34px Inter, system-ui, sans-serif';
    ctx.fillText(`${recDone}`, half / 2, 60);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 11px Inter, system-ui, sans-serif';
    ctx.fillText(`calls of ${calls.length} total`, half / 2, 80);
    // live stack depth blocks
    const blkW = Math.min(48, half * 0.4);
    const blkH = Math.min(15, (h - 120) / Math.max(1, n + 1));
    const bx = half / 2 - blkW / 2;
    const by0 = h - 24;
    for (let d = 0; d <= curDepth; d++) {
      const y = by0 - (d + 1) * (blkH + 2);
      ctx.fillStyle = d === curDepth ? C.rec : hexA(C.rec, 0.18);
      ctx.fillRect(bx, y, blkW, blkH);
      ctx.strokeStyle = C.rec;
      ctx.lineWidth = 1;
      ctx.strokeRect(bx, y, blkW, blkH);
    }
    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 10px Inter, system-ui, sans-serif';
    ctx.fillText(`stack depth ${curDepth + 1}`, half / 2, by0 + 14);

    // ---------- RIGHT: iteration ----------
    const ox = half;
    ctx.fillStyle = C.iter;
    ctx.font = '700 13px Inter, system-ui, sans-serif';
    ctx.fillText('Iteration (loop)', ox + half / 2, 22);
    const cells = n + 1;
    const cw = Math.min(36, (half - 28) / cells);
    const startX = ox + (half - cw * cells) / 2;
    const cy = h / 2 - 18;
    ctx.textBaseline = 'middle';
    for (let i = 0; i <= n; i++) {
      const x = startX + i * cw;
      const filled = i <= iterFilled;
      const isCur = i === iterFilled && !iterFinished;
      ctx.fillStyle = filled ? hexA(C.iter, isCur ? 0.45 : 0.16) : 'rgba(128,128,128,0.06)';
      ctx.fillRect(x, cy, cw - 3, 30);
      ctx.strokeStyle = filled ? C.iter : C.grid;
      ctx.lineWidth = isCur ? 2.5 : 1;
      ctx.strokeRect(x, cy, cw - 3, 30);
      if (filled) {
        ctx.fillStyle = '#0f172a';
        ctx.font = `700 ${Math.min(13, cw * 0.5)}px Inter, system-ui, sans-serif`;
        ctx.fillText(String(dp[i]), x + (cw - 3) / 2, cy + 15);
      }
    }
    ctx.fillStyle = iterFinished ? C.done : '#94a3b8';
    ctx.font = '700 13px Inter, system-ui, sans-serif';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(
      iterFinished ? `✓ done — fib(${n}) = ${dp[n]} in ${n} steps` : `step ${iterFilled} / ${n}`,
      ox + half / 2,
      cy + 56,
    );
  }

  const atEnd = idx >= calls.length - 1;
  const caption = iterFinished
    ? `Iteration finished long ago (${n} steps). Recursion is still grinding — call ${recDone} of ${calls.length}.`
    : `Both running: recursion has made ${recDone} calls; iteration is on step ${iterFilled}.`;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <label class="mb-3 flex items-center gap-2 text-sm">
        <span class="text-muted">fib(n), n = {n}</span>
        <input
          type="range"
          min={3}
          max={10}
          step={1}
          value={n}
          onInput={(e) => setN(parseInt((e.target as HTMLInputElement).value, 10))}
          class="flex-1 accent-[#4f46e5]"
        />
        <span class="font-mono text-xs text-muted">{calls.length} vs {n}</span>
      </label>

      <canvas ref={canvasRef} class="w-full touch-none rounded-xl bg-surface-2" />

      <div class="mt-3 space-y-3 text-sm">
        <div class="min-h-[3rem] rounded-lg bg-surface-2 p-3">
          <span class="text-xs font-semibold uppercase tracking-wide text-muted">
            Frame {Math.min(idx + 1, calls.length)} / {calls.length}
          </span>
          <p class="mt-1 text-text">{caption}</p>
        </div>
        <StepControls
          playing={playing}
          atEnd={atEnd}
          speed={speed}
          onPlay={() => {
            if (atEnd) setIdx(0);
            setPlaying((p) => !p);
          }}
          onStepBack={() => {
            setPlaying(false);
            setIdx((i) => Math.max(0, i - 1));
          }}
          onStepFwd={() => {
            setPlaying(false);
            setIdx((i) => Math.min(calls.length - 1, i + 1));
          }}
          onReset={() => {
            setPlaying(false);
            setIdx(0);
          }}
          onSpeed={setSpeed}
        />
        <p class="text-xs text-muted">
          Naive recursion repeats the same subproblems — its <strong>time</strong> blows up like
          2ⁿ even though its <strong>stack depth</strong> stays just n. Iteration does n steps, full stop.
        </p>
      </div>
    </div>
  );
}

function hexA(hex: string, a: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function StepControls({
  playing,
  atEnd,
  speed,
  onPlay,
  onStepBack,
  onStepFwd,
  onReset,
  onSpeed,
}: {
  playing: boolean;
  atEnd: boolean;
  speed: number;
  onPlay: () => void;
  onStepBack: () => void;
  onStepFwd: () => void;
  onReset: () => void;
  onSpeed: (v: number) => void;
}) {
  return (
    <div class="space-y-2">
      <div class="flex flex-wrap items-center gap-2">
        <button onClick={onStepBack} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted transition hover:text-text" title="Step back">⏮</button>
        <button onClick={onPlay} class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white transition hover:opacity-90">{playing ? '⏸ Pause' : atEnd ? '↺ Replay' : '▶ Play'}</button>
        <button onClick={onStepFwd} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted transition hover:text-text" title="Step forward">⏭</button>
        <button onClick={onReset} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted transition hover:text-text" title="Reset">↺</button>
      </div>
      <label class="flex items-center gap-2 text-xs text-muted">
        <span>speed</span>
        <input type="range" min={0.25} max={4} step={0.25} value={speed} onInput={(e) => onSpeed(parseFloat((e.target as HTMLInputElement).value))} class="flex-1 accent-[#4f46e5]" />
        <span class="w-8 font-mono">{speed.toFixed(2)}×</span>
      </label>
    </div>
  );
}
