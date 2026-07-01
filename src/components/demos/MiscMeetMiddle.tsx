import { useEffect, useMemo, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated Meet in the Middle (subset-sum = target).
   - Edit a small array (≤ 8) and a target. The array is split into two
     halves. We enumerate ALL subset sums of each half (2^(n/2) each),
     sort the right half's sums, and then for every LEFT sum we binary
     search the right list for the complement (target − leftSum).
   - Phases: enumerate left → enumerate + sort right → combine. A match
     lights up both partners.
   - Transport: Play / Pause / Step / Step-back / Reset + speed.
   ------------------------------------------------------------------ */

const COLORS = { left: '#0ea5e9', right: '#4f46e5', found: '#10b981', probe: '#f59e0b' };

type SubsetSum = { sum: number; mask: number; half: number[]; };
type Frame = {
  phase: 'left' | 'right' | 'sort' | 'combine' | 'done';
  leftShown: number; // how many left sums revealed
  rightShown: number;
  activeLeft: number | null; // index into leftSums during combine
  needed: number | null;
  probeRight: number | null; // index into sorted rightSums being probed
  matchRight: number | null;
  found: boolean;
  caption: string;
};

function enumerate(half: number[]): SubsetSum[] {
  const out: SubsetSum[] = [];
  for (let mask = 0; mask < (1 << half.length); mask++) {
    let s = 0; const picks: number[] = [];
    for (let i = 0; i < half.length; i++) if (mask & (1 << i)) { s += half[i]; picks.push(half[i]); }
    out.push({ sum: s, mask, half: picks });
  }
  return out;
}

function buildFrames(arr: number[], target: number) {
  const mid = Math.floor(arr.length / 2);
  const left = arr.slice(0, mid);
  const right = arr.slice(mid);
  const leftSums = enumerate(left);
  const rightSums = enumerate(right).sort((a, b) => a.sum - b.sum);
  const frames: Frame[] = [];

  for (let i = 1; i <= leftSums.length; i++) {
    frames.push({ phase: 'left', leftShown: i, rightShown: 0, activeLeft: null, needed: null, probeRight: null, matchRight: null, found: false,
      caption: `Enumerate LEFT subsets: {${leftSums[i - 1].half.join(', ') || '∅'}} → sum ${leftSums[i - 1].sum}. (${i}/${leftSums.length})` });
  }
  for (let i = 1; i <= rightSums.length; i++) {
    frames.push({ phase: 'right', leftShown: leftSums.length, rightShown: i, activeLeft: null, needed: null, probeRight: null, matchRight: null, found: false,
      caption: `Enumerate RIGHT subsets: sum ${rightSums[i - 1].sum}. (${i}/${rightSums.length})` });
  }
  frames.push({ phase: 'sort', leftShown: leftSums.length, rightShown: rightSums.length, activeLeft: null, needed: null, probeRight: null, matchRight: null, found: false,
    caption: `Sort the RIGHT sums ascending so we can binary search them: [${rightSums.map((r) => r.sum).join(', ')}].` });

  const rvals = rightSums.map((r) => r.sum);
  let done = false;
  for (let li = 0; li < leftSums.length && !done; li++) {
    const needed = target - leftSums[li].sum;
    frames.push({ phase: 'combine', leftShown: leftSums.length, rightShown: rightSums.length, activeLeft: li, needed, probeRight: null, matchRight: null, found: false,
      caption: `Take left sum ${leftSums[li].sum}. We need a right sum of ${target} − ${leftSums[li].sum} = ${needed}. Binary search for it.` });
    let lo = 0, hi = rvals.length - 1, match = -1;
    while (lo <= hi) {
      const m = (lo + hi) >> 1;
      frames.push({ phase: 'combine', leftShown: leftSums.length, rightShown: rightSums.length, activeLeft: li, needed, probeRight: m, matchRight: null, found: false,
        caption: `Probe right[${m}] = ${rvals[m]} vs needed ${needed}.` });
      if (rvals[m] === needed) { match = m; break; }
      if (rvals[m] < needed) lo = m + 1; else hi = m - 1;
    }
    if (match >= 0) {
      frames.push({ phase: 'combine', leftShown: leftSums.length, rightShown: rightSums.length, activeLeft: li, needed, probeRight: match, matchRight: match, found: true,
        caption: `Match! left ${leftSums[li].sum} + right ${rvals[match]} = ${target}. A subset summing to ${target} exists.` });
      done = true;
    }
  }
  if (!done) {
    frames.push({ phase: 'done', leftShown: leftSums.length, rightShown: rightSums.length, activeLeft: null, needed: null, probeRight: null, matchRight: null, found: false,
      caption: `No left/right pair sums to ${target} — no subset reaches the target.` });
  }
  return { frames, leftSums, rightSums, left, right };
}

const parseList = (s: string): number[] =>
  s.split(',').map((x) => parseInt(x.trim(), 10)).filter((x) => Number.isFinite(x)).slice(0, 8);

export default function MiscMeetMiddle() {
  const [text, setText] = useState('3, 1, 4, 1, 5, 9');
  const [tText, setTText] = useState('15');
  const [nums, setNums] = useState<number[]>(() => parseList('3, 1, 4, 1, 5, 9'));
  const [target, setTarget] = useState(15);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);
  idxRef.current = idx;

  const { frames, leftSums, rightSums, left, right } = useMemo(() => buildFrames(nums, target), [nums, target]);
  const f = frames[Math.min(idx, frames.length - 1)];

  const commit = () => {
    const parsed = parseList(text);
    let t = parseInt(tText, 10);
    if (!parsed.length) return;
    if (!Number.isFinite(t)) t = 0;
    setNums(parsed); setTarget(t); setTText(String(t)); setIdx(0); setPlaying(false);
  };

  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 780 / speed;
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

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <input value={text} onInput={(e) => setText((e.target as HTMLInputElement).value)} class="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm" placeholder="up to 8 numbers" />
        <label class="flex items-center gap-1 text-sm text-muted">target<input value={tText} onInput={(e) => setTText((e.target as HTMLInputElement).value)} class="w-16 rounded-lg border border-border bg-surface-2 px-2 py-1.5 font-mono text-sm" /></label>
        <button onClick={commit} class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Load</button>
      </div>

      <div class="mb-3 flex flex-wrap gap-4 text-sm">
        <div><span class="text-xs font-semibold" style={`color:${COLORS.left}`}>left half</span> <span class="font-mono">[{left.join(', ')}]</span></div>
        <div><span class="text-xs font-semibold" style={`color:${COLORS.right}`}>right half</span> <span class="font-mono">[{right.join(', ')}]</span></div>
      </div>

      <div class="grid gap-3 sm:grid-cols-2">
        <div>
          <div class="mb-1 text-xs font-semibold" style={`color:${COLORS.left}`}>left subset sums</div>
          <div class="flex flex-wrap gap-1.5 font-mono text-sm">
            {leftSums.slice(0, f.leftShown).map((s, i) => {
              const active = f.activeLeft === i;
              return <span key={i} class={`rounded-md border px-2 py-1 transition ${active ? 'border-transparent text-white scale-110' : 'border-border bg-surface-2 text-text'}`} style={active ? `background:${COLORS.left}` : ''}>{s.sum}</span>;
            })}
          </div>
        </div>
        <div>
          <div class="mb-1 text-xs font-semibold" style={`color:${COLORS.right}`}>right subset sums {f.phase !== 'left' && f.phase !== 'right' ? '(sorted)' : ''}</div>
          <div class="flex flex-wrap gap-1.5 font-mono text-sm">
            {rightSums.slice(0, f.rightShown).map((s, i) => {
              const isMatch = f.matchRight === i;
              const isProbe = f.probeRight === i && !isMatch;
              let cls = 'border-border bg-surface-2 text-text'; let style = '';
              if (isProbe) { cls = 'border-transparent text-white'; style = `background:${COLORS.probe}`; }
              if (isMatch) { cls = 'border-transparent text-white scale-110'; style = `background:${COLORS.found}`; }
              return <span key={i} class={`rounded-md border px-2 py-1 transition ${cls}`} style={style}>{s.sum}</span>;
            })}
          </div>
        </div>
      </div>

      {f.needed != null && (
        <div class="mt-3 text-sm font-mono">
          need right = target − left = <span class="font-bold" style={`color:${COLORS.probe}`}>{f.needed}</span>
        </div>
      )}

      <p class="mt-2 min-h-[3rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">{f.caption}</p>
      {f.found && <p class="mt-2 rounded-lg bg-brand-soft px-3 py-2 text-sm font-semibold text-text">Combined two halves in √(search space) work instead of checking all 2ⁿ subsets.</p>}

      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={stepB} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏮ Back</button>
        <button onClick={play} class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90">{playing ? '⏸ Pause' : '▶ Play'}</button>
        <button onClick={stepF} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏭ Step</button>
        <button onClick={reset} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">↺ Reset</button>
        <span class="text-xs text-muted">frame {idx + 1}/{frames.length}</span>
        <label class="ml-auto flex items-center gap-2 text-xs text-muted">speed
          <input type="range" min={0.5} max={3} step={0.5} value={speed} onInput={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))} class="w-24 accent-[#4f46e5]" />
        </label>
      </div>
      <p class="mt-2 text-center text-xs text-muted">Tip: each half lists 2^(n/2) sums, not 2ⁿ — the split is what tames the exponential.</p>
    </div>
  );
}
