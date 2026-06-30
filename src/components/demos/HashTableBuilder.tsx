import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated hash-table builder (separate chaining + load-factor resize).
   - Edit the list of keys. The demo inserts them one at a time:
     hash the key -> place it in a bucket -> when load factor passes
     0.75 it DOUBLES capacity and rehashes every key into a bigger table.
   - Each frame is a full precomputed snapshot (capacity + buckets +
     caption), so stepping forward/back is exact.
   - Transport: Play / Pause / Step / Step-back / Reset + speed.
   ------------------------------------------------------------------ */

const PRIME = 31;
const LOAD = 0.75;
const START_CAP = 4;
const COLORS = { cur: '#0ea5e9', bucket: '#4f46e5', resize: '#10b981' };

const hash = (key: string, cap: number) => {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * PRIME + key.charCodeAt(i)) % cap;
  return h;
};

type Frame = {
  cap: number;
  buckets: string[][];
  size: number;
  activeBucket: number | null;
  activeKey: string | null;
  caption: string;
  phase: 'hash' | 'place' | 'resize' | 'idle';
};

function buildFrames(keys: string[]): Frame[] {
  const frames: Frame[] = [];
  let cap = START_CAP;
  let buckets: string[][] = Array.from({ length: cap }, () => []);
  let size = 0;
  const snapshot = (b: string[][]) => b.map((x) => [...x]);

  frames.push({ cap, buckets: snapshot(buckets), size, activeBucket: null, activeKey: null, caption: `Empty table, capacity ${cap}. Press Play to insert the keys.`, phase: 'idle' });

  for (const k of keys) {
    const idx = hash(k, cap);
    frames.push({ cap, buckets: snapshot(buckets), size, activeBucket: idx, activeKey: k, caption: `hash("${k}") mod ${cap} = bucket ${idx}.`, phase: 'hash' });
    buckets[idx].push(k);
    size++;
    const lf = size / cap;
    frames.push({ cap, buckets: snapshot(buckets), size, activeBucket: idx, activeKey: k, caption: `Placed "${k}" in bucket ${idx}. Size ${size}, load factor ${lf.toFixed(2)}.`, phase: 'place' });

    if (lf > LOAD) {
      const newCap = cap * 2;
      const nb: string[][] = Array.from({ length: newCap }, () => []);
      for (const bucket of buckets) for (const key of bucket) nb[hash(key, newCap)].push(key);
      cap = newCap;
      buckets = nb;
      frames.push({ cap, buckets: snapshot(buckets), size, activeBucket: null, activeKey: null, caption: `Load factor ${lf.toFixed(2)} > ${LOAD} → resize to capacity ${cap} and rehash every key.`, phase: 'resize' });
    }
  }
  return frames;
}

const parseKeys = (s: string): string[] => s.split(',').map((x) => x.trim()).filter((x) => x.length > 0).slice(0, 10);

export default function HashTableBuilder() {
  const [text, setText] = useState('apple, banana, cherry, date, fig');
  const [keys, setKeys] = useState<string[]>(() => parseKeys('apple, banana, cherry, date, fig'));
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);
  idxRef.current = idx;

  const frames = buildFrames(keys);
  const last = frames.length - 1;

  const commit = () => { const p = parseKeys(text); if (p.length) { setKeys(p); setIdx(0); setPlaying(false); } };

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
  }, [playing, speed, keys]);

  const reset = () => { setPlaying(false); setIdx(0); lastRef.current = 0; };
  const stepF = () => { setPlaying(false); setIdx((v) => Math.min(last, v + 1)); };
  const stepB = () => { setPlaying(false); setIdx((v) => Math.max(0, v - 1)); };
  const play = () => { if (idx >= last) setIdx(0); lastRef.current = 0; setPlaying((p) => !p); };

  const f = frames[Math.min(idx, last)];
  const lf = f.size / f.cap;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <input value={text} onInput={(e) => setText((e.target as HTMLInputElement).value)} class="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm" placeholder="comma-separated keys" />
        <button onClick={commit} class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Load</button>
      </div>

      <div class="mb-3 flex flex-wrap items-center gap-3 text-xs text-muted">
        <span>capacity <strong class="text-text">{f.cap}</strong></span>
        <span>size <strong class="text-text">{f.size}</strong></span>
        <span class="flex items-center gap-1">load factor
          <span class="inline-block h-2 w-24 overflow-hidden rounded-full bg-surface-2">
            <span class="block h-full" style={`width:${Math.min(100, lf * 100)}%;background:${lf > LOAD ? COLORS.resize : COLORS.bucket}`}></span>
          </span>
          <strong class="text-text">{lf.toFixed(2)}</strong>
        </span>
      </div>

      {/* buckets */}
      <div class="space-y-1.5">
        {f.buckets.map((bucket, i) => (
          <div key={i} class={`flex items-center gap-2 rounded-md border px-2 py-1 transition ${i === f.activeBucket ? 'border-transparent' : 'border-border'}`} style={i === f.activeBucket ? `background:${(f.phase === 'resize' ? COLORS.resize : COLORS.cur)}1a` : ''}>
            <span class="w-6 shrink-0 text-right font-mono text-xs text-muted">{i}</span>
            <div class="flex flex-1 flex-wrap items-center gap-1">
              {bucket.length === 0 && <span class="text-xs text-muted/60">empty</span>}
              {bucket.map((k, j) => (
                <span key={j} class="flex items-center font-mono text-xs">
                  {j > 0 && <span class="mx-1 text-muted">→</span>}
                  <span class={`rounded-md px-2 py-1 font-semibold ${k === f.activeKey && i === f.activeBucket ? 'text-white' : 'bg-surface-2 text-text'}`} style={k === f.activeKey && i === f.activeBucket ? `background:${COLORS.bucket}` : ''}>{k}</span>
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <p class="mt-3 min-h-[2.5rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">{f.caption}</p>

      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={stepB} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏮ Back</button>
        <button onClick={play} class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90">{playing ? '⏸ Pause' : '▶ Play'}</button>
        <button onClick={stepF} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏭ Step</button>
        <button onClick={reset} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">↺ Reset</button>
        <label class="ml-auto flex items-center gap-2 text-xs text-muted">speed
          <input type="range" min={0.5} max={3} step={0.5} value={speed} onInput={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))} class="w-24 accent-[#4f46e5]" />
        </label>
      </div>
      <p class="mt-2 text-center text-xs text-muted">Tip: add more keys to push the load factor past 0.75 and watch the table double and rehash.</p>
    </div>
  );
}
