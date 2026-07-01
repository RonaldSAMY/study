import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated Manacher's algorithm.
   - Edit the string. It is transformed to "#a#b#a#" so EVERY palindrome
     has odd length. The demo sweeps a center i and records P[i], the
     palindromic radius, reusing the mirror inside the current [C,R] span.
   - Each frame highlights the center, the palindrome span, the mirror
     position, and the [C,R] window, with a caption.
   - Transport: Play / Pause / Step / Back / Reset + speed.
   ------------------------------------------------------------------ */

const COLORS = { cur: '#0ea5e9', span: '#10b981', mirror: '#4f46e5' };

type Frame = { i: number; C: number; R: number; mirror: number; p: number[]; radius: number; usedMirror: boolean; note: string };

function computeFrames(s: string): { t: string; frames: Frame[] } {
  const t = '#' + s.split('').join('#') + '#';
  const n = t.length;
  const p = new Array(n).fill(0);
  const frames: Frame[] = [];
  let C = 0, R = 0;
  for (let i = 0; i < n; i++) {
    const mirror = 2 * C - i;
    let note = '';
    let usedMirror = false;
    if (i < R) { p[i] = Math.min(R - i, p[mirror]); usedMirror = true; note = `i is inside [C=${C}, R=${R}] — copy from mirror ${mirror}: P[i] = min(R-i=${R - i}, P[mirror]=${p[mirror]}).`; }
    else note = 'i is at or past the right edge R — start a fresh expansion.';
    let expanded = 0;
    while (i - 1 - p[i] >= 0 && i + 1 + p[i] < n && t[i + 1 + p[i]] === t[i - 1 - p[i]]) { p[i]++; expanded++; }
    if (expanded > 0) note += ` Expanded by ${expanded}.`;
    if (i + p[i] > R) { C = i; R = i + p[i]; note += ` Widest so far — move center to ${i}, R to ${R}.`; }
    frames.push({ i, C, R, mirror, p: [...p], radius: p[i], usedMirror, note });
  }
  return { t, frames };
}

const clean = (s: string) => s.replace(/[^a-zA-Z]/g, '').slice(0, 15).toLowerCase();

export default function SAlgManacher() {
  const [text, setText] = useState('abacaba');
  const [s, setS] = useState('abacaba');
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);
  idxRef.current = idx;

  const { t, frames } = computeFrames(s);
  const commit = () => { const c = clean(text); if (c.length) { setS(c); setIdx(0); setPlaying(false); } };

  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 950 / speed;
    const tick = (ts: number) => {
      if (!lastRef.current) lastRef.current = ts;
      if (ts - lastRef.current >= interval) {
        lastRef.current = ts;
        const next = idxRef.current + 1;
        if (next >= frames.length) { setIdx(frames.length - 1); setPlaying(false); return; }
        setIdx(next);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
  }, [playing, speed, s]);

  const reset = () => { setPlaying(false); setIdx(0); lastRef.current = 0; };
  const stepF = () => { setPlaying(false); setIdx((v) => Math.min(frames.length - 1, v + 1)); };
  const stepB = () => { setPlaying(false); setIdx((v) => Math.max(0, v - 1)); };
  const play = () => { if (idx >= frames.length - 1) setIdx(0); lastRef.current = 0; setPlaying((p) => !p); };

  const f = frames[Math.min(idx, frames.length - 1)];
  const done = idx >= frames.length - 1;

  // best palindrome across all frames seen so far
  let best = { radius: 0, center: 0 };
  for (let k = 0; k <= idx && k < frames.length; k++) { const fr = frames[k]; if (fr.radius > best.radius) best = { radius: fr.radius, center: fr.i }; }
  const bestStart = Math.floor((best.center - best.radius) / 2);
  const bestStr = s.slice(bestStart, bestStart + best.radius);

  const L = 2 * f.C - f.R;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <input value={text} onInput={(e) => setText((e.target as HTMLInputElement).value)} class="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm" placeholder="letters only" />
        <button onClick={commit} class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Load</button>
      </div>

      <div class="overflow-x-auto">
        <div class="flex gap-1 font-mono text-sm">
          {t.split('').map((ch, j) => {
            const inSpan = j >= f.i - f.radius && j <= f.i + f.radius && f.radius > 0;
            const isCenter = j === f.i;
            const isMirror = f.usedMirror && j === f.mirror;
            const inBox = j >= Math.max(0, L) && j <= f.R && f.R > 0;
            const bg = isCenter ? COLORS.cur : isMirror ? COLORS.mirror : inSpan ? COLORS.span : '';
            const sep = ch === '#';
            return <div key={j} class={`flex h-9 w-7 shrink-0 items-center justify-center rounded-md border text-sm font-bold ${bg ? 'border-transparent text-white' : sep ? 'border-border bg-surface-2 text-muted' : 'border-border bg-surface text-text'} ${inBox ? 'ring-1 ring-offset-1' : ''}`} style={`${bg ? `background:${bg};` : ''}${inBox ? `--tw-ring-color:${COLORS.mirror}` : ''}`}>{ch}</div>;
          })}
        </div>
        <div class="mt-1 flex gap-1 font-mono text-[10px] text-muted">
          {f.p.map((v, j) => <div key={j} class={`w-7 shrink-0 text-center ${j === f.i ? 'font-bold text-text' : ''}`}>{v}</div>)}
        </div>
      </div>

      <p class="mt-3 min-h-[2.75rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">{f.note}</p>
      <p class="mt-2 rounded-lg bg-brand-soft px-3 py-2 text-sm text-text">Longest palindrome so far: <span class="font-mono font-bold">"{bestStr}"</span> (radius {best.radius}). {done ? 'The maximum P value gives the answer.' : ''}</p>

      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={stepB} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏮ Back</button>
        <button onClick={play} class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90">{playing ? '⏸ Pause' : '▶ Play'}</button>
        <button onClick={stepF} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏭ Step</button>
        <button onClick={reset} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">↺ Reset</button>
        <label class="ml-auto flex items-center gap-2 text-xs text-muted">speed
          <input type="range" min={0.5} max={3} step={0.5} value={speed} onInput={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))} class="w-24 accent-[#4f46e5]" />
        </label>
      </div>
      <p class="mt-2 text-center text-xs text-muted">Sky = center, emerald = palindrome span, indigo = mirror. The '#' separators make every palindrome odd-length.</p>
    </div>
  );
}
