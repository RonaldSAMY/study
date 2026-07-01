import { useEffect, useMemo, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated Coordinate Compression.
   - Edit an array of (possibly huge, possibly sparse) values. The demo
     collects the unique values, sorts them, gives each a small rank
     0,1,2,..., then rewrites the original array using those ranks.
   - Phases: sort unique → assign ranks → map each element to its rank.
   - Highlights the value being placed and its matching rank cell.
   - Transport: Play / Pause / Step / Step-back / Reset + speed.
   ------------------------------------------------------------------ */

const COLORS = { sorted: '#4f46e5', rank: '#0ea5e9', map: '#10b981' };

type Frame = {
  phase: 'sorted' | 'rank' | 'map' | 'done';
  sortedShown: number;
  ranksShown: number;
  mapped: number; // number of original elements rewritten
  activeSorted: number | null;
  activeOrig: number | null;
  caption: string;
};

function buildFrames(arr: number[]) {
  const sorted = [...new Set(arr)].sort((a, b) => a - b);
  const rankOf = new Map<number, number>();
  sorted.forEach((v, i) => rankOf.set(v, i));
  const compressed = arr.map((v) => rankOf.get(v)!);
  const frames: Frame[] = [];

  for (let i = 1; i <= sorted.length; i++) {
    frames.push({ phase: 'sorted', sortedShown: i, ranksShown: 0, mapped: 0, activeSorted: i - 1, activeOrig: null,
      caption: `Collect the distinct values and sort them: ${sorted[i - 1]} is next in order. (${i}/${sorted.length})` });
  }
  for (let i = 1; i <= sorted.length; i++) {
    frames.push({ phase: 'rank', sortedShown: sorted.length, ranksShown: i, mapped: 0, activeSorted: i - 1, activeOrig: null,
      caption: `Assign rank ${i - 1} to value ${sorted[i - 1]}.` });
  }
  for (let i = 0; i < arr.length; i++) {
    frames.push({ phase: 'map', sortedShown: sorted.length, ranksShown: sorted.length, mapped: i + 1, activeSorted: compressed[i], activeOrig: i,
      caption: `Rewrite arr[${i}] = ${arr[i]} as its rank ${compressed[i]}.` });
  }
  frames.push({ phase: 'done', sortedShown: sorted.length, ranksShown: sorted.length, mapped: arr.length, activeSorted: null, activeOrig: null,
    caption: `Done. The values fit in [0, ${sorted.length - 1}] now — a segment tree or BIT only needs ${sorted.length} slots, whatever the original magnitudes were.` });
  return { frames, sorted, compressed };
}

const parseList = (s: string): number[] =>
  s.split(',').map((x) => parseInt(x.trim(), 10)).filter((x) => Number.isFinite(x)).slice(0, 12);

export default function MiscCoordCompression() {
  const [text, setText] = useState('1000000, 5, 500000, 5, 750000, 250000');
  const [nums, setNums] = useState<number[]>(() => parseList('1000000, 5, 500000, 5, 750000, 250000'));
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);
  idxRef.current = idx;

  const { frames, sorted, compressed } = useMemo(() => buildFrames(nums), [nums]);
  const f = frames[Math.min(idx, frames.length - 1)];

  const commit = () => { const parsed = parseList(text); if (!parsed.length) return; setNums(parsed); setIdx(0); setPlaying(false); };

  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 820 / speed;
    const tick = (t: number) => {
      if (!lastRef.current) lastRef.current = t;
      if (t - lastRef.current >= interval) {
        lastRef.current = t;
        const next = idxRef.current + 1;
        if (next >= frames.length) { setIdx(frames.length - 1); setPlaying(false); return; }
        setIdx(next);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
  }, [playing, speed, frames]);

  const reset = () => { setPlaying(false); setIdx(0); lastRef.current = 0; };
  const stepF = () => { setPlaying(false); setIdx((v) => Math.min(frames.length - 1, v + 1)); };
  const stepB = () => { setPlaying(false); setIdx((v) => Math.max(0, v - 1)); };
  const play = () => { if (idx >= frames.length - 1) setIdx(0); lastRef.current = 0; setPlaying((p) => !p); };

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <input value={text} onInput={(e) => setText((e.target as HTMLInputElement).value)} class="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm" placeholder="comma-separated values" />
        <button onClick={commit} class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Load</button>
      </div>

      <div class="mb-1 text-xs font-semibold text-muted">original array</div>
      <div class="flex flex-wrap gap-1.5 font-mono text-sm">
        {nums.map((x, i) => {
          const active = f.activeOrig === i;
          return <span key={i} class={`rounded-md border px-2 py-1.5 transition ${active ? 'border-transparent text-white scale-110' : 'border-border bg-surface-2 text-text'}`} style={active ? `background:${COLORS.map}` : ''}>{x}</span>;
        })}
      </div>

      <div class="mt-3 mb-1 text-xs font-semibold text-muted">sorted unique values → rank</div>
      <div class="flex flex-wrap gap-1.5 font-mono text-sm">
        {sorted.slice(0, f.sortedShown).map((v, i) => {
          const active = f.activeSorted === i;
          const showRank = i < f.ranksShown;
          return (
            <div key={i} class="flex flex-col items-center gap-0.5">
              <span class={`rounded-md border px-2 py-1 transition ${active ? 'border-transparent text-white scale-110' : 'border-border bg-surface-2 text-text'}`} style={active ? `background:${COLORS.sorted}` : ''}>{v}</span>
              <span class={`flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold text-white transition ${showRank ? '' : 'opacity-0'}`} style={`background:${COLORS.rank}`}>{i}</span>
            </div>
          );
        })}
      </div>

      <div class="mt-3 mb-1 text-xs font-semibold text-muted">compressed array (ranks)</div>
      <div class="flex flex-wrap gap-1.5 font-mono text-sm">
        {nums.map((_, i) => {
          const shown = i < f.mapped;
          const active = f.activeOrig === i;
          return <span key={i} class={`flex h-9 w-9 items-center justify-center rounded-md border transition ${shown ? (active ? 'border-transparent text-white scale-110' : 'border-border bg-surface-2 text-text') : 'border-dashed border-border text-muted'}`} style={shown && active ? `background:${COLORS.map}` : ''}>{shown ? compressed[i] : '·'}</span>;
        })}
      </div>

      <p class="mt-3 min-h-[3rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">{f.caption}</p>

      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={stepB} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏮ Back</button>
        <button onClick={play} class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90">{playing ? '⏸ Pause' : '▶ Play'}</button>
        <button onClick={stepF} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏭ Step</button>
        <button onClick={reset} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">↺ Reset</button>
        <span class="text-xs text-muted">frame {idx + 1}/{frames.length}</span>
        <label class="ml-auto flex items-center gap-2 text-xs text-muted">speed
          <input type="range" min={0.5} max={3} step={0.5} value={speed} onInput={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))} class="w-24 accent-[#4f46e5]" />
        </label>
      </div>
      <p class="mt-2 text-center text-xs text-muted">Tip: equal values (like the two 5s) always get the SAME rank — compression preserves order and equality, nothing else.</p>
    </div>
  );
}
