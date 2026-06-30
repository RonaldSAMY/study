import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated palindrome check with two pointers.
   - Edit a string (optionally fold case + drop non-letters to test
     phrases like "A man a plan a canal Panama"). Two pointers compare
     from both ends inward; the first mismatch proves it is NOT a
     palindrome, otherwise the pointers cross and it IS one.
   - Each frame is a precomputed comparison snapshot, so stepping is exact.
   - Transport: Play / Pause / Step / Step-back / Reset + speed.
   ------------------------------------------------------------------ */

const COLORS = { match: '#10b981', mismatch: '#ef4444', active: '#0ea5e9' };

type Frame = { l: number; r: number; kind: 'compare' | 'ok-pal' | 'bad-pal'; a: string; b: string };

function buildFrames(chars: string[]): Frame[] {
  const frames: Frame[] = [];
  let l = 0;
  let r = chars.length - 1;
  while (l < r) {
    const a = chars[l];
    const b = chars[r];
    if (a !== b) {
      frames.push({ l, r, kind: 'bad-pal', a, b });
      return frames;
    }
    frames.push({ l, r, kind: 'compare', a, b });
    l++;
    r--;
  }
  frames.push({ l, r, kind: 'ok-pal', a: chars[l] ?? '', b: chars[r] ?? '' });
  return frames;
}

export default function StrPalindromeCheck() {
  const [text, setText] = useState('racecar');
  const [clean, setClean] = useState(false);
  const normalize = (s: string) => (clean ? [...s.toLowerCase().replace(/[^a-z0-9]/g, '')] : [...s]).slice(0, 18);
  const [chars, setChars] = useState<string[]>(() => [...'racecar']);
  const [frames, setFrames] = useState<Frame[]>(() => buildFrames([...'racecar']));
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);
  idxRef.current = idx;

  const commit = () => {
    const next = normalize(text);
    if (next.length) { setChars(next); setFrames(buildFrames(next)); setIdx(0); setPlaying(false); }
  };

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

  const f = frames[idx];
  const finished = f.kind !== 'compare';
  const isPal = f.kind === 'ok-pal';
  const caption = f.kind === 'bad-pal'
    ? `Mismatch! position ${f.l} ('${f.a}') ≠ position ${f.r} ('${f.b}'). Not a palindrome — we can stop immediately.`
    : f.kind === 'ok-pal'
      ? 'Pointers crossed with every pair equal — it reads the same backward. Palindrome confirmed.'
      : `Compare position ${f.l} ('${f.a}') with position ${f.r} ('${f.b}') → equal, step inward.`;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <input value={text} onInput={(e) => setText((e.target as HTMLInputElement).value)} class="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm" placeholder="type a word or phrase" />
        <button onClick={commit} class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Load</button>
        <label class="flex items-center gap-1.5 text-xs text-muted"><input type="checkbox" checked={clean} onInput={(e) => setClean((e.target as HTMLInputElement).checked)} class="h-4 w-4 accent-[#4f46e5]" />fold case + drop punctuation</label>
      </div>

      <div class="flex flex-wrap gap-1.5 font-mono text-sm">
        {chars.map((c, i) => {
          const active = i === f.l || i === f.r;
          const settled = !finished ? (i < f.l || i > f.r) : false;
          const bg = active ? (f.kind === 'bad-pal' ? COLORS.mismatch : f.kind === 'ok-pal' ? COLORS.match : COLORS.active) : '';
          return (
            <div key={i} class="flex flex-col items-center">
              <span class={`flex h-10 w-10 items-center justify-center rounded-md border text-base font-bold transition ${active ? 'scale-110 border-transparent text-white' : 'border-border bg-surface-2 text-text'}`} style={`${bg ? `background:${bg};` : ''}${settled ? `border-color:${COLORS.match};` : ''}`}>{c === ' ' ? '␣' : c}</span>
              <span class="mt-1 text-[10px] text-muted">{i === f.l ? 'L' : i === f.r ? 'R' : i}</span>
            </div>
          );
        })}
      </div>

      <p class="mt-3 min-h-[2.5rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">{caption}</p>
      {finished && (
        <p class="mt-2 rounded-lg px-3 py-2 text-sm font-semibold text-text" style={`background:${isPal ? 'rgba(16,185,129,.15)' : 'rgba(239,68,68,.15)'}`}>
          {isPal ? `✓ "${chars.join('')}" is a palindrome.` : `✗ "${chars.join('')}" is not a palindrome.`}
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
      <p class="mt-2 text-center text-xs text-muted">Try "abba", "racecar", or a phrase like "A man a plan a canal Panama" with cleaning on.</p>
    </div>
  );
}
