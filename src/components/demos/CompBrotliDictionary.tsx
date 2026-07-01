import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated Brotli-style compressor: built-in dictionary + LZ + literals.
   - Edit the text (HTML-ish content shows Brotli off best). At each
     position the scanner tries, in order:
       1. a built-in DICTIONARY entry (indigo) — matches even on the
          FIRST occurrence, unlike LZ,
       2. an LZ back-reference to earlier text (sky),
       3. a raw literal byte (emerald).
   - Highlights the matched span, lists the dictionary with the active
     entry lit up, and shows a live compression-ratio readout.
   - Transport: Play / Pause / Step / Back / Reset + speed.
   ------------------------------------------------------------------ */

const MIN_MATCH = 4;
const COLORS = { dict: '#4f46e5', match: '#0ea5e9', lit: '#10b981' };

// a tiny slice of Brotli's ~120KB built-in web dictionary
const DICT = [
  '<div class="', '</div>', '<div>', '<body>', '</body>', '<html>', '</html>',
  '<script>', '</script>', 'Content-Type', 'application/json', 'text/html',
  'charset=utf-8', 'https://', 'http://', 'the ', 'and ', 'for ',
];

type Token =
  | { kind: 'dict'; at: number; text: string; id: number }
  | { kind: 'match'; at: number; offset: number; length: number }
  | { kind: 'lit'; at: number; ch: string };

function tokenize(s: string): Token[] {
  const tokens: Token[] = [];
  let pos = 0;
  while (pos < s.length) {
    // 1. longest dictionary entry
    let dId = -1, dLen = 0;
    for (let k = 0; k < DICT.length; k++) {
      if (s.startsWith(DICT[k], pos) && DICT[k].length > dLen) { dLen = DICT[k].length; dId = k; }
    }
    if (dId >= 0) { tokens.push({ kind: 'dict', at: pos, text: DICT[dId], id: dId }); pos += dLen; continue; }
    // 2. longest LZ back-reference
    let bestLen = 0, bestStart = -1;
    for (let start = 0; start < pos; start++) {
      let len = 0;
      while (pos + len < s.length && s[start + len] === s[pos + len] && len < 255) len++;
      if (len > bestLen) { bestLen = len; bestStart = start; }
    }
    if (bestLen >= MIN_MATCH) { tokens.push({ kind: 'match', at: pos, offset: pos - bestStart, length: bestLen }); pos += bestLen; continue; }
    // 3. literal
    tokens.push({ kind: 'lit', at: pos, ch: s[pos] }); pos += 1;
  }
  return tokens;
}

const spanLen = (t: Token) => t.kind === 'dict' ? t.text.length : t.kind === 'match' ? t.length : 1;

export default function CompBrotliDictionary() {
  const DEFAULT = '<div class="box"><div class="box">Content-Type: text/html</div></div>';
  const [text, setText] = useState(DEFAULT);
  const [tokens, setTokens] = useState<Token[]>(() => tokenize(DEFAULT));
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);
  idxRef.current = idx;

  const src = text.slice(0, 90);

  const commit = () => {
    const t = text.slice(0, 90);
    if (t.length) { setTokens(tokenize(t)); setIdx(0); setPlaying(false); }
  };

  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 860 / speed;
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

  const active = idx > 0 ? tokens[idx - 1] : null;
  const activeStart = active ? active.at : -1;
  const activeEnd = active ? active.at + spanLen(active) : -1;
  const committedTo = active ? active.at : 0;

  // sizes: dict ref ~2 bytes, LZ match ~3 bytes, literal 1 byte
  const shown = tokens.slice(0, idx);
  const covered = shown.reduce((a, t) => a + spanLen(t), 0);
  const encoded = shown.reduce((a, t) => a + (t.kind === 'dict' ? 2 : t.kind === 'match' ? 3 : 1), 0);
  const ratio = covered ? encoded / covered : 1;

  const caption = !active
    ? 'Press Play. Brotli checks its built-in dictionary first, then looks for LZ repeats, then falls back to literals.'
    : active.kind === 'dict'
      ? `Dictionary hit: "${active.text}" is entry #${active.id} — 2 bytes, and it works on the FIRST use (LZ can't).`
      : active.kind === 'match'
        ? `LZ back-reference: copy ${active.length} bytes from ${active.offset} back -> (offset ${active.offset}, length ${active.length}).`
        : `Literal: '${active.ch === ' ' ? '␣' : active.ch}' — not in the dictionary and not seen before.`;

  const done = idx >= tokens.length && tokens.length > 0;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <input value={text} onInput={(e) => setText((e.target as HTMLInputElement).value)} class="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm" placeholder="HTML-ish text works best" />
        <button onClick={commit} class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Load</button>
      </div>

      {/* input strip */}
      <div class="flex flex-wrap gap-0.5 font-mono text-xs">
        {[...src].map((ch, i) => {
          const inActive = i >= activeStart && i < activeEnd;
          const covered = i < committedTo;
          const color = active && inActive ? (active.kind === 'dict' ? COLORS.dict : active.kind === 'match' ? COLORS.match : COLORS.lit) : '';
          return (
            <span key={i} class={`flex h-7 min-w-[1.1rem] items-center justify-center rounded border px-0.5 transition ${inActive ? 'scale-110 border-transparent text-white' : covered ? 'border-transparent bg-surface-2 text-muted' : 'border-border bg-surface-2 text-text'}`} style={inActive ? `background:${color}` : ''}>{ch === ' ' ? '␣' : ch}</span>
          );
        })}
      </div>

      <div class="mt-2 flex flex-wrap gap-3 text-xs text-muted">
        <Legend color={COLORS.dict} label="dictionary" />
        <Legend color={COLORS.match} label="LZ back-ref" />
        <Legend color={COLORS.lit} label="literal" />
      </div>

      <p class="mt-3 min-h-[2.75rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">{caption}</p>

      <div class="mt-3 grid grid-cols-3 gap-2 text-sm">
        <Stat label="bytes in" value={`${covered}`} />
        <Stat label="bytes out" value={`${encoded}`} color={COLORS.match} />
        <Stat label="ratio" value={ratio.toFixed(2)} color={COLORS.lit} />
      </div>

      {/* dictionary listing */}
      <div class="mt-3 rounded-lg bg-surface-2 p-3">
        <div class="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">built-in dictionary (excerpt)</div>
        <div class="flex flex-wrap gap-1 font-mono text-xs">
          {DICT.map((d, k) => {
            const isActive = active && active.kind === 'dict' && active.id === k;
            return (
              <span key={k} class={`rounded border px-1.5 py-1 ${isActive ? 'border-transparent text-white' : 'border-border bg-surface text-text'}`} style={isActive ? `background:${COLORS.dict}` : ''}>#{k} {d}</span>
            );
          })}
        </div>
      </div>

      {done && (
        <p class="mt-2 rounded-lg bg-brand-soft px-3 py-2 text-sm text-text">
          The dictionary paid off on the very first "&lt;div class=" and "Content-Type" — no earlier copy needed. That head start on small, web-shaped data is why Brotli wins on static assets.
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
      <p class="mt-2 text-center text-xs text-muted">Tip: paste real HTML. The more it looks like the web, the more the dictionary fires before LZ even starts.</p>
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

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span class="flex items-center gap-1.5">
      <span class="inline-block h-3 w-3 rounded" style={`background:${color}`} />
      {label}
    </span>
  );
}
