import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Fractional knapsack — fill by value-density.
   - Edit items ("weight:value") and the capacity. The demo sorts items
     by value/weight ratio (most valuable per kilo first) and pours them
     into the bag, taking a FRACTION of the item that overflows.
   - The greedy choice each step is "the densest remaining item" — every
     kilo of capacity should hold the most value it possibly can.
   - A horizontal capacity bar fills with colored segments.
   - Transport: Play / Pause / Step / Step-back / Reset + speed.
   ------------------------------------------------------------------ */

const PALETTE = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6', '#ef4444'];

type Item = { w: number; v: number; label: string; color: string };
type Frame = { item: number; weightTaken: number; valueTaken: number; fraction: number; capUsedAfter: number; valueAfter: number };

const parseItems = (s: string): Item[] => {
  const out: Item[] = [];
  let n = 0;
  for (const part of s.split(',')) {
    const m = part.trim().match(/^(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)$/);
    if (!m) continue;
    const w = parseFloat(m[1]);
    const v = parseFloat(m[2]);
    if (w > 0 && v > 0) out.push({ w, v, label: String.fromCharCode(65 + n), color: PALETTE[n % PALETTE.length] }), n++;
  }
  return out;
};

function computeFrames(sorted: Item[], capacity: number): Frame[] {
  const frames: Frame[] = [];
  let cap = capacity;
  let used = 0;
  let value = 0;
  for (let i = 0; i < sorted.length; i++) {
    if (cap <= 1e-9) break;
    const it = sorted[i];
    const take = Math.min(it.w, cap);
    const frac = take / it.w;
    const val = it.v * frac;
    cap -= take;
    used += take;
    value += val;
    frames.push({ item: i, weightTaken: take, valueTaken: val, fraction: frac, capUsedAfter: used, valueAfter: value });
  }
  return frames;
}

export default function GreedyFractionalKnapsack() {
  const [itemText, setItemText] = useState('10:60, 20:100, 30:120');
  const [capText, setCapText] = useState('50');
  const [items, setItems] = useState<Item[]>(() => parseItems('10:60, 20:100, 30:120'));
  const [capacity, setCapacity] = useState(50);

  const sorted = [...items].sort((a, b) => b.v / b.w - a.v / a.w);
  const frames = computeFrames(sorted, capacity);

  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);
  idxRef.current = idx;

  const commit = () => {
    const it = parseItems(itemText);
    const c = parseFloat(capText);
    if (it.length && Number.isFinite(c) && c > 0) { setItems(it); setCapacity(c); setIdx(0); setPlaying(false); }
  };

  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 950 / speed;
    const tick = (t: number) => {
      if (!lastRef.current) lastRef.current = t;
      if (t - lastRef.current >= interval) {
        lastRef.current = t;
        const next = idxRef.current + 1;
        if (next >= frames.length + 1) { setIdx(frames.length); setPlaying(false); return; }
        setIdx(next);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
  }, [playing, speed, items, capacity]);

  const reset = () => { setPlaying(false); setIdx(0); lastRef.current = 0; };
  const stepF = () => { setPlaying(false); setIdx((v) => Math.min(frames.length, v + 1)); };
  const stepB = () => { setPlaying(false); setIdx((v) => Math.max(0, v - 1)); };
  const play = () => { if (idx >= frames.length) setIdx(0); lastRef.current = 0; setPlaying((p) => !p); };

  const taken = frames.slice(0, idx);
  const totalValue = idx > 0 ? frames[idx - 1].valueAfter : 0;
  const usedCap = idx > 0 ? frames[idx - 1].capUsedAfter : 0;
  const done = idx >= frames.length;
  const curFrame = idx > 0 ? frames[idx - 1] : null;
  const curItem = curFrame ? sorted[curFrame.item] : null;
  const nextItem = !done && idx < frames.length ? sorted[frames[idx].item] : null;

  const caption = idx === 0
    ? 'Items are sorted by value-density (value ÷ weight). Pour in the densest first — every kilo should carry the most value.'
    : curFrame!.fraction >= 0.999
      ? `${curItem!.label} has the best remaining density (${(curItem!.v / curItem!.w).toFixed(2)} per kg) and fits whole — take all ${curItem!.w} kg for +${curFrame!.valueTaken.toFixed(0)} value.`
      : `Only ${(capacity - (frames[idx - 2]?.capUsedAfter ?? 0)).toFixed(1)} kg left — take ${(curFrame!.fraction * 100).toFixed(0)}% of ${curItem!.label} for +${curFrame!.valueTaken.toFixed(1)}. Bag is now full.`;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 grid gap-2 sm:grid-cols-[2fr_1fr_auto]">
        <label class="flex items-center gap-2 text-sm text-muted">items
          <input value={itemText} onInput={(e) => setItemText((e.target as HTMLInputElement).value)} class="w-full rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm" placeholder="10:60, 20:100" />
        </label>
        <label class="flex items-center gap-2 text-sm text-muted">cap
          <input value={capText} onInput={(e) => setCapText((e.target as HTMLInputElement).value)} class="w-full rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm" />
        </label>
        <button onClick={commit} class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Load</button>
      </div>

      {/* item table sorted by density */}
      <div class="flex flex-wrap gap-1.5 text-xs font-mono">
        {sorted.map((it, i) => {
          const isCur = curFrame ? i === curFrame.item : false;
          const isNext = nextItem ? sorted.indexOf(nextItem) === i : false;
          const consumed = idx > 0 && i < (curFrame ? curFrame.item + 1 : 0);
          return (
            <span key={it.label} class={`rounded-md border px-2 py-1 transition ${isNext ? 'scale-105 border-transparent text-white' : consumed ? 'border-border text-muted' : 'border-border bg-surface-2 text-text'}`} style={isNext ? `background:${COLORS_cur}` : consumed ? `background:${it.color}22` : ''}>
              <span class="font-bold" style={`color:${it.color}`}>{it.label}</span> {it.w}kg/${it.v} · {(it.v / it.w).toFixed(2)}/kg
            </span>
          );
        })}
      </div>

      {/* capacity fill bar */}
      <div class="mt-3">
        <div class="mb-1 flex justify-between text-xs text-muted"><span>knapsack</span><span>{usedCap.toFixed(1)} / {capacity} kg</span></div>
        <div class="flex h-10 w-full overflow-hidden rounded-lg border border-border bg-surface-2">
          {taken.map((f, i) => {
            const it = sorted[f.item];
            const pct = (f.weightTaken / capacity) * 100;
            return <div key={i} class="flex items-center justify-center text-xs font-bold text-white transition-all" style={`width:${pct}%;background:${it.color}`}>{pct > 8 ? `${it.label}${f.fraction < 0.999 ? ' ' + (f.fraction * 100).toFixed(0) + '%' : ''}` : ''}</div>;
          })}
        </div>
      </div>

      <p class="mt-3 min-h-[2.75rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">{caption}</p>
      <p class="mt-2 font-mono text-sm text-text">total value: <span class="font-bold" style="color:#10b981">{totalValue.toFixed(1)}</span></p>
      {done && (
        <p class="mt-2 rounded-lg bg-brand-soft px-3 py-2 text-sm font-semibold text-text">
          Bag full at value {totalValue.toFixed(1)} — provably the maximum, because allowing fractions lets the densest items always come first.
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
      <p class="mt-2 text-center text-xs text-muted">Each item is "weight:value". The bar shows how each kilo of capacity is spent — densest first.</p>
    </div>
  );
}

const COLORS_cur = '#0ea5e9';
