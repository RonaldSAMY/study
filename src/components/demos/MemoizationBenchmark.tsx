import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Naive vs memoized Fibonacci — the space-for-time trade.
   - Slide n. The naive recursion recomputes the same subproblems and
     its call count explodes (~exponential); memoization stores each
     answer once, so it does linear work for a few extra memory cells.
   - Bars use a log scale (the naive bar would otherwise leave the
     screen). Counters animate to the new totals.
   - A frame-budget readout estimates whether the work fits in one
     60fps frame (16.7 ms) at a rough cost per call.
   ------------------------------------------------------------------ */

const COLORS = {
  naive: '#ef4444',
  memo: '#10b981',
  mem: '#0ea5e9',
};

const NS_PER_CALL = 8; // rough nanoseconds per recursive call (illustrative)
const FRAME_MS = 16.67;

// fib values to size the naive call count: naiveCalls(n) = 2*fib(n+1) - 1
function fib(n: number): number {
  let a = 0, b = 1;
  for (let i = 0; i < n; i++) { [a, b] = [b, a + b]; }
  return a;
}

export default function MemoizationBenchmark() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const [n, setN] = useState(20);

  const naiveCalls = n === 0 ? 1 : 2 * fib(n + 1) - 1;
  const memoCalls = 2 * n + 1;
  const memCells = n + 1;

  // animated displayed values
  const [disp, setDisp] = useState({ naive: naiveCalls, memo: memoCalls });
  const dispRef = useRef(disp);
  dispRef.current = disp;
  const sizeRef = useRef({ w: 480, h: 170 });

  const draw = (naiveShown: number, memoShown: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);
    const padL = 70, padR = 16;
    const barAreaW = w - padL - padR;
    const maxLog = Math.log10(Math.max(10, naiveCalls) + 1);
    const rows = [
      { label: 'naive', val: naiveShown, color: COLORS.naive, y: 34 },
      { label: 'memoized', val: memoShown, color: COLORS.memo, y: 100 },
    ];
    const barH = 38;
    for (const row of rows) {
      const frac = Math.log10(row.val + 1) / maxLog;
      ctx.fillStyle = 'rgba(128,128,128,0.85)';
      ctx.font = '700 12px Inter, sans-serif';
      ctx.fillText(row.label, 8, row.y + barH / 2 + 4);
      ctx.fillStyle = 'rgba(128,128,128,0.12)';
      roundRect(ctx, padL, row.y, barAreaW, barH, 8); ctx.fill();
      ctx.fillStyle = row.color;
      roundRect(ctx, padL, row.y, Math.max(6, barAreaW * frac), barH, 8); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = '700 13px Inter, sans-serif';
      ctx.fillText(`${Math.round(row.val).toLocaleString()} calls`, padL + 10, row.y + barH / 2 + 5);
    }
    ctx.fillStyle = 'rgba(128,128,128,0.6)';
    ctx.font = '600 10px Inter, sans-serif';
    ctx.fillText('(bar length is log-scaled)', padL, 158);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 560);
      const hgt = 170;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = hgt * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${hgt}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w, h: hgt };
      draw(dispRef.current.naive, dispRef.current.memo);
    };
    resize();
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // animate displayed counts toward targets when n changes
  useEffect(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const start = { ...dispRef.current };
    const target = { naive: naiveCalls, memo: memoCalls };
    const t0 = performance.now();
    const dur = 450;
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      const cur = {
        naive: start.naive + (target.naive - start.naive) * e,
        memo: start.memo + (target.memo - start.memo) * e,
      };
      setDisp(cur);
      draw(cur.naive, cur.memo);
      if (p < 1) rafRef.current = requestAnimationFrame(step);
      else rafRef.current = null;
    };
    rafRef.current = requestAnimationFrame(step);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n]);

  const naiveMs = (naiveCalls * NS_PER_CALL) / 1e6;
  const memoMs = (memoCalls * NS_PER_CALL) / 1e6;
  const speedup = naiveCalls / memoCalls;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />
      <div class="mt-3 space-y-3 text-sm">
        <label class="block">
          <span class="mb-1 block text-muted">compute fib({n})</span>
          <input
            type="range" min={1} max={32} step={1} value={n}
            onInput={(e) => setN(parseInt((e.target as HTMLInputElement).value))}
            class="w-full accent-[#10b981]"
          />
        </label>
        <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Readout label="speedup" color={COLORS.memo} value={`${speedup >= 100 ? Math.round(speedup).toLocaleString() : speedup.toFixed(1)}×`} />
          <Readout label="memory spent" color={COLORS.mem} value={`${memCells} cells`} />
          <Readout label="naive time" color={COLORS.naive} value={fmtMs(naiveMs)} />
          <Readout label="memo time" color={COLORS.memo} value={fmtMs(memoMs)} />
        </div>
        <p class="text-xs text-muted">
          {naiveMs > FRAME_MS
            ? `At ~${NS_PER_CALL} ns/call the naive version busts the 16.7 ms frame budget — the game would stutter. Memoization fits easily.`
            : `Both fit in a 60fps frame here, but watch the naive bar (and time) rocket up as you raise n.`}
        </p>
      </div>
    </div>
  );
}

function fmtMs(ms: number): string {
  if (ms < 0.001) return `${(ms * 1e6).toFixed(0)} ns`;
  if (ms < 1) return `${(ms * 1000).toFixed(1)} µs`;
  if (ms < 1000) return `${ms.toFixed(2)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

function Readout({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div class="rounded-lg bg-surface-2 px-3 py-2">
      <span class="text-muted" style={color ? `color:${color}` : ''}>{label}</span>
      <div class="font-mono text-base font-semibold">{value}</div>
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
