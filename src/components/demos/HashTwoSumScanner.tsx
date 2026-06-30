import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated Two Sum via a "seen" hash map.
   - Edit the array and target. The demo scans left to right. For each
     number it asks the map: have I seen (target - num)? If yes, we have
     a pair. If no, it records (num -> index) and moves on.
   - Each frame highlights the current number, the complement it looks
     up, and the growing seen-map. A hit is celebrated at the end.
   - Transport: Play / Pause / Step / Step-back / Reset + speed.
   ------------------------------------------------------------------ */

const COLORS = { cur: '#0ea5e9', hit: '#10b981', complement: '#4f46e5' };

type Frame = {
  i: number;                 // current index being scanned
  seen: [number, number][];  // map entries (value -> index) before this step's insert
  complement: number;
  hitIndex: number | null;   // index of complement in seen, if found
  pair: [number, number] | null;
  caption: string;
  done: boolean;
};

function buildFrames(nums: number[], target: number): Frame[] {
  const frames: Frame[] = [];
  const seen = new Map<number, number>();
  const entries = () => [...seen.entries()] as [number, number][];
  frames.push({ i: -1, seen: entries(), complement: 0, hitIndex: null, pair: null, caption: `Scan left to right looking for two numbers that add to ${target}. The map remembers values we have already passed.`, done: false });

  for (let i = 0; i < nums.length; i++) {
    const comp = target - nums[i];
    const hit = seen.has(comp) ? seen.get(comp)! : null;
    frames.push({ i, seen: entries(), complement: comp, hitIndex: hit, pair: null, caption: `At index ${i}, value ${nums[i]}. Need ${target} − ${nums[i]} = ${comp}. Is ${comp} in the map?`, done: false });
    if (hit !== null) {
      frames.push({ i, seen: entries(), complement: comp, hitIndex: hit, pair: [hit, i], caption: `Yes — ${comp} was seen at index ${hit}. Pair found: indices ${hit} and ${i} (${nums[hit]} + ${nums[i]} = ${target}).`, done: true });
      return frames;
    }
    seen.set(nums[i], i);
    frames.push({ i, seen: entries(), complement: comp, hitIndex: null, pair: null, caption: `${comp} is not in the map. Record ${nums[i]} → index ${i} and continue.`, done: false });
  }
  frames.push({ i: nums.length, seen: entries(), complement: 0, hitIndex: null, pair: null, caption: `Reached the end with no match — no two numbers add to ${target}.`, done: true });
  return frames;
}

const parseList = (s: string): number[] => s.split(',').map((x) => parseInt(x.trim(), 10)).filter((x) => Number.isFinite(x)).slice(0, 12);

export default function HashTwoSumScanner() {
  const [text, setText] = useState('2, 7, 11, 15');
  const [targetText, setTargetText] = useState('9');
  const [nums, setNums] = useState<number[]>(() => parseList('2, 7, 11, 15'));
  const [target, setTarget] = useState(9);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);
  idxRef.current = idx;

  const frames = buildFrames(nums, target);
  const last = frames.length - 1;

  const commit = () => {
    const p = parseList(text);
    const t = parseInt(targetText, 10);
    if (p.length && Number.isFinite(t)) { setNums(p); setTarget(t); setIdx(0); setPlaying(false); }
  };

  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 950 / speed;
    const tick = (t: number) => {
      if (!lastRef.current) lastRef.current = t;
      if (t - lastRef.current >= interval) {
        lastRef.current = t;
        const next = idxRef.current + 1;
        if (next > last) { setIdx(last); setPlaying(false); return; }
        setIdx(next);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
  }, [playing, speed, nums, target]);

  const reset = () => { setPlaying(false); setIdx(0); lastRef.current = 0; };
  const stepF = () => { setPlaying(false); setIdx((v) => Math.min(last, v + 1)); };
  const stepB = () => { setPlaying(false); setIdx((v) => Math.max(0, v - 1)); };
  const play = () => { if (idx >= last) setIdx(0); lastRef.current = 0; setPlaying((p) => !p); };

  const f = frames[Math.min(idx, last)];
  const pairSet = new Set(f.pair ?? []);

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <input value={text} onInput={(e) => setText((e.target as HTMLInputElement).value)} class="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm" placeholder="comma-separated numbers" />
        <label class="flex items-center gap-1.5 text-xs text-muted">target
          <input value={targetText} onInput={(e) => setTargetText((e.target as HTMLInputElement).value)} class="w-16 rounded-lg border border-border bg-surface-2 px-2 py-1.5 font-mono text-sm" />
        </label>
        <button onClick={commit} class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Load</button>
      </div>

      {/* array row */}
      <div class="flex flex-wrap gap-1.5 font-mono text-sm">
        {nums.map((x, i) => {
          const isCur = i === f.i && !pairSet.size;
          const inPair = pairSet.has(i);
          return (
            <span key={i} class={`flex flex-col items-center rounded-md border px-2.5 py-1.5 transition ${inPair ? 'scale-110 border-transparent text-white' : isCur ? 'scale-110 border-transparent text-white' : 'border-border bg-surface-2 text-text'}`} style={inPair ? `background:${COLORS.hit}` : isCur ? `background:${COLORS.cur}` : ''}>
              <span class="text-base font-bold">{x}</span>
              <span class="text-[10px] opacity-70">i={i}</span>
            </span>
          );
        })}
      </div>

      {/* seen map */}
      <div class="mt-3">
        <span class="text-xs font-semibold text-muted">seen map (value → index)</span>
        <div class="mt-1 flex min-h-[2.25rem] flex-wrap items-center gap-1.5 rounded-lg bg-surface-2 px-2 py-2 font-mono text-xs">
          {f.seen.length === 0 && <span class="text-muted/60">empty</span>}
          {f.seen.map(([v, i]) => {
            const isHit = f.hitIndex !== null && v === f.complement;
            return (
              <span key={`${v}-${i}`} class={`rounded-md px-2 py-1 font-semibold ${isHit ? 'text-white' : 'bg-surface text-text'}`} style={isHit ? `background:${COLORS.complement}` : ''}>{v}→{i}</span>
            );
          })}
        </div>
      </div>

      <p class="mt-3 min-h-[2.5rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">{f.caption}</p>
      {f.done && f.pair && <p class="mt-2 rounded-lg bg-brand-soft px-3 py-2 text-sm font-semibold text-text">One pass, O(n). The map turned a nested-loop search into a single sweep.</p>}

      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={stepB} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏮ Back</button>
        <button onClick={play} class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90">{playing ? '⏸ Pause' : '▶ Play'}</button>
        <button onClick={stepF} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏭ Step</button>
        <button onClick={reset} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">↺ Reset</button>
        <label class="ml-auto flex items-center gap-2 text-xs text-muted">speed
          <input type="range" min={0.5} max={3} step={0.5} value={speed} onInput={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))} class="w-24 accent-[#4f46e5]" />
        </label>
      </div>
      <p class="mt-2 text-center text-xs text-muted">Try target 26 on the default array (11 + 15), or a target with no pair to see the scan fall through.</p>
    </div>
  );
}
