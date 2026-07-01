import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated Boyer-Moore search (bad-character heuristic).
   - Edit text + pattern. The pattern is aligned under the text and
     matched RIGHT-TO-LEFT. On a mismatch the bad-character rule slides
     the pattern forward, often skipping many positions at once.
   - Each frame highlights the matched tail (emerald), the mismatch
     (red), and reports the jump, with a caption.
   - Transport: Play / Pause / Step / Back / Reset + speed.
   ------------------------------------------------------------------ */

const COLORS = { ok: '#10b981', bad: '#e11d48', cur: '#0ea5e9' };

type Frame = { shift: number; j: number; matched: number; shiftBy: number; lastPos: number };

function computeFrames(text: string, pattern: string): Frame[] {
  const n = text.length, m = pattern.length;
  const frames: Frame[] = [];
  if (m === 0 || m > n) return frames;
  const badChar = new Map<string, number>();
  for (let i = 0; i < m; i++) badChar.set(pattern[i], i);

  let shift = 0;
  let guard = 0;
  while (shift <= n - m && guard++ < 400) {
    let j = m - 1;
    while (j >= 0 && pattern[j] === text[shift + j]) j--;
    if (j < 0) {
      frames.push({ shift, j: -1, matched: m, shiftBy: 1, lastPos: -1 });
      shift += 1;
    } else {
      const c = text[shift + j];
      const lastPos = badChar.has(c) ? badChar.get(c)! : -1;
      const bc = j - lastPos;
      const shiftBy = Math.max(1, bc);
      frames.push({ shift, j, matched: m - 1 - j, shiftBy, lastPos });
      shift += shiftBy;
    }
  }
  return frames;
}

const clean = (s: string) => s.replace(/\s+/g, '').slice(0, 26);

export default function SAlgBoyerMoore() {
  const [textIn, setTextIn] = useState('GCATCGCAGAGAGTATACAGT');
  const [patIn, setPatIn] = useState('GCAGAGAG');
  const [text, setText] = useState('GCATCGCAGAGAGTATACAGT');
  const [pattern, setPattern] = useState('GCAGAGAG');
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);
  idxRef.current = idx;

  const frames = computeFrames(text, pattern);
  const m = pattern.length;
  const commit = () => { const t = clean(textIn), p = clean(patIn); if (t.length && p.length && p.length <= t.length) { setText(t); setPattern(p); setIdx(0); setPlaying(false); } };

  useEffect(() => {
    if (!playing || frames.length === 0) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 1000 / speed;
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
  }, [playing, speed, text, pattern]);

  const reset = () => { setPlaying(false); setIdx(0); lastRef.current = 0; };
  const stepF = () => { setPlaying(false); setIdx((v) => Math.min(frames.length - 1, v + 1)); };
  const stepB = () => { setPlaying(false); setIdx((v) => Math.max(0, v - 1)); };
  const play = () => { if (idx >= frames.length - 1) setIdx(0); lastRef.current = 0; setPlaying((p) => !p); };

  const f = frames.length ? frames[Math.min(idx, frames.length - 1)] : null;
  const done = idx >= frames.length - 1;
  const cellW = 'w-8';

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <input value={textIn} onInput={(e) => setTextIn((e.target as HTMLInputElement).value)} class="min-w-[10rem] flex-1 rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm" placeholder="text" />
        <input value={patIn} onInput={(e) => setPatIn((e.target as HTMLInputElement).value)} class="w-32 rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm" placeholder="pattern" />
        <button onClick={commit} class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Load</button>
      </div>

      <div class="overflow-x-auto">
        {/* text row */}
        <div class="flex gap-1 font-mono text-sm">
          {text.split('').map((ch, jx) => {
            const active = f != null && jx >= f.shift && jx < f.shift + m;
            const rel = f != null ? jx - f.shift : -1;
            const isMismatch = f != null && f.j >= 0 && rel === f.j;
            const isMatched = f != null && active && rel > f.j;
            const bg = isMismatch ? COLORS.bad : isMatched ? COLORS.ok : '';
            return <div key={jx} class={`flex h-9 ${cellW} shrink-0 items-center justify-center rounded-md border font-bold ${bg ? 'border-transparent text-white' : active ? 'border-border bg-surface text-text' : 'border-border bg-surface-2 text-muted'}`} style={bg ? `background:${bg}` : ''}>{ch}</div>;
          })}
        </div>
        {/* pattern row, offset by shift */}
        {f != null && (
          <div class="mt-1 flex gap-1 font-mono text-sm">
            {Array.from({ length: f.shift }).map((_, k) => <div key={`s${k}`} class={`h-9 ${cellW} shrink-0`} />)}
            {pattern.split('').map((ch, k) => {
              const isMismatch = f.j >= 0 && k === f.j;
              const isMatched = k > f.j;
              const bg = isMismatch ? COLORS.bad : isMatched ? COLORS.ok : '';
              return <div key={k} class={`flex h-9 ${cellW} shrink-0 items-center justify-center rounded-md border font-bold ${bg ? 'border-transparent text-white' : 'text-text'}`} style={`${bg ? `background:${bg};` : ''}border-color:${COLORS.cur}`}>{ch}</div>;
            })}
          </div>
        )}
      </div>

      <p class="mt-3 min-h-[2.75rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">
        {f == null ? 'Pattern is empty or longer than the text.' : f.j < 0
          ? `All ${m} characters matched right-to-left — MATCH at ${f.shift}. Shift by 1 to seek the next.`
          : `Mismatch at j=${f.j}: pattern '${pattern[f.j]}' vs text '${text[f.shift + f.j]}'. '${text[f.shift + f.j]}' ${f.lastPos < 0 ? 'is not in the pattern' : `last appears at index ${f.lastPos}`} → jump the pattern by ${f.shiftBy}.`}
      </p>
      {done && frames.length > 0 && <p class="mt-2 rounded-lg bg-brand-soft px-3 py-2 text-sm font-semibold text-text">Finished. Notice how many alignments Boyer-Moore skipped — it rarely looks at every character.</p>}

      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={stepB} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏮ Back</button>
        <button onClick={play} class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90">{playing ? '⏸ Pause' : '▶ Play'}</button>
        <button onClick={stepF} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏭ Step</button>
        <button onClick={reset} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">↺ Reset</button>
        <label class="ml-auto flex items-center gap-2 text-xs text-muted">speed
          <input type="range" min={0.5} max={3} step={0.5} value={speed} onInput={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))} class="w-24 accent-[#4f46e5]" />
        </label>
      </div>
      <p class="mt-2 text-center text-xs text-muted">Matching goes right-to-left. Emerald = matched tail, red = the bad character that triggers the jump.</p>
    </div>
  );
}
