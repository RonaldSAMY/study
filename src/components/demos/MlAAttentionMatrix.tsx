import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Scaled dot-product attention, animated one query at a time.
   - Edit the sentence; each token gets a deterministic 4-dim embedding.
   - Pick a query token; the demo steps through:
       1. score_j = (q · k_j) / sqrt(d)   for every key j
       2. softmax the row of scores  ->  attention weights
       3. output = sum_j weight_j * v_j   (weighted sum of values)
   - Q = K = V = the embeddings here (self-attention).
   - Transport: Play / Pause / Step / Back / Reset + speed.
   ------------------------------------------------------------------ */

const D = 4;
const COLORS = { q: '#4f46e5', k: '#0ea5e9', v: '#10b981' };

// deterministic pseudo-embedding so the same word always maps to the same vector
function embed(token: string): number[] {
  const v: number[] = [];
  for (let k = 0; k < D; k++) {
    let s = 0;
    for (let i = 0; i < token.length; i++) s += Math.sin((token.charCodeAt(i) + 3) * (k + 1) * 0.7 + i * 1.3);
    v.push(Number((s / Math.max(1, Math.sqrt(token.length))).toFixed(2)));
  }
  return v;
}
const dot = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * b[i], 0);
const parseTokens = (s: string) => s.trim().split(/\s+/).filter(Boolean).slice(0, 6);

export default function MlAAttentionMatrix() {
  const [text, setText] = useState('the cat sat on the mat');
  const [tokens, setTokens] = useState<string[]>(() => parseTokens('the cat sat on the mat'));
  const [qIdx, setQIdx] = useState(1); // which query row we inspect
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);
  idxRef.current = idx;

  const n = tokens.length;
  const emb = tokens.map(embed);
  const scale = 1 / Math.sqrt(D);
  const scores = emb[qIdx] ? emb.map((k) => dot(emb[qIdx], k) * scale) : [];
  const maxS = Math.max(...scores);
  const exps = scores.map((s) => Math.exp(s - maxS));
  const sumE = exps.reduce((a, b) => a + b, 0);
  const weights = exps.map((e) => e / sumE);

  // frames: n score steps, 1 softmax step, n value steps, 1 done step
  const totalFrames = n + 1 + n + 1;

  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 720 / speed;
    const tick = (t: number) => {
      if (!lastRef.current) lastRef.current = t;
      if (t - lastRef.current >= interval) {
        lastRef.current = t;
        const next = idxRef.current + 1;
        if (next >= totalFrames) { setIdx(totalFrames - 1); setPlaying(false); return; }
        setIdx(next);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
  }, [playing, speed, tokens, qIdx]);

  const commit = () => { const t = parseTokens(text); if (t.length) { setTokens(t); setQIdx(Math.min(qIdx, t.length - 1)); setIdx(0); setPlaying(false); } };
  const reset = () => { setPlaying(false); setIdx(0); lastRef.current = 0; };
  const stepF = () => { setPlaying(false); setIdx((v) => Math.min(totalFrames - 1, v + 1)); };
  const stepB = () => { setPlaying(false); setIdx((v) => Math.max(0, v - 1)); };
  const play = () => { if (idx >= totalFrames - 1) setIdx(0); lastRef.current = 0; setPlaying((p) => !p); };
  const pickQ = (i: number) => { setQIdx(i); setIdx(0); setPlaying(false); };

  // decode current phase
  const inScore = idx < n;
  const scoresShown = inScore ? idx + 1 : n;
  const softmaxDone = idx >= n;
  const valueStep = idx >= n + 1 ? idx - (n + 1) + 1 : 0; // 1..n
  const done = idx >= n + 1 + n;
  const activeKey = inScore ? idx : idx >= n + 1 && idx < n + 1 + n ? idx - (n + 1) : -1;

  // running output vector (weighted sum of first `valueStep` values)
  const output = Array(D).fill(0);
  for (let j = 0; j < Math.min(valueStep, n); j++) for (let d = 0; d < D; d++) output[d] += weights[j] * emb[j][d];

  let caption: string;
  if (inScore) {
    const j = idx;
    caption = `score(${tokens[qIdx]} , ${tokens[j]}) = (q · k) / √${D} = ${scores[j].toFixed(2)} — a raw similarity between the query and this key.`;
  } else if (idx === n) {
    caption = `Softmax turns the ${n} scores into weights that sum to 1 — a probability distribution over which tokens to read from.`;
  } else if (!done) {
    const j = idx - (n + 1);
    caption = `Add ${(weights[j] * 100).toFixed(0)}% of ${tokens[j]}'s value vector into the output. Bigger weight → more of that token flows through.`;
  } else {
    caption = `Done. "${tokens[qIdx]}" is now a blend of every token's value, weighted by relevance. That blended vector is attention's output.`;
  }

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <input value={text} onInput={(e) => setText((e.target as HTMLInputElement).value)} class="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm" placeholder="a short sentence" />
        <button onClick={commit} class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Load</button>
      </div>

      <div class="mb-2 flex flex-wrap items-center gap-1.5 text-sm">
        <span class="mr-1 font-semibold" style={`color:${COLORS.q}`}>query:</span>
        {tokens.map((tk, i) => (
          <button key={i} onClick={() => pickQ(i)} class={`rounded-md border px-2.5 py-1 font-mono transition ${i === qIdx ? 'border-transparent text-white' : 'border-border bg-surface-2 text-muted hover:text-text'}`} style={i === qIdx ? `background:${COLORS.q}` : ''}>{tk}</button>
        ))}
      </div>

      {/* keys row + scores + weights */}
      <div class="overflow-x-auto">
        <table class="w-full border-separate border-spacing-1 text-center font-mono text-xs">
          <thead>
            <tr>
              <th class="px-1 text-left text-muted">key →</th>
              {tokens.map((tk, j) => (
                <th key={j} class={`rounded-md px-2 py-1 ${j === activeKey ? 'text-white' : 'text-text'}`} style={j === activeKey ? `background:${COLORS.k}` : ''}>{tk}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="px-1 text-left text-muted">score</td>
              {tokens.map((tk, j) => (
                <td key={j} class={`rounded-md border px-2 py-1 ${j < scoresShown ? 'border-border bg-surface-2 text-text' : 'border-dashed border-border text-muted/40'}`}>{j < scoresShown ? scores[j].toFixed(2) : '·'}</td>
              ))}
            </tr>
            <tr>
              <td class="px-1 text-left text-muted">weight</td>
              {tokens.map((tk, j) => (
                <td key={j} class="rounded-md px-1 py-1 align-bottom">
                  {softmaxDone ? (
                    <div class="flex flex-col items-center justify-end">
                      <div class="w-full rounded-sm" style={`height:${Math.max(3, weights[j] * 46)}px;background:${j < valueStep ? COLORS.v : COLORS.k}`}></div>
                      <span class="mt-0.5 text-[10px] text-muted">{(weights[j] * 100).toFixed(0)}%</span>
                    </div>
                  ) : <span class="text-muted/40">·</span>}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {/* output vector */}
      <div class="mt-3 flex items-center gap-2 font-mono text-sm">
        <span class="w-14 shrink-0 font-bold" style={`color:${COLORS.v}`}>output</span>
        <div class="flex gap-1">
          {output.map((val, i) => (
            <div key={i} class="flex h-9 w-14 items-center justify-center rounded-md border border-border bg-surface-2 text-xs">{val.toFixed(2)}</div>
          ))}
        </div>
      </div>

      <p class="mt-3 min-h-[3rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">{caption}</p>
      {done && <p class="mt-2 rounded-lg bg-brand-soft px-3 py-2 text-sm font-semibold text-text">Repeat this for every query row and you have the full attention matrix — the operation at the heart of every transformer.</p>}

      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={stepB} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏮ Back</button>
        <button onClick={play} class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90">{playing ? '⏸ Pause' : '▶ Play'}</button>
        <button onClick={stepF} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏭ Step</button>
        <button onClick={reset} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">↺ Reset</button>
        <label class="ml-auto flex items-center gap-2 text-xs text-muted">speed
          <input type="range" min={0.5} max={3} step={0.5} value={speed} onInput={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))} class="w-24 accent-[#4f46e5]" />
        </label>
      </div>
      <p class="mt-2 text-center text-xs text-muted">Blue = key being scored, green = value flowing into the output. Click any token to make it the query.</p>
    </div>
  );
}
