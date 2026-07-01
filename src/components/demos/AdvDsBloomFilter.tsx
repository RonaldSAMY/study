import { useEffect, useMemo, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated Bloom filter: insert + query with a false-positive demo.
   - Inserting a word sets k hash bits to 1.
   - Querying checks those k bits: all 1 ⇒ "maybe", any 0 ⇒ "definitely
     not". If a never-inserted word lights up all-1, the demo flags it
     as a FALSE POSITIVE live.
   - Transport: Play / Pause / Step / Back / Reset + speed, with the
     active bit highlighted and a caption narrating each hash.
   ------------------------------------------------------------------ */

const SKY = '#0ea5e9';
const EM = '#10b981';
const ROSE = '#f43f5e';

type Frame = { bits: number[]; hi: number; kind: string; ok: boolean | null; caption: string; fp?: boolean };

function murmur(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    let k = str.charCodeAt(i);
    k = Math.imul(k, 0xcc9e2d51); k = (k << 15) | (k >>> 17); k = Math.imul(k, 0x1b873593);
    h ^= k; h = (h << 13) | (h >>> 19); h = Math.imul(h, 5) + 0xe6546b64;
  }
  h ^= str.length; h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13;
  return h >>> 0;
}
function fnv(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function hashes(item: string, k: number, m: number): number[] {
  const h1 = murmur(item), h2 = fnv(item);
  const out: number[] = [];
  for (let i = 0; i < k; i++) out.push(((h1 + i * h2) % m + m) % m);
  return out;
}

function build(insertItems: string[], query: string) {
  const m = 36, k = 3;
  const bits = new Array(m).fill(0);
  const frames: Frame[] = [];
  frames.push({ bits: [...bits], hi: -1, kind: 'start', ok: null, caption: 'Empty filter: every one of the 36 bits is 0.' });
  for (const it of insertItems) {
    hashes(it, k, m).forEach((idx, j) => {
      bits[idx] = 1;
      frames.push({ bits: [...bits], hi: idx, kind: 'insert', ok: null,
        caption: `insert("${it}"): hash #${j + 1} → bit ${idx}. Set it to 1.` });
    });
  }
  frames.push({ bits: [...bits], hi: -1, kind: 'query', ok: null, caption: `Now query "${query}". Check its ${k} hash bits — no scanning the words themselves.` });
  let allset = true;
  const hs = hashes(query, k, m);
  for (let j = 0; j < hs.length; j++) {
    const idx = hs[j];
    const set = bits[idx] === 1;
    if (!set) allset = false;
    frames.push({ bits: [...bits], hi: idx, kind: 'check', ok: set,
      caption: `Check hash #${j + 1} → bit ${idx}: ${set ? '1 ✓ (set)' : '0 ✗ — that 0 proves it is NOT in the set'}.` });
    if (!set) break;
  }
  const inserted = insertItems.includes(query);
  let caption: string;
  if (!allset) caption = `Verdict: "${query}" is DEFINITELY NOT in the set. A single 0 bit is conclusive.`;
  else if (inserted) caption = `Verdict: all bits set → "${query}" is probably present (and it really was inserted).`;
  else caption = `Verdict: all bits set → "${query}" reads as "maybe", yet it was never inserted. This is a FALSE POSITIVE.`;
  frames.push({ bits: [...bits], hi: -1, kind: 'verdict', ok: allset, caption, fp: allset && !inserted });
  return { m, k, frames };
}

export default function AdvDsBloomFilter() {
  const [insText, setInsText] = useState('cat, dog, fox, owl, bee');
  const [query, setQuery] = useState('pig');
  const [items, setItems] = useState<string[]>(() => ['cat', 'dog', 'fox', 'owl', 'bee']);
  const [q, setQ] = useState('pig');

  const { m, frames } = useMemo(() => build(items, q), [items, q]);

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
    const interval = 760 / speed;
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
    const parsed = insText.split(',').map((s) => s.trim()).filter(Boolean);
    if (parsed.length) { setItems(parsed); setQ(query.trim() || parsed[0]); }
  };

  const f = frames[idx];

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <input value={insText} onInput={(e) => setInsText((e.target as HTMLInputElement).value)}
          class="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm" placeholder="words to insert" />
        <label class="flex items-center gap-1.5 text-xs text-muted">query
          <input value={query} onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
            class="w-24 rounded-lg border border-border bg-surface-2 px-2 py-1 font-mono text-sm" />
        </label>
        <button onClick={commit} class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Load</button>
      </div>

      <div class="grid gap-1.5" style="grid-template-columns:repeat(12,minmax(0,1fr))">
        {f.bits.map((b, i) => {
          const active = f.hi === i;
          let bg = b ? SKY : 'transparent';
          if (active && f.kind === 'check') bg = f.ok ? EM : ROSE;
          else if (active) bg = EM;
          return (
            <div key={i} class={`flex aspect-square items-center justify-center rounded-md border text-xs font-bold ${b || active ? 'border-transparent text-white' : 'border-border text-muted'}`}
              style={`background:${bg}${active ? ';transform:scale(1.12)' : ''}`}>{b}</div>
          );
        })}
      </div>
      <div class="mt-1 text-center text-[11px] text-muted">36-bit array · bit index 0 → 35</div>

      <p class={`mt-3 min-h-[2.5rem] rounded-lg px-3 py-2 text-sm ${f.fp ? 'bg-[#f43f5e]/15 font-semibold text-text' : 'bg-surface-2 text-text'}`}>{f.caption}</p>

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
      <p class="mt-2 text-center text-xs text-muted">Tip: query a word you DID insert (e.g. cat) for a true "maybe"; try several uninserted words to find a false positive.</p>
    </div>
  );
}
