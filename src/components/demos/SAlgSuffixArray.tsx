import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated suffix array + binary-search substring query.
   - Edit the text. All suffixes are sorted (that sorted list of start
     indices IS the suffix array). Edit the pattern, then watch a binary
     search zero in on the block of suffixes that start with the pattern.
   - Each frame highlights the live [lo, hi] range, the mid suffix being
     compared, and the comparison result, with a caption.
   - Transport: Play / Pause / Step / Back / Reset + speed.
   ------------------------------------------------------------------ */

const COLORS = { mid: '#0ea5e9', hit: '#10b981', range: '#4f46e5' };

function suffixArray(s: string): number[] {
  return Array.from({ length: s.length }, (_, i) => i).sort((a, b) => (s.slice(a) < s.slice(b) ? -1 : 1));
}

type Frame = { lo: number; hi: number; mid: number; cmp: 'prefix' | 'less' | 'greater'; note: string };

function searchFrames(s: string, sa: number[], pattern: string): { frames: Frame[]; hits: number[] } {
  const frames: Frame[] = [];
  const n = sa.length;
  const hits: number[] = [];
  if (pattern.length === 0) return { frames, hits };
  for (let i = 0; i < n; i++) if (s.slice(sa[i]).startsWith(pattern)) hits.push(i);
  let lo = 0, hi = n - 1, guard = 0;
  while (lo <= hi && guard++ < 60) {
    const mid = Math.floor((lo + hi) / 2);
    const suf = s.slice(sa[mid]);
    let cmp: 'prefix' | 'less' | 'greater';
    let note: string;
    if (suf.startsWith(pattern)) { cmp = 'prefix'; note = `Suffix "${suf}" starts with "${pattern}" — a hit. Search left to find the first one.`; hi = mid - 1; }
    else if (suf < pattern) { cmp = 'less'; note = `Suffix "${suf}" < "${pattern}" — the block is to the right. Move lo up.`; lo = mid + 1; }
    else { cmp = 'greater'; note = `Suffix "${suf}" > "${pattern}" — the block is to the left. Move hi down.`; hi = mid - 1; }
    frames.push({ lo: cmp === 'less' ? lo : frames.length ? frames[frames.length - 1].lo : 0, hi, mid, cmp, note });
  }
  // rebuild lo/hi progression cleanly for display
  const clean: Frame[] = [];
  let clo = 0, chi = n - 1;
  guard = 0;
  while (clo <= chi && guard++ < 60) {
    const mid = Math.floor((clo + chi) / 2);
    const suf = s.slice(sa[mid]);
    let cmp: 'prefix' | 'less' | 'greater';
    let note: string;
    const loBefore = clo, hiBefore = chi;
    if (suf.startsWith(pattern)) { cmp = 'prefix'; note = `Suffix "${suf}" starts with "${pattern}" — a hit. Keep searching left for the first match.`; chi = mid - 1; }
    else if (suf < pattern) { cmp = 'less'; note = `"${suf}" < "${pattern}" lexicographically — matches must be to the right. Move lo up.`; clo = mid + 1; }
    else { cmp = 'greater'; note = `"${suf}" > "${pattern}" lexicographically — matches must be to the left. Move hi down.`; chi = mid - 1; }
    clean.push({ lo: loBefore, hi: hiBefore, mid, cmp, note });
  }
  return { frames: clean, hits };
}

const cleanText = (s: string) => s.replace(/[^a-zA-Z]/g, '').toLowerCase().slice(0, 12);
const cleanPat = (s: string) => s.replace(/[^a-zA-Z]/g, '').toLowerCase().slice(0, 8);

export default function SAlgSuffixArray() {
  const [textIn, setTextIn] = useState('banana');
  const [patIn, setPatIn] = useState('an');
  const [text, setText] = useState('banana');
  const [pattern, setPattern] = useState('an');
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);
  idxRef.current = idx;

  const sa = suffixArray(text);
  const { frames, hits } = searchFrames(text, sa, pattern);
  const commit = () => { const t = cleanText(textIn), p = cleanPat(patIn); if (t.length && p.length) { setText(t); setPattern(p); setIdx(0); setPlaying(false); } };

  useEffect(() => {
    if (!playing || frames.length === 0) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 1050 / speed;
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
  }, [playing, speed, text, pattern]);

  const reset = () => { setPlaying(false); setIdx(0); lastRef.current = 0; };
  const stepF = () => { setPlaying(false); setIdx((v) => Math.min(frames.length - 1, v + 1)); };
  const stepB = () => { setPlaying(false); setIdx((v) => Math.max(0, v - 1)); };
  const play = () => { if (idx >= frames.length - 1) setIdx(0); lastRef.current = 0; setPlaying((p) => !p); };

  const f = frames.length ? frames[Math.min(idx, frames.length - 1)] : null;
  const done = idx >= frames.length - 1;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <input value={textIn} onInput={(e) => setTextIn((e.target as HTMLInputElement).value)} class="min-w-[8rem] flex-1 rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm" placeholder="text" />
        <input value={patIn} onInput={(e) => setPatIn((e.target as HTMLInputElement).value)} class="w-24 rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm" placeholder="pattern" />
        <button onClick={commit} class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Load</button>
      </div>

      <div class="rounded-xl bg-surface-2 p-2 font-mono text-sm">
        <div class="mb-1 flex gap-2 px-2 text-[11px] text-muted"><span class="w-10">SA[i]</span><span>sorted suffix</span></div>
        {sa.map((start, i) => {
          const inRange = f != null && i >= f.lo && i <= f.hi;
          const isMid = f != null && i === f.mid && !done;
          const isHit = done && hits.includes(i);
          const suf = text.slice(start);
          return (
            <div key={i} class={`flex items-center gap-2 rounded px-2 py-0.5 transition ${isMid ? 'text-white' : isHit ? 'text-white' : inRange ? 'text-text' : 'text-muted opacity-60'}`} style={isMid ? `background:${COLORS.mid}` : isHit ? `background:${COLORS.hit}` : inRange ? 'background:var(--surface,transparent)' : ''}>
              <span class="w-10 shrink-0 tabular-nums">{start}</span>
              <span><span class="font-bold">{suf.slice(0, pattern.length)}</span>{suf.slice(pattern.length)}</span>
            </div>
          );
        })}
      </div>

      <p class="mt-3 min-h-[2.5rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">
        {f == null ? 'Enter a pattern to search the sorted suffixes.' : <><span class="font-semibold" style={`color:${COLORS.range}`}>lo={f.lo}, mid={f.mid}, hi={f.hi}</span> · {f.note}</>}
      </p>
      {done && <p class="mt-2 rounded-lg bg-brand-soft px-3 py-2 text-sm font-semibold text-text">Suffix array = [{sa.join(', ')}]. "{pattern}" occurs at text positions {hits.length ? hits.map((i) => sa[i]).sort((a, b) => a - b).join(', ') : '(none)'} — found in about log(n) comparisons.</p>}

      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={stepB} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏮ Back</button>
        <button onClick={play} class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90">{playing ? '⏸ Pause' : '▶ Play'}</button>
        <button onClick={stepF} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏭ Step</button>
        <button onClick={reset} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">↺ Reset</button>
        <label class="ml-auto flex items-center gap-2 text-xs text-muted">speed
          <input type="range" min={0.5} max={3} step={0.5} value={speed} onInput={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))} class="w-24 accent-[#4f46e5]" />
        </label>
      </div>
      <p class="mt-2 text-center text-xs text-muted">Suffixes are pre-sorted, so every occurrence of a pattern sits in one contiguous block — binary search finds it fast.</p>
    </div>
  );
}
