import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Diagram of ONE pre-norm transformer block, data flowing through it.
   Stages: Input → LayerNorm → Multi-Head Attention → ⊕ (residual)
           → LayerNorm → Feed-Forward MLP → ⊕ (residual) → Output.
   - Click a stage (or press Step) to walk the residual stream through.
   - The side panel shows each sub-layer's job and the residual vector
     (6 toy dims) updating at the two ⊕ add points.
   - A pulse animates downward to show the direction of flow; the rAF is
     cleaned up on unmount (VectorPlayground conventions).
   ------------------------------------------------------------------ */

type Stage = { key: string; label: string; kind: 'stream' | 'norm' | 'attn' | 'ffn' | 'add'; desc: string };

const STAGES: Stage[] = [
  { key: 'in', label: 'Input', kind: 'stream', desc: 'A row of token vectors enters — the residual stream carrying everything the model knows so far.' },
  { key: 'ln1', label: 'LayerNorm', kind: 'norm', desc: 'Normalize each token vector to mean 0, variance 1 (then rescale). This stabilizes what attention sees.' },
  { key: 'attn', label: 'Multi-Head Attention', kind: 'attn', desc: 'Each token gathers information from other tokens. Heads look at different relationships in parallel.' },
  { key: 'add1', label: '⊕ Add (residual)', kind: 'add', desc: 'Add attention’s output back onto the stream: x ← x + Attn(LN(x)). The skip path protects the gradient.' },
  { key: 'ln2', label: 'LayerNorm', kind: 'norm', desc: 'Normalize again before the MLP, for the same stability reason.' },
  { key: 'ffn', label: 'Feed-Forward MLP', kind: 'ffn', desc: 'A position-wise 2-layer MLP (expand → GELU → project). It transforms each token independently — the model’s "thinking" step.' },
  { key: 'add2', label: '⊕ Add (residual)', kind: 'add', desc: 'Add the MLP’s output back: x ← x + MLP(LN(x)). The block’s output is the updated stream.' },
  { key: 'out', label: 'Output', kind: 'stream', desc: 'Same shape as the input — so blocks stack: the output stream feeds straight into the next block.' },
];

const COLORS = {
  stream: '#0ea5e9',
  norm: '#64748b',
  attn: '#4f46e5',
  ffn: '#10b981',
  add: '#f59e0b',
  active: '#4f46e5',
  grid: 'rgba(128,128,128,0.18)',
};
const kindColor = (k: Stage['kind']) =>
  k === 'attn' ? COLORS.attn : k === 'ffn' ? COLORS.ffn : k === 'add' ? COLORS.add : k === 'stream' ? COLORS.stream : COLORS.norm;

const BASE = [0.6, -0.3, 0.4, 0.1, -0.5, 0.2];
const ATTN_DELTA = [0.2, 0.5, -0.3, 0.25, 0.1, -0.15];
const FFN_DELTA = [-0.15, 0.1, 0.35, -0.2, 0.3, 0.25];

export default function TransformerBlockFlow() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [active, setActive] = useState(0);
  const [blocks, setBlocks] = useState(12);
  const sizeRef = useRef({ w: 360, h: 520 });
  const boxesRef = useRef<{ x: number; y: number; w: number; h: number }[]>([]);
  const rafRef = useRef<number>();
  const pulseRef = useRef(0);

  // residual stream value at the current stage
  const streamAt = (i: number) => {
    const v = [...BASE];
    if (i >= 3) for (let d = 0; d < v.length; d++) v[d] += ATTN_DELTA[d];
    if (i >= 6) for (let d = 0; d < v.length; d++) v[d] += FFN_DELTA[d];
    return v;
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);

    const n = STAGES.length;
    const colX = w * 0.52;
    const boxW = Math.min(w * 0.6, 230);
    const top = 14;
    const gap = (h - 28) / n;
    const boxH = Math.min(gap * 0.62, 46);
    const highwayX = colX - boxW / 2 - 16;

    const boxes: { x: number; y: number; w: number; h: number }[] = [];
    for (let i = 0; i < n; i++) {
      const cy = top + gap * (i + 0.5);
      boxes.push({ x: colX - boxW / 2, y: cy - boxH / 2, w: boxW, h: boxH });
    }
    boxesRef.current = boxes;

    // residual highway (left vertical line linking input → adds → output)
    ctx.strokeStyle = COLORS.stream;
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.moveTo(highwayX, boxes[0].y + boxes[0].h / 2);
    ctx.lineTo(highwayX, boxes[n - 1].y + boxes[n - 1].h / 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // connectors: straight pipe down the center
    ctx.strokeStyle = 'rgba(128,128,128,0.5)';
    ctx.lineWidth = 2;
    for (let i = 0; i < n - 1; i++) {
      const a = boxes[i], b = boxes[i + 1];
      ctx.beginPath();
      ctx.moveTo(colX, a.y + a.h);
      ctx.lineTo(colX, b.y);
      ctx.stroke();
    }
    // skip arrows from highway into the two ⊕ nodes
    ctx.strokeStyle = COLORS.stream;
    ctx.lineWidth = 2;
    [3, 6].forEach((ai) => {
      const b = boxes[ai];
      ctx.beginPath();
      ctx.moveTo(highwayX, b.y + b.h / 2);
      ctx.lineTo(b.x, b.y + b.h / 2);
      ctx.stroke();
    });

    // boxes
    boxes.forEach((bx, i) => {
      const s = STAGES[i];
      const isActive = i === active;
      ctx.fillStyle = isActive ? hexWithAlpha(kindColor(s.kind), 0.18) : 'rgba(128,128,128,0.08)';
      ctx.strokeStyle = isActive ? kindColor(s.kind) : 'rgba(128,128,128,0.4)';
      ctx.lineWidth = isActive ? 2.5 : 1.2;
      roundRect(ctx, bx.x, bx.y, bx.w, bx.h, 10);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = isActive ? kindColor(s.kind) : 'rgba(128,128,128,0.95)';
      ctx.font = `${isActive ? '600 ' : ''}13px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(s.label, bx.x + bx.w / 2, bx.y + bx.h / 2);
    });

    // flow pulse traveling down toward the active stage's connector
    if (active > 0) {
      const a = boxes[active - 1], b = boxes[active];
      const t = pulseRef.current;
      const py = a.y + a.h + (b.y - (a.y + a.h)) * t;
      ctx.fillStyle = COLORS.active;
      ctx.beginPath(); ctx.arc(colX, py, 4, 0, Math.PI * 2); ctx.fill();
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 420);
      const h = Math.round(Math.max(440, Math.min(560, w * 1.45)));
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w, h };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // animate the flow pulse
  useEffect(() => {
    const loop = () => {
      pulseRef.current = (pulseRef.current + 0.02) % 1;
      draw();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [active]);

  const onClick = (e: MouseEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const idx = boxesRef.current.findIndex((b) => px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h);
    if (idx >= 0) setActive(idx);
  };

  const s = STAGES[active];
  const stream = streamAt(active);

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setActive((a) => Math.max(0, a - 1))}
          class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text"
        >‹ Back</button>
        <button
          onClick={() => setActive((a) => (a + 1) % STAGES.length)}
          class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white"
        >Step ›</button>
        <span class="text-xs text-muted">Step through the block, or click any stage.</span>
      </div>

      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" onClick={onClick} />

        <div class="space-y-3 text-sm">
          <div class="rounded-lg border border-border bg-surface-2 p-3">
            <div class="mb-1 font-semibold" style={`color:${kindColor(s.kind)}`}>{active + 1}. {s.label}</div>
            <p class="text-muted">{s.desc}</p>
          </div>

          <div class="rounded-lg bg-surface-2 p-3">
            <div class="mb-2 text-muted">Residual stream (one token, 6 toy dims)</div>
            <div class="flex items-end gap-1.5" style="height:64px">
              {stream.map((v, d) => (
                <div key={d} class="flex flex-1 flex-col items-center justify-end" style="height:100%">
                  <div
                    style={`height:${Math.min(100, Math.abs(v) * 60)}%;width:100%;border-radius:4px;background:${v >= 0 ? COLORS.attn : COLORS.add}`}
                  />
                </div>
              ))}
            </div>
            <p class="mt-2 text-xs text-muted">
              The two ⊕ steps <strong>add</strong> onto these values — the stream is read from and written back to, never replaced.
            </p>
          </div>

          <label class="block">
            <span class="mb-1 block text-muted">stacked blocks = {blocks}</span>
            <input
              type="range" min={1} max={96} step={1} value={blocks}
              onInput={(e) => setBlocks(parseInt((e.target as HTMLInputElement).value))}
              class="w-full accent-[#4f46e5]"
            />
            <span class="text-xs text-muted">GPT-style models stack dozens of identical blocks like this one.</span>
          </label>
        </div>
      </div>
    </div>
  );
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function hexWithAlpha(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return `rgba(${r},${g},${b},${a})`;
}
