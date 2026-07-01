import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated Fenwick (Binary Indexed) Tree.
   - Edit the array (comma-separated). The demo builds the BIT and draws
     each node as a horizontal bar over the range it summarises:
     node i covers (i - lowbit(i), i].
   - Pick "prefix query" or "point update" and an index. Play it to watch
     the lowbit jumps: a query walks DOWN (i -= lowbit), an update climbs
     UP (i += lowbit). Visited nodes light up; a live caption narrates the
     jump and the running sum.
   - Transport: Play / Pause / Step / Back / Reset + speed.
   ------------------------------------------------------------------ */

type Mode = 'query' | 'update';
const COLORS = { visited: '#4f46e5', cur: '#0ea5e9', cover: '#10b981', faint: 'rgba(128,128,128,0.18)' };

const lowbit = (i: number): number => i & (-i);
const parseList = (s: string): number[] =>
  s.split(',').map((x) => parseInt(x.trim(), 10)).filter((x) => Number.isFinite(x)).slice(0, 12);

// 1-indexed BIT nodes visited by a prefix query ending at 0-indexed `q`.
function querySteps(q: number): number[] {
  const out: number[] = [];
  let i = q + 1;
  while (i > 0) { out.push(i); i -= lowbit(i); }
  return out;
}
// 1-indexed BIT nodes visited by a point update at 0-indexed `u`.
function updateSteps(u: number, n: number): number[] {
  const out: number[] = [];
  let i = u + 1;
  while (i <= n) { out.push(i); i += lowbit(i); }
  return out;
}
function buildTree(a: number[]): number[] {
  const n = a.length;
  const tree = new Array(n + 1).fill(0);
  for (let i = 0; i < n; i++) { let j = i + 1; while (j <= n) { tree[j] += a[i]; j += lowbit(j); } }
  return tree;
}

export default function AdvFenwickTree() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ cell: 48, ox: 8, top: 8 });
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);

  const [text, setText] = useState('3, 1, 4, 1, 5, 9, 2, 6');
  const [nums, setNums] = useState<number[]>(() => parseList('3, 1, 4, 1, 5, 9, 2, 6'));
  const [mode, setMode] = useState<Mode>('query');
  const [target, setTarget] = useState(5);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  idxRef.current = idx;

  const n = nums.length;
  const tgt = Math.min(target, n - 1);
  const delta = 3; // fixed point-update delta for the demo
  const tree = buildTree(nums);
  const steps = mode === 'query' ? querySteps(tgt) : updateSteps(tgt, n);
  const maxLevel = Math.max(0, Math.floor(Math.log2(n)));

  const commit = () => { const p = parseList(text); if (p.length) { setNums(p); setIdx(0); setPlaying(false); setTarget((t) => Math.min(t, p.length - 1)); } };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { cell, ox, top } = sizeRef.current;
    const rowH = 30;
    const barsBottom = top + (maxLevel + 1) * rowH;
    const arrTop = barsBottom + 16;
    const arrH = 42;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const shown = steps.slice(0, idxRef.current);
    const cur = idxRef.current > 0 ? steps[idxRef.current - 1] : -1;
    // which array columns are "covered" so far (query: union of canonical ranges)
    const covered = new Set<number>();
    if (mode === 'query') for (const bi of shown) for (let c = bi - lowbit(bi); c <= bi - 1; c++) covered.add(c);

    // array row
    for (let c = 0; c < n; c++) {
      const x = ox + c * cell;
      ctx.fillStyle = covered.has(c) ? 'rgba(16,185,129,0.22)' : 'rgba(128,128,128,0.06)';
      ctx.fillRect(x, arrTop, cell - 4, arrH);
      ctx.strokeStyle = 'rgba(128,128,128,0.3)';
      ctx.strokeRect(x, arrTop, cell - 4, arrH);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '11px ui-sans-serif, system-ui';
      ctx.fillText(`${c}`, x + (cell - 4) / 2, arrTop + arrH - 9);
      ctx.fillStyle = covered.has(c) ? '#10b981' : '#64748b';
      ctx.font = 'bold 15px ui-monospace, monospace';
      ctx.fillText(`${nums[c]}`, x + (cell - 4) / 2, arrTop + 15);
    }

    // BIT node bars
    for (let bi = 1; bi <= n; bi++) {
      const lb = lowbit(bi);
      const start0 = bi - lb;       // 0-indexed inclusive
      const end0 = bi - 1;          // 0-indexed inclusive
      const level = Math.round(Math.log2(lb));
      const y = barsBottom - level * rowH;
      const x0 = ox + start0 * cell;
      const x1 = ox + end0 * cell + (cell - 4);
      const isCur = bi === cur;
      const isVis = shown.includes(bi);
      ctx.fillStyle = isCur ? COLORS.cur : isVis ? COLORS.visited : COLORS.faint;
      ctx.strokeStyle = isCur || isVis ? '#fff' : 'rgba(128,128,128,0.35)';
      ctx.lineWidth = isCur ? 2.5 : 1;
      roundRect(ctx, x0 + 1, y - 12, x1 - x0 - 2, 22, 6);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = isCur || isVis ? '#fff' : '#94a3b8';
      ctx.font = 'bold 12px ui-monospace, monospace';
      ctx.fillText(`${bi} =${tree[bi]}`, (x0 + x1) / 2, y);
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
      const cell = Math.max(34, Math.floor((w - 16) / n));
      const gw = cell * n + 16;
      const rowH = 30;
      const gh = (maxLevel + 1) * rowH + 16 + 42 + 24;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = gw * dpr;
      canvas.height = gh * dpr;
      canvas.style.width = `${gw}px`;
      canvas.style.height = `${gh}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { cell, ox: 8, top: 16 };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n, maxLevel]);

  useEffect(draw, [nums, mode, tgt, idx]);

  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 900 / speed;
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

  // running sum for a query
  let runSum = 0;
  for (const bi of steps.slice(0, idx)) runSum += tree[bi];

  let caption: string;
  if (idx === 0) {
    caption = mode === 'query'
      ? `prefix(${tgt}) — sum of indices 0..${tgt}. Start at BIT node ${tgt + 1}, then keep jumping by -lowbit. Press Play.`
      : `update index ${tgt} (+${delta}). Start at BIT node ${tgt + 1}, then climb by +lowbit to refresh every node that covers it. Press Play.`;
  } else {
    const bi = steps[idx - 1];
    const lb = lowbit(bi);
    if (mode === 'query') {
      const nxt = bi - lb;
      caption = `node ${bi} covers (${bi - lb}, ${bi}] -> add tree[${bi}]=${tree[bi]} (running sum ${runSum}). lowbit(${bi})=${lb}, so jump to ${nxt}${nxt === 0 ? ' — stop.' : '.'}`;
    } else {
      const nxt = bi + lb;
      caption = `node ${bi} covers index ${tgt} -> tree[${bi}] += ${delta}. lowbit(${bi})=${lb}, so climb to ${nxt}${nxt > n ? ' — past the end, stop.' : '.'}`;
    }
  }
  const done = idx >= steps.length && steps.length > 0;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <input value={text} onInput={(e) => setText((e.target as HTMLInputElement).value)} class="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm" placeholder="comma-separated numbers (max 12)" />
        <button onClick={commit} class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Load</button>
      </div>

      <div class="mb-3 flex flex-wrap items-center gap-3">
        <div class="flex gap-1">
          {(['query', 'update'] as Mode[]).map((m) => (
            <button key={m} onClick={() => { setMode(m); setIdx(0); setPlaying(false); }} class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${mode === m ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'}`}>
              {m === 'query' ? 'Prefix query' : 'Point update'}
            </button>
          ))}
        </div>
        <label class="flex items-center gap-2 text-xs text-muted">index {tgt}
          <input type="range" min={0} max={n - 1} step={1} value={tgt} onInput={(e) => { setTarget(parseInt((e.target as HTMLInputElement).value, 10)); setIdx(0); setPlaying(false); }} class="w-28 accent-[#4f46e5]" />
        </label>
      </div>

      <div class="overflow-x-auto">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />
      </div>

      <p class="mt-3 min-h-[3rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">{caption}</p>
      {done && mode === 'query' && <p class="mt-2 rounded-lg bg-brand-soft px-3 py-2 text-sm font-semibold text-text">prefix({tgt}) = {runSum}. Only {steps.length} node{steps.length === 1 ? '' : 's'} touched — one per set bit of {tgt + 1} (binary {(tgt + 1).toString(2)}).</p>}
      {done && mode === 'update' && <p class="mt-2 rounded-lg bg-brand-soft px-3 py-2 text-sm font-semibold text-text">Updated {steps.length} node{steps.length === 1 ? '' : 's'} — every BIT node whose range covers index {tgt}. That is the O(log n) climb.</p>}

      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={stepB} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏮ Back</button>
        <button onClick={play} class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90">{playing ? '⏸ Pause' : '▶ Play'}</button>
        <button onClick={stepF} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏭ Step</button>
        <button onClick={reset} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">↺ Reset</button>
        <label class="ml-auto flex items-center gap-2 text-xs text-muted">speed
          <input type="range" min={0.5} max={3} step={0.5} value={speed} onInput={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))} class="w-24 accent-[#4f46e5]" />
        </label>
      </div>
      <p class="mt-2 text-center text-xs text-muted">Each bar is a BIT node labelled <span class="font-mono">index =stored sum</span>; its width is the range it owns. Watch the lowbit jumps skip over the array.</p>
    </div>
  );
}
