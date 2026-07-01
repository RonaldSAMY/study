import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated Z-array construction with the [L, R] "Z-box".
   - Edit the string. The demo scans i = 1..n-1, filling Z[i] = the
     longest substring starting at i that matches a prefix of s.
   - Each frame highlights the current i, the active [L, R] window, and
     the prefix / match regions that are being compared, with a caption.
   - Transport: Play / Pause / Step / Back / Reset + speed.
   ------------------------------------------------------------------ */

const COLORS = { cur: '#0ea5e9', match: '#10b981', box: '#4f46e5' };

type Frame = { i: number; L: number; R: number; z: number[]; match: number; note: string };

function computeFrames(s: string): Frame[] {
  const n = s.length;
  const z = new Array(n).fill(0);
  const frames: Frame[] = [];
  frames.push({ i: 0, L: 0, R: 0, z: [...z], match: 0, note: 'Z[0] is the whole string by convention. Start scanning at i = 1.' });
  let L = 0, R = 0;
  for (let i = 1; i < n; i++) {
    let note = '';
    if (i > R) {
      L = R = i;
      while (R < n && s[R - L] === s[R]) R++;
      z[i] = R - L; R--;
      note = `i=${i} is past the Z-box — compare from scratch. Matched ${z[i]} char(s) against the prefix.`;
    } else {
      const k = i - L;
      if (z[k] < R - i + 1) {
        z[i] = z[k];
        note = `i=${i} is inside the Z-box [${L},${R}]; mirror Z[${k}]=${z[k]} fits, so copy it: Z[${i}]=${z[i]}.`;
      } else {
        L = i;
        while (R < n && s[R - L] === s[R]) R++;
        z[i] = R - L; R--;
        note = `i=${i} is inside the box but its mirror reaches the edge — extend past R to Z[${i}]=${z[i]}.`;
      }
    }
    frames.push({ i, L, R, z: [...z], match: z[i], note });
  }
  return frames;
}

const clean = (s: string) => s.replace(/\s+/g, '').slice(0, 22);

export default function SAlgZArray() {
  const [text, setText] = useState('aabxaabxcaabxaab');
  const [s, setS] = useState('aabxaabxcaabxaab');
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);
  idxRef.current = idx;

  const frames = computeFrames(s);
  const commit = () => { const c = clean(text); if (c.length) { setS(c); setIdx(0); setPlaying(false); } };

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
  }, [playing, speed, s]);

  const reset = () => { setPlaying(false); setIdx(0); lastRef.current = 0; };
  const stepF = () => { setPlaying(false); setIdx((v) => Math.min(frames.length - 1, v + 1)); };
  const stepB = () => { setPlaying(false); setIdx((v) => Math.max(0, v - 1)); };
  const play = () => { if (idx >= frames.length - 1) setIdx(0); lastRef.current = 0; setPlaying((p) => !p); };

  const f = frames[Math.min(idx, frames.length - 1)];
  const done = idx >= frames.length - 1;

  const cellClass = (j: number) => {
    const inMatch = f.i > 0 && j >= f.i && j < f.i + f.match;
    const inPrefix = f.i > 0 && j < f.match;
    if (inMatch || inPrefix) return 'match';
    if (j === f.i && f.i > 0) return 'cur';
    return 'plain';
  };

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <input value={text} onInput={(e) => setText((e.target as HTMLInputElement).value)} class="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm" placeholder="a string (letters only)" />
        <button onClick={commit} class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Load</button>
      </div>

      {/* index ruler */}
      <div class="flex flex-wrap gap-1 font-mono text-[10px] text-muted">
        {s.split('').map((_, j) => (
          <span key={j} class="w-8 text-center">{j}</span>
        ))}
      </div>
      {/* character row */}
      <div class="flex flex-wrap gap-1 font-mono text-sm">
        {s.split('').map((ch, j) => {
          const k = cellClass(j);
          const bg = k === 'match' ? COLORS.match : k === 'cur' ? COLORS.cur : '';
          const box = j >= f.L && j <= f.R && f.R > f.L;
          return (
            <div key={j} class={`flex h-9 w-8 items-center justify-center rounded-md border font-bold transition ${k === 'plain' ? 'border-border bg-surface-2 text-text' : 'border-transparent text-white'} ${box ? 'ring-2 ring-offset-1' : ''}`} style={`${bg ? `background:${bg};` : ''}${box ? `--tw-ring-color:${COLORS.box}` : ''}`}>{ch}</div>
          );
        })}
      </div>
      {/* Z values */}
      <div class="mt-2 flex flex-wrap gap-1 font-mono text-xs">
        {s.split('').map((_, j) => (
          <div key={j} class={`flex h-6 w-8 items-center justify-center rounded ${j === f.i ? 'bg-brand-soft font-bold text-text' : 'text-muted'}`}>{j === 0 ? '·' : f.z[j] || 0}</div>
        ))}
      </div>

      <p class="mt-3 min-h-[2.75rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">
        <span class="font-semibold" style={`color:${COLORS.box}`}>Z-box [{f.L},{f.R}]</span> · {f.note}
      </p>
      {done && <p class="mt-2 rounded-lg bg-brand-soft px-3 py-2 text-sm font-semibold text-text">Z-array complete: [{f.z.map((v, j) => (j === 0 ? '·' : v)).join(', ')}]. Any Z[i] equal to the pattern length marks a full match.</p>}

      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={stepB} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏮ Back</button>
        <button onClick={play} class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90">{playing ? '⏸ Pause' : '▶ Play'}</button>
        <button onClick={stepF} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏭ Step</button>
        <button onClick={reset} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">↺ Reset</button>
        <label class="ml-auto flex items-center gap-2 text-xs text-muted">speed
          <input type="range" min={0.5} max={3} step={0.5} value={speed} onInput={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))} class="w-24 accent-[#4f46e5]" />
        </label>
      </div>
      <p class="mt-2 text-center text-xs text-muted">Emerald = the prefix and the region at i that match it. The indigo ring is the current Z-box the algorithm reuses.</p>
    </div>
  );
}
