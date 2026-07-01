import { useEffect, useMemo, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated Square-Root Decomposition (range-sum query).
   - Edit the array and a query [L, R]. The array is split into √n
     blocks, each labelled with its precomputed sum.
   - Answering the query is animated: a few loose elements on the LEFT
     edge, then WHOLE blocks jumped over in one O(1) step each, then a
     few loose elements on the RIGHT edge. The running total ticks up.
   - Transport: Play / Pause / Step / Step-back / Reset + speed.
   ------------------------------------------------------------------ */

const COLORS = { edge: '#0ea5e9', block: '#4f46e5', done: '#10b981' };

type Frame = {
  add: number[]; // element indices contributing at this frame
  block: number | null; // whole block index contributing at this frame
  running: number;
  caption: string;
};

function buildFrames(arr: number[], L: number, R: number, bs: number, blockSum: number[]): Frame[] {
  const frames: Frame[] = [];
  let running = 0;
  const leftBlock = Math.floor(L / bs);
  const rightBlock = Math.floor(R / bs);
  frames.push({ add: [], block: null, running: 0,
    caption: `Query sum of [${L}, ${R}]. Block size = ⌊√${arr.length}⌋ = ${bs}. Walk the edges by hand, jump the middle blocks whole.` });

  if (leftBlock === rightBlock) {
    for (let i = L; i <= R; i++) {
      running += arr[i];
      frames.push({ add: [i], block: null, running, caption: `Same block — add arr[${i}] = ${arr[i]} directly. Running = ${running}.` });
    }
  } else {
    for (let i = L; i < (leftBlock + 1) * bs; i++) {
      running += arr[i];
      frames.push({ add: [i], block: null, running, caption: `Left edge: add loose element arr[${i}] = ${arr[i]}. Running = ${running}.` });
    }
    for (let b = leftBlock + 1; b < rightBlock; b++) {
      running += blockSum[b];
      frames.push({ add: [], block: b, running, caption: `Whole block ${b} is inside — add its precomputed sum ${blockSum[b]} in ONE step. Running = ${running}.` });
    }
    for (let i = rightBlock * bs; i <= R; i++) {
      running += arr[i];
      frames.push({ add: [i], block: null, running, caption: `Right edge: add loose element arr[${i}] = ${arr[i]}. Running = ${running}.` });
    }
  }
  frames.push({ add: [], block: null, running, caption: `Answer: sum[${L}, ${R}] = ${running}. At most ~2√n loose elements plus √n block sums were touched.` });
  return frames;
}

const parseList = (s: string): number[] =>
  s.split(',').map((x) => parseInt(x.trim(), 10)).filter((x) => Number.isFinite(x));

export default function MiscSqrtBlocks() {
  const [text, setText] = useState('3,1,4,1,5,9,2,6,5,3,5,8,9,7,9,3');
  const [lText, setLText] = useState('2');
  const [rText, setRText] = useState('10');
  const [nums, setNums] = useState<number[]>(() => parseList('3,1,4,1,5,9,2,6,5,3,5,8,9,7,9,3'));
  const [L, setL] = useState(2);
  const [R, setR] = useState(10);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);
  idxRef.current = idx;

  const { bs, blockSum } = useMemo(() => {
    const b = Math.max(1, Math.floor(Math.sqrt(nums.length)));
    const sums: number[] = [];
    for (let i = 0; i < nums.length; i++) {
      const bi = Math.floor(i / b);
      sums[bi] = (sums[bi] || 0) + nums[i];
    }
    return { bs: b, blockSum: sums };
  }, [nums]);

  const frames = useMemo(() => buildFrames(nums, L, R, bs, blockSum), [nums, L, R, bs, blockSum]);
  const f = frames[Math.min(idx, frames.length - 1)];

  const commit = () => {
    const parsed = parseList(text);
    if (!parsed.length) return;
    let l = parseInt(lText, 10); let r = parseInt(rText, 10);
    if (!Number.isFinite(l)) l = 0; if (!Number.isFinite(r)) r = parsed.length - 1;
    l = Math.max(0, Math.min(parsed.length - 1, l));
    r = Math.max(l, Math.min(parsed.length - 1, r));
    setNums(parsed); setL(l); setR(r); setLText(String(l)); setRText(String(r)); setIdx(0); setPlaying(false);
  };

  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 900 / speed;
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

  const numBlocks = Math.ceil(nums.length / bs);

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <input value={text} onInput={(e) => setText((e.target as HTMLInputElement).value)} class="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm" placeholder="comma-separated numbers" />
        <label class="flex items-center gap-1 text-sm text-muted">L<input value={lText} onInput={(e) => setLText((e.target as HTMLInputElement).value)} class="w-12 rounded-lg border border-border bg-surface-2 px-2 py-1.5 font-mono text-sm" /></label>
        <label class="flex items-center gap-1 text-sm text-muted">R<input value={rText} onInput={(e) => setRText((e.target as HTMLInputElement).value)} class="w-12 rounded-lg border border-border bg-surface-2 px-2 py-1.5 font-mono text-sm" /></label>
        <button onClick={commit} class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Load</button>
      </div>

      <div class="flex flex-wrap gap-2 font-mono text-sm">
        {Array.from({ length: numBlocks }, (_, b) => {
          const start = b * bs;
          const end = Math.min(start + bs, nums.length);
          const wholeActive = f.block === b;
          return (
            <div key={b} class={`rounded-lg border p-1.5 transition ${wholeActive ? 'border-transparent' : 'border-border'}`} style={wholeActive ? `background:${COLORS.block}22;border-color:${COLORS.block}` : ''}>
              <div class="flex gap-1">
                {nums.slice(start, end).map((x, oi) => {
                  const i = start + oi;
                  const inRange = i >= L && i <= R;
                  const edgeActive = f.add.includes(i);
                  let cls = 'border-border bg-surface-2 text-text';
                  let style = '';
                  if (!inRange) cls = 'border-border bg-surface-2 text-muted opacity-40';
                  if (wholeActive) { cls = 'border-transparent text-white'; style = `background:${COLORS.block}`; }
                  if (edgeActive) { cls = 'border-transparent text-white scale-110'; style = `background:${COLORS.edge}`; }
                  return <span key={i} class={`flex h-9 w-9 items-center justify-center rounded-md border text-sm font-bold transition ${cls}`} style={style}>{x}</span>;
                })}
              </div>
              <div class="mt-1 text-center text-[11px] text-muted">Σ={blockSum[b]}</div>
            </div>
          );
        })}
      </div>

      <div class="mt-3 flex items-center gap-2 font-mono text-sm">
        <span class="font-bold" style={`color:${COLORS.done}`}>running total</span>
        <span class="rounded-md px-3 py-1 text-base font-bold text-white" style={`background:${COLORS.done}`}>{f.running}</span>
      </div>
      <p class="mt-2 min-h-[3rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">{f.caption}</p>

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
      <p class="mt-2 text-center text-xs text-muted">Tip: widen the query to span more whole blocks — those are the O(1) jumps that make the whole thing O(√n).</p>
    </div>
  );
}
