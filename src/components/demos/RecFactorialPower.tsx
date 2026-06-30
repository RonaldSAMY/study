import { useEffect, useMemo, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated call-stack tracer for two classic recursions:
     • factorial(n) = n * factorial(n-1)        — a linear chain, O(n)
     • fast power x^n by squaring               — halves n, O(log n)
   Precomputed snapshots are driven by play / pause / step / speed.
   requestAnimationFrame autoplay, always cancelled on pause + unmount.
   ------------------------------------------------------------------ */

type Mode = 'factorial' | 'power';
type Frame = { label: string; ret: number | null; base: boolean };
type Snap = { stack: Frame[]; caption: string; active: number; mults: number };
const C = { call: '#0ea5e9', base: '#10b981', ret: '#4f46e5', grid: 'rgba(128,128,128,0.18)' };

function buildFactorial(n: number): Snap[] {
  const snaps: Snap[] = [];
  const stack: Frame[] = [];
  let mults = 0;
  const snap = (caption: string) =>
    snaps.push({ stack: stack.map((f) => ({ ...f })), caption, active: stack.length - 1, mults });
  function fact(k: number): number {
    stack.push({ label: `factorial(${k})`, ret: null, base: k <= 1 });
    snap(`Call factorial(${k}) — push a frame and wait for the smaller call.`);
    let v: number;
    if (k <= 1) {
      stack[stack.length - 1].ret = 1;
      snap(`Base case: factorial(${k}) = 1. Now the stack can unwind.`);
      v = 1;
    } else {
      const rest = fact(k - 1);
      v = k * rest;
      mults++;
      stack[stack.length - 1].ret = v;
      snap(`factorial(${k}) = ${k} × ${rest} = ${v}  (multiplication #${mults}).`);
    }
    stack.pop();
    return v;
  }
  const total = fact(n);
  snaps.push({ stack: [], caption: `Done: factorial(${n}) = ${total}, using ${mults} multiplications — that is O(n).`, active: -1, mults });
  return snaps;
}

function buildPower(x: number, n: number): Snap[] {
  const snaps: Snap[] = [];
  const stack: Frame[] = [];
  let mults = 0;
  const snap = (caption: string) =>
    snaps.push({ stack: stack.map((f) => ({ ...f })), caption, active: stack.length - 1, mults });
  function pow(e: number): number {
    stack.push({ label: `power(${x}, ${e})`, ret: null, base: e === 0 });
    if (e === 0) {
      snap(`Call power(${x}, 0) — base case: anything to the 0 is 1.`);
      stack[stack.length - 1].ret = 1;
      snap(`power(${x}, 0) = 1. Unwind from here.`);
      stack.pop();
      return 1;
    }
    if (e % 2 === 0) {
      snap(`Call power(${x}, ${e}) — ${e} is EVEN, so recurse on half: power(${x}, ${e / 2}).`);
      const half = pow(e / 2);
      const v = half * half;
      mults++;
      stack[stack.length - 1].ret = v;
      snap(`Even: power(${x}, ${e}) = ${half}² = ${v}  (one squaring → big jump, multiplication #${mults}).`);
      stack.pop();
      return v;
    }
    snap(`Call power(${x}, ${e}) — ${e} is ODD, so peel one factor: ${x} × power(${x}, ${e - 1}).`);
    const rest = pow(e - 1);
    const v = x * rest;
    mults++;
    stack[stack.length - 1].ret = v;
    snap(`Odd: power(${x}, ${e}) = ${x} × ${rest} = ${v}  (multiplication #${mults}).`);
    stack.pop();
    return v;
  }
  const total = pow(n);
  snaps.push({ stack: [], caption: `Done: ${x}^${n} = ${total}, in only ${mults} multiplications — naive would need ${n}. That is O(log n).`, active: -1, mults });
  return snaps;
}

export default function RecFactorialPower() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 480, h: 380 });
  const rafRef = useRef<number | null>(null);
  const accRef = useRef(0);
  const lastRef = useRef(0);

  const [mode, setMode] = useState<Mode>('factorial');
  const [n, setN] = useState(4);
  const [x, setX] = useState(2);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  const snaps = useMemo(
    () => (mode === 'factorial' ? buildFactorial(n) : buildPower(x, n)),
    [mode, n, x],
  );

  useEffect(() => {
    setIdx(0);
    setPlaying(false);
  }, [snaps]);

  const snap = snaps[Math.min(idx, snaps.length - 1)];

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
      if (accRef.current >= 800 / speed) {
        accRef.current = 0;
        setIdx((i) => {
          if (i >= snaps.length - 1) {
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
  }, [playing, speed, snaps]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 560);
      const h = Math.round(w * 0.78);
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

  useEffect(draw, [idx, snaps]);

  function draw() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);
    const s = snaps[Math.min(idx, snaps.length - 1)];
    const top = 16;
    const maxFrames = Math.max(1, mode === 'factorial' ? n + 1 : Math.ceil(Math.log2(n + 1)) * 2 + 2);
    const boxH = Math.min(40, (h - top - 16) / maxFrames);
    const boxW = Math.min(330, w - 32);
    const bx = (w - boxW) / 2;
    ctx.textBaseline = 'middle';
    ctx.font = '600 13px Inter, system-ui, sans-serif';
    s.stack.forEach((f, depth) => {
      const y = top + depth * (boxH + 4);
      const isActive = depth === s.active;
      const color = f.ret !== null ? (f.base ? C.base : C.ret) : C.call;
      ctx.fillStyle = isActive ? hexA(color, 0.18) : 'rgba(128,128,128,0.06)';
      ctx.fillRect(bx, y, boxW, boxH);
      ctx.strokeStyle = isActive ? color : C.grid;
      ctx.lineWidth = isActive ? 2.5 : 1;
      ctx.strokeRect(bx, y, boxW, boxH);
      ctx.fillStyle = '#0f172a';
      ctx.textAlign = 'left';
      ctx.fillText(f.label, bx + 12, y + boxH / 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = f.ret !== null ? color : '#94a3b8';
      ctx.fillText(f.ret !== null ? `↩ ${f.ret}` : 'waiting…', bx + boxW - 12, y + boxH / 2);
    });
    if (s.stack.length === 0) {
      ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'center';
      ctx.font = '600 14px Inter, system-ui, sans-serif';
      ctx.fillText('stack empty — all done', w / 2, top + boxH);
    }
  }

  const atEnd = idx >= snaps.length - 1;
  const nMax = mode === 'factorial' ? 9 : 16;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        {(['factorial', 'power'] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              mode === m ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
            }`}
          >
            {m === 'factorial' ? 'factorial(n)' : 'fast power xⁿ'}
          </button>
        ))}
      </div>

      <div class="mb-3 flex flex-wrap items-center gap-4 text-sm">
        {mode === 'power' && (
          <label class="flex items-center gap-2">
            <span class="text-muted">base x</span>
            <input
              type="number"
              min={2}
              max={5}
              value={x}
              onInput={(e) => setX(Math.max(2, Math.min(5, parseInt((e.target as HTMLInputElement).value, 10) || 2)))}
              class="w-16 rounded-lg border border-border bg-surface-2 px-2 py-1 font-mono"
            />
          </label>
        )}
        <label class="flex flex-1 items-center gap-2">
          <span class="text-muted">{mode === 'factorial' ? 'n' : 'exponent n'} = {n}</span>
          <input
            type="range"
            min={mode === 'factorial' ? 1 : 0}
            max={nMax}
            step={1}
            value={n}
            onInput={(e) => setN(parseInt((e.target as HTMLInputElement).value, 10))}
            class="flex-1 accent-[#0ea5e9]"
          />
        </label>
      </div>

      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />
        <div class="space-y-3 text-sm">
          <div class="min-h-[4rem] rounded-lg bg-surface-2 p-3">
            <span class="text-xs font-semibold uppercase tracking-wide text-muted">
              Step {Math.min(idx + 1, snaps.length)} / {snaps.length} · mults so far: {snap?.mults}
            </span>
            <p class="mt-1 text-text">{snap?.caption}</p>
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
              setIdx((i) => Math.min(snaps.length - 1, i + 1));
            }}
            onReset={() => {
              setPlaying(false);
              setIdx(0);
            }}
            onSpeed={setSpeed}
          />
          <p class="text-xs text-muted">
            Compare the two modes: factorial stacks <strong>n</strong> frames, but fast power only
            about <strong>log₂ n</strong> — watch how few frames the power needs.
          </p>
        </div>
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
        <input type="range" min={0.25} max={3} step={0.25} value={speed} onInput={(e) => onSpeed(parseFloat((e.target as HTMLInputElement).value))} class="flex-1 accent-[#4f46e5]" />
        <span class="w-8 font-mono">{speed.toFixed(2)}×</span>
      </label>
    </div>
  );
}
