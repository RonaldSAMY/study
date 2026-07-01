import { useEffect, useMemo, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated skip-list SEARCH.
   - A deterministic "perfect" skip list is built from your sorted keys
     (node i sits on level = number of trailing zeros of i+1), so the
     express lanes are reproducible.
   - Searching a target walks RIGHT along a lane while next < target,
     then DROPS DOWN a level — exactly how O(log n) search works.
   - Transport: Play / Pause / Step / Back / Reset + speed. The active
     node is highlighted and a caption narrates every move.
   ------------------------------------------------------------------ */

const IND = '#4f46e5';
const SKY = '#0ea5e9';
const EM = '#10b981';
const MAXCAP = 4;

type Frame = { level: number; rank: number; cmp: number | null; caption: string; done: boolean; found: boolean };

function trailingZeros(x: number): number {
  let c = 0;
  while ((x & 1) === 0 && c < MAXCAP) { x >>= 1; c++; }
  return c;
}

function build(raw: number[], target: number) {
  const keys = Array.from(new Set(raw)).sort((a, b) => a - b);
  const n = keys.length;
  const level = keys.map((_, i) => trailingZeros(i + 1));
  const maxUsed = n ? Math.max(...level) : 0;
  const laneOf = (L: number) => keys.map((_, i) => i).filter((i) => level[i] >= L);

  const frames: Frame[] = [];
  let curLevel = maxUsed;
  let curRank = -1;
  frames.push({ level: curLevel, rank: -1, cmp: null, done: false, found: false,
    caption: `Start at HEAD on the top express lane (level ${maxUsed}). Target = ${target}.` });

  while (curLevel >= 0) {
    const lane = laneOf(curLevel);
    for (;;) {
      const next = lane.find((r) => r > curRank);
      if (next !== undefined && keys[next] < target) {
        curRank = next;
        frames.push({ level: curLevel, rank: curRank, cmp: next, done: false, found: false,
          caption: `Level ${curLevel}: ${keys[next]} < ${target}, walk right to ${keys[next]}.` });
      } else if (next !== undefined && keys[next] === target) {
        frames.push({ level: curLevel, rank: next, cmp: next, done: true, found: true,
          caption: `Found ${target} at level ${curLevel}! The express lanes skipped most of the list.` });
        return { keys, level, maxUsed, frames };
      } else {
        if (curLevel > 0) {
          frames.push({ level: curLevel - 1, rank: curRank, cmp: null, done: false, found: false,
            caption: `Level ${curLevel}: next is ${next !== undefined ? keys[next] : 'NIL'} ≥ ${target}. Drop down to level ${curLevel - 1}.` });
        }
        break;
      }
    }
    curLevel--;
  }
  frames.push({ level: 0, rank: curRank, cmp: null, done: true, found: false,
    caption: `${target} is not in the list — we fell off the bottom lane without a match.` });
  return { keys, level, maxUsed, frames };
}

export default function AdvDsSkipListSearch() {
  const [text, setText] = useState('5, 12, 19, 25, 31, 38, 44, 50, 60, 72, 80, 91, 99');
  const [keysIn, setKeysIn] = useState<number[]>(() =>
    '5, 12, 19, 25, 31, 38, 44, 50, 60, 72, 80, 91, 99'.split(',').map((s) => parseInt(s, 10)));
  const [target, setTarget] = useState(60);

  const { keys, level, maxUsed, frames } = useMemo(() => build(keysIn, target), [keysIn, target]);

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

  const commit = () => {
    const parsed = text.split(',').map((s) => parseInt(s.trim(), 10)).filter((x) => Number.isFinite(x));
    if (parsed.length >= 2) setKeysIn(parsed);
  };

  const f = frames[idx];
  const n = keys.length;
  const colW = 58;
  const rowH = 52;
  const padL = 60;
  const padT = 20;
  const W = padL + n * colW + 20;
  const H = padT + (maxUsed + 1) * rowH + 10;
  const colX = (rank: number) => (rank < 0 ? 28 : padL + rank * colW);
  const rowY = (lvl: number) => padT + (maxUsed - lvl) * rowH;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <input value={text} onInput={(e) => setText((e.target as HTMLInputElement).value)}
          class="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm" placeholder="sorted keys" />
        <button onClick={commit} class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Load</button>
        <label class="flex items-center gap-1.5 text-xs text-muted">target
          <input type="number" value={target} onInput={(e) => setTarget(parseInt((e.target as HTMLInputElement).value, 10) || 0)}
            class="w-20 rounded-lg border border-border bg-surface-2 px-2 py-1 font-mono text-sm" />
        </label>
      </div>

      <div class="overflow-x-auto rounded-xl bg-surface-2 p-2">
        <svg viewBox={`0 0 ${W} ${H}`} class="touch-none" style={`width:100%;min-width:${Math.min(W, 680)}px;height:auto`}>
          {Array.from({ length: maxUsed + 1 }, (_, r) => maxUsed - r).map((L) => {
            const present = [-1, ...keys.map((_, i) => i).filter((i) => level[i] >= L)];
            const y = rowY(L);
            return (
              <g key={L}>
                <line x1={colX(present[0])} y1={y} x2={W - 14} y2={y} stroke="rgba(128,128,128,0.35)" stroke-width={2} />
                <text x={4} y={y + 4} font-size="11" fill="#94a3b8">L{L}</text>
                <text x={W - 12} y={y + 4} font-size="10" fill="#94a3b8">NIL</text>
                {present.map((rank) => {
                  const isHead = rank < 0;
                  const active = f.level === L && f.rank === rank;
                  const isCmp = f.cmp === rank && rank >= 0 && f.level === L;
                  const fill = active ? (f.found ? EM : SKY) : isHead ? IND : 'var(--surface, #1e293b)';
                  return (
                    <g key={rank}>
                      <circle cx={colX(rank)} cy={y} r={active ? 17 : 14}
                        fill={active ? fill : isHead ? IND : '#0f172a'}
                        stroke={isCmp ? EM : active ? '#fff' : 'rgba(148,163,184,0.6)'} stroke-width={isCmp || active ? 3 : 1.5} />
                      <text x={colX(rank)} y={y + 4} text-anchor="middle" font-size={isHead ? 9 : 11}
                        fill="#fff" font-weight="600">{isHead ? 'H' : keys[rank]}</text>
                    </g>
                  );
                })}
              </g>
            );
          })}
        </svg>
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
      <p class="mt-2 text-center text-xs text-muted">Tip: search a value that is NOT a key (e.g. 55) to watch the search fall off the bottom lane.</p>
    </div>
  );
}
