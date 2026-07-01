import { useEffect, useMemo, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated Quickselect.
   - Edit the array and the rank k. The demo runs iterative Lomuto
     quickselect: it partitions the ACTIVE window [left, right] around
     a pivot (the rightmost element), then recurses into only ONE side
     — the side that must contain the k-th smallest element.
   - Every scan step, swap, pivot placement and side-decision is a frame.
     The active window is bright; the discarded side is dimmed for good.
   - Transport: Play / Pause / Step / Step-back / Reset + speed.
   Everything is precomputed into `frames`, then played by index.
   ------------------------------------------------------------------ */

const COLORS = { pivot: '#4f46e5', i: '#10b981', j: '#0ea5e9', found: '#10b981' };

type Frame = {
  arr: number[];
  left: number;
  right: number;
  pivotPos: number; // index currently holding the pivot value
  i: number; // boundary of the "< pivot" region
  j: number; // scanning pointer (-1 when not scanning)
  swap: [number, number] | null;
  foundPos: number | null;
  caption: string;
};

function buildFrames(input: number[], k: number): Frame[] {
  const arr = [...input];
  const frames: Frame[] = [];
  const snap = (o: Omit<Frame, 'arr'>) => frames.push({ arr: [...arr], ...o });

  let left = 0;
  let right = arr.length - 1;
  snap({ left, right, pivotPos: right, i: left, j: -1, swap: null, foundPos: null,
    caption: `Goal: find the k=${k} (0-indexed) smallest. Start with the whole array active.` });

  while (left < right) {
    const pivot = arr[right];
    let i = left;
    snap({ left, right, pivotPos: right, i, j: -1, swap: null, foundPos: null,
      caption: `Pick pivot = arr[right] = ${pivot}. Sweep and pull every value < ${pivot} to the left.` });

    for (let j = left; j < right; j++) {
      if (arr[j] < pivot) {
        snap({ left, right, pivotPos: right, i, j, swap: null, foundPos: null,
          caption: `arr[${j}] = ${arr[j]} < ${pivot} → swap it into the left region at i=${i}.` });
        [arr[i], arr[j]] = [arr[j], arr[i]];
        snap({ left, right, pivotPos: right, i, j, swap: [i, j], foundPos: null,
          caption: `Swapped. The "< pivot" region grows: i moves to ${i + 1}.` });
        i++;
      } else {
        snap({ left, right, pivotPos: right, i, j, swap: null, foundPos: null,
          caption: `arr[${j}] = ${arr[j]} ≥ ${pivot} → leave it; i stays at ${i}.` });
      }
    }

    [arr[i], arr[right]] = [arr[right], arr[i]];
    const p = i;
    snap({ left, right, pivotPos: p, i: p, j: -1, swap: [p, right], foundPos: null,
      caption: `Place the pivot between the two regions: it lands at index ${p}, its final sorted position.` });

    if (p === k) {
      snap({ left, right, pivotPos: p, i: p, j: -1, swap: null, foundPos: p,
        caption: `pivot index ${p} = k. Done — the k-th smallest is ${arr[p]}.` });
      return frames;
    } else if (p < k) {
      left = p + 1;
      snap({ left, right, pivotPos: p, i: p, j: -1, swap: null, foundPos: null,
        caption: `${p} < k, so the answer is to the RIGHT. Discard [0..${p}] and recurse on [${left}..${right}].` });
    } else {
      right = p - 1;
      snap({ left, right, pivotPos: p, i: p, j: -1, swap: null, foundPos: null,
        caption: `${p} > k, so the answer is to the LEFT. Discard the right part and recurse on [${left}..${right}].` });
    }
  }

  snap({ left, right, pivotPos: left, i: left, j: -1, swap: null, foundPos: left,
    caption: `The window shrank to one element — the k-th smallest is ${arr[left]}.` });
  return frames;
}

const parseList = (s: string): number[] =>
  s.split(',').map((x) => parseInt(x.trim(), 10)).filter((x) => Number.isFinite(x));

export default function MiscQuickselect() {
  const [text, setText] = useState('7, 2, 1, 6, 8, 5, 3, 4');
  const [kText, setKText] = useState('3');
  const [nums, setNums] = useState<number[]>(() => parseList('7, 2, 1, 6, 8, 5, 3, 4'));
  const [k, setK] = useState(3);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);
  idxRef.current = idx;

  const frames = useMemo(() => buildFrames(nums, k), [nums, k]);
  const f = frames[Math.min(idx, frames.length - 1)];

  const commit = () => {
    const parsed = parseList(text);
    let kv = parseInt(kText, 10);
    if (!parsed.length) return;
    if (!Number.isFinite(kv)) kv = 0;
    kv = Math.max(0, Math.min(parsed.length - 1, kv));
    setNums(parsed); setK(kv); setKText(String(kv)); setIdx(0); setPlaying(false);
  };

  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 780 / speed;
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
        <input value={text} onInput={(e) => setText((e.target as HTMLInputElement).value)} class="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm" placeholder="comma-separated numbers" />
        <label class="flex items-center gap-1 text-sm text-muted">k
          <input value={kText} onInput={(e) => setKText((e.target as HTMLInputElement).value)} class="w-14 rounded-lg border border-border bg-surface-2 px-2 py-1.5 font-mono text-sm" />
        </label>
        <button onClick={commit} class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Load</button>
      </div>

      <div class="flex flex-wrap gap-1.5 font-mono text-sm">
        {f.arr.map((x, i) => {
          const active = i >= f.left && i <= f.right;
          const isPivot = i === f.pivotPos;
          const isI = i === f.i && f.j >= 0;
          const isJ = i === f.j;
          const found = f.foundPos === i;
          let style = '';
          let cls = 'border-border bg-surface-2 text-text';
          if (!active) cls = 'border-border bg-surface-2 text-muted opacity-40';
          if (isPivot) { cls = 'border-transparent text-white'; style = `background:${COLORS.pivot}`; }
          if (isJ) { cls = 'border-transparent text-white'; style = `background:${COLORS.j}`; }
          if (found) { cls = 'border-transparent text-white scale-110'; style = `background:${COLORS.found}`; }
          return (
            <div key={i} class="flex flex-col items-center gap-0.5">
              <span class={`flex h-10 w-10 items-center justify-center rounded-md border text-base font-bold transition ${cls}`} style={style}>{x}</span>
              <span class="h-4 text-[10px] font-semibold text-muted">
                {i === k ? 'k' : isI ? 'i' : ''}
              </span>
            </div>
          );
        })}
      </div>

      <p class="mt-2 min-h-[3rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">{f.caption}</p>
      <p class="mt-1 text-xs text-muted">
        <span class="mr-3"><span class="inline-block h-2.5 w-2.5 rounded-sm align-middle" style={`background:${COLORS.pivot}`}></span> pivot</span>
        <span class="mr-3"><span class="inline-block h-2.5 w-2.5 rounded-sm align-middle" style={`background:${COLORS.j}`}></span> scanning j</span>
        <span><span class="inline-block h-2.5 w-2.5 rounded-sm align-middle" style={`background:${COLORS.found}`}></span> answer · dim = discarded</span>
      </p>

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
      <p class="mt-2 text-center text-xs text-muted">Tip: notice only ONE side survives each partition — that halving is why the average cost is linear, not n log n.</p>
    </div>
  );
}
