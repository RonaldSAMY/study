import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated "anatomy of a string".
   - Edit a string. The demo walks it left to right, one character at a
     time, revealing each char's INDEX and UTF-16 code unit, and building
     a running character-frequency tally underneath.
   - The first character whose final tally is 1 is the "first unique"
     character — highlighted at the end (LeetCode 387).
   - Transport: Play / Pause / Step / Step-back / Reset + speed.
   Helpers live INSIDE the island; raf is cancelled on unmount/pause.
   ------------------------------------------------------------------ */

const COLORS = { cur: '#0ea5e9', tally: '#4f46e5', unique: '#10b981' };

export default function StrCharAnatomy() {
  const [text, setText] = useState('letter');
  const [chars, setChars] = useState<string[]>(() => [...'letter']);
  const [idx, setIdx] = useState(0); // 0..chars.length
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);
  idxRef.current = idx;

  // Frequency tally over the first `idx` characters (built incrementally).
  const tallyAt = (k: number): Map<string, number> => {
    const m = new Map<string, number>();
    for (let i = 0; i < k; i++) m.set(chars[i], (m.get(chars[i]) || 0) + 1);
    return m;
  };
  const fullTally = tallyAt(chars.length);
  const firstUniqueIndex = chars.findIndex((c) => fullTally.get(c) === 1);

  const commit = () => {
    const next = [...text].slice(0, 14);
    if (next.length) { setChars(next); setIdx(0); setPlaying(false); }
  };

  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 760 / speed;
    const tick = (t: number) => {
      if (!lastRef.current) lastRef.current = t;
      if (t - lastRef.current >= interval) {
        lastRef.current = t;
        const next = idxRef.current + 1;
        if (next >= chars.length + 1) { setIdx(chars.length); setPlaying(false); return; }
        setIdx(next);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
  }, [playing, speed, chars]);

  const reset = () => { setPlaying(false); setIdx(0); lastRef.current = 0; };
  const stepF = () => { setPlaying(false); setIdx((v) => Math.min(chars.length, v + 1)); };
  const stepB = () => { setPlaying(false); setIdx((v) => Math.max(0, v - 1)); };
  const play = () => { if (idx >= chars.length) setIdx(0); lastRef.current = 0; setPlaying((p) => !p); };

  const curIndex = idx - 1; // char just visited
  const tally = tallyAt(idx);
  const done = idx >= chars.length;
  const curChar = curIndex >= 0 ? chars[curIndex] : null;
  const caption = idx === 0
    ? 'Strings are indexed from 0. Press Play to walk each character and tally how often it appears.'
    : `index ${curIndex}: char '${curChar}' has code unit ${curChar!.charCodeAt(0)}. Its running count is now ${tally.get(curChar!)}.`;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <input value={text} onInput={(e) => setText((e.target as HTMLInputElement).value)} class="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm" placeholder="type a word (max 14 chars)" />
        <button onClick={commit} class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Load</button>
      </div>

      {/* character cells with their indices */}
      <div class="flex flex-wrap gap-1.5 font-mono text-sm">
        {chars.map((c, i) => (
          <div key={i} class="flex flex-col items-center">
            <span class={`flex h-10 w-10 items-center justify-center rounded-md border text-base font-bold transition ${i === curIndex ? 'scale-110 border-transparent text-white' : i < curIndex ? 'border-border bg-surface-2 text-muted' : 'border-border bg-surface-2 text-text'} ${done && i === firstUniqueIndex ? 'ring-2 ring-offset-1' : ''}`} style={`${i === curIndex ? `background:${COLORS.cur};` : ''}${done && i === firstUniqueIndex ? `box-shadow:0 0 0 2px ${COLORS.unique};` : ''}`}>{c === ' ' ? '␣' : c}</span>
            <span class="mt-1 text-[10px] text-muted">{i}</span>
          </div>
        ))}
      </div>

      {/* frequency tally */}
      <div class="mt-4 text-xs font-semibold uppercase tracking-wide text-muted">Frequency so far</div>
      <div class="mt-1.5 flex flex-wrap gap-1.5 font-mono text-sm">
        {[...tally.entries()].length === 0 && <span class="text-muted">(empty)</span>}
        {[...tally.entries()].map(([c, n]) => (
          <span key={c} class="rounded-md border border-border px-2 py-1" style={c === curChar ? `border-color:${COLORS.tally};color:${COLORS.tally};font-weight:700` : ''}>{c === ' ' ? '␣' : c}:{n}</span>
        ))}
      </div>

      <p class="mt-3 min-h-[2.5rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">{caption}</p>
      {done && chars.length > 0 && (
        <p class="mt-2 rounded-lg bg-brand-soft px-3 py-2 text-sm font-semibold text-text">
          {firstUniqueIndex >= 0
            ? `First non-repeating character: '${chars[firstUniqueIndex]}' at index ${firstUniqueIndex} (its final count is 1).`
            : 'Every character repeats — there is no non-repeating character.'}
        </p>
      )}

      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={stepB} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏮ Back</button>
        <button onClick={play} class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90">{playing ? '⏸ Pause' : '▶ Play'}</button>
        <button onClick={stepF} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏭ Step</button>
        <button onClick={reset} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">↺ Reset</button>
        <label class="ml-auto flex items-center gap-2 text-xs text-muted">speed
          <input type="range" min={0.5} max={3} step={0.5} value={speed} onInput={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))} class="w-24 accent-[#4f46e5]" />
        </label>
      </div>
      <p class="mt-2 text-center text-xs text-muted">Each box is one character at a fixed index. One pass builds the whole frequency map.</p>
    </div>
  );
}
