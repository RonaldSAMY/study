import { useEffect, useMemo, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated suffix array: build + substring search.
   - Build: every suffix of text + "$" is slotted into sorted order
     (insertion-sort style), highlighting each comparison.
   - Search: a binary search over the sorted suffixes finds the
     contiguous block whose prefix equals the pattern — those are all
     the occurrences, in O(m log n).
   - Transport: Play / Pause / Step / Back / Reset + speed, with active
     rows highlighted and a live caption.
   ------------------------------------------------------------------ */

const SKY = '#0ea5e9';
const EM = '#10b981';

type Row = { i: number; s: string };
type Frame = { list: Row[]; hi: number[]; strong: number; phase: 'build' | 'search'; matches?: number[]; caption: string };

function build(textRaw: string, patternRaw: string) {
  const text = textRaw + '$';
  const N = text.length;
  const sorted: Row[] = [];
  const frames: Frame[] = [];
  const snap = () => sorted.map((x) => ({ ...x }));

  frames.push({ list: [], hi: [], strong: -1, phase: 'build', caption: `Take all ${N} suffixes of "${text}" and keep them sorted as we go.` });
  for (let start = 0; start < N; start++) {
    const s = text.slice(start);
    let pos = 0;
    while (pos < sorted.length && sorted[pos].s < s) {
      frames.push({ list: snap(), hi: [pos], strong: pos, phase: 'build',
        caption: `Placing "${s}" (from index ${start}): "${sorted[pos].s}" < "${s}", scan past it.` });
      pos++;
    }
    sorted.splice(pos, 0, { i: start, s });
    frames.push({ list: snap(), hi: [pos], strong: pos, phase: 'build',
      caption: `Insert suffix "${s}" (starts at index ${start}) at sorted rank ${pos}.` });
  }

  const p = patternRaw;
  if (p.length) {
    frames.push({ list: snap(), hi: [], strong: -1, phase: 'search', caption: `Now search for "${p}" with a binary search over the sorted suffixes.` });
    let l = 0, r = sorted.length;
    while (l < r) {
      const mid = (l + r) >> 1;
      const suf = sorted[mid].s;
      frames.push({ list: snap(), hi: [mid], strong: mid, phase: 'search',
        caption: `Compare "${p}" with rank ${mid} ("${suf}") → ${suf < p ? 'smaller: search the right half' : 'not smaller: search the left half'}.` });
      if (suf < p) l = mid + 1; else r = mid;
    }
    const matches: number[] = [];
    let k = l;
    while (k < sorted.length && sorted[k].s.startsWith(p)) { matches.push(k); k++; }
    if (matches.length) {
      const idxs = matches.map((m) => sorted[m].i).sort((a, b) => a - b);
      frames.push({ list: snap(), hi: matches, strong: matches[0], phase: 'search', matches,
        caption: `"${p}" occurs ${matches.length} time(s), at text indices ${idxs.join(', ')} — a contiguous block of the suffix array.` });
    } else {
      frames.push({ list: snap(), hi: [], strong: -1, phase: 'search', matches: [],
        caption: `"${p}" is not a substring — no sorted suffix begins with it.` });
    }
  }
  return { text, frames };
}

export default function AdvDsSuffixArray() {
  const [textIn, setTextIn] = useState('banana');
  const [patIn, setPatIn] = useState('ana');
  const [text, setText] = useState('banana');
  const [pat, setPat] = useState('ana');

  const { frames } = useMemo(() => build(text, pat), [text, pat]);

  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);
  idxRef.current = idx;

  useEffect(() => { setIdx(0); setPlaying(false); }, [frames]);

  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 720 / speed;
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

  const commit = () => {
    const t = textIn.trim().replace(/\$/g, '').slice(0, 12);
    if (t) { setText(t); setPat(patIn.trim().replace(/\$/g, '')); }
  };

  const f = frames[idx];

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <label class="flex items-center gap-1.5 text-xs text-muted">text
          <input value={textIn} onInput={(e) => setTextIn((e.target as HTMLInputElement).value)}
            class="w-40 rounded-lg border border-border bg-surface-2 px-2 py-1 font-mono text-sm" />
        </label>
        <label class="flex items-center gap-1.5 text-xs text-muted">pattern
          <input value={patIn} onInput={(e) => setPatIn((e.target as HTMLInputElement).value)}
            class="w-28 rounded-lg border border-border bg-surface-2 px-2 py-1 font-mono text-sm" />
        </label>
        <button onClick={commit} class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Load</button>
      </div>

      <div class="rounded-xl bg-surface-2 p-2">
        <div class="mb-1 grid grid-cols-[2.5rem_3rem_1fr] gap-2 px-1 text-[11px] font-semibold text-muted">
          <span>rank</span><span>start</span><span>suffix</span>
        </div>
        <div class="space-y-1">
          {f.list.map((row, r) => {
            const isMatch = f.matches && f.matches.includes(r);
            const isHi = f.hi.includes(r);
            const bg = isMatch ? EM : isHi ? SKY : 'transparent';
            const on = isMatch || isHi;
            return (
              <div key={r} class={`grid grid-cols-[2.5rem_3rem_1fr] items-center gap-2 rounded-md px-1 py-0.5 font-mono text-sm transition ${on ? 'font-bold text-white' : 'text-text'}`}
                style={on ? `background:${bg}` : ''}>
                <span class="opacity-80">{r}</span>
                <span class="opacity-80">{row.i}</span>
                <span class="tracking-wide">{row.s}</span>
              </div>
            );
          })}
          {f.list.length === 0 && <div class="px-1 py-2 text-sm text-muted">(no suffixes placed yet)</div>}
        </div>
      </div>

      <p class="mt-3 min-h-[2.5rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">{f.caption}</p>

      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={stepB} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏮ Back</button>
        <button onClick={play} class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90">{playing ? '⏸ Pause' : '▶ Play'}</button>
        <button onClick={stepF} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏭ Step</button>
        <button onClick={reset} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">↺ Reset</button>
        <span class="text-xs text-muted">step {idx + 1}/{frames.length}</span>
        <label class="ml-auto flex items-center gap-2 text-xs text-muted">speed
          <input type="range" min={0.5} max={3} step={0.5} value={speed} onInput={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))} class="w-24 accent-[#4f46e5]" />
        </label>
      </div>
      <p class="mt-2 text-center text-xs text-muted">Tip: the "$" terminator sorts first; every occurrence of a pattern is one solid emerald block.</p>
    </div>
  );
}
