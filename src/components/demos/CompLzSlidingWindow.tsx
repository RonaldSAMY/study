import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated LZ77 / LZ4 sliding window.
   - Edit the text. The demo scans left to right. At each position it
     searches the already-seen "window" for the LONGEST match of the
     upcoming bytes. A match >= 4 becomes a back-reference token
     (offset, length); otherwise a single literal byte is emitted.
   - Canvas shows the character grid: committed bytes, the current
     match SOURCE (indigo) and TARGET (sky) with an arrow, or a single
     literal (emerald). A live caption + compression-ratio readout.
   - Transport: Play / Pause / Step / Back / Reset + speed.
   ------------------------------------------------------------------ */

const MIN_MATCH = 4;
const COLORS = {
  committed: 'rgba(16,185,129,0.20)',
  src: '#4f46e5',
  tgt: '#0ea5e9',
  lit: '#10b981',
  grid: 'rgba(128,128,128,0.25)',
  text: '#e5e7eb',
};

type Token =
  | { kind: 'lit'; at: number; ch: string }
  | { kind: 'match'; at: number; offset: number; length: number };

// greedy longest-match LZ tokenizer
function tokenize(s: string): Token[] {
  const tokens: Token[] = [];
  let pos = 0;
  while (pos < s.length) {
    let bestLen = 0;
    let bestStart = -1;
    for (let start = 0; start < pos; start++) {
      let len = 0;
      while (pos + len < s.length && s[start + len] === s[pos + len] && len < 255) len++;
      if (len > bestLen) { bestLen = len; bestStart = start; }
    }
    if (bestLen >= MIN_MATCH) {
      tokens.push({ kind: 'match', at: pos, offset: pos - bestStart, length: bestLen });
      pos += bestLen;
    } else {
      tokens.push({ kind: 'lit', at: pos, ch: s[pos] });
      pos += 1;
    }
  }
  return tokens;
}

export default function CompLzSlidingWindow() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ cell: 26, cols: 20 });
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);

  const [text, setText] = useState('TOBEORNOTTOBEORTOBEORNOT');
  const [tokens, setTokens] = useState<Token[]>(() => tokenize('TOBEORNOTTOBEORTOBEORNOT'));
  const [idx, setIdx] = useState(0); // tokens revealed 0..tokens.length
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  idxRef.current = idx;

  const src = text.slice(0, 48);

  const commit = () => {
    const t = text.slice(0, 48);
    if (t.length) { setTokens(tokenize(t)); setIdx(0); setPlaying(false); }
  };

  // ---- drawing (helpers INSIDE the island) ----
  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { cell, cols } = sizeRef.current;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = `${Math.round(cell * 0.5)}px ui-monospace, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const cellXY = (i: number) => ({ x: (i % cols) * cell, y: Math.floor(i / cols) * cell });

    const active = idxRef.current > 0 ? tokens[idxRef.current - 1] : null;
    const committedTo = active ? active.at : src.length; // bytes decided before current token
    const isMatch = active && active.kind === 'match';
    const srcStart = isMatch ? active.at - active.offset : -1;

    for (let i = 0; i < src.length; i++) {
      const { x, y } = cellXY(i);
      let fill = 'transparent';
      if (i < committedTo) fill = COLORS.committed;
      if (isMatch && i >= srcStart && i < srcStart + active.length) fill = COLORS.src;
      if (isMatch && i >= active.at && i < active.at + active.length) fill = COLORS.tgt;
      if (active && active.kind === 'lit' && i === active.at) fill = COLORS.lit;
      const solid = fill === COLORS.src || fill === COLORS.tgt || fill === COLORS.lit;
      ctx.fillStyle = fill;
      ctx.fillRect(x + 1, y + 1, cell - 2, cell - 2);
      ctx.strokeStyle = COLORS.grid;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 1, y + 1, cell - 2, cell - 2);
      ctx.fillStyle = solid ? '#fff' : COLORS.text;
      ctx.fillText(src[i] === ' ' ? '␣' : src[i], x + cell / 2, y + cell / 2 + 1);
    }

    // arrow from match source -> target
    if (isMatch) {
      const a = cellXY(srcStart);
      const b = cellXY(active.at);
      const ax = a.x + cell / 2;
      const ay = a.y + 2;
      const bx = b.x + cell / 2;
      const by = b.y + 2;
      ctx.strokeStyle = COLORS.src;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.quadraticCurveTo((ax + bx) / 2, Math.min(ay, by) - cell * 0.5, bx, by);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(bx, by, 3, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.src;
      ctx.fill();
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 560);
      const cols = Math.max(8, Math.floor(w / 28));
      const cell = Math.floor(w / cols);
      const rows = Math.ceil(src.length / cols);
      const gw = cell * cols;
      const gh = cell * rows;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = gw * dpr;
      canvas.height = gh * dpr;
      canvas.style.width = `${gw}px`;
      canvas.style.height = `${gh}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { cell, cols };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokens]);

  useEffect(draw, [idx, tokens]);

  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 900 / speed;
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

  // running sizes: literal ~1 byte, match ~3 bytes (2-byte offset + 1-byte length)
  const shown = tokens.slice(0, idx);
  const covered = shown.reduce((a, t) => a + (t.kind === 'match' ? t.length : 1), 0);
  const encoded = shown.reduce((a, t) => a + (t.kind === 'match' ? 3 : 1), 0);
  const ratio = covered ? encoded / covered : 1;

  const active = idx > 0 ? tokens[idx - 1] : null;
  const caption = !active
    ? 'Press Play. At each position the scanner hunts the window for the longest repeat of the bytes ahead.'
    : active.kind === 'match'
      ? `Match: copy ${active.length} bytes from ${active.offset} back -> token (offset ${active.offset}, length ${active.length}). ${active.length} bytes become ~3.`
      : `Literal: no match >= 4, so emit the raw byte '${active.ch === ' ' ? '␣' : active.ch}'.`;

  const done = idx >= tokens.length && tokens.length > 0;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <input value={text} onInput={(e) => setText((e.target as HTMLInputElement).value)} class="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm" placeholder="text with repeated substrings" />
        <button onClick={commit} class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Load</button>
      </div>

      <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

      <div class="mt-2 flex flex-wrap gap-3 text-xs text-muted">
        <Legend color={COLORS.src} label="match source" />
        <Legend color={COLORS.tgt} label="match target" />
        <Legend color={COLORS.lit} label="literal" />
      </div>

      <p class="mt-3 min-h-[2.75rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">{caption}</p>

      <div class="mt-3 grid grid-cols-3 gap-2 text-sm">
        <Stat label="bytes in" value={`${covered}`} />
        <Stat label="bytes out" value={`${encoded}`} color={COLORS.tgt} />
        <Stat label="ratio" value={ratio.toFixed(2)} color={COLORS.lit} />
      </div>

      {done && (
        <p class="mt-2 rounded-lg bg-brand-soft px-3 py-2 text-sm text-text">
          Every repeated stretch collapsed into a short back-reference. The first occurrence of any pattern is still literals — LZ only pays off once a string appears again.
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
      <p class="mt-2 text-center text-xs text-muted">Tip: try "the cat the cat the cat" — the second and third copies become tiny (offset, length) tokens.</p>
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
