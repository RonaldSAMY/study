import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated polynomial hash function.
   - Edit a key (string) and a bucket count. The demo folds the key one
     character at a time with a rolling hash:  h = (h * 31 + code) % size.
   - Each step highlights the active character, shows the arithmetic, and
     lights up the bucket the running hash currently points at — so you
     watch the key "land" on an index.
   - Transport: Play / Pause / Step / Step-back / Reset + speed.
   ------------------------------------------------------------------ */

const PRIME = 31;
const COLORS = { cur: '#0ea5e9', hash: '#10b981', target: '#4f46e5' };

const clampSize = (n: number) => Math.max(2, Math.min(16, Math.floor(n) || 2));
const code = (c: string) => c.charCodeAt(0);

export default function HashFunctionExplorer() {
  const [keyText, setKeyText] = useState('apple');
  const [sizeText, setSizeText] = useState('12');
  const [key, setKey] = useState('apple');
  const [size, setSize] = useState(12);
  const [idx, setIdx] = useState(0); // 0..key.length
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);
  idxRef.current = idx;

  // prefix hashes: h[0]=0, h[k] = (h[k-1]*31 + code(key[k-1])) % size
  const hashes: number[] = (() => {
    const a = [0];
    for (let i = 0; i < key.length; i++) a.push((a[i] * PRIME + code(key[i])) % size);
    return a;
  })();

  const commit = () => {
    const k = keyText.slice(0, 14);
    const s = clampSize(parseInt(sizeText, 10));
    if (k.length === 0) return;
    setKey(k);
    setSize(s);
    setSizeText(String(s));
    setIdx(0);
    setPlaying(false);
  };

  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 900 / speed;
    const tick = (t: number) => {
      if (!lastRef.current) lastRef.current = t;
      if (t - lastRef.current >= interval) {
        lastRef.current = t;
        const next = idxRef.current + 1;
        if (next >= key.length + 1) { setIdx(key.length); setPlaying(false); return; }
        setIdx(next);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
  }, [playing, speed, key, size]);

  const reset = () => { setPlaying(false); setIdx(0); lastRef.current = 0; };
  const stepF = () => { setPlaying(false); setIdx((v) => Math.min(key.length, v + 1)); };
  const stepB = () => { setPlaying(false); setIdx((v) => Math.max(0, v - 1)); };
  const play = () => { if (idx >= key.length) setIdx(0); lastRef.current = 0; setPlaying((p) => !p); };

  const curHash = hashes[idx];
  const done = idx >= key.length;
  const curChar = idx - 1; // char just folded in

  const caption = idx === 0
    ? `h starts at 0. Press Play to fold "${key}" character by character.`
    : `h = (${hashes[idx - 1]} * ${PRIME} + ${code(key[idx - 1])} ['${key[idx - 1]}']) mod ${size} = ${(hashes[idx - 1] * PRIME + code(key[idx - 1]))} mod ${size} = ${curHash}`;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <input value={keyText} onInput={(e) => setKeyText((e.target as HTMLInputElement).value)} class="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm" placeholder="key" />
        <label class="flex items-center gap-1.5 text-xs text-muted">buckets
          <input value={sizeText} onInput={(e) => setSizeText((e.target as HTMLInputElement).value)} class="w-16 rounded-lg border border-border bg-surface-2 px-2 py-1.5 font-mono text-sm" />
        </label>
        <button onClick={commit} class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Load</button>
      </div>

      {/* characters row */}
      <div class="flex flex-wrap gap-1.5 font-mono text-sm">
        {[...key].map((ch, i) => (
          <span key={i} class={`flex flex-col items-center rounded-md border px-2.5 py-1.5 transition ${i === curChar ? 'scale-110 border-transparent text-white' : i < curChar ? 'border-border bg-surface-2 text-muted' : 'border-border bg-surface-2 text-text'}`} style={i === curChar ? `background:${COLORS.cur}` : ''}>
            <span class="text-base font-bold">{ch}</span>
            <span class="text-[10px] opacity-80">{code(ch)}</span>
          </span>
        ))}
      </div>

      {/* running hash */}
      <div class="mt-3 flex items-center gap-2 font-mono text-sm">
        <span class="font-bold" style={`color:${COLORS.hash}`}>h =</span>
        <span class="flex h-9 min-w-[2.5rem] items-center justify-center rounded-md border border-transparent px-2 text-base font-bold text-white" style={`background:${COLORS.hash}`}>{curHash}</span>
        <span class="text-muted">→ bucket index {curHash}</span>
      </div>

      {/* bucket grid */}
      <div class="mt-3 flex flex-wrap gap-1.5">
        {Array.from({ length: size }, (_, i) => (
          <div key={i} class={`flex h-10 w-10 flex-col items-center justify-center rounded-md border text-xs font-bold transition ${i === curHash ? 'scale-110 border-transparent text-white' : 'border-border bg-surface-2 text-muted'}`} style={i === curHash ? `background:${done ? COLORS.target : COLORS.hash}` : ''}>
            <span>{i}</span>
            {i === curHash && done && <span class="text-[9px] font-normal">{key}</span>}
          </div>
        ))}
      </div>

      <p class="mt-3 min-h-[2.5rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">{caption}</p>
      {done && <p class="mt-2 rounded-lg bg-brand-soft px-3 py-2 text-sm font-semibold text-text">"{key}" hashes to bucket {curHash}. Same key, same size → always the same index. That determinism is what makes lookup O(1).</p>}

      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={stepB} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏮ Back</button>
        <button onClick={play} class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90">{playing ? '⏸ Pause' : '▶ Play'}</button>
        <button onClick={stepF} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏭ Step</button>
        <button onClick={reset} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">↺ Reset</button>
        <label class="ml-auto flex items-center gap-2 text-xs text-muted">speed
          <input type="range" min={0.5} max={3} step={0.5} value={speed} onInput={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))} class="w-24 accent-[#4f46e5]" />
        </label>
      </div>
      <p class="mt-2 text-center text-xs text-muted">Tip: try keys "cat" and "act" — different order, different hash. Change the bucket count to watch every index move.</p>
    </div>
  );
}
