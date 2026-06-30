import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated bitmask subset explorer.
   - Define a small set of elements (up to 5). The demo counts an integer
     mask from 0 to 2^n - 1; each mask IS a subset (bit i set => element i
     is in). This is exactly the state a bitmask-DP loops over.
   - The current mask is drawn as bit cells with the chosen elements; a
     grid of all 2^n masks fills in as we go, and a caption reads the
     subset off the bits.
   - Transport: Play / Pause / Step / Step-back / Reset + speed.
   ------------------------------------------------------------------ */

const COLORS = { on: '#4f46e5', visited: '#10b981', head: '#0ea5e9' };

const parseEls = (s: string): string[] => s.split(',').map((x) => x.trim()).filter(Boolean).slice(0, 5);
const subsetOf = (mask: number, els: string[]): string[] => els.filter((_, i) => (mask >> i) & 1);

export default function BitmaskSubsetExplorer() {
  const [text, setText] = useState('A, B, C');
  const [els, setEls] = useState<string[]>(() => parseEls('A, B, C'));
  const n = els.length;
  const total = 1 << n; // number of masks
  const [idx, setIdx] = useState(0); // current mask 0..total-1
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);
  idxRef.current = idx;

  const commit = () => { const e = parseEls(text); if (e.length) { setEls(e); setIdx(0); setPlaying(false); } };

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

  const mask = idx;
  const subset = subsetOf(mask, els);
  const subsetStr = subset.length ? `{ ${subset.join(', ')} }` : '{ } (empty set)';
  const caption = `mask ${mask} = ${mask.toString(2).padStart(n, '0')}  ->  ${subsetStr}`;
  const done = idx >= total - 1;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <input value={text} onInput={(e) => setText((e.target as HTMLInputElement).value)} class="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm" placeholder="up to 5 elements, comma-separated" />
        <button onClick={commit} class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Load</button>
      </div>

      {/* current mask as labeled bit cells (MSB element n-1 .. LSB element 0) */}
      <div class="flex items-center gap-2 font-mono text-sm">
        <span class="w-12 shrink-0 font-bold" style={`color:${COLORS.on}`}>mask</span>
        <div class="flex gap-1">
          {Array.from({ length: n }, (_, k) => n - 1 - k).map((bitpos) => {
            const on = (mask >> bitpos) & 1;
            return (
              <div key={bitpos} class="flex flex-col items-center gap-1">
                <div class={`flex h-9 w-9 items-center justify-center rounded-md border text-base font-bold ${on ? 'border-transparent text-white' : 'border-border bg-surface-2 text-muted'}`} style={on ? `background:${COLORS.on}` : ''}>{on}</div>
                <span class="text-[10px] text-muted">{els[bitpos]}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* grid of all masks, filling in as we count */}
      <div class="mt-4 flex flex-wrap gap-1">
        {Array.from({ length: total }, (_, m) => (
          <div key={m} title={subsetOf(m, els).join('') || '∅'}
            class={`flex h-7 min-w-[1.75rem] items-center justify-center rounded border px-1 font-mono text-[11px] transition ${m === idx ? 'border-transparent text-white scale-110' : m < idx ? 'border-transparent text-white' : 'border-border bg-surface-2 text-muted'}`}
            style={m === idx ? `background:${COLORS.head}` : m < idx ? `background:${COLORS.visited}` : ''}>
            {m.toString(2).padStart(n, '0')}
          </div>
        ))}
      </div>

      <p class="mt-3 min-h-[2.5rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">{caption}</p>
      {done && <p class="mt-2 rounded-lg bg-brand-soft px-3 py-2 text-sm font-semibold text-text">Counting 0…{total - 1} enumerated all {total} = 2^{n} subsets exactly once. A DP table indexed by these masks remembers an answer per subset.</p>}

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
        <Readout label="elements n" value={`${n}`} />
        <Readout label="subsets 2ⁿ" value={`${total}`} />
        <Readout label="current subset" value={subset.length ? subset.join('') : '∅'} />
      </div>
    </div>
  );
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div class="rounded-lg bg-surface-2 px-2 py-2">
      <div class="text-xs text-muted">{label}</div>
      <div class="font-mono font-semibold">{value}</div>
    </div>
  );
}
