import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   The complexity "zoo".
   - Reveal the complexity classes one at a time, fastest to slowest,
     as horizontal bars. Bar length is proportional to log10(operations)
     so even O(2ⁿ) fits next to O(1).
   - Pick the input size n (preset buttons). The caption narrates each
     class as it appears, with the exact operation count at that n.
   - Frames = how many classes are revealed (0 .. 7). Transport controls
     (Play / Pause / Step / Reset + speed) drive that index.
   ------------------------------------------------------------------ */

type Zoo = { label: string; nick: string; color: string; example: string; f: (n: number) => number };

const ZOO: Zoo[] = [
  { label: 'O(1)', nick: 'constant', color: '#10b981', example: 'array index, hash lookup', f: () => 1 },
  { label: 'O(log n)', nick: 'logarithmic', color: '#22c55e', example: 'binary search', f: (n) => Math.max(1, Math.ceil(Math.log2(n))) },
  { label: 'O(n)', nick: 'linear', color: '#0ea5e9', example: 'scan a list, find max', f: (n) => n },
  { label: 'O(n log n)', nick: 'linearithmic', color: '#4f46e5', example: 'merge sort, quick sort', f: (n) => n * Math.max(1, Math.log2(n)) },
  { label: 'O(n²)', nick: 'quadratic', color: '#f59e0b', example: 'bubble sort, all pairs', f: (n) => n * n },
  { label: 'O(2ⁿ)', nick: 'exponential', color: '#f97316', example: 'naive Fibonacci, subsets', f: (n) => Math.pow(2, n) },
  { label: 'O(n!)', nick: 'factorial', color: '#f43f5e', example: 'brute-force salesman, permutations', f: (n) => factorial(n) },
];

function factorial(n: number): number {
  let r = 1;
  for (let i = 2; i <= n; i++) { r *= i; if (!isFinite(r)) return Infinity; }
  return r;
}

function fmt(x: number): string {
  if (!isFinite(x)) return '∞';
  if (x >= 1e9) return x.toExponential(1).replace('e+', '×10^');
  return Math.round(x).toLocaleString();
}

const PRESETS = [8, 16, 100, 1000, 1000000];

export default function BigOZooLadder() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 480, h: 360 });

  const [nVal, setNVal] = useState(16);
  const [idx, setIdx] = useState(1); // number of classes revealed
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(2); // steps per second
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);

  const idxRef = useRef(idx); idxRef.current = idx;
  const nRef = useRef(nVal); nRef.current = nVal;

  // autoplay
  useEffect(() => {
    if (!playing) return;
    const interval = 1000 / Math.max(1, speed);
    const loop = (t: number) => {
      if (!lastRef.current) lastRef.current = t;
      if (t - lastRef.current >= interval) {
        lastRef.current = t;
        setIdx((i) => {
          if (i >= ZOO.length) { setPlaying(false); return i; }
          return i + 1;
        });
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      lastRef.current = 0;
    };
  }, [playing, speed]);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    const revealed = idxRef.current;
    const n = nRef.current;
    ctx.clearRect(0, 0, w, h);

    const padL = 86;
    const padR = 14;
    const padT = 10;
    const rowH = (h - padT) / ZOO.length;
    const barMaxW = w - padL - padR;

    // scale bars by log10(ops) so the whole zoo fits. Cap the log so that
    // values that overflow to Infinity (2ⁿ, n! at large n) don't crush the
    // smaller bars to nothing.
    const LOGCAP = 30;
    const lg = (x: number) => (isFinite(x) ? Math.min(LOGCAP, Math.log10(Math.max(10, x))) : LOGCAP);
    let maxLog = 1;
    for (const z of ZOO) maxLog = Math.max(maxLog, lg(z.f(n)));

    ctx.font = '600 12px Inter, sans-serif';
    for (let i = 0; i < ZOO.length; i++) {
      const z = ZOO[i];
      const y = padT + i * rowH;
      const cy = y + rowH / 2;
      const shown = i < revealed;
      const isNew = i === revealed - 1;

      // label
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = shown ? z.color : 'rgba(128,128,128,0.4)';
      ctx.fillText(z.label, padL - 10, cy);

      // bar track
      ctx.fillStyle = 'rgba(128,128,128,0.10)';
      roundRect(ctx, padL, cy - rowH * 0.28, barMaxW, rowH * 0.56, 6);
      ctx.fill();

      if (shown) {
        const ops = z.f(n);
        const frac = Math.min(1, lg(ops) / maxLog);
        const bw = Math.max(8, frac * barMaxW);
        ctx.fillStyle = z.color;
        ctx.globalAlpha = isNew ? 1 : 0.82;
        roundRect(ctx, padL, cy - rowH * 0.28, bw, rowH * 0.56, 6);
        ctx.fill();
        if (isNew) {
          ctx.globalAlpha = 1;
          ctx.lineWidth = 2.5;
          ctx.strokeStyle = '#fff';
          roundRect(ctx, padL, cy - rowH * 0.28, bw, rowH * 0.56, 6);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        // ops count at the bar end
        ctx.textAlign = bw > barMaxW - 70 ? 'right' : 'left';
        ctx.fillStyle = bw > barMaxW - 70 ? '#fff' : z.color;
        ctx.font = '600 11px Inter, sans-serif';
        const tx = bw > barMaxW - 70 ? padL + bw - 6 : padL + bw + 6;
        ctx.fillText(fmt(ops) + ' ops', tx, cy);
        ctx.font = '600 12px Inter, sans-serif';
      }
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 560);
      const h = Math.round(Math.min(w * 0.8, 380));
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
    return () => {
      window.removeEventListener('resize', resize);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(draw, [idx, nVal]);

  const step = (d: number) => {
    setPlaying(false);
    setIdx((i) => Math.max(0, Math.min(ZOO.length, i + d)));
  };

  const newest = idx > 0 ? ZOO[idx - 1] : null;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <span class="text-sm text-muted">input size n =</span>
        {PRESETS.map((p) => (
          <button
            key={p}
            onClick={() => { setNVal(p); setPlaying(false); }}
            class={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
              nVal === p ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
            }`}
          >
            {p.toLocaleString()}
          </button>
        ))}
      </div>

      <canvas ref={canvasRef} class="touch-none w-full rounded-xl bg-surface-2" />

      {/* transport */}
      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={() => step(-1)} class="rounded-lg bg-surface-2 px-2.5 py-1.5 text-sm font-semibold text-muted hover:text-text" title="Step back">⏮</button>
        <button
          onClick={() => { if (idx >= ZOO.length) setIdx(0); setPlaying((p) => !p); }}
          class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white transition hover:opacity-90"
        >
          {playing ? '⏸ Pause' : '▶ Play'}
        </button>
        <button onClick={() => step(1)} class="rounded-lg bg-surface-2 px-2.5 py-1.5 text-sm font-semibold text-muted hover:text-text" title="Step forward">⏭</button>
        <button onClick={() => { setPlaying(false); setIdx(0); }} class="rounded-lg bg-surface-2 px-2.5 py-1.5 text-sm font-semibold text-muted hover:text-text" title="Reset">↺</button>
        <label class="ml-auto flex items-center gap-2 text-xs text-muted">
          speed
          <input type="range" min={1} max={8} step={1} value={speed}
            onInput={(e) => setSpeed(parseInt((e.target as HTMLInputElement).value))}
            class="w-24 accent-[#10b981]" />
        </label>
      </div>

      {/* live caption */}
      <div class="mt-3 rounded-lg bg-surface-2 p-3 text-sm">
        {newest ? (
          <span>
            <strong style={`color:${newest.color}`}>{newest.label}</strong>{' '}
            <span class="text-muted">({newest.nick})</span> — e.g. {newest.example}. At{' '}
            <span class="font-mono">n = {nVal.toLocaleString()}</span> it does{' '}
            <strong>{fmt(newest.f(nVal))}</strong> operations.
          </span>
        ) : (
          <span class="text-muted">Press Play to reveal the zoo from fastest to slowest.</span>
        )}
      </div>
    </div>
  );
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, h / 2, w / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
