import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated Longest Common Subsequence (LCS) DP table.
   - The learner types two strings (uppercase letters). A "Load" button
     rebuilds the precomputed frames.
   - dp[i][j] = LCS length of the first i chars of text1 and first j of
     text2. We fill the table row-major, one cell per frame:
        match    : dp[i][j] = dp[i-1][j-1] + 1   (diagonal + 1)
        no match : dp[i][j] = max(dp[i-1][j], dp[i][j-1])  (up vs left)
   - The view is idx-driven (not live): each frame highlights the current
     cell, the source cell(s) it read, and writes a caption. At the end
     the answer cell and one LCS path light up.
   - Transport: Back / Play-Pause / Step / Reset + a speed slider, with a
     requestAnimationFrame autoplay loop cleaned up on unmount.
   ------------------------------------------------------------------ */

const COLORS = { cur: '#0ea5e9', match: '#10b981', source: '#4f46e5' };
const MAX_LEN = 9;

type Frame = {
  i: number;
  j: number;
  value: number;
  match: boolean;
  diag: number;
  up: number;
  left: number;
};

const sanitize = (s: string): string => s.toUpperCase().replace(/[^A-Z]/g, '').slice(0, MAX_LEN);

function buildDP(t1: string, t2: string): { dp: number[][]; frames: Frame[] } {
  const m = t1.length;
  const n = t2.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  const frames: Frame[] = [];
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const match = t1[i - 1] === t2[j - 1];
      if (match) dp[i][j] = dp[i - 1][j - 1] + 1;
      else dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      frames.push({ i, j, value: dp[i][j], match, diag: dp[i - 1][j - 1], up: dp[i - 1][j], left: dp[i][j - 1] });
    }
  }
  return { dp, frames };
}

function backtrack(dp: number[][], t1: string, t2: string): { lcs: string; path: Set<string> } {
  let i = t1.length;
  let j = t2.length;
  let lcs = '';
  const path = new Set<string>();
  while (i > 0 && j > 0) {
    if (t1[i - 1] === t2[j - 1]) {
      lcs = t1[i - 1] + lcs;
      path.add(`${i},${j}`);
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }
  return { lcs, path };
}

export default function DpLcsTable() {
  const [input1, setInput1] = useState('ABCBDAB');
  const [input2, setInput2] = useState('BDCABA');
  const [t1, setT1] = useState('ABCBDAB');
  const [t2, setT2] = useState('BDCABA');
  const [idx, setIdx] = useState(0); // 0..frames.length
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);
  idxRef.current = idx;

  const m = t1.length;
  const n = t2.length;
  const { dp, frames } = buildDP(t1, t2);
  const total = frames.length;
  const { lcs, path } = backtrack(dp, t1, t2);

  const commit = () => {
    const a = sanitize(input1);
    const b = sanitize(input2);
    if (!a.length || !b.length) return;
    setInput1(a);
    setInput2(b);
    setT1(a);
    setT2(b);
    setIdx(0);
    setPlaying(false);
    lastRef.current = 0;
  };

  useEffect(() => {
    if (!playing) {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      return;
    }
    const interval = 720 / speed;
    const tick = (time: number) => {
      if (!lastRef.current) lastRef.current = time;
      if (time - lastRef.current >= interval) {
        lastRef.current = time;
        const next = idxRef.current + 1;
        if (next >= total) {
          setIdx(total);
          setPlaying(false);
          return;
        }
        setIdx(next);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [playing, speed, total]);

  const reset = () => { setPlaying(false); setIdx(0); lastRef.current = 0; };
  const stepF = () => { setPlaying(false); setIdx((v) => Math.min(total, v + 1)); };
  const stepB = () => { setPlaying(false); setIdx((v) => Math.max(0, v - 1)); };
  const play = () => { if (idx >= total) setIdx(0); lastRef.current = 0; setPlaying((p) => !p); };

  const done = idx >= total && total > 0;
  const cur = idx > 0 ? frames[idx - 1] : null;     // last cell filled (for caption)
  const active = done ? null : cur;                  // highlighting target while running

  const caption = (() => {
    if (!cur) return 'The empty row and column are all 0. Press Play to fill the table cell by cell.';
    if (cur.match) return `text1[${cur.i}]=${t1[cur.i - 1]} == text2[${cur.j}]=${t2[cur.j - 1]}  →  dp[${cur.i}][${cur.j}] = dp[${cur.i - 1}][${cur.j - 1}] + 1 = ${cur.value}`;
    return `${t1[cur.i - 1]} != ${t2[cur.j - 1]}  →  dp[${cur.i}][${cur.j}] = max(up ${cur.up}, left ${cur.left}) = ${cur.value}`;
  })();

  // is cell (i,j) already written? base row/col are always 0.
  const filled = (i: number, j: number) => i === 0 || j === 0 || (i - 1) * n + (j - 1) < idx;

  const dpCellStyle = (i: number, j: number): string => {
    if (active && active.i === i && active.j === j) return `background:${COLORS.cur};color:#fff`;
    if (active && active.match && i === active.i - 1 && j === active.j - 1) return `background:${COLORS.match};color:#fff`;
    if (active && !active.match && i === active.i - 1 && j === active.j) return `outline:2px solid ${COLORS.source};outline-offset:-2px`;
    if (active && !active.match && i === active.i && j === active.j - 1) return `outline:2px solid ${COLORS.source};outline-offset:-2px`;
    if (done && i === m && j === n) return `background:${COLORS.match};color:#fff`;
    if (done && path.has(`${i},${j}`)) return `box-shadow:inset 0 0 0 2px ${COLORS.match}`;
    return '';
  };

  // matched character headers light up emerald on a match step
  const headRowHot = (i: number) => active && active.match && active.i === i;
  const headColHot = (j: number) => active && active.match && active.j === j;

  const cellBase = 'flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border text-sm font-semibold transition';

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 grid gap-2 sm:grid-cols-2">
        <label class="flex items-center gap-2 text-sm">
          <span class="w-12 shrink-0 text-muted">text1</span>
          <input value={input1} onInput={(e) => setInput1((e.target as HTMLInputElement).value)} class="w-full rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm uppercase" placeholder="letters" />
        </label>
        <label class="flex items-center gap-2 text-sm">
          <span class="w-12 shrink-0 text-muted">text2</span>
          <input value={input2} onInput={(e) => setInput2((e.target as HTMLInputElement).value)} class="w-full rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm uppercase" placeholder="letters" />
        </label>
      </div>
      <div class="mb-3 flex items-center gap-2">
        <button onClick={commit} class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Load</button>
        <span class="text-xs text-muted">Uppercase letters, up to {MAX_LEN} each.</span>
      </div>

      {/* DP table */}
      <div class="overflow-x-auto pb-1">
        <div class="inline-grid gap-1 font-mono" style={`grid-template-columns:repeat(${n + 2}, 2.25rem)`}>
          {/* header row: corner + column labels (j = 0..n) */}
          <div class={`${cellBase} border-transparent`} />
          {Array.from({ length: n + 1 }, (_unused, j) => (
            <div key={`c${j}`} class={`${cellBase} ${headColHot(j) ? 'border-transparent text-white' : 'bg-surface-2 text-muted'}`} style={headColHot(j) ? `background:${COLORS.match}` : ''}>
              {j === 0 ? 'ε' : t2[j - 1]}
            </div>
          ))}

          {/* data rows: row label (i = 0..m) + dp cells (j = 0..n) */}
          {Array.from({ length: m + 1 }, (_unused, i) => [
            <div key={`r${i}`} class={`${cellBase} ${headRowHot(i) ? 'border-transparent text-white' : 'bg-surface-2 text-muted'}`} style={headRowHot(i) ? `background:${COLORS.match}` : ''}>
              {i === 0 ? 'ε' : t1[i - 1]}
            </div>,
            ...Array.from({ length: n + 1 }, (_u, j) => {
              const style = dpCellStyle(i, j);
              const show = filled(i, j);
              return (
                <div key={`${i}-${j}`} class={`${cellBase} ${style ? '' : show ? 'bg-surface text-text' : 'bg-surface-2 text-muted/30'}`} style={style}>
                  {show ? dp[i][j] : ''}
                </div>
              );
            }),
          ])}
        </div>
      </div>

      {/* legend */}
      <div class="mt-3 flex flex-wrap gap-3 text-xs text-muted">
        <span class="flex items-center gap-1.5"><span class="inline-block h-3 w-3 rounded" style={`background:${COLORS.cur}`} />current cell</span>
        <span class="flex items-center gap-1.5"><span class="inline-block h-3 w-3 rounded" style={`background:${COLORS.match}`} />diagonal match</span>
        <span class="flex items-center gap-1.5"><span class="inline-block h-3 w-3 rounded" style={`outline:2px solid ${COLORS.source};outline-offset:-2px`} />up / left source</span>
      </div>

      <p class="mt-3 min-h-[2.5rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">{caption}</p>
      {done && (
        <p class="mt-2 rounded-lg bg-brand-soft px-3 py-2 text-sm font-semibold text-text">
          dp[{m}][{n}] = {dp[m][n]} — the LCS has length {dp[m][n]}. One longest common subsequence is "{lcs}".
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
      <p class="mt-2 text-center text-xs text-muted">{total === 0 ? 'Enter two non-empty strings and press Load.' : `Cell ${Math.min(idx, total)} of ${total}.`}</p>
    </div>
  );
}
