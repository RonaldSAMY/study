import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Sum-over-Subsets DP — fill subset sums one bit at a time.
   - Edit f, indexed by bitmask (length must be a power of two: 4, 8, 16).
   - For each bit i in turn, every mask that HAS bit i absorbs the value
     of the same mask with bit i removed:  dp[mask] += dp[mask ^ (1<<i)].
     After n passes, dp[mask] = sum of f over all subsets of mask.
   - The active mask is indigo; the source it reads (mask without bit i)
     is sky. A live caption narrates each O(n·2^n) update.
   - Transport: Play / Pause / Step / Back / Reset + speed.
   ------------------------------------------------------------------ */

const COLORS = { active: '#4f46e5', src: '#0ea5e9', done: '#10b981' };

type Frame = { bit: number; mask: number; src: number; before: number; add: number; after: number; state: number[] };

function parseVals(s: string): number[] | null {
  const v = s.split(',').map((x) => parseInt(x.trim(), 10)).filter((x) => Number.isFinite(x));
  const ok = v.length >= 2 && (v.length & (v.length - 1)) === 0 && v.length <= 16;
  return ok ? v : null;
}

export default function DpOptSos() {
  const [text, setText] = useState('1, 2, 4, 8, 16, 32, 64, 128');
  const [vals, setVals] = useState<number[]>(() => parseVals('1, 2, 4, 8, 16, 32, 64, 128')!);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1.5);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);
  idxRef.current = idx;

  const n = Math.round(Math.log2(vals.length));
  const size = vals.length;

  const frames = (() => {
    const dp = [...vals];
    const fr: Frame[] = [{ bit: -1, mask: -1, src: -1, before: 0, add: 0, after: 0, state: [...dp] }];
    for (let i = 0; i < n; i++) {
      for (let mask = 0; mask < size; mask++) {
        if (mask & (1 << i)) {
          const src = mask ^ (1 << i);
          const before = dp[mask], add = dp[src];
          dp[mask] = before + add;
          fr.push({ bit: i, mask, src, before, add, after: dp[mask], state: [...dp] });
        }
      }
    }
    return fr;
  })();

  const total = frames.length;
  const cur = frames[Math.min(idx, total - 1)];
  const state = cur.state;

  const commit = () => { const p = parseVals(text); if (p) { setVals(p); setIdx(0); setPlaying(false); } };
  const bin = (m: number) => m.toString(2).padStart(n, '0');

  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 700 / speed;
    const tick = (t: number) => {
      if (!lastRef.current) lastRef.current = t;
      if (t - lastRef.current >= interval) {
        lastRef.current = t;
        const next = idxRef.current + 1;
        if (next >= total) { setIdx(total - 1); setPlaying(false); return; }
        setIdx(next);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
  }, [playing, speed, total]);

  const reset = () => { setPlaying(false); setIdx(0); lastRef.current = 0; };
  const stepF = () => { setPlaying(false); setIdx((v) => Math.min(total - 1, v + 1)); };
  const stepB = () => { setPlaying(false); setIdx((v) => Math.max(0, v - 1)); };
  const play = () => { if (idx >= total - 1) setIdx(0); lastRef.current = 0; setPlaying((p) => !p); };

  const done = idx >= total - 1;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <input value={text} onInput={(e) => setText((e.target as HTMLInputElement).value)} class="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm" placeholder="power-of-two many values" />
        <button onClick={commit} class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Load</button>
      </div>

      <div class="mb-2 text-xs font-semibold uppercase tracking-wide" style={`color:${cur.bit >= 0 ? COLORS.active : COLORS.done}`}>
        {cur.bit >= 0 ? `Pass over bit ${cur.bit}` : 'Initial: dp = f'}
      </div>

      <div class="grid grid-cols-1 gap-1 font-mono text-sm sm:grid-cols-2">
        {state.map((v, mask) => {
          const isActive = mask === cur.mask;
          const isSrc = mask === cur.src;
          const bitSet = cur.bit >= 0 && (mask & (1 << cur.bit));
          return (
            <div key={mask} class={`flex items-center gap-2 rounded-md border px-2 py-1.5 transition ${isActive ? 'border-transparent text-white' : isSrc ? 'border-transparent text-white' : 'border-border bg-surface-2 text-text'}`} style={isActive ? `background:${COLORS.active}` : isSrc ? `background:${COLORS.src}` : ''}>
              <span class="opacity-70">F[</span>
              <span>{bin(mask).split('').map((ch, bi) => (
                <span key={bi} class={cur.bit >= 0 && (n - 1 - bi) === cur.bit ? 'underline decoration-2 underline-offset-2' : ''}>{ch}</span>
              ))}</span>
              <span class="opacity-70">]</span>
              <span class="ml-auto font-bold">{v}</span>
              {isActive && <span class="text-xs opacity-90">= {cur.before}+{cur.add}</span>}
            </div>
          );
        })}
      </div>

      <p class="mt-3 min-h-[2.5rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">
        {cur.bit >= 0
          ? `bit ${cur.bit}: F[${bin(cur.mask)}] += F[${bin(cur.src)}]  →  ${cur.before} + ${cur.add} = ${cur.after}. (folds in subsets that lack bit ${cur.bit}.)`
          : 'dp starts as a copy of f. Press Play to sweep bit by bit.'}
      </p>
      {done && <p class="mt-2 rounded-lg bg-brand-soft px-3 py-2 text-sm font-semibold text-text">Done in {n} passes. Now F[mask] = sum of f over every subset of mask — that took {total - 1} updates instead of the naive 3^n = {Math.pow(3, n)}.</p>}

      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={stepB} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏮ Back</button>
        <button onClick={play} class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90">{playing ? '⏸ Pause' : '▶ Play'}</button>
        <button onClick={stepF} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏭ Step</button>
        <button onClick={reset} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">↺ Reset</button>
        <span class="ml-auto font-mono text-xs text-muted">{Math.min(idx + 1, total)}/{total}</span>
        <label class="flex items-center gap-2 text-xs text-muted">speed
          <input type="range" min={0.5} max={3} step={0.5} value={speed} onInput={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))} class="w-20 accent-[#4f46e5]" />
        </label>
      </div>
      <p class="mt-2 text-center text-xs text-muted"><span style={`color:${COLORS.active}`}>■</span> mask being updated &nbsp; <span style={`color:${COLORS.src}`}>■</span> source (mask with bit {cur.bit >= 0 ? cur.bit : 'i'} cleared). The underlined bit is the active one.</p>
    </div>
  );
}
