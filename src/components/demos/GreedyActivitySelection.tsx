import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Activity selection on a timeline.
   - Edit the activities (each "start-end"). The demo sorts them by
     FINISH time, then walks left to right keeping a "last end" marker:
     every activity that starts at or after the marker is taken; the rest
     conflict and are skipped.
   - The greedy choice each step is "the next activity to finish that is
     still compatible" — finishing earliest leaves the most room.
   - Canvas timeline with devicePixelRatio scaling + resize handling.
   - Transport: Play / Pause / Step / Step-back / Reset + speed.
   ------------------------------------------------------------------ */

const COLORS = {
  pick: '#10b981',
  cur: '#0ea5e9',
  brand: '#4f46e5',
  skip: 'rgba(148,163,184,0.45)',
  pending: 'rgba(148,163,184,0.30)',
  marker: '#4f46e5',
  grid: 'rgba(128,128,128,0.22)',
};

type Act = { start: number; end: number; label: string };
type Step = { idx: number; picked: boolean; lastEnd: number };

const parseActs = (s: string): Act[] => {
  const out: Act[] = [];
  let n = 0;
  for (const part of s.split(',')) {
    const m = part.trim().match(/^(\d+)\s*-\s*(\d+)$/);
    if (!m) continue;
    const start = parseInt(m[1], 10);
    const end = parseInt(m[2], 10);
    if (end > start) out.push({ start, end, label: String.fromCharCode(65 + n++) });
  }
  return out;
};

function computeSteps(sorted: Act[]): Step[] {
  const steps: Step[] = [];
  let lastEnd = -Infinity;
  for (let i = 0; i < sorted.length; i++) {
    const picked = sorted[i].start >= lastEnd;
    if (picked) lastEnd = sorted[i].end;
    steps.push({ idx: i, picked, lastEnd });
  }
  return steps;
}

export default function GreedyActivitySelection() {
  const [text, setText] = useState('0-6, 1-4, 3-5, 5-7, 3-9, 5-9, 6-10, 8-11');
  const [acts, setActs] = useState<Act[]>(() => parseActs('0-6, 1-4, 3-5, 5-7, 3-9, 5-9, 6-10, 8-11'));

  const sorted = [...acts].sort((a, b) => a.end - b.end || a.start - b.start);
  const steps = computeSteps(sorted);

  const [idx, setIdx] = useState(0); // 0..steps.length
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 560, h: 260 });
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);
  idxRef.current = idx;
  const stepsRef = useRef(steps);
  stepsRef.current = steps;

  const tMax = Math.max(1, ...sorted.map((a) => a.end));

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);

    const padL = 16, padR = 16, padT = 14, padB = 26;
    const plotW = w - padL - padR;
    const rows = sorted.length || 1;
    const rowH = Math.min(30, (h - padT - padB) / rows);
    const xOf = (t: number) => padL + (t / tMax) * plotW;
    const i = idxRef.current;
    const st = stepsRef.current;

    // axis ticks
    ctx.strokeStyle = COLORS.grid;
    ctx.fillStyle = 'rgba(128,128,128,0.8)';
    ctx.font = '10px ui-sans-serif, system-ui';
    ctx.textAlign = 'center';
    for (let t = 0; t <= tMax; t++) {
      const x = xOf(t);
      ctx.beginPath();
      ctx.moveTo(x, padT);
      ctx.lineTo(x, h - padB + 4);
      ctx.stroke();
      ctx.fillText(String(t), x, h - padB + 16);
    }

    // current "last end" marker
    if (i > 0) {
      const le = st[i - 1].lastEnd;
      if (Number.isFinite(le)) {
        const x = xOf(le);
        ctx.strokeStyle = COLORS.marker;
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.moveTo(x, padT - 2);
        ctx.lineTo(x, h - padB + 4);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // bars (sorted by end time, top to bottom)
    for (let r = 0; r < sorted.length; r++) {
      const a = sorted[r];
      const y = padT + r * rowH + 2;
      const x0 = xOf(a.start);
      const x1 = xOf(a.end);
      const considered = r < i;
      const isCur = r === i - 1;
      let fill = COLORS.pending;
      if (considered) fill = st[r].picked ? COLORS.pick : COLORS.skip;
      ctx.fillStyle = fill;
      const bh = rowH - 6;
      roundRect(ctx, x0, y, Math.max(6, x1 - x0), bh, 5);
      ctx.fill();
      if (isCur) {
        ctx.strokeStyle = COLORS.cur;
        ctx.lineWidth = 3;
        roundRect(ctx, x0, y, Math.max(6, x1 - x0), bh, 5);
        ctx.stroke();
      }
      // label
      ctx.fillStyle = considered && st[r].picked ? '#fff' : 'rgba(80,80,90,0.95)';
      ctx.font = '11px ui-sans-serif, system-ui';
      ctx.textAlign = 'left';
      ctx.fillText(`${a.label} (${a.start}-${a.end})`, x0 + 5, y + bh / 2 + 4);
    }
  };

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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 600);
      const rows = Math.max(1, acts.length);
      const h = 40 + rows * 30;
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
  }, [acts]);

  useEffect(draw, [idx, acts]);

  useEffect(() => {
    if (!playing) {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      return;
    }
    const interval = 900 / speed;
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
  }, [playing, speed, acts]);

  const commit = () => { const p = parseActs(text); if (p.length) { setActs(p); setIdx(0); setPlaying(false); } };
  const reset = () => { setPlaying(false); setIdx(0); lastRef.current = 0; };
  const stepF = () => { setPlaying(false); setIdx((v) => Math.min(steps.length, v + 1)); };
  const stepB = () => { setPlaying(false); setIdx((v) => Math.max(0, v - 1)); };
  const play = () => { if (idx >= steps.length) setIdx(0); lastRef.current = 0; setPlaying((p) => !p); };

  const cur = idx > 0 ? steps[idx - 1] : null;
  const a = cur ? sorted[cur.idx] : null;
  const chosenCount = steps.slice(0, idx).filter((s) => s.picked).length;
  const totalPicked = steps.filter((s) => s.picked).length;
  const done = idx >= steps.length;

  const caption = idx === 0
    ? 'Sorted by finish time. Walk left to right: keep an activity only if it starts at or after the last one we kept.'
    : cur!.picked
      ? `${a!.label} finishes at ${a!.end}, the earliest still compatible — take it. It starts at ${a!.start} ≥ marker, and leaves the most room for what follows.`
      : `${a!.label} starts at ${a!.start}, before the marker (${steps[idx - 2]?.lastEnd ?? 0}) — it overlaps the last pick, so skip it.`;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <input value={text} onInput={(e) => setText((e.target as HTMLInputElement).value)} class="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm" placeholder="0-6, 1-4, 3-5, ..." />
        <button onClick={commit} class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Load</button>
      </div>

      <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

      <p class="mt-3 min-h-[2.75rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">{caption}</p>
      {done && (
        <p class="mt-2 rounded-lg bg-brand-soft px-3 py-2 text-sm font-semibold text-text">
          Greedy kept {totalPicked} non-overlapping activities — the maximum possible. Sorting by finish time is what makes the earliest-finish choice always safe.
        </p>
      )}

      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={stepB} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏮ Back</button>
        <button onClick={play} class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90">{playing ? '⏸ Pause' : '▶ Play'}</button>
        <button onClick={stepF} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏭ Step</button>
        <button onClick={reset} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">↺ Reset</button>
        <span class="ml-2 text-xs text-muted">kept {chosenCount}/{totalPicked}</span>
        <label class="ml-auto flex items-center gap-2 text-xs text-muted">speed
          <input type="range" min={0.5} max={3} step={0.5} value={speed} onInput={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))} class="w-24 accent-[#4f46e5]" />
        </label>
      </div>
      <p class="mt-2 text-center text-xs text-muted">Green = kept, grey = skipped (conflicts), dashed line = the last finish time we committed to.</p>
    </div>
  );
}
