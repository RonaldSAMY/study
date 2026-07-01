import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Merge overlapping intervals (the sort-by-start greedy).
   - Edit intervals ("start-end"). The demo sorts by START time and
     sweeps left to right, keeping one "current merged" block. Each new
     interval either OVERLAPS (extend the block's end) or sits past it
     (emit the block, open a fresh one).
   - The greedy choice is the sort itself: after sorting by start, a
     single left-to-right pass never has to look back.
   - Canvas timeline: raw intervals on top, merged result building below.
   - Transport: Play / Pause / Step / Step-back / Reset + speed.
   ------------------------------------------------------------------ */

const COLORS = {
  raw: 'rgba(148,163,184,0.45)',
  cur: '#0ea5e9',
  merged: '#10b981',
  extend: '#f59e0b',
  brand: '#4f46e5',
  grid: 'rgba(128,128,128,0.22)',
};

type Iv = [number, number];
type Step = { i: number; action: 'extend' | 'new'; merged: Iv[]; active: Iv };

const parse = (s: string): Iv[] => {
  const out: Iv[] = [];
  for (const part of s.split(',')) {
    const m = part.trim().match(/^(\d+)\s*-\s*(\d+)$/);
    if (!m) continue;
    const a = parseInt(m[1], 10), b = parseInt(m[2], 10);
    if (b >= a) out.push([a, b]);
  }
  return out;
};

function computeSteps(sorted: Iv[]): Step[] {
  const steps: Step[] = [];
  const merged: Iv[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const cur = sorted[i];
    if (merged.length && cur[0] <= merged[merged.length - 1][1]) {
      merged[merged.length - 1] = [merged[merged.length - 1][0], Math.max(merged[merged.length - 1][1], cur[1])];
      steps.push({ i, action: 'extend', merged: merged.map((m) => [...m] as Iv), active: [...merged[merged.length - 1]] as Iv });
    } else {
      merged.push([...cur] as Iv);
      steps.push({ i, action: 'new', merged: merged.map((m) => [...m] as Iv), active: [...cur] as Iv });
    }
  }
  return steps;
}

export default function GreedyIntervalMerge() {
  const [text, setText] = useState('1-3, 2-6, 8-10, 15-18, 9-12');
  const [ivs, setIvs] = useState<Iv[]>(() => parse('1-3, 2-6, 8-10, 15-18, 9-12'));

  const sorted = [...ivs].sort((a, b) => a[0] - b[0]);
  const steps = computeSteps(sorted);

  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 560, h: 220 });
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);
  idxRef.current = idx;
  const stepsRef = useRef(steps);
  stepsRef.current = steps;
  const sortedRef = useRef(sorted);
  sortedRef.current = sorted;

  const tMax = Math.max(1, ...sorted.map((a) => a[1]));

  function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    const so = sortedRef.current;
    const st = stepsRef.current;
    const i = idxRef.current;
    ctx.clearRect(0, 0, w, h);

    const padL = 16, padR = 16;
    const plotW = w - padL - padR;
    const xOf = (t: number) => padL + (t / tMax) * plotW;
    const topY = 18;
    const rowH = 20;
    const rows = so.length || 1;

    // ticks
    ctx.strokeStyle = COLORS.grid;
    ctx.fillStyle = 'rgba(128,128,128,0.8)';
    ctx.font = '10px ui-sans-serif, system-ui';
    ctx.textAlign = 'center';
    for (let t = 0; t <= tMax; t++) {
      const x = xOf(t);
      ctx.beginPath();
      ctx.moveTo(x, topY - 6);
      ctx.lineTo(x, topY + rows * rowH + 2);
      ctx.stroke();
    }

    // raw intervals
    ctx.textAlign = 'left';
    for (let r = 0; r < so.length; r++) {
      const [a, b] = so[r];
      const y = topY + r * rowH;
      const isCur = r === i - 1;
      ctx.fillStyle = r < i ? COLORS.raw : 'rgba(148,163,184,0.20)';
      roundRect(ctx, xOf(a), y, Math.max(5, xOf(b) - xOf(a)), rowH - 6, 4);
      ctx.fill();
      if (isCur) {
        ctx.strokeStyle = COLORS.cur;
        ctx.lineWidth = 3;
        roundRect(ctx, xOf(a), y, Math.max(5, xOf(b) - xOf(a)), rowH - 6, 4);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(80,80,90,0.95)';
      ctx.fillText(`${a}-${b}`, xOf(a) + 4, y + (rowH - 6) / 2 + 3);
    }

    // merged result row
    const my = topY + rows * rowH + 14;
    ctx.fillStyle = 'rgba(128,128,128,0.8)';
    ctx.textAlign = 'left';
    ctx.fillText('merged →', padL, my - 4);
    const merged = i > 0 ? st[i - 1].merged : [];
    const activeAction = i > 0 ? st[i - 1].action : null;
    merged.forEach((m, mi) => {
      const isActive = mi === merged.length - 1;
      ctx.fillStyle = isActive && activeAction === 'extend' ? COLORS.extend : COLORS.merged;
      roundRect(ctx, xOf(m[0]), my, Math.max(6, xOf(m[1]) - xOf(m[0])), 18, 5);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = '11px ui-sans-serif, system-ui';
      ctx.fillText(`${m[0]}-${m[1]}`, xOf(m[0]) + 4, my + 13);
    });
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 600);
      const rows = Math.max(1, ivs.length);
      const h = 18 + rows * 20 + 50;
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
  }, [ivs]);

  useEffect(draw, [idx, ivs]);

  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 950 / speed;
    const tick = (t: number) => {
      if (!lastRef.current) lastRef.current = t;
      if (t - lastRef.current >= interval) {
        lastRef.current = t;
        const next = idxRef.current + 1;
        if (next >= steps.length + 1) { setIdx(steps.length); setPlaying(false); return; }
        setIdx(next);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
  }, [playing, speed, ivs]);

  const commit = () => { const p = parse(text); if (p.length) { setIvs(p); setIdx(0); setPlaying(false); } };
  const reset = () => { setPlaying(false); setIdx(0); lastRef.current = 0; };
  const stepF = () => { setPlaying(false); setIdx((v) => Math.min(steps.length, v + 1)); };
  const stepB = () => { setPlaying(false); setIdx((v) => Math.max(0, v - 1)); };
  const play = () => { if (idx >= steps.length) setIdx(0); lastRef.current = 0; setPlaying((p) => !p); };

  const cur = idx > 0 ? steps[idx - 1] : null;
  const curIv = cur ? sorted[cur.i] : null;
  const done = idx >= steps.length;
  const finalCount = steps.length ? steps[steps.length - 1].merged.length : 0;

  const caption = idx === 0
    ? 'Sorted by start time. Sweep left to right keeping one open block; each interval either overlaps it or starts a new one.'
    : cur!.action === 'extend'
      ? `${curIv![0]}-${curIv![1]} starts at ${curIv![0]} ≤ the open block's end — they overlap, so extend the block's end to ${cur!.active[1]}.`
      : `${curIv![0]}-${curIv![1]} starts after the open block — there's a gap, so close that block and open a new one here.`;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <input value={text} onInput={(e) => setText((e.target as HTMLInputElement).value)} class="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm" placeholder="1-3, 2-6, 8-10, ..." />
        <button onClick={commit} class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Load</button>
      </div>

      <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

      <p class="mt-3 min-h-[2.75rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">{caption}</p>
      {done && (
        <p class="mt-2 rounded-lg bg-brand-soft px-3 py-2 text-sm font-semibold text-text">
          {ivs.length} intervals collapsed to {finalCount} merged block{finalCount === 1 ? '' : 's'} in a single sorted pass — O(n log n) total, dominated by the sort.
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
      <p class="mt-2 text-center text-xs text-muted">Amber = a block just extended by an overlap, green = settled merged blocks.</p>
    </div>
  );
}
