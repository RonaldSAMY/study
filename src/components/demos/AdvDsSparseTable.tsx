import { useEffect, useMemo, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated sparse table for Range-Minimum queries.
   - Build phase: each cell table[j][i] = min(table[j-1][i],
     table[j-1][i + 2^(j-1)]) — doubling the covered range each level.
   - Query phase: pick k = floor(log2(len)) and overlap two cells of
     length 2^k to answer min(l..r) in O(1). Min is idempotent, so the
     overlap is harmless.
   - Transport: Play / Pause / Step / Back / Reset + speed, with the two
     source cells and the result highlighted, plus a caption.
   ------------------------------------------------------------------ */

const SKY = '#0ea5e9';
const EM = '#10b981';
const IND = '#4f46e5';

type Cell = [number, number];
type Frame = {
  table: (number | null)[][];
  src: Cell[]; result: Cell | null; arr: [number, number] | null;
  caption: string; phase: 'build' | 'query';
};

function build(arr: number[], ql: number, qr: number) {
  const n = arr.length;
  const log = new Array(n + 1).fill(0);
  for (let i = 2; i <= n; i++) log[i] = log[i >> 1] + 1;
  const K = log[n] + 1;
  const table: (number | null)[][] = Array.from({ length: K }, () => Array(n).fill(null));
  const frames: Frame[] = [];
  const snap = () => table.map((row) => [...row]);

  for (let i = 0; i < n; i++) table[0][i] = arr[i];
  frames.push({ table: snap(), src: [], result: null, arr: null, phase: 'build',
    caption: 'Level 0: every cell is just one element — ranges of length 1.' });

  for (let j = 1; j < K; j++) {
    const half = 1 << (j - 1);
    for (let i = 0; i + (1 << j) <= n; i++) {
      const a = table[j - 1][i]!, b = table[j - 1][i + half]!;
      table[j][i] = Math.min(a, b);
      frames.push({ table: snap(), src: [[j - 1, i], [j - 1, i + half]], result: [j, i], arr: null, phase: 'build',
        caption: `table[${j}][${i}] = min(${a}, ${b}) = ${Math.min(a, b)} — covers indices ${i}…${i + (1 << j) - 1} (length ${1 << j}).` });
    }
  }

  // query
  const len = qr - ql + 1;
  const k = log[len];
  const aPos: Cell = [k, ql];
  const bPos: Cell = [k, qr - (1 << k) + 1];
  frames.push({ table: snap(), src: [], result: null, arr: [ql, qr], phase: 'query',
    caption: `Query min(${ql}…${qr}): length ${len}, so k = ⌊log₂ ${len}⌋ = ${k}, covering ${1 << k} elements per cell.` });
  const av = table[aPos[0]][aPos[1]]!, bv = table[bPos[0]][bPos[1]]!;
  frames.push({ table: snap(), src: [aPos, bPos], result: null, arr: [ql, qr], phase: 'query',
    caption: `Overlap two length-${1 << k} blocks: from index ${ql} (=${av}) and from index ${qr - (1 << k) + 1} (=${bv}). Overlap is fine — min is idempotent.` });
  frames.push({ table: snap(), src: [aPos, bPos], result: null, arr: [ql, qr], phase: 'query',
    caption: `Answer: min(${av}, ${bv}) = ${Math.min(av, bv)} in O(1) — two lookups, no loop over the range.` });
  return { arr, n, K, frames };
}

export default function AdvDsSparseTable() {
  const [text, setText] = useState('5, 2, 7, 4, 8, 1, 6, 3');
  const [arr, setArr] = useState<number[]>(() => [5, 2, 7, 4, 8, 1, 6, 3]);
  const [ql, setQl] = useState(1);
  const [qr, setQr] = useState(6);

  const { n, K, frames } = useMemo(() => {
    const lo = Math.max(0, Math.min(ql, qr, arr.length - 1));
    const hi = Math.min(arr.length - 1, Math.max(ql, qr));
    return build(arr, lo, hi);
  }, [arr, ql, qr]);

  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);
  idxRef.current = idx;

  useEffect(() => { setIdx(0); setPlaying(false); }, [frames]);

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

  const commit = () => {
    const parsed = text.split(',').map((s) => parseInt(s.trim(), 10)).filter((x) => Number.isFinite(x));
    if (parsed.length >= 2) setArr(parsed.slice(0, 16));
  };

  const f = frames[idx];
  const isSrc = (j: number, i: number) => f.src.some((c) => c[0] === j && c[1] === i);
  const isRes = (j: number, i: number) => f.result != null && f.result[0] === j && f.result[1] === i;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <input value={text} onInput={(e) => setText((e.target as HTMLInputElement).value)}
          class="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm" placeholder="array values" />
        <button onClick={commit} class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Load</button>
        <label class="flex items-center gap-1 text-xs text-muted">l
          <input type="number" min={0} max={n - 1} value={ql} onInput={(e) => setQl(parseInt((e.target as HTMLInputElement).value, 10) || 0)} class="w-14 rounded-lg border border-border bg-surface-2 px-2 py-1 font-mono text-sm" />
        </label>
        <label class="flex items-center gap-1 text-xs text-muted">r
          <input type="number" min={0} max={n - 1} value={qr} onInput={(e) => setQr(parseInt((e.target as HTMLInputElement).value, 10) || 0)} class="w-14 rounded-lg border border-border bg-surface-2 px-2 py-1 font-mono text-sm" />
        </label>
      </div>

      <div class="overflow-x-auto">
        <div class="inline-block">
          {/* index header */}
          <div class="flex gap-1.5 pl-12 font-mono text-[11px] text-muted">
            {Array.from({ length: n }, (_, i) => (
              <div key={i} class="w-9 text-center">{i}</div>
            ))}
          </div>
          {Array.from({ length: K }, (_, j) => (
            <div key={j} class="mt-1.5 flex items-center gap-1.5">
              <div class="w-11 shrink-0 text-right font-mono text-[11px] text-muted">2^{j}={1 << j}</div>
              {Array.from({ length: n }, (_, i) => {
                const v = f.table[j][i];
                const inArr = j === 0 && f.arr != null && i >= f.arr[0] && i <= f.arr[1];
                const src = isSrc(j, i);
                const res = isRes(j, i);
                let bg = 'transparent';
                if (res) bg = EM; else if (src) bg = SKY; else if (inArr) bg = IND;
                const filled = v != null;
                return (
                  <div key={i}
                    class={`flex h-9 w-9 items-center justify-center rounded-md border font-mono text-sm ${src || res || inArr ? 'border-transparent font-bold text-white' : filled ? 'border-border bg-surface-2 text-text' : 'border-transparent'}`}
                    style={bg !== 'transparent' ? `background:${bg};transform:scale(1.05)` : ''}>
                    {filled ? v : ''}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <p class="mt-3 min-h-[2.5rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">{f.caption}</p>

      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={stepB} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏮ Back</button>
        <button onClick={play} class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90">{playing ? '⏸ Pause' : '▶ Play'}</button>
        <button onClick={stepF} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏭ Step</button>
        <button onClick={reset} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">↺ Reset</button>
        <span class="text-xs text-muted">step {idx + 1}/{frames.length}</span>
        <label class="ml-auto flex items-center gap-2 text-xs text-muted">speed
          <input type="range" min={0.5} max={3} step={0.5} value={speed} onInput={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))} class="w-24 accent-[#4f46e5]" />
        </label>
      </div>
      <p class="mt-2 text-center text-xs text-muted">Tip: blue cells are the two precomputed blocks; their overlap still gives the right minimum.</p>
    </div>
  );
}
