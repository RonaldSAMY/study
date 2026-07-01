import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Digit DP — build numbers digit by digit with a TIGHT flag.
   - Pick an upper bound N and a target digit sum S.
   - The demo walks the decision tree that counts integers in [0, N]
     whose digits sum to S. At each position it tries digits 0..limit,
     where limit = N's digit while we are still "tight" (hugging the
     bound), or 9 once we've gone strictly below (loose).
   - The active position is highlighted; the prefix is indigo while
     tight, emerald once loose. A live caption + running count narrate.
   - Transport: Play / Pause / Step / Back / Reset + speed.
   ------------------------------------------------------------------ */

const COLORS = { tight: '#4f46e5', loose: '#10b981', bound: '#0ea5e9' };

type Frame = {
  built: number[];
  pos: number;        // position currently being decided (built.length)
  tight: boolean;
  sum: number;
  kind: 'place' | 'leaf';
  valid?: boolean;
  count: number;
  caption: string;
};

function digitsOf(n: number): number[] {
  return String(Math.max(0, Math.floor(n))).split('').map((d) => parseInt(d, 10));
}

export default function DpOptDigitBuilder() {
  const [boundText, setBoundText] = useState('345');
  const [sumText, setSumText] = useState('10');
  const [bound, setBound] = useState(345);
  const [target, setTarget] = useState(10);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1.5);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);
  idxRef.current = idx;

  const { frames, truncated, total: totalCount } = (() => {
    const D = digitsOf(bound);
    const L = D.length;
    const frames: Frame[] = [];
    const MAX = 700;
    let count = 0;
    let truncated = false;

    const dfs = (pos: number, built: number[], tight: boolean, sum: number) => {
      if (truncated) return;
      if (pos === L) {
        const ok = sum === target;
        if (ok) count++;
        frames.push({
          built: [...built], pos, tight, sum, kind: 'leaf', valid: ok, count,
          caption: `Complete: ${built.join('') || '0'} has digit sum ${sum} ${ok ? `= ${target} ✓ count it` : `≠ ${target} ✗`}.`,
        });
        return;
      }
      const limit = tight ? D[pos] : 9;
      for (let d = 0; d <= limit; d++) {
        if (frames.length >= MAX) { truncated = true; return; }
        const nTight = tight && d === limit;
        frames.push({
          built: [...built, d], pos: pos + 1, tight: nTight, sum: sum + d, kind: 'place', count,
          caption: `pos ${pos}: place ${d} (allowed 0..${limit}${tight ? ', tight' : ', free'}). ${nTight ? 'still tight' : 'now loose — next digit can be 0..9'}, sum so far ${sum + d}.`,
        });
        dfs(pos + 1, [...built, d], nTight, sum + d);
        if (truncated) return;
      }
    };
    dfs(0, [], true, 0);
    return { frames, truncated, total: count };
  })();

  const total = frames.length;
  const cur = total ? frames[Math.min(idx, total - 1)] : null;
  const Dbound = digitsOf(bound);

  const commit = () => {
    const b = parseInt(boundText, 10);
    const s = parseInt(sumText, 10);
    if (Number.isFinite(b) && b >= 0 && b <= 9999 && Number.isFinite(s) && s >= 0) {
      setBound(b); setTarget(s); setIdx(0); setPlaying(false);
    }
  };

  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 620 / speed;
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

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <label class="flex items-center gap-1.5 text-sm text-muted">N ≤
          <input value={boundText} onInput={(e) => setBoundText((e.target as HTMLInputElement).value)} class="w-20 rounded-lg border border-border bg-surface-2 px-2 py-1.5 font-mono text-sm" />
        </label>
        <label class="flex items-center gap-1.5 text-sm text-muted">digit sum =
          <input value={sumText} onInput={(e) => setSumText((e.target as HTMLInputElement).value)} class="w-16 rounded-lg border border-border bg-surface-2 px-2 py-1.5 font-mono text-sm" />
        </label>
        <button onClick={commit} class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Load</button>
      </div>

      {/* upper bound row */}
      <div class="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Upper bound N = {bound}</div>
      <div class="flex gap-1.5 font-mono text-lg">
        {Dbound.map((d, i) => {
          const active = cur && cur.kind === 'place' && cur.pos - 1 === i;
          const decided = cur ? i < (cur.kind === 'leaf' ? cur.pos : cur.pos - 1) : false;
          return (
            <div key={i} class={`flex h-11 w-11 items-center justify-center rounded-md border-2 ${active ? 'text-white' : 'bg-surface-2 text-muted'}`} style={active ? `background:${COLORS.bound};border-color:${COLORS.bound}` : `border-color:${decided ? 'rgba(128,128,128,0.3)' : COLORS.bound}`}>{d}</div>
          );
        })}
      </div>

      {/* number being built */}
      <div class="mt-3 mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Number being built {cur ? `(${cur.tight ? 'tight' : 'loose'})` : ''}</div>
      <div class="flex gap-1.5 font-mono text-lg">
        {Dbound.map((_, i) => {
          const b = cur?.built ?? [];
          const filled = i < b.length;
          const col = cur && cur.tight ? COLORS.tight : COLORS.loose;
          return (
            <div key={i} class="flex h-11 w-11 items-center justify-center rounded-md border-2 text-white" style={filled ? `background:${col};border-color:${col}` : 'border-color:rgba(128,128,128,0.3);background:transparent'}>
              <span class={filled ? '' : 'text-muted'}>{filled ? b[i] : '_'}</span>
            </div>
          );
        })}
        <div class="ml-3 flex items-center font-sans text-sm text-muted">sum = {cur?.sum ?? 0}</div>
      </div>

      <p class={`mt-3 min-h-[2.5rem] rounded-lg px-3 py-2 text-sm ${cur?.kind === 'leaf' ? (cur.valid ? 'bg-brand-soft font-semibold' : 'bg-surface-2') : 'bg-surface-2'} text-text`}>{cur ? cur.caption : 'Press Play to build every number ≤ N digit by digit.'}</p>

      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={stepB} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏮ Back</button>
        <button onClick={play} class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90">{playing ? '⏸ Pause' : '▶ Play'}</button>
        <button onClick={stepF} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏭ Step</button>
        <button onClick={reset} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">↺ Reset</button>
        <span class="ml-auto font-mono text-xs" style={`color:${COLORS.loose}`}>count = {cur?.count ?? 0}</span>
        <label class="flex items-center gap-2 text-xs text-muted">speed
          <input type="range" min={0.5} max={4} step={0.5} value={speed} onInput={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))} class="w-20 accent-[#4f46e5]" />
        </label>
      </div>
      <p class="mt-2 text-center text-xs text-muted">
        Total with digit sum {target}: <strong style={`color:${COLORS.loose}`}>{totalCount}</strong>{truncated ? ' (animation truncated — try a smaller N)' : ''}.
        While <span style={`color:${COLORS.tight}`}>tight</span> the next digit is capped by N; once <span style={`color:${COLORS.loose}`}>loose</span> it is free 0–9.
      </p>
    </div>
  );
}
