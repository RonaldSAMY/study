import { useEffect, useMemo, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated CALL-STACK tracer for a simple recursion.

   We trace  sum(arr, i) = arr[i] + sum(arr, i+1),  base case returns 0.
   - The learner types their own list of numbers.
   - We precompute a list of "snapshots": each one is a picture of the
     call stack at one moment, plus a caption narrating that step.
   - Controls (play / pause / step / reset / speed) move an index through
     the snapshots. Autoplay uses requestAnimationFrame and is always
     cancelled on pause + unmount.
   ------------------------------------------------------------------ */

type Frame = { i: number; ret: number | null };
type Snap = { stack: Frame[]; caption: string; mode: 'call' | 'base' | 'return' | 'done'; active: number };

const COLORS = {
  call: '#0ea5e9',
  base: '#10b981',
  ret: '#4f46e5',
  grid: 'rgba(128,128,128,0.18)',
};

function buildSnaps(arr: number[]): Snap[] {
  const snaps: Snap[] = [];
  const stack: Frame[] = [];
  const push = (caption: string, mode: Snap['mode']) =>
    snaps.push({ stack: stack.map((f) => ({ ...f })), caption, mode, active: stack.length - 1 });

  function sum(i: number): number {
    stack.push({ i, ret: null });
    push(`Call sum(i=${i}) — push a new frame onto the stack.`, 'call');
    let v: number;
    if (i >= arr.length) {
      stack[stack.length - 1].ret = 0;
      push(`Base case: i=${i} is past the end, so return 0 without recursing.`, 'base');
      v = 0;
    } else {
      const rest = sum(i + 1);
      v = arr[i] + rest;
      stack[stack.length - 1].ret = v;
      push(`sum(i=${i}) now returns arr[${i}] + ${rest} = ${arr[i]} + ${rest} = ${v}.`, 'return');
    }
    stack.pop();
    return v;
  }

  if (arr.length === 0) {
    return [{ stack: [], caption: 'Empty list — sum is 0.', mode: 'done', active: -1 }];
  }
  const total = sum(0);
  snaps.push({ stack: [], caption: `Finished — every frame has returned. The sum is ${total}.`, mode: 'done', active: -1 });
  return snaps;
}

export default function RecCallStackTrace() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 480, h: 380 });
  const rafRef = useRef<number | null>(null);
  const accRef = useRef(0);
  const lastRef = useRef(0);

  const [text, setText] = useState('3, 1, 4, 1, 5');
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  const arr = useMemo(
    () =>
      text
        .split(',')
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => Number.isFinite(n))
        .slice(0, 6),
    [text],
  );
  const snaps = useMemo(() => buildSnaps(arr), [arr]);

  // reset playback whenever the input (and thus the snapshots) changes
  useEffect(() => {
    setIdx(0);
    setPlaying(false);
  }, [snaps]);

  const snap = snaps[Math.min(idx, snaps.length - 1)];

  // ---- autoplay loop ----
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
      const interval = 750 / speed;
      if (accRef.current >= interval) {
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

  // ---- responsive canvas ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 560);
      const h = Math.round(w * 0.8);
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

    // --- the array along the top ---
    const n = Math.max(1, arr.length);
    const cellW = Math.min(46, (w - 24) / n);
    const ax = (w - cellW * n) / 2;
    const ay = 14;
    ctx.font = '600 14px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let c = 0; c < n; c++) {
      const x = ax + c * cellW;
      const isActive = s.active >= 0 && s.stack[s.active]?.i === c;
      ctx.fillStyle = isActive ? 'rgba(14,165,233,0.20)' : 'rgba(128,128,128,0.07)';
      ctx.fillRect(x, ay, cellW - 4, 34);
      ctx.strokeStyle = isActive ? COLORS.call : COLORS.grid;
      ctx.lineWidth = isActive ? 2 : 1;
      ctx.strokeRect(x, ay, cellW - 4, 34);
      ctx.fillStyle = '#64748b';
      ctx.font = '600 10px Inter, system-ui, sans-serif';
      ctx.fillText(`[${c}]`, x + (cellW - 4) / 2, ay - 0);
      ctx.fillStyle = '#0f172a';
      ctx.font = '700 15px Inter, system-ui, sans-serif';
      ctx.fillText(String(arr[c] ?? ''), x + (cellW - 4) / 2, ay + 17);
    }

    // --- the call stack ---
    const top = ay + 64;
    const maxFrames = Math.max(1, arr.length + 1);
    const boxH = Math.min(42, (h - top - 16) / maxFrames);
    const boxW = Math.min(300, w - 40);
    const bx = (w - boxW) / 2;
    ctx.font = '600 13px Inter, system-ui, sans-serif';
    s.stack.forEach((f, depth) => {
      const y = top + depth * (boxH + 4);
      const isActive = depth === s.active;
      const color = f.ret !== null ? (f.i >= arr.length ? COLORS.base : COLORS.ret) : COLORS.call;
      ctx.fillStyle = isActive ? hexA(color, 0.18) : 'rgba(128,128,128,0.06)';
      ctx.fillRect(bx, y, boxW, boxH);
      ctx.strokeStyle = isActive ? color : COLORS.grid;
      ctx.lineWidth = isActive ? 2.5 : 1;
      ctx.strokeRect(bx, y, boxW, boxH);
      ctx.fillStyle = '#0f172a';
      ctx.textAlign = 'left';
      ctx.fillText(`sum(i = ${f.i})`, bx + 12, y + boxH / 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = f.ret !== null ? color : '#94a3b8';
      ctx.fillText(f.ret !== null ? `↩ returns ${f.ret}` : 'waiting…', bx + boxW - 12, y + boxH / 2);
    });
    if (s.stack.length === 0) {
      ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'center';
      ctx.font = '600 14px Inter, system-ui, sans-serif';
      ctx.fillText('stack empty', w / 2, top + boxH);
    }
  }

  const atEnd = idx >= snaps.length - 1;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <label class="mb-3 block text-sm">
        <span class="mb-1 block text-muted">Your list of numbers (up to 6):</span>
        <input
          type="text"
          value={text}
          onInput={(e) => setText((e.target as HTMLInputElement).value)}
          class="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 font-mono text-sm"
          placeholder="e.g. 3, 1, 4, 1, 5"
        />
      </label>

      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

        <div class="space-y-3 text-sm">
          <div class="min-h-[3.5rem] rounded-lg bg-surface-2 p-3">
            <span class="text-xs font-semibold uppercase tracking-wide text-muted">
              Step {Math.min(idx + 1, snaps.length)} / {snaps.length}
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
            Frames are <strong>pushed</strong> as we dive toward the base case, then values are
            <strong> returned</strong> back up as each frame pops.
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

export function StepControls({
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
        <button
          onClick={onStepBack}
          class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted transition hover:text-text"
          title="Step back"
        >
          ⏮
        </button>
        <button
          onClick={onPlay}
          class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white transition hover:opacity-90"
        >
          {playing ? '⏸ Pause' : atEnd ? '↺ Replay' : '▶ Play'}
        </button>
        <button
          onClick={onStepFwd}
          class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted transition hover:text-text"
          title="Step forward"
        >
          ⏭
        </button>
        <button
          onClick={onReset}
          class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted transition hover:text-text"
          title="Reset"
        >
          ↺
        </button>
      </div>
      <label class="flex items-center gap-2 text-xs text-muted">
        <span>speed</span>
        <input
          type="range"
          min={0.25}
          max={3}
          step={0.25}
          value={speed}
          onInput={(e) => onSpeed(parseFloat((e.target as HTMLInputElement).value))}
          class="flex-1 accent-[#4f46e5]"
        />
        <span class="w-8 font-mono">{speed.toFixed(2)}×</span>
      </label>
    </div>
  );
}
