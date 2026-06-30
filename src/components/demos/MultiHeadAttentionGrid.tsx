import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Multi-head attention patterns over one sentence.
   - Pick a query word. Three heads each show DIFFERENT attention rows:
     • Head 1 looks at the PREVIOUS word, • Head 2 locks onto the NOUN,
     • Head 3 looks at the NEXT word.
   - Toggle a head on/off to see what its slice of the output contributes.
   Canvas conventions copied from VectorPlayground.
   ------------------------------------------------------------------ */

const TOKENS = ['The', 'tired', 'cat', 'slept', 'soundly'];
const N = TOKENS.length;
const NOUN = 2; // "cat"

const HEADS = [
  { name: 'Head 1 · previous word', color: '#4f46e5', kind: 'prev' as const },
  { name: 'Head 2 · the noun', color: '#0ea5e9', kind: 'noun' as const },
  { name: 'Head 3 · next word', color: '#10b981', kind: 'next' as const },
];

function rowFor(kind: 'prev' | 'noun' | 'next', i: number): number[] {
  const r = new Array(N).fill(0.06);
  if (kind === 'prev') r[i > 0 ? i - 1 : 0] += 0.8;
  else if (kind === 'noun') r[NOUN] += 0.8;
  else r[i < N - 1 ? i + 1 : N - 1] += 0.8;
  const z = r.reduce((a, b) => a + b, 0);
  return r.map((v) => v / z);
}

function hexA(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export default function MultiHeadAttentionGrid() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [query, setQuery] = useState(1); // "tired"
  const [on, setOn] = useState([true, true, true]);
  const sizeRef = useRef({ w: 480, h: 280 });

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);

    const padL = 12, padR = 12, padT = 28, rowGap = 16;
    const labelH = 22;
    const gridW = w - padL - padR;
    const cellW = gridW / N;
    const rowH = (h - padT - labelH - rowGap * HEADS.length) / HEADS.length;

    // column (key) labels at top
    ctx.font = '600 12px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let j = 0; j < N; j++) {
      ctx.fillStyle = j === query ? '#94a3b8' : 'rgba(128,128,128,0.85)';
      ctx.fillText(TOKENS[j], padL + cellW * (j + 0.5), padT - 14);
    }

    HEADS.forEach((head, hi) => {
      const y = padT + labelH + hi * (rowH + rowGap);
      const row = rowFor(head.kind, query);
      const dim = on[hi] ? 1 : 0.18;
      // head label
      ctx.textAlign = 'left';
      ctx.font = '700 12px Inter, sans-serif';
      ctx.fillStyle = hexA(head.color, dim);
      ctx.fillText(head.name, padL, y - 6);
      // cells
      for (let j = 0; j < N; j++) {
        const x = padL + j * cellW;
        ctx.fillStyle = hexA(head.color, (0.1 + 0.9 * row[j]) * dim);
        roundRect(ctx, x + 2, y, cellW - 4, rowH, 6);
        ctx.fill();
        ctx.fillStyle = `rgba(255,255,255,${row[j] > 0.25 ? 0.95 * dim : 0})`;
        ctx.textAlign = 'center';
        ctx.font = '600 11px Inter, sans-serif';
        ctx.fillText(`${Math.round(row[j] * 100)}`, x + cellW / 2, y + rowH / 2);
      }
    });
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 560);
      const h = 280;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr; canvas.height = h * dpr;
      canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w, h };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(draw, [query, on]);

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3">
        <p class="mb-2 text-sm font-semibold text-muted">Query word (who is doing the looking?):</p>
        <div class="flex flex-wrap gap-2">
          {TOKENS.map((tk, i) => (
            <button
              key={tk}
              onClick={() => setQuery(i)}
              class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                query === i ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
              }`}
            >
              {tk}
            </button>
          ))}
        </div>
      </div>

      <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

      <div class="mt-3 flex flex-wrap gap-2">
        {HEADS.map((head, hi) => (
          <button
            key={head.name}
            onClick={() => setOn((o) => o.map((v, k) => (k === hi ? !v : v)))}
            class={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              on[hi] ? 'text-white' : 'bg-surface-2 text-muted opacity-70 hover:opacity-100'
            }`}
            style={on[hi] ? `background:${head.color}` : ''}
          >
            {on[hi] ? '● ' : '○ '}{head.name}
          </button>
        ))}
      </div>
      <p class="mt-2 text-xs text-muted">
        Each head computes its own Q, K, V and its own attention pattern. The final output{' '}
        <strong>concatenates</strong> every head's result and mixes them with one more linear layer —
        so the model reads grammar, position, and meaning at the same time.
      </p>
    </div>
  );
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
