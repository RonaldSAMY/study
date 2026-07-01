import { useEffect, useMemo, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated Reservoir Sampling (keep k of a stream, each with prob k/n).
   - Edit the stream and k. Items arrive one at a time. The first k fill
     the reservoir directly. For item i (1-indexed), we draw j in [0, i);
     if j < k we overwrite reservoir[j], else the item is dropped — a
     replacement probability of exactly k/i.
   - Randomness is seeded once per Load, so every frame is reproducible
     and you can step backwards through the exact same run. Reload to
     roll fresh randomness.
   - Transport: Play / Pause / Step / Step-back / Reset + speed.
   ------------------------------------------------------------------ */

const COLORS = { current: '#0ea5e9', keep: '#10b981', drop: '#f43f5e', slot: '#4f46e5' };

// deterministic RNG so the animation is reproducible across steps
function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Frame = {
  i: number; // stream index just processed
  reservoir: (number | null)[];
  j: number | null;
  slot: number | null; // replaced slot
  kind: 'fill' | 'keep' | 'drop';
  prob: string;
  caption: string;
};

function buildFrames(stream: number[], k: number, seed: number): Frame[] {
  const rand = mulberry32(seed);
  const reservoir: (number | null)[] = Array(k).fill(null);
  const frames: Frame[] = [];
  for (let i = 0; i < stream.length; i++) {
    if (i < k) {
      reservoir[i] = stream[i];
      frames.push({ i, reservoir: [...reservoir], j: i, slot: i, kind: 'fill', prob: '1',
        caption: `Item ${i + 1} = ${stream[i]}: reservoir not full yet, drop it straight into slot ${i}.` });
    } else {
      const j = Math.floor(rand() * (i + 1));
      if (j < k) {
        reservoir[j] = stream[i];
        frames.push({ i, reservoir: [...reservoir], j, slot: j, kind: 'keep', prob: `${k}/${i + 1}`,
          caption: `Item ${i + 1} = ${stream[i]}: drew j=${j} < k=${k} → keep it, overwrite slot ${j}. (chance ${k}/${i + 1})` });
      } else {
        frames.push({ i, reservoir: [...reservoir], j, slot: null, kind: 'drop', prob: `${k}/${i + 1}`,
          caption: `Item ${i + 1} = ${stream[i]}: drew j=${j} ≥ k=${k} → drop it. (keep-chance was ${k}/${i + 1})` });
      }
    }
  }
  return frames;
}

const parseList = (s: string): number[] =>
  s.split(',').map((x) => parseInt(x.trim(), 10)).filter((x) => Number.isFinite(x));

export default function MiscReservoirSampling() {
  const [text, setText] = useState('10, 20, 30, 40, 50, 60, 70, 80, 90, 100');
  const [kText, setKText] = useState('3');
  const [nums, setNums] = useState<number[]>(() => parseList('10, 20, 30, 40, 50, 60, 70, 80, 90, 100'));
  const [k, setK] = useState(3);
  const [seed, setSeed] = useState(12345);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);
  idxRef.current = idx;

  const frames = useMemo(() => buildFrames(nums, k, seed), [nums, k, seed]);
  const f = frames[Math.min(idx, frames.length - 1)];

  const commit = () => {
    const parsed = parseList(text);
    let kv = parseInt(kText, 10);
    if (!parsed.length) return;
    if (!Number.isFinite(kv)) kv = 1;
    kv = Math.max(1, Math.min(parsed.length, kv));
    setNums(parsed); setK(kv); setKText(String(kv)); setSeed((Math.random() * 1e9) | 0); setIdx(0); setPlaying(false);
  };

  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 850 / speed;
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
        <input value={text} onInput={(e) => setText((e.target as HTMLInputElement).value)} class="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm" placeholder="stream values" />
        <label class="flex items-center gap-1 text-sm text-muted">k<input value={kText} onInput={(e) => setKText((e.target as HTMLInputElement).value)} class="w-14 rounded-lg border border-border bg-surface-2 px-2 py-1.5 font-mono text-sm" /></label>
        <button onClick={commit} class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Load</button>
      </div>

      <div class="mb-1 text-xs font-semibold text-muted">stream</div>
      <div class="flex flex-wrap gap-1.5 font-mono text-sm">
        {nums.map((x, i) => {
          const isCur = i === f.i;
          const seen = i < f.i;
          let cls = 'border-border bg-surface-2 text-text';
          let style = '';
          if (seen) cls = 'border-border bg-surface-2 text-muted opacity-40';
          if (isCur) { cls = 'border-transparent text-white scale-110'; style = `background:${f.kind === 'drop' ? COLORS.drop : COLORS.current}`; }
          return <span key={i} class={`flex h-9 w-9 items-center justify-center rounded-md border text-sm font-bold transition ${cls}`} style={style}>{x}</span>;
        })}
      </div>

      <div class="mt-3 mb-1 text-xs font-semibold text-muted">reservoir (k = {k} slots)</div>
      <div class="flex flex-wrap gap-1.5 font-mono text-sm">
        {f.reservoir.map((v, i) => {
          const active = f.slot === i;
          return (
            <div key={i} class="flex flex-col items-center gap-0.5">
              <span class={`flex h-10 w-10 items-center justify-center rounded-md border text-base font-bold transition ${active ? 'border-transparent text-white scale-110' : 'border-border bg-surface-2 text-text'}`} style={active ? `background:${COLORS.keep}` : (v != null ? `background:${COLORS.slot}22;border-color:${COLORS.slot}` : '')}>{v ?? '·'}</span>
              <span class="text-[10px] text-muted">{i}</span>
            </div>
          );
        })}
        <div class="ml-3 flex items-center text-sm">
          <span class="rounded-md px-3 py-1 font-mono font-semibold text-white" style={`background:${COLORS.slot}`}>keep-prob k/i = {f.prob}</span>
        </div>
      </div>

      <p class="mt-3 min-h-[3rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">{f.caption}</p>

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
      <p class="mt-2 text-center text-xs text-muted">Tip: press Load again to re-roll the randomness. Over many runs each item lands in the reservoir about k/n of the time.</p>
    </div>
  );
}
