import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated 0/1-knapsack DP table, filled cell by cell.
   - Rows i = 0..n are items (row 0 = no items, the base case).
   - Columns w = 0..W are capacities.
   - Recurrence per cell:
       dp[i][w] = dp[i-1][w]                              if weight > w
                = max(dp[i-1][w], dp[i-1][w-weight]+value) otherwise
   - Frames are precomputed row-major (i outer, w inner), one per cell.
     Each frame records the value written and the TWO cells it read:
     the "skip" cell directly above and, when the item fits, the "take"
     cell dp[i-1][w-weight]. The view is idx-driven, never live.
   - Transport: Play / Pause / Step / Step-back / Reset + speed.
   ------------------------------------------------------------------ */

const COLORS = { cur: '#0ea5e9', read: '#4f46e5', done: '#10b981' };

type Item = { w: number; v: number };
type Frame = {
  i: number;        // current row (1..n)
  w: number;        // current column (0..W)
  val: number;      // value written into dp[i][w]
  skip: number;     // dp[i-1][w]
  fits: boolean;    // does item i fit in capacity w?
  takeCol: number;  // w - weight (column read when taking)
  takeVal: number;  // dp[i-1][w-weight]
  itemW: number;
  itemV: number;
};

// Parse "2:3, 3:4" into [{w:2,v:3},{w:3,v:4}]; ignore malformed entries.
function parseItems(s: string): Item[] {
  return s
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const [a, b] = p.split(':').map((x) => parseInt(x.trim(), 10));
      return { w: a, v: b };
    })
    .filter((it) => Number.isFinite(it.w) && Number.isFinite(it.v) && it.w >= 1 && it.v >= 0 && it.w <= 12);
}

// Build the full dp table, the row-major frames, and the backtracked picks.
function build(items: Item[], cap: number) {
  const n = items.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(cap + 1).fill(0));
  const frames: Frame[] = [];

  for (let i = 1; i <= n; i++) {
    const { w: weight, v: value } = items[i - 1];
    for (let w = 0; w <= cap; w++) {
      const skip = dp[i - 1][w];
      const fits = weight <= w;
      const takeCol = w - weight;
      const takeVal = fits ? dp[i - 1][takeCol] : 0;
      dp[i][w] = fits ? Math.max(skip, takeVal + value) : skip;
      frames.push({ i, w, val: dp[i][w], skip, fits, takeCol, takeVal, itemW: weight, itemV: value });
    }
  }

  // Backtrack chosen items (0-based indices) from dp[n][cap].
  const picks: number[] = [];
  let w = cap;
  for (let i = n; i > 0 && w > 0; i--) {
    if (dp[i][w] !== dp[i - 1][w]) {
      picks.push(i - 1);
      w -= items[i - 1].w;
    }
  }
  picks.reverse();

  return { dp, frames, picks, n };
}

export default function DpKnapsackTable() {
  const [text, setText] = useState('2:3, 3:4, 4:5, 5:6');
  const [items, setItems] = useState<Item[]>(() => parseItems('2:3, 3:4, 4:5, 5:6'));
  const [cap, setCap] = useState(5);
  const [idx, setIdx] = useState(0); // 0..frames.length
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);
  idxRef.current = idx;

  const { dp, frames, picks, n } = build(items, cap);
  const total = frames.length;

  const commit = () => {
    const parsed = parseItems(text);
    if (parsed.length) {
      setItems(parsed);
      setIdx(0);
      setPlaying(false);
      lastRef.current = 0;
    }
  };

  const onCap = (val: number) => {
    const c = Math.max(1, Math.min(12, Math.round(val) || 1));
    setCap(c);
    setIdx(0);
    setPlaying(false);
    lastRef.current = 0;
  };

  useEffect(() => {
    if (!playing) {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      return;
    }
    const interval = 700 / speed;
    const tick = (t: number) => {
      if (!lastRef.current) lastRef.current = t;
      if (t - lastRef.current >= interval) {
        lastRef.current = t;
        const next = idxRef.current + 1;
        if (next >= total + 1) {
          setIdx(total);
          setPlaying(false);
          return;
        }
        setIdx(next);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [playing, speed, total]);

  const reset = () => { setPlaying(false); setIdx(0); lastRef.current = 0; };
  const stepF = () => { setPlaying(false); setIdx((v) => Math.min(total, v + 1)); };
  const stepB = () => { setPlaying(false); setIdx((v) => Math.max(0, v - 1)); };
  const play = () => { if (idx >= total) setIdx(0); lastRef.current = 0; setPlaying((p) => !p); };

  const done = idx >= total;
  const cur = idx > 0 ? frames[idx - 1] : null;

  // A cell is shown once its frame has run; base row 0 is always visible.
  const filled = (i: number, w: number) =>
    i === 0 || (i - 1) * (cap + 1) + w < idx;

  const caption = (() => {
    if (!cur) return 'Base row (no items) is all 0. Press Play to fill the table cell by cell.';
    const head = `dp[${cur.i}][${cur.w}]`;
    if (!cur.fits) {
      return `${head} = dp[${cur.i - 1}][${cur.w}] = ${cur.val}  —  item ${cur.i} weighs ${cur.itemW}, too heavy for capacity ${cur.w}, so we skip it.`;
    }
    return `${head} = max(dp[${cur.i - 1}][${cur.w}], ${cur.itemV} + dp[${cur.i - 1}][${cur.takeCol}]) = max(${cur.skip}, ${cur.itemV}+${cur.takeVal}) = ${cur.val}`;
  })();

  // Class + inline style for one table cell.
  const cellStyle = (i: number, w: number): { cls: string; style: string } => {
    const isCur = cur && cur.i === i && cur.w === w;
    const isSkipRead = cur && cur.i - 1 === i && cur.w === w;
    const isTakeRead = cur && cur.fits && cur.i - 1 === i && cur.takeCol === w;
    const isAnswer = done && i === n && w === cap;
    if (isCur) return { cls: 'border-transparent text-white font-bold', style: `background:${COLORS.cur}` };
    if (isAnswer) return { cls: 'border-transparent text-white font-bold', style: `background:${COLORS.done}` };
    if (isSkipRead || isTakeRead)
      return { cls: 'font-semibold text-text', style: `background:rgba(79,70,229,0.14);box-shadow:inset 0 0 0 2px ${COLORS.read}` };
    return { cls: 'border-border bg-surface-2 text-text', style: '' };
  };

  const maxValue = dp[n][cap];

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      {/* editors */}
      <div class="mb-3 flex flex-wrap items-end gap-3">
        <label class="flex-1 min-w-[14rem] text-xs text-muted">
          items (weight:value, comma-separated)
          <input
            value={text}
            onInput={(e) => setText((e.target as HTMLInputElement).value)}
            class="mt-1 w-full rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm text-text"
            placeholder="2:3, 3:4, 4:5, 5:6"
          />
        </label>
        <label class="text-xs text-muted">
          capacity
          <input
            type="number"
            min={1}
            max={12}
            value={cap}
            onInput={(e) => onCap(parseInt((e.target as HTMLInputElement).value, 10))}
            class="mt-1 w-20 rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm text-text"
          />
        </label>
        <button onClick={commit} class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Load</button>
      </div>

      {/* the dp grid */}
      <div class="overflow-x-auto">
        <div
          class="inline-grid gap-1 text-center font-mono text-sm"
          style={`grid-template-columns: minmax(4.5rem, auto) repeat(${cap + 1}, 2.1rem)`}
        >
          {/* header row: capacity labels */}
          <div class="flex items-end justify-end pr-2 text-xs text-muted">w →</div>
          {Array.from({ length: cap + 1 }, (_, w) => (
            <div key={`h${w}`} class="flex h-7 items-center justify-center text-xs font-semibold text-muted">{w}</div>
          ))}

          {/* data rows */}
          {Array.from({ length: n + 1 }, (_, i) => {
            const rowLabel = i === 0 ? '∅ (no items)' : `${i}: ${items[i - 1].w}kg/$${items[i - 1].v}`;
            return [
              <div key={`l${i}`} class="flex items-center justify-end pr-2 text-[11px] leading-tight text-muted">{rowLabel}</div>,
              ...Array.from({ length: cap + 1 }, (_, w) => {
                const { cls, style } = cellStyle(i, w);
                return (
                  <div
                    key={`${i}-${w}`}
                    class={`flex h-9 items-center justify-center rounded-md border transition ${cls}`}
                    style={style}
                  >
                    {filled(i, w) ? dp[i][w] : ''}
                  </div>
                );
              }),
            ];
          })}
        </div>
      </div>

      {/* legend */}
      <div class="mt-3 flex flex-wrap gap-3 text-xs text-muted">
        <span class="flex items-center gap-1.5"><span class="inline-block h-3 w-3 rounded" style={`background:${COLORS.cur}`} /> current cell</span>
        <span class="flex items-center gap-1.5"><span class="inline-block h-3 w-3 rounded" style={`box-shadow:inset 0 0 0 2px ${COLORS.read};background:rgba(79,70,229,0.14)`} /> cells it reads (skip / take)</span>
        <span class="flex items-center gap-1.5"><span class="inline-block h-3 w-3 rounded" style={`background:${COLORS.done}`} /> answer dp[n][W]</span>
      </div>

      <p class="mt-3 min-h-[2.75rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">{caption}</p>
      {done && n > 0 && (
        <p class="mt-2 rounded-lg bg-brand-soft px-3 py-2 text-sm font-semibold text-text">
          Done — max value {maxValue} with capacity {cap}.{' '}
          {picks.length
            ? `Take item${picks.length > 1 ? 's' : ''} ${picks.map((p) => p + 1).join(', ')} (${picks.map((p) => `${items[p].w}kg/$${items[p].v}`).join(' + ')}).`
            : 'No item fits — take nothing.'}
        </p>
      )}

      {/* transport */}
      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={stepB} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏮ Back</button>
        <button onClick={play} class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90">{playing ? '⏸ Pause' : '▶ Play'}</button>
        <button onClick={stepF} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏭ Step</button>
        <button onClick={reset} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">↺ Reset</button>
        <label class="ml-auto flex items-center gap-2 text-xs text-muted">speed
          <input type="range" min={0.5} max={3} step={0.5} value={speed} onInput={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))} class="w-24 accent-[#4f46e5]" />
        </label>
      </div>
      <p class="mt-2 text-center text-xs text-muted">
        Step {Math.min(idx, total)} / {total}. Each cell reads the two cells in the row above: straight up (skip) and {'←'} weight to the left (take).
      </p>
    </div>
  );
}
