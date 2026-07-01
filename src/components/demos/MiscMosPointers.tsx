import { useEffect, useMemo, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated Mo's Algorithm (count distinct in a range).
   - Fixed array; edit the list of queries [L,R]. The demo sorts the
     queries by (block of L, then R) and then sweeps a single window
     [curL, curR], adding/removing one element at a time. Because the
     queries are reordered, the pointers travel far less than answering
     each query from scratch.
   - The live state is the current DISTINCT count. Each pointer move
     (add / remove) is one frame; answered queries are recorded.
   - Transport: Play / Pause / Step / Step-back / Reset + speed.
   ------------------------------------------------------------------ */

const COLORS = { window: '#4f46e5', add: '#10b981', remove: '#f43f5e', answer: '#0ea5e9' };

type Q = { l: number; r: number; idx: number };
type Frame = {
  curL: number;
  curR: number;
  move: number | null; // element index just added/removed
  kind: 'add' | 'remove' | 'answer' | 'start';
  distinct: number;
  qIndex: number | null; // original query index just answered
  caption: string;
};

function buildFrames(arr: number[], queries: [number, number][]): { frames: Frame[]; order: Q[]; answers: (number | null)[] } {
  const bs = Math.max(1, Math.floor(Math.sqrt(arr.length)));
  const order: Q[] = queries.map(([l, r], idx) => ({ l, r, idx }))
    .sort((a, b) => {
      const ba = Math.floor(a.l / bs), bb = Math.floor(b.l / bs);
      if (ba !== bb) return ba - bb;
      return ba % 2 === 0 ? a.r - b.r : b.r - a.r;
    });

  const freq = new Map<number, number>();
  let distinct = 0;
  const add = (v: number) => { const nf = (freq.get(v) || 0) + 1; freq.set(v, nf); if (nf === 1) distinct++; };
  const remove = (v: number) => { const nf = (freq.get(v) || 0) - 1; if (nf === 0) { freq.delete(v); distinct--; } else freq.set(v, nf); };

  const frames: Frame[] = [];
  const answers: (number | null)[] = queries.map(() => null);
  let curL = 0, curR = -1;
  frames.push({ curL, curR, move: null, kind: 'start', distinct, qIndex: null,
    caption: `Sorted ${queries.length} queries by (block of L, then R). Window starts empty at [0, -1].` });

  for (const q of order) {
    const { l: L, r: R, idx } = q;
    while (curR < R) { curR++; add(arr[curR]); frames.push({ curL, curR, move: curR, kind: 'add', distinct, qIndex: null, caption: `Extend right: add arr[${curR}] = ${arr[curR]}. Distinct = ${distinct}.` }); }
    while (curL > L) { curL--; add(arr[curL]); frames.push({ curL, curR, move: curL, kind: 'add', distinct, qIndex: null, caption: `Extend left: add arr[${curL}] = ${arr[curL]}. Distinct = ${distinct}.` }); }
    while (curR > R) { remove(arr[curR]); frames.push({ curL, curR, move: curR, kind: 'remove', distinct, qIndex: null, caption: `Shrink right: remove arr[${curR}] = ${arr[curR]}. Distinct = ${distinct}.` }); curR--; }
    while (curL < L) { remove(arr[curL]); frames.push({ curL, curR, move: curL, kind: 'remove', distinct, qIndex: null, caption: `Shrink left: remove arr[${curL}] = ${arr[curL]}. Distinct = ${distinct}.` }); curL++; }
    answers[idx] = distinct;
    frames.push({ curL, curR, move: null, kind: 'answer', distinct, qIndex: idx,
      caption: `Window is exactly [${L}, ${R}] → answer query ${idx}: ${distinct} distinct values.` });
  }
  return { frames, order, answers };
}

const parseQueries = (s: string): [number, number][] => {
  const out: [number, number][] = [];
  const re = /(\d+)\s*[-, ]\s*(\d+)/g; let m;
  const clean = s.replace(/[()\[\]]/g, ' ');
  while ((m = re.exec(clean)) !== null) out.push([parseInt(m[1], 10), parseInt(m[2], 10)]);
  return out;
};

const ARR = [1, 3, 2, 1, 4, 1, 3, 5, 2, 1];

export default function MiscMosPointers() {
  const [qText, setQText] = useState('(0,3) (2,5) (1,4) (5,8) (0,9)');
  const [queries, setQueries] = useState<[number, number][]>(() => parseQueries('(0,3) (2,5) (1,4) (5,8) (0,9)'));
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);
  idxRef.current = idx;

  const { frames, order } = useMemo(() => buildFrames(ARR, queries), [queries]);
  const f = frames[Math.min(idx, frames.length - 1)];

  const commit = () => {
    const parsed = parseQueries(qText).filter(([l, r]) => l >= 0 && r < ARR.length && l <= r);
    if (!parsed.length) return;
    setQueries(parsed); setIdx(0); setPlaying(false);
  };

  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 720 / speed;
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

  const answered = new Set<number>();
  for (let i = 0; i <= Math.min(idx, frames.length - 1); i++) if (frames[i].kind === 'answer' && frames[i].qIndex != null) answered.add(frames[i].qIndex as number);

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-1 text-xs text-muted">Fixed array (edit the queries below):</div>
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <input value={qText} onInput={(e) => setQText((e.target as HTMLInputElement).value)} class="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm" placeholder="queries like (0,3) (2,5)" />
        <button onClick={commit} class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Load</button>
      </div>

      <div class="flex flex-wrap gap-1.5 font-mono text-sm">
        {ARR.map((x, i) => {
          const inWindow = i >= f.curL && i <= f.curR;
          const moved = f.move === i;
          let cls = 'border-border bg-surface-2 text-muted opacity-50';
          let style = '';
          if (inWindow) { cls = 'border-transparent text-white'; style = `background:${COLORS.window}`; }
          if (moved && f.kind === 'add') { cls = 'border-transparent text-white scale-110'; style = `background:${COLORS.add}`; }
          if (moved && f.kind === 'remove') { cls = 'border-transparent text-white scale-110'; style = `background:${COLORS.remove}`; }
          return (
            <div key={i} class="flex flex-col items-center gap-0.5">
              <span class={`flex h-10 w-10 items-center justify-center rounded-md border text-base font-bold transition ${cls}`} style={style}>{x}</span>
              <span class="text-[10px] text-muted">{i}</span>
            </div>
          );
        })}
      </div>

      <div class="mt-3 flex items-center gap-3 text-sm">
        <span class="rounded-md px-3 py-1 font-mono font-bold text-white" style={`background:${COLORS.answer}`}>distinct = {f.distinct}</span>
        <span class="font-mono text-muted">window [{f.curL}, {f.curR}]</span>
      </div>

      <div class="mt-3 flex flex-wrap gap-1.5">
        {order.map((q) => (
          <span key={q.idx} class={`rounded-md border px-2 py-1 font-mono text-xs transition ${answered.has(q.idx) ? 'border-transparent text-white' : 'border-border bg-surface-2 text-muted'} ${f.qIndex === q.idx ? 'scale-110' : ''}`} style={answered.has(q.idx) ? `background:${COLORS.answer}` : ''}>Q{q.idx}[{q.l},{q.r}]</span>
        ))}
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
      <p class="mt-2 text-center text-xs text-muted">Tip: watch how little the window slides between neighbouring queries — that saved travel is the whole point of the reordering.</p>
    </div>
  );
}
