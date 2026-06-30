import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated Brian Kernighan popcount.
   - Type a number n (0-255, toggleable bit cells). The demo repeatedly
     applies n = n & (n - 1), which CLEARS THE LOWEST SET BIT each time,
     so it loops exactly once per 1-bit.
   - Each step highlights the bit about to vanish and bumps a counter.
   - Transport: Play / Pause / Step / Step-back / Reset + speed.
   ------------------------------------------------------------------ */

const WIDTH = 8;
const COLORS = { n: '#4f46e5', cleared: '#10b981' };

const toBits = (n: number): number[] => {
  const out: number[] = [];
  for (let p = WIDTH - 1; p >= 0; p--) out.push((n >> p) & 1);
  return out;
};
const val = (bits: number[]): number => bits.reduce((a, b, i) => a | (b << (WIDTH - 1 - i)), 0);
const lowestSetPos = (n: number): number => { for (let p = 0; p < WIDTH; p++) if ((n >> p) & 1) return p; return -1; };
const posToIdx = (p: number) => WIDTH - 1 - p;

export default function BitCountKernighan() {
  const [nBits, setNBits] = useState<number[]>(toBits(0b10110)); // 22 -> 3 ones
  const n0 = val(nBits);

  // precompute the chain of values: n, n&(n-1), ... , 0
  const [chain, setChain] = useState<number[]>(() => buildChain(n0));
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);
  idxRef.current = idx;

  useEffect(() => { setChain(buildChain(n0)); setIdx(0); setPlaying(false); }, [n0]);

  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const steps = chain.length - 1;
    const interval = 820 / speed;
    const tick = (t: number) => {
      if (!lastRef.current) lastRef.current = t;
      if (t - lastRef.current >= interval) {
        lastRef.current = t;
        const next = idxRef.current + 1;
        if (next >= steps + 1) { setIdx(steps); setPlaying(false); return; }
        setIdx(next);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
  }, [playing, speed, chain]);

  const steps = chain.length - 1; // number of set bits
  const reset = () => { setPlaying(false); setIdx(0); lastRef.current = 0; };
  const stepF = () => { setPlaying(false); setIdx((v) => Math.min(steps, v + 1)); };
  const stepB = () => { setPlaying(false); setIdx((v) => Math.max(0, v - 1)); };
  const play = () => { if (idx >= steps) setIdx(0); lastRef.current = 0; setPlaying((p) => !p); };
  const flip = (k: number) => { const c = [...nBits]; c[k] ^= 1; setNBits(c); };

  const current = chain[idx];
  const bits = toBits(current);
  // the bit highlighted is the one about to be cleared on the NEXT step
  const aboutToClear = idx < steps ? lowestSetPos(current) : -1;
  const count = idx;
  const done = idx >= steps;
  const caption = idx === 0
    ? (steps === 0 ? 'n is already 0 — no set bits to clear.' : 'Press Play. Each step clears the lowest 1-bit via n & (n-1).')
    : `n & (n-1) cleared bit ${lowestSetPos(chain[idx - 1])}  ->  n = ${current} (${current.toString(2).padStart(WIDTH, '0')}),  count = ${count}`;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="space-y-2 font-mono text-sm">
        <div class="flex items-center gap-2">
          <span class="w-5 shrink-0 font-bold" style={`color:${COLORS.n}`}>n</span>
          <div class="flex gap-1">
            {bits.map((bit, i) => {
              const active = i === posToIdx(aboutToClear);
              const filled = bit === 1;
              return (
                <button key={i} onClick={() => flip(i)}
                  class={`flex h-9 w-9 items-center justify-center rounded-md border text-base font-bold transition cursor-pointer hover:brightness-110 ${filled ? 'border-transparent text-white' : 'border-border bg-surface-2 text-muted'} ${active ? 'ring-2 ring-offset-1 ring-[#10b981] scale-110' : ''}`}
                  style={filled ? `background:${active ? COLORS.cleared : COLORS.n}` : ''}>{bit}</button>
              );
            })}
          </div>
        </div>
      </div>

      <p class="mt-3 min-h-[2.5rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">{caption}</p>
      {done && <p class="mt-2 rounded-lg bg-brand-soft px-3 py-2 text-sm font-semibold text-text">Finished in {steps} step{steps === 1 ? '' : 's'} — {n0} has {steps} set bit{steps === 1 ? '' : 's'}. The loop ran once per 1-bit, not once per bit.</p>}

      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={stepB} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏮ Back</button>
        <button onClick={play} class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90">{playing ? '⏸ Pause' : '▶ Play'}</button>
        <button onClick={stepF} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏭ Step</button>
        <button onClick={reset} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">↺ Reset</button>
        <label class="ml-auto flex items-center gap-2 text-xs text-muted">speed
          <input type="range" min={0.5} max={3} step={0.5} value={speed} onInput={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))} class="w-24 accent-[#4f46e5]" />
        </label>
      </div>

      <div class="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
        <Readout label="start n" value={`${n0}`} />
        <Readout label="set bits so far" value={`${count}`} />
        <Readout label="current n" value={`${current}`} />
      </div>
      <p class="mt-2 text-center text-xs text-muted">Tip: click a bit to change n. More 1-bits = more steps; the leading zeros are skipped entirely.</p>
    </div>
  );
}

function buildChain(n: number): number[] {
  const out = [n];
  let x = n;
  let guard = 0;
  while (x > 0 && guard < 64) { x = x & (x - 1); out.push(x); guard++; }
  return out;
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div class="rounded-lg bg-surface-2 px-2 py-2">
      <div class="text-xs text-muted">{label}</div>
      <div class="font-mono font-semibold">{value}</div>
    </div>
  );
}
