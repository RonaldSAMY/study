import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated collision resolution: separate chaining vs linear probing.
   - Edit the keys; toggle the strategy. Capacity is fixed and small so
     collisions are frequent and visible.
   - Chaining: colliding keys form a linked list inside one bucket.
   - Linear probing: on collision the demo SCANS to the next slot
     (h, h+1, h+2, ...) until it finds an empty one — each probe is a
     frame you can step through.
   - Transport: Play / Pause / Step / Step-back / Reset + speed.
   ------------------------------------------------------------------ */

const PRIME = 31;
const CAP = 7; // small prime -> visible collisions
const COLORS = { home: '#0ea5e9', probe: '#f59e0b', place: '#4f46e5', collide: '#ef4444' };

type Strategy = 'chaining' | 'probing';

const hash = (key: string) => {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * PRIME + key.charCodeAt(i)) % CAP;
  return h;
};

type Frame = {
  slots: (string[] | string | null)[]; // chaining: string[] per slot; probing: string|null per slot
  home: number | null;
  scan: number | null;     // currently inspected slot (probing)
  placed: number | null;   // slot where key just landed
  activeKey: string | null;
  caption: string;
};

function chainFrames(keys: string[]): Frame[] {
  const slots: string[][] = Array.from({ length: CAP }, () => []);
  const frames: Frame[] = [];
  const snap = () => slots.map((s) => [...s]);
  frames.push({ slots: snap(), home: null, scan: null, placed: null, activeKey: null, caption: `Empty table, ${CAP} buckets. Chaining stores collisions as a linked list inside one bucket.` });
  for (const k of keys) {
    const h = hash(k);
    const collided = slots[h].length > 0;
    frames.push({ slots: snap(), home: h, scan: null, placed: null, activeKey: k, caption: `hash("${k}") = ${h}.${collided ? ` Bucket ${h} is occupied — collision!` : ''}` });
    slots[h].push(k);
    frames.push({ slots: snap(), home: h, scan: null, placed: h, activeKey: k, caption: collided ? `Append "${k}" to the chain in bucket ${h}. No probing — the list just grows.` : `Place "${k}" in bucket ${h}.` });
  }
  return frames;
}

function probeFrames(keys: string[]): Frame[] {
  const slots: (string | null)[] = Array.from({ length: CAP }, () => null);
  const frames: Frame[] = [];
  const snap = () => [...slots];
  frames.push({ slots: snap(), home: null, scan: null, placed: null, activeKey: null, caption: `Empty table, ${CAP} slots. Linear probing keeps everything in the array and scans for the next free slot.` });
  for (const k of keys) {
    const h = hash(k);
    frames.push({ slots: snap(), home: h, scan: h, placed: null, activeKey: k, caption: `hash("${k}") = ${h}. Probe slot ${h}…` });
    let i = h;
    let steps = 0;
    while (slots[i] !== null && steps < CAP) {
      frames.push({ slots: snap(), home: h, scan: i, placed: null, activeKey: k, caption: `Slot ${i} holds "${slots[i]}" — occupied. Move to slot ${(i + 1) % CAP}.` });
      i = (i + 1) % CAP;
      steps++;
    }
    if (steps >= CAP) { frames.push({ slots: snap(), home: h, scan: null, placed: null, activeKey: k, caption: `Table is full — "${k}" cannot be inserted (in practice you resize first).` }); break; }
    slots[i] = k;
    frames.push({ slots: snap(), home: h, scan: i, placed: i, activeKey: k, caption: i === h ? `Slot ${i} was free — place "${k}" there.` : `First free slot is ${i}. Place "${k}" there (${i - h < 0 ? i + CAP - h : i - h} probe${(i - h + CAP) % CAP === 1 ? '' : 's'} away).` });
  }
  return frames;
}

const parseKeys = (s: string): string[] => s.split(',').map((x) => x.trim()).filter((x) => x.length > 0).slice(0, 8);

export default function HashCollisionResolver() {
  const [text, setText] = useState('cat, dog, bird, fish, owl');
  const [keys, setKeys] = useState<string[]>(() => parseKeys('cat, dog, bird, fish, owl'));
  const [strategy, setStrategy] = useState<Strategy>('chaining');
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);
  idxRef.current = idx;

  const frames = strategy === 'chaining' ? chainFrames(keys) : probeFrames(keys);
  const last = frames.length - 1;

  const commit = () => { const p = parseKeys(text); if (p.length) { setKeys(p); setIdx(0); setPlaying(false); } };
  const switchStrategy = (s: Strategy) => { setStrategy(s); setIdx(0); setPlaying(false); };

  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 900 / speed;
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
  }, [playing, speed, keys, strategy]);

  const reset = () => { setPlaying(false); setIdx(0); lastRef.current = 0; };
  const stepF = () => { setPlaying(false); setIdx((v) => Math.min(last, v + 1)); };
  const stepB = () => { setPlaying(false); setIdx((v) => Math.max(0, v - 1)); };
  const play = () => { if (idx >= last) setIdx(0); lastRef.current = 0; setPlaying((p) => !p); };

  const f = frames[Math.min(idx, last)];

  const slotColor = (i: number): string => {
    if (i === f.placed) return COLORS.place;
    if (i === f.scan) return COLORS.probe;
    if (i === f.home) return COLORS.home;
    return '';
  };

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <input value={text} onInput={(e) => setText((e.target as HTMLInputElement).value)} class="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm" placeholder="comma-separated keys" />
        <button onClick={commit} class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Load</button>
      </div>

      <div class="mb-3 flex gap-2">
        {(['chaining', 'probing'] as Strategy[]).map((s) => (
          <button key={s} onClick={() => switchStrategy(s)} class={`rounded-lg px-3 py-1.5 text-sm font-semibold capitalize transition ${strategy === s ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'}`}>
            {s === 'chaining' ? 'Separate chaining' : 'Linear probing'}
          </button>
        ))}
      </div>

      {/* slots */}
      <div class="space-y-1.5">
        {Array.from({ length: CAP }, (_, i) => {
          const c = slotColor(i);
          const cell = f.slots[i];
          return (
            <div key={i} class={`flex items-center gap-2 rounded-md border px-2 py-1.5 transition ${c ? 'border-transparent' : 'border-border'}`} style={c ? `background:${c}1a` : ''}>
              <span class="w-6 shrink-0 text-right font-mono text-xs" style={c ? `color:${c}` : 'color:var(--muted, #94a3b8)'}>{i}</span>
              <div class="flex flex-1 flex-wrap items-center gap-1 font-mono text-xs">
                {strategy === 'chaining' ? (
                  (cell as string[]).length === 0 ? <span class="text-muted/60">empty</span> :
                    (cell as string[]).map((k, j) => (
                      <span key={j} class="flex items-center">
                        {j > 0 && <span class="mx-1 text-muted">→</span>}
                        <span class={`rounded-md px-2 py-1 font-semibold ${k === f.activeKey && i === f.placed ? 'text-white' : 'bg-surface-2 text-text'}`} style={k === f.activeKey && i === f.placed ? `background:${COLORS.place}` : ''}>{k}</span>
                      </span>
                    ))
                ) : (
                  cell === null ? <span class="text-muted/60">empty</span> :
                    <span class={`rounded-md px-2 py-1 font-semibold ${i === f.placed ? 'text-white' : 'bg-surface-2 text-text'}`} style={i === f.placed ? `background:${COLORS.place}` : ''}>{cell as string}</span>
                )}
              </div>
            </div>
          );
        })}
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
      <p class="mt-2 text-center text-xs text-muted">Sky = home bucket, amber = a slot being probed, indigo = where the key landed. Switch strategies on the same keys to compare.</p>
    </div>
  );
}
