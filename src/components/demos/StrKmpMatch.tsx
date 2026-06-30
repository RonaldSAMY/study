import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated Knuth-Morris-Pratt pattern matching.
   - Edit the text and the pattern. PHASE 1 builds the LPS ("failure")
     table cell by cell; PHASE 2 slides the pattern across the text with
     two pointers, and on a mismatch it JUMPS j back via lps[j-1] instead
     of restarting — that jump is the whole trick.
   - Every frame is precomputed (faithful to the course kmpSearch), so
     stepping back/forward is exact. Active cells are highlighted and a
     caption narrates each comparison, extension, fallback, and match.
   - Transport: Play / Pause / Step / Step-back / Reset + speed.
   ------------------------------------------------------------------ */

const C = { txt: '#0ea5e9', pat: '#4f46e5', good: '#10b981', bad: '#ef4444' };

type LpsFrame = {
  phase: 'lps';
  lps: number[];
  i: number;          // pattern index being filled
  len: number;        // current prefix length / compare index
  cmp: [number, number] | null;
  kind: 'extend' | 'fallback' | 'zero';
  msg: string;
};
type SearchFrame = {
  phase: 'search';
  ti: number;         // text pointer
  pj: number;         // pattern pointer
  align: number;      // ti - pj, where pattern[0] sits under the text
  matches: number[];
  kind: 'match' | 'mismatch' | 'mismatch0' | 'found';
  msg: string;
};
type Frame = LpsFrame | SearchFrame;

function buildLPS(pattern: string): number[] {
  const m = pattern.length;
  const lps = new Array(m).fill(0);
  let len = 0;
  let i = 1;
  while (i < m) {
    if (pattern[i] === pattern[len]) { len++; lps[i] = len; i++; }
    else if (len !== 0) len = lps[len - 1];
    else { lps[i] = 0; i++; }
  }
  return lps;
}

function buildFrames(text: string, pattern: string): Frame[] {
  const frames: Frame[] = [];
  const m = pattern.length;
  const n = text.length;

  // ---- Phase 1: build LPS, recording every decision ----
  const lps = new Array(m).fill(0);
  let len = 0;
  let i = 1;
  while (i < m) {
    if (pattern[i] === pattern[len]) {
      len++;
      lps[i] = len;
      frames.push({ phase: 'lps', lps: [...lps], i, len: len - 1, cmp: [i, len - 1], kind: 'extend', msg: `pattern[${i}]='${pattern[i]}' = pattern[${len - 1}] → extend: lps[${i}] = ${len}` });
      i++;
    } else if (len !== 0) {
      frames.push({ phase: 'lps', lps: [...lps], i, len, cmp: [i, len], kind: 'fallback', msg: `pattern[${i}]='${pattern[i]}' ≠ pattern[${len}] → fall back: len = lps[${len - 1}] = ${lps[len - 1]}` });
      len = lps[len - 1];
    } else {
      lps[i] = 0;
      frames.push({ phase: 'lps', lps: [...lps], i, len: 0, cmp: [i, 0], kind: 'zero', msg: `pattern[${i}]='${pattern[i]}' ≠ pattern[0], no prefix → lps[${i}] = 0` });
      i++;
    }
  }

  // ---- Phase 2: search, faithful to kmpSearch ----
  const matches: number[] = [];
  let ti = 0;
  let pj = 0;
  while (ti < n) {
    if (text[ti] === pattern[pj]) {
      frames.push({ phase: 'search', ti, pj, align: ti - pj, matches: [...matches], kind: 'match', msg: `text[${ti}]='${text[ti]}' = pattern[${pj}]='${pattern[pj]}' ✓ advance both pointers` });
      ti++; pj++;
    } else if (pj !== 0) {
      const njump = lps[pj - 1];
      frames.push({ phase: 'search', ti, pj, align: ti - pj, matches: [...matches], kind: 'mismatch', msg: `text[${ti}]='${text[ti]}' ≠ pattern[${pj}]='${pattern[pj]}' ✗ jump j = lps[${pj - 1}] = ${njump} (keep i)` });
      pj = njump;
    } else {
      frames.push({ phase: 'search', ti, pj, align: ti - pj, matches: [...matches], kind: 'mismatch0', msg: `text[${ti}]='${text[ti]}' ≠ pattern[0] ✗ slide pattern: advance i only` });
      ti++;
    }
    if (pj === m) {
      matches.push(ti - pj);
      frames.push({ phase: 'search', ti, pj, align: ti - pj, matches: [...matches], kind: 'found', msg: `Whole pattern matched → occurrence at index ${ti - pj}. Resume with j = lps[${pj - 1}] = ${lps[pj - 1]}` });
      pj = lps[pj - 1];
    }
  }
  if (frames.length === 0) frames.push({ phase: 'search', ti: 0, pj: 0, align: 0, matches: [], kind: 'mismatch0', msg: 'Nothing to search.' });
  return frames;
}

export default function StrKmpMatch() {
  const [textIn, setTextIn] = useState('abxabcabcaby');
  const [patIn, setPatIn] = useState('abcaby');
  const [text, setText] = useState('abxabcabcaby');
  const [pattern, setPattern] = useState('abcaby');
  const lps = buildLPS(pattern);
  const [frames, setFrames] = useState<Frame[]>(() => buildFrames('abxabcabcaby', 'abcaby'));
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);
  idxRef.current = idx;

  const commit = () => {
    const tt = textIn.slice(0, 26);
    const pp = patIn.slice(0, 10);
    if (tt.length && pp.length && pp.length <= tt.length) {
      setText(tt); setPattern(pp); setFrames(buildFrames(tt, pp)); setIdx(0); setPlaying(false);
    }
  };

  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 900 / speed;
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
  }, [playing, speed, frames]);

  const reset = () => { setPlaying(false); setIdx(0); lastRef.current = 0; };
  const stepF = () => { setPlaying(false); setIdx((v) => Math.min(frames.length - 1, v + 1)); };
  const stepB = () => { setPlaying(false); setIdx((v) => Math.max(0, v - 1)); };
  const play = () => { if (idx >= frames.length - 1) setIdx(0); lastRef.current = 0; setPlaying((p) => !p); };

  const f = frames[idx];
  const patChars = [...pattern];
  const txtChars = [...text];
  const shownLps = f.phase === 'lps' ? f.lps : lps;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 grid gap-2 sm:grid-cols-2">
        <label class="text-xs text-muted">text<input value={textIn} onInput={(e) => setTextIn((e.target as HTMLInputElement).value)} class="mt-1 w-full rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm" /></label>
        <label class="text-xs text-muted">pattern<input value={patIn} onInput={(e) => setPatIn((e.target as HTMLInputElement).value)} class="mt-1 w-full rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm" /></label>
      </div>
      <div class="mb-3 flex items-center gap-2">
        <button onClick={commit} class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Load</button>
        <span class="rounded-md px-2 py-1 text-xs font-bold" style={`background:${f.phase === 'lps' ? 'rgba(79,70,229,.15)' : 'rgba(14,165,233,.15)'}`}>{f.phase === 'lps' ? 'Phase 1 — building LPS table' : 'Phase 2 — sliding search'}</span>
      </div>

      {/* TEXT row (search phase aligns pattern beneath it) */}
      {f.phase === 'search' && (
        <div class="overflow-x-auto">
          <div class="flex gap-1 font-mono text-sm">
            {txtChars.map((c, i) => {
              const active = i === f.ti;
              const inWindow = i >= f.align && i < f.align + patChars.length;
              const matchedPrefix = inWindow && i < f.ti;
              const bg = active ? (f.kind === 'mismatch' || f.kind === 'mismatch0' ? C.bad : f.kind === 'found' ? C.good : C.txt) : '';
              return <span key={i} class={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md border text-base font-bold transition ${active ? 'scale-110 border-transparent text-white' : 'border-border bg-surface-2 text-text'}`} style={`${bg ? `background:${bg};` : ''}${matchedPrefix && !active ? `border-color:${C.good};` : ''}`}>{c}</span>;
            })}
          </div>
          {/* aligned pattern */}
          <div class="mt-1 flex gap-1 font-mono text-sm">
            {Array.from({ length: f.align }).map((_, i) => <span key={`pad${i}`} class="h-9 w-9 shrink-0" />)}
            {patChars.map((c, j) => {
              const active = j === f.pj;
              const matched = j < f.pj;
              const bg = active ? (f.kind === 'mismatch' || f.kind === 'mismatch0' ? C.bad : f.kind === 'found' ? C.good : C.pat) : '';
              return <span key={j} class={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md border text-base font-bold transition ${active ? 'scale-110 border-transparent text-white' : matched ? 'border-transparent text-white' : 'border-border bg-surface-2 text-text'}`} style={`${bg ? `background:${bg};` : matched ? `background:${C.good};` : ''}`}>{c}</span>;
            })}
          </div>
        </div>
      )}

      {/* PATTERN + LPS table */}
      <div class={`overflow-x-auto ${f.phase === 'search' ? 'mt-4' : ''}`}>
        <div class="text-xs font-semibold uppercase tracking-wide text-muted">pattern &amp; LPS table</div>
        <div class="mt-1 flex gap-1 font-mono text-sm">
          {patChars.map((c, j) => {
            const hl = f.phase === 'lps' && f.cmp && (j === f.cmp[0] || j === f.cmp[1]);
            const bg = hl ? (f.kind === 'extend' ? C.good : f.kind === 'fallback' ? C.bad : C.pat) : '';
            return <span key={j} class={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md border text-base font-bold transition ${hl ? 'scale-110 border-transparent text-white' : 'border-border bg-surface-2 text-text'}`} style={bg ? `background:${bg}` : ''}>{c}</span>;
          })}
        </div>
        <div class="mt-1 flex gap-1 font-mono text-xs">
          {patChars.map((_, j) => {
            const filled = f.phase !== 'lps' || j <= f.i;
            const justSet = f.phase === 'lps' && j === f.i;
            return <span key={j} class={`flex h-8 w-9 shrink-0 items-center justify-center rounded-md border ${justSet ? 'border-transparent text-white' : 'border-border bg-surface-2 text-muted'}`} style={justSet ? `background:${C.pat}` : ''}>{filled ? shownLps[j] : '·'}</span>;
          })}
        </div>
        <div class="mt-1 flex gap-1 text-[10px] text-muted">
          {patChars.map((_, j) => <span key={j} class="flex w-9 shrink-0 justify-center">{j}</span>)}
        </div>
      </div>

      <p class="mt-3 min-h-[2.5rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">{f.msg}</p>
      {f.phase === 'search' && f.matches.length > 0 && (
        <p class="mt-2 rounded-lg bg-brand-soft px-3 py-2 text-sm font-semibold text-text">matches so far at index: {f.matches.join(', ')}</p>
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
      <p class="mt-2 text-center text-xs text-muted">Watch the search phase: on a red mismatch the pattern jumps by lps[j-1] — the text pointer never backtracks.</p>
    </div>
  );
}
