import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated "single number" via XOR.
   - Edit the array (comma-separated). The demo folds it left to right
     with an accumulator: acc ^= nums[i]. Equal numbers cancel (a^a=0),
     so the lone unpaired value survives.
   - Each step highlights the number being XOR-ed and shows the running
     accumulator in binary, with a caption.
   - Transport: Play / Pause / Step / Step-back / Reset + speed.
   ------------------------------------------------------------------ */

const WIDTH = 6; // values 0..63
const COLORS = { acc: '#10b981', cur: '#0ea5e9' };

const toBits = (n: number): number[] => { const o: number[] = []; for (let p = WIDTH - 1; p >= 0; p--) o.push((n >> p) & 1); return o; };
const parseList = (s: string): number[] => s.split(',').map((x) => parseInt(x.trim(), 10)).filter((x) => Number.isFinite(x) && x >= 0 && x < (1 << WIDTH));

export default function XorSingleNumber() {
  const [text, setText] = useState('4, 1, 2, 1, 2');
  const [nums, setNums] = useState<number[]>(() => parseList('4, 1, 2, 1, 2'));
  const [idx, setIdx] = useState(0); // 0..nums.length
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);
  idxRef.current = idx;

  // prefix XOR accumulators: acc[0]=0, acc[k]=nums[0]^...^nums[k-1]
  const acc: number[] = (() => { const a = [0]; for (let i = 0; i < nums.length; i++) a.push(a[i] ^ nums[i]); return a; })();

  const commit = () => { const parsed = parseList(text); if (parsed.length) { setNums(parsed); setIdx(0); setPlaying(false); } };

  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 820 / speed;
    const tick = (t: number) => {
      if (!lastRef.current) lastRef.current = t;
      if (t - lastRef.current >= interval) {
        lastRef.current = t;
        const next = idxRef.current + 1;
        if (next >= nums.length + 1) { setIdx(nums.length); setPlaying(false); return; }
        setIdx(next);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
  }, [playing, speed, nums]);

  const reset = () => { setPlaying(false); setIdx(0); lastRef.current = 0; };
  const stepF = () => { setPlaying(false); setIdx((v) => Math.min(nums.length, v + 1)); };
  const stepB = () => { setPlaying(false); setIdx((v) => Math.max(0, v - 1)); };
  const play = () => { if (idx >= nums.length) setIdx(0); lastRef.current = 0; setPlaying((p) => !p); };

  const accVal = acc[idx];
  const done = idx >= nums.length;
  const curIndex = idx - 1; // the number just folded in
  const caption = idx === 0
    ? 'acc starts at 0. Press Play to XOR each number into it.'
    : `acc ${acc[idx - 1].toString(2).padStart(WIDTH, '0')} XOR ${nums[idx - 1].toString(2).padStart(WIDTH, '0')} (=${nums[idx - 1]})  ->  ${accVal.toString(2).padStart(WIDTH, '0')} (=${accVal})`;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <input value={text} onInput={(e) => setText((e.target as HTMLInputElement).value)} class="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm" placeholder="comma-separated numbers" />
        <button onClick={commit} class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Load</button>
      </div>

      {/* numbers row */}
      <div class="flex flex-wrap gap-1.5 font-mono text-sm">
        {nums.map((x, i) => (
          <span key={i} class={`rounded-md border px-2.5 py-1.5 transition ${i === curIndex ? 'scale-110 border-transparent text-white' : i < curIndex ? 'border-border bg-surface-2 text-muted line-through' : 'border-border bg-surface-2 text-text'}`} style={i === curIndex ? `background:${COLORS.cur}` : ''}>{x}</span>
        ))}
      </div>

      {/* accumulator bit cells */}
      <div class="mt-3 flex items-center gap-2 font-mono text-sm">
        <span class="w-8 shrink-0 font-bold" style={`color:${COLORS.acc}`}>acc</span>
        <div class="flex gap-1">
          {toBits(accVal).map((bit, i) => (
            <div key={i} class={`flex h-9 w-9 items-center justify-center rounded-md border text-base font-bold ${bit ? 'border-transparent text-white' : 'border-border bg-surface-2 text-muted'}`} style={bit ? `background:${COLORS.acc}` : ''}>{bit}</div>
          ))}
        </div>
        <span class="ml-2 text-muted">= {accVal}</span>
      </div>

      <p class="mt-3 min-h-[2.5rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">{caption}</p>
      {done && nums.length > 0 && <p class="mt-2 rounded-lg bg-brand-soft px-3 py-2 text-sm font-semibold text-text">All pairs cancelled to 0 — the survivor is {accVal}. Order never mattered: XOR is commutative and associative.</p>}

      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={stepB} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏮ Back</button>
        <button onClick={play} class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90">{playing ? '⏸ Pause' : '▶ Play'}</button>
        <button onClick={stepF} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏭ Step</button>
        <button onClick={reset} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">↺ Reset</button>
        <label class="ml-auto flex items-center gap-2 text-xs text-muted">speed
          <input type="range" min={0.5} max={3} step={0.5} value={speed} onInput={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))} class="w-24 accent-[#4f46e5]" />
        </label>
      </div>
      <p class="mt-2 text-center text-xs text-muted">Tip: every number must be 0–63. Make all values appear an even number of times except one to see the trick.</p>
    </div>
  );
}
