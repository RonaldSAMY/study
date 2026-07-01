import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Dataflow through one transformer block, one token vector at a time.
   - Edit the input vector (a token's embedding). The demo walks it
     through the standard pre-LN block:
       input -> +positional -> self-attention -> +residual & norm
             -> feed-forward -> +residual & norm -> output
   - Each stage shows the vector (as bars) before and after, highlights
     the active stage, and explains what changed.
   - Transport: Play / Pause / Step / Back / Reset + speed.
   ------------------------------------------------------------------ */

const COLORS = { brand: '#4f46e5', sky: '#0ea5e9', green: '#10b981' };
const parseVec = (s: string) => s.split(',').map((x) => parseFloat(x.trim())).filter((x) => Number.isFinite(x)).slice(0, 6);

// simple fixed transforms so the block is deterministic and inspectable
const posEncoding = (d: number, pos = 1) => Array.from({ length: d }, (_, i) => (i % 2 === 0 ? Math.sin(pos / Math.pow(10000, i / d)) : Math.cos(pos / Math.pow(10000, (i - 1) / d))));
const context = (d: number) => Array.from({ length: d }, (_, i) => Math.cos(i * 1.1) * 0.6); // stand-in "attention read" from other tokens
const layerNorm = (v: number[]) => { const m = v.reduce((a, b) => a + b, 0) / v.length; const sd = Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length + 1e-6); return v.map((x) => (x - m) / sd); };
const ffn = (v: number[]) => v.map((x, i) => { const h = Math.max(0, x * 1.3 + Math.sin(i) * 0.4); return h * 0.9 - 0.1 * x; }); // relu(xW1)W2, simplified

const STAGES = [
  { name: 'Input embedding', note: 'The token starts as a raw vector — one point in meaning-space.' },
  { name: '+ Positional encoding', note: 'Add a position signal so the model knows where this token sits.' },
  { name: 'Self-attention', note: 'Mix in a weighted read of the other tokens — context flows in here.' },
  { name: 'Add & Norm', note: 'Add the residual (skip connection) and normalize — keeps training stable.' },
  { name: 'Feed-forward', note: 'A per-token MLP (ReLU) reshapes features independently of position.' },
  { name: 'Add & Norm', note: 'Residual + norm again. This vector is the block output, fed to the next block.' },
];

export default function MlATransformerBlock() {
  const [text, setText] = useState('0.8, -0.4, 0.5, 0.2');
  const [x0, setX0] = useState<number[]>(() => parseVec('0.8, -0.4, 0.5, 0.2'));
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);
  idxRef.current = idx;

  const d = x0.length;
  // precompute the vector at the OUTPUT of each stage (stage 0 = input)
  const stages: number[][] = [x0];
  const afterPos = x0.map((v, i) => v + posEncoding(d)[i]);
  stages.push(afterPos);
  const attn = afterPos.map((v, i) => 0.5 * v + 0.5 * context(d)[i]);
  stages.push(attn);
  const norm1 = layerNorm(afterPos.map((v, i) => v + attn[i])); // residual + norm
  stages.push(norm1);
  const ff = ffn(norm1);
  stages.push(ff);
  const norm2 = layerNorm(norm1.map((v, i) => v + ff[i]));
  stages.push(norm2);

  const total = STAGES.length;

  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 950 / speed;
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
  }, [playing, speed, x0]);

  const commit = () => { const v = parseVec(text); if (v.length >= 2) { setX0(v); setIdx(0); setPlaying(false); } };
  const reset = () => { setPlaying(false); setIdx(0); lastRef.current = 0; };
  const stepF = () => { setPlaying(false); setIdx((v) => Math.min(total - 1, v + 1)); };
  const stepB = () => { setPlaying(false); setIdx((v) => Math.max(0, v - 1)); };
  const play = () => { if (idx >= total - 1) setIdx(0); lastRef.current = 0; setPlaying((p) => !p); };

  const cur = stages[idx];
  const maxAbs = Math.max(1, ...stages.flat().map(Math.abs));

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <input value={text} onInput={(e) => setText((e.target as HTMLInputElement).value)} class="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm" placeholder="comma-separated token vector" />
        <button onClick={commit} class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Load</button>
      </div>

      <div class="grid gap-4 md:grid-cols-[minmax(0,220px),1fr]">
        {/* pipeline */}
        <ol class="space-y-1.5">
          {STAGES.map((s, i) => (
            <li key={i} class={`rounded-lg border px-3 py-2 text-sm transition ${i === idx ? 'border-transparent text-white' : i < idx ? 'border-border bg-surface-2 text-muted' : 'border-border bg-surface-2 text-text'}`} style={i === idx ? `background:${COLORS.brand}` : ''}>
              <span class="font-mono text-xs opacity-70">{i}</span> {s.name}
            </li>
          ))}
        </ol>

        {/* vector bars */}
        <div>
          <div class="flex h-40 items-center justify-center gap-2 rounded-xl bg-surface-2 p-3">
            {cur.map((v, i) => (
              <div key={i} class="flex h-full flex-1 flex-col items-center justify-center">
                <div class="flex h-full w-full flex-col justify-center">
                  <div class="flex-1 flex items-end">
                    {v >= 0 && <div class="w-full rounded-t" style={`height:${(Math.abs(v) / maxAbs) * 50}%;background:${COLORS.green}`}></div>}
                  </div>
                  <div class="h-px w-full bg-border"></div>
                  <div class="flex-1 flex items-start">
                    {v < 0 && <div class="w-full rounded-b" style={`height:${(Math.abs(v) / maxAbs) * 50}%;background:${COLORS.sky}`}></div>}
                  </div>
                </div>
                <span class="mt-1 font-mono text-[10px] text-muted">{v.toFixed(2)}</span>
              </div>
            ))}
          </div>
          <p class="mt-3 min-h-[3rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text"><strong>{STAGES[idx].name}.</strong> {STAGES[idx].note}</p>
        </div>
      </div>

      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={stepB} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏮ Back</button>
        <button onClick={play} class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90">{playing ? '⏸ Pause' : '▶ Play'}</button>
        <button onClick={stepF} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏭ Step</button>
        <button onClick={reset} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">↺ Reset</button>
        <label class="ml-auto flex items-center gap-2 text-xs text-muted">speed
          <input type="range" min={0.5} max={3} step={0.5} value={speed} onInput={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))} class="w-24 accent-[#4f46e5]" />
        </label>
      </div>
      <p class="mt-2 text-center text-xs text-muted">Green = positive component, blue = negative. Watch the residual + norm steps rein the vector back to a stable scale.</p>
    </div>
  );
}
