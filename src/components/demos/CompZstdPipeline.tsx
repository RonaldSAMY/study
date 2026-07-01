import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated two-stage Zstandard pipeline.
   Stage 1 (LZ): scan the text into literals + (offset, length) matches.
   Stage 2 (entropy): give frequent literals SHORT bit-codes and rare
     ones long codes (a Huffman code, zstd's stand-in for FSE).
   The animation walks token by token, revealing each literal's bit-code
   and updating two size readouts: "after LZ" vs "after LZ + entropy",
   so you SEE why zstd layers an entropy coder on top of LZ.
   - Transport: Play / Pause / Step / Back / Reset + speed.
   ------------------------------------------------------------------ */

const MIN_MATCH = 4;
const COLORS = { lit: '#10b981', match: '#0ea5e9', code: '#4f46e5' };

type Token =
  | { kind: 'lit'; ch: string }
  | { kind: 'match'; offset: number; length: number };

function tokenize(s: string): Token[] {
  const tokens: Token[] = [];
  let pos = 0;
  while (pos < s.length) {
    let bestLen = 0, bestStart = -1;
    for (let start = 0; start < pos; start++) {
      let len = 0;
      while (pos + len < s.length && s[start + len] === s[pos + len] && len < 255) len++;
      if (len > bestLen) { bestLen = len; bestStart = start; }
    }
    if (bestLen >= MIN_MATCH) { tokens.push({ kind: 'match', offset: pos - bestStart, length: bestLen }); pos += bestLen; }
    else { tokens.push({ kind: 'lit', ch: s[pos] }); pos += 1; }
  }
  return tokens;
}

// Huffman code lengths + code strings for a literal alphabet.
function huffman(freq: Map<string, number>): Map<string, string> {
  const codes = new Map<string, string>();
  const syms = [...freq.keys()];
  if (syms.length === 0) return codes;
  if (syms.length === 1) { codes.set(syms[0], '0'); return codes; }
  type Node = { f: number; ch?: string; l?: Node; r?: Node };
  let nodes: Node[] = syms.map((ch) => ({ f: freq.get(ch)!, ch }));
  while (nodes.length > 1) {
    nodes.sort((a, b) => a.f - b.f);
    const l = nodes.shift()!;
    const r = nodes.shift()!;
    nodes.push({ f: l.f + r.f, l, r });
  }
  const walk = (n: Node, prefix: string) => {
    if (n.ch !== undefined) { codes.set(n.ch, prefix || '0'); return; }
    if (n.l) walk(n.l, prefix + '0');
    if (n.r) walk(n.r, prefix + '1');
  };
  walk(nodes[0], '');
  return codes;
}

export default function CompZstdPipeline() {
  const [text, setText] = useState('the quick brown fox the quick brown fox the lazy dog');
  const [tokens, setTokens] = useState<Token[]>(() => tokenize('the quick brown fox the quick brown fox the lazy dog'));
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);
  idxRef.current = idx;

  // literal frequencies -> Huffman codes (computed once per input)
  const freq = new Map<string, number>();
  for (const t of tokens) if (t.kind === 'lit') freq.set(t.ch, (freq.get(t.ch) ?? 0) + 1);
  const codes = huffman(freq);

  const commit = () => {
    const t = text.slice(0, 80);
    if (t.length) { setTokens(tokenize(t)); setIdx(0); setPlaying(false); }
  };

  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 820 / speed;
    const tick = (t: number) => {
      if (!lastRef.current) lastRef.current = t;
      if (t - lastRef.current >= interval) {
        lastRef.current = t;
        const next = idxRef.current + 1;
        if (next > tokens.length) { setIdx(tokens.length); setPlaying(false); return; }
        setIdx(next);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
  }, [playing, speed, tokens]);

  const reset = () => { setPlaying(false); setIdx(0); lastRef.current = 0; };
  const stepF = () => { setPlaying(false); setIdx((v) => Math.min(tokens.length, v + 1)); };
  const stepB = () => { setPlaying(false); setIdx((v) => Math.max(0, v - 1)); };
  const play = () => { if (idx >= tokens.length) setIdx(0); lastRef.current = 0; setPlaying((p) => !p); };

  // running sizes (bits): match ~24 bits both stages; literal 8 bits raw, codeLen after entropy
  const shown = tokens.slice(0, idx);
  const rawBytes = shown.reduce((a, t) => a + (t.kind === 'match' ? t.length : 1), 0);
  const lzBits = shown.reduce((a, t) => a + (t.kind === 'match' ? 24 : 8), 0);
  const entBits = shown.reduce((a, t) => a + (t.kind === 'match' ? 24 : (codes.get(t.ch)?.length ?? 8)), 0);
  const lzBytes = Math.ceil(lzBits / 8);
  const entBytes = Math.ceil(entBits / 8);

  const active = idx > 0 ? tokens[idx - 1] : null;
  const caption = !active
    ? 'Press Play. Stage 1 turns text into tokens; Stage 2 gives frequent literals short bit-codes.'
    : active.kind === 'match'
      ? `LZ match (offset ${active.offset}, length ${active.length}): ${active.length} bytes coded as one sequence. Real zstd entropy-codes these too (FSE).`
      : `Literal '${active.ch === ' ' ? '␣' : active.ch}' -> Huffman code ${codes.get(active.ch)} (${codes.get(active.ch)?.length} bits instead of 8).`;

  const done = idx >= tokens.length && tokens.length > 0;
  const sortedCodes = [...codes.entries()].sort((a, b) => a[1].length - b[1].length);

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <input value={text} onInput={(e) => setText((e.target as HTMLInputElement).value)} class="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm" placeholder="text to compress" />
        <button onClick={commit} class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Load</button>
      </div>

      {/* token stream */}
      <div class="rounded-lg bg-surface-2 p-3">
        <div class="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Stage 1 — LZ tokens</div>
        <div class="flex flex-wrap gap-1 font-mono text-xs">
          {tokens.map((t, i) => {
            const isActive = i === idx - 1;
            const revealed = i < idx;
            const bg = t.kind === 'match' ? COLORS.match : COLORS.lit;
            return (
              <span key={i} class={`rounded border px-1.5 py-1 transition ${isActive ? 'scale-110 border-transparent text-white' : revealed ? 'border-transparent text-white' : 'border-border bg-surface text-muted'}`} style={revealed ? `background:${bg}${isActive ? '' : 'cc'}` : ''}>
                {t.kind === 'match' ? `(${t.offset},${t.length})` : (t.ch === ' ' ? '␣' : t.ch)}
              </span>
            );
          })}
        </div>
      </div>

      <p class="mt-3 min-h-[2.75rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">{caption}</p>

      <div class="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 text-sm">
        <Stat label="bytes in" value={`${rawBytes}`} />
        <Stat label="after LZ" value={`${lzBytes} B`} color={COLORS.match} />
        <Stat label="+ entropy" value={`${entBytes} B`} color={COLORS.code} />
        <Stat label="ratio" value={rawBytes ? (entBytes / rawBytes).toFixed(2) : '1.00'} color={COLORS.lit} />
      </div>

      {/* Huffman code table */}
      <div class="mt-3 rounded-lg bg-surface-2 p-3">
        <div class="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Stage 2 — entropy code table (short = frequent)</div>
        <div class="flex flex-wrap gap-1.5 font-mono text-xs">
          {sortedCodes.map(([ch, code]) => {
            const isActive = active && active.kind === 'lit' && active.ch === ch;
            return (
              <span key={ch} class={`rounded border px-1.5 py-1 ${isActive ? 'border-transparent text-white' : 'border-border bg-surface text-text'}`} style={isActive ? `background:${COLORS.code}` : ''}>
                {ch === ' ' ? '␣' : ch}=<span class="text-muted">{code}</span>
              </span>
            );
          })}
        </div>
      </div>

      {done && (
        <p class="mt-2 rounded-lg bg-brand-soft px-3 py-2 text-sm text-text">
          LZ removed the repeats; the entropy coder then squeezed the leftover literals from 8 bits down to their Huffman code lengths. Layering the two is exactly what makes zstd beat plain LZ4 on ratio.
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
      <p class="mt-2 text-center text-xs text-muted">Blue = LZ back-reference, green = literal. Watch "+ entropy" dip below "after LZ" as common letters get short codes.</p>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div class="rounded-lg bg-surface-2 px-3 py-2">
      <div class="text-xs text-muted">{label}</div>
      <div class="font-mono font-semibold" style={color ? `color:${color}` : ''}>{value}</div>
    </div>
  );
}
