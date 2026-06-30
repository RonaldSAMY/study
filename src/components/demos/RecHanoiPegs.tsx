import { useEffect, useMemo, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated Tower of Hanoi.
   - Pick the number of disks. We precompute the full solution
     (move n-1 to aux, move biggest, move n-1 onto it) as a list of
     STATE snapshots, one per move.
   - Controls scrub through the snapshots; the just-moved disk is
     highlighted and a caption narrates the move.
   - requestAnimationFrame autoplay, always cancelled on pause + unmount.
   ------------------------------------------------------------------ */

type Peg = 'A' | 'B' | 'C';
type State = { A: number[]; B: number[]; C: number[] };
type Step = { state: State; caption: string; movedDisk: number; to: Peg | null };
const C = { peg: '#4f46e5', moved: '#f59e0b', grid: 'rgba(128,128,128,0.18)' };
const DISK = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#a855f7', '#ec4899', '#14b8a6'];

function buildSteps(n: number): Step[] {
  const state: State = {
    A: Array.from({ length: n }, (_, i) => n - i),
    B: [],
    C: [],
  };
  const steps: Step[] = [
    { state: clone(state), caption: `Start: ${n} disks stacked on peg A. Goal — move them all to peg C.`, movedDisk: 0, to: null },
  ];
  let count = 0;
  const total = Math.pow(2, n) - 1;
  function solve(k: number, from: Peg, to: Peg, aux: Peg) {
    if (k === 0) return;
    solve(k - 1, from, aux, to);
    const disk = state[from].pop()!;
    state[to].push(disk);
    count++;
    steps.push({
      state: clone(state),
      caption: `Move ${count} of ${total}: disk ${disk} from ${from} → ${to}.`,
      movedDisk: disk,
      to,
    });
    solve(k - 1, aux, to, from);
  }
  solve(n, 'A', 'C', 'B');
  steps.push({ state: clone(state), caption: `Solved in ${total} moves — the minimum possible (2^${n} − 1).`, movedDisk: 0, to: null });
  return steps;
}
function clone(s: State): State {
  return { A: [...s.A], B: [...s.B], C: [...s.C] };
}

export default function RecHanoiPegs() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 520, h: 300 });
  const rafRef = useRef<number | null>(null);
  const accRef = useRef(0);
  const lastRef = useRef(0);

  const [n, setN] = useState(3);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1.5);

  const steps = useMemo(() => buildSteps(n), [n]);

  useEffect(() => {
    setIdx(0);
    setPlaying(false);
  }, [steps]);

  const step = steps[Math.min(idx, steps.length - 1)];

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
      if (accRef.current >= 600 / speed) {
        accRef.current = 0;
        setIdx((i) => {
          if (i >= steps.length - 1) {
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
  }, [playing, speed, steps]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 620);
      const h = Math.round(w * 0.52);
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

  useEffect(draw, [idx, steps]);

  function draw() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);
    const s = steps[Math.min(idx, steps.length - 1)];
    const pegs: Peg[] = ['A', 'B', 'C'];
    const baseY = h - 34;
    const pegH = h - 70;
    const slotW = w / 3;
    const diskUnit = Math.min(18, (h - 90) / n);
    const maxDiskW = slotW * 0.82;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    pegs.forEach((peg, pi) => {
      const cx = slotW * pi + slotW / 2;
      // base + post
      ctx.fillStyle = C.grid;
      ctx.fillRect(slotW * pi + 12, baseY, slotW - 24, 8);
      ctx.fillStyle = 'rgba(79,70,229,0.35)';
      ctx.fillRect(cx - 3, baseY - pegH, 6, pegH);
      // label
      ctx.fillStyle = '#64748b';
      ctx.font = '700 14px Inter, system-ui, sans-serif';
      ctx.fillText(peg, cx, baseY + 22);
      // disks
      s.state[peg].forEach((disk, level) => {
        const dw = maxDiskW * (disk / n);
        const dh = diskUnit;
        const x = cx - dw / 2;
        const y = baseY - (level + 1) * dh + 2;
        const moved = disk === s.movedDisk && s.to === peg;
        ctx.fillStyle = DISK[(disk - 1) % DISK.length];
        roundRect(ctx, x, y, dw, dh - 2, Math.min(6, dh / 2));
        ctx.fill();
        if (moved) {
          ctx.lineWidth = 3;
          ctx.strokeStyle = C.moved;
          roundRect(ctx, x, y, dw, dh - 2, Math.min(6, dh / 2));
          ctx.stroke();
        }
        ctx.fillStyle = '#fff';
        ctx.font = `700 ${Math.round(dh * 0.6)}px Inter, system-ui, sans-serif`;
        ctx.fillText(String(disk), cx, y + (dh - 2) / 2);
      });
    });
  }

  const atEnd = idx >= steps.length - 1;
  const total = Math.pow(2, n) - 1;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <label class="mb-3 flex items-center gap-2 text-sm">
        <span class="text-muted">disks n = {n}</span>
        <input
          type="range"
          min={1}
          max={7}
          step={1}
          value={n}
          onInput={(e) => setN(parseInt((e.target as HTMLInputElement).value, 10))}
          class="flex-1 accent-[#4f46e5]"
        />
        <span class="font-mono text-xs text-muted">{total} moves</span>
      </label>

      <canvas ref={canvasRef} class="w-full touch-none rounded-xl bg-surface-2" />

      <div class="mt-3 space-y-3 text-sm">
        <div class="min-h-[3rem] rounded-lg bg-surface-2 p-3">
          <span class="text-xs font-semibold uppercase tracking-wide text-muted">
            Move {Math.min(idx, steps.length - 1)} / {total}
          </span>
          <p class="mt-1 text-text">{step?.caption}</p>
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
            setIdx((i) => Math.min(steps.length - 1, i + 1));
          }}
          onReset={() => {
            setPlaying(false);
            setIdx(0);
          }}
          onSpeed={setSpeed}
        />
        <p class="text-xs text-muted">
          Each move obeys one rule: never put a bigger disk on a smaller one. The whole solution is
          just <strong>two smaller solutions</strong> with one move in between.
        </p>
      </div>
    </div>
  );
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
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
