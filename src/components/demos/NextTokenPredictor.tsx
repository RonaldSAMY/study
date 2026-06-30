import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Next-token prediction, cross-entropy loss & perplexity.
   - A short sentence; at each position the model predicts the next token.
   - "Training" slider sharpens the model's logits toward the true token.
   - Per step: p(true), loss = -ln p(true), perplexity = exp(loss).
   - Headline: average loss over the whole sentence and exp(avg) = the
     model's perplexity on this sequence.
   Canvas bar chart (VectorPlayground dpr conventions).
   ------------------------------------------------------------------ */

const VOCAB = ['the', 'cat', 'sat', 'on', 'mat', 'dog', 'ran', 'fast'];

type Pos = { ctx: string; target: number; base: number[] };
const POSITIONS: Pos[] = [
  { ctx: 'the',                target: 1, base: [0.3, 1.2, 0.2, 0.1, 0.8, 1.0, 0.1, 0.2] },
  { ctx: 'the cat',           target: 2, base: [0.1, 0.2, 1.3, 0.3, 0.1, 0.2, 1.1, 0.3] },
  { ctx: 'the cat sat',       target: 3, base: [0.2, 0.1, 0.1, 1.4, 0.1, 0.1, 0.3, 0.4] },
  { ctx: 'the cat sat on',    target: 0, base: [1.5, 0.2, 0.1, 0.2, 0.3, 0.2, 0.1, 0.1] },
  { ctx: 'the cat sat on the', target: 4, base: [0.2, 0.9, 0.1, 0.1, 1.2, 0.8, 0.1, 0.2] },
];

const COLORS = {
  bar: '#4f46e5',
  target: '#10b981',
  grid: 'rgba(128,128,128,0.18)',
  axis: 'rgba(128,128,128,0.5)',
};

function softmax(logits: number[]) {
  const m = Math.max(...logits);
  const ex = logits.map((l) => Math.exp(l - m));
  const s = ex.reduce((a, b) => a + b, 0);
  return ex.map((e) => e / s);
}
function distAt(p: Pos, skill: number) {
  const logits = p.base.map((b, i) => b + (i === p.target ? skill * 4.5 : 0));
  return softmax(logits);
}

export default function NextTokenPredictor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pos, setPos] = useState(0);
  const [skill, setSkill] = useState(0.0);
  const sizeRef = useRef({ w: 480, h: 260 });

  const p = POSITIONS[pos];
  const dist = distAt(p, skill);
  const pTrue = dist[p.target];
  const stepLoss = -Math.log(pTrue);
  const stepPpl = Math.exp(stepLoss);

  // whole-sentence average
  const losses = POSITIONS.map((q) => -Math.log(distAt(q, skill)[q.target]));
  const avgLoss = losses.reduce((a, b) => a + b, 0) / losses.length;
  const sentencePpl = Math.exp(avgLoss);

  const pad = { L: 16, R: 12, T: 14, B: 30 };
  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);
    const x0 = pad.L, y0 = h - pad.B;
    const plotW = w - pad.L - pad.R, plotH = h - pad.B - pad.T;
    const n = VOCAB.length;
    const slot = plotW / n;

    ctx.strokeStyle = COLORS.axis; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + plotW, y0); ctx.stroke();

    dist.forEach((prob, i) => {
      const bw = slot * 0.6;
      const cx = x0 + slot * (i + 0.5);
      const bh = prob * plotH;
      const isTarget = i === p.target;
      ctx.fillStyle = isTarget ? COLORS.target : COLORS.bar;
      ctx.globalAlpha = isTarget ? 1 : 0.8;
      roundRectTop(ctx, cx - bw / 2, y0 - bh, bw, bh, 5);
      ctx.fill();
      ctx.globalAlpha = 1;
      // prob label
      ctx.fillStyle = 'rgba(128,128,128,0.95)';
      ctx.font = '10px Inter, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      if (prob > 0.04) ctx.fillText(prob.toFixed(2), cx, y0 - bh - 2);
      // token label
      ctx.fillStyle = isTarget ? COLORS.target : 'rgba(128,128,128,0.95)';
      ctx.font = `${isTarget ? '600 ' : ''}12px Inter, sans-serif`;
      ctx.textBaseline = 'top';
      ctx.fillText(VOCAB[i], cx, y0 + 6);
    });
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 560);
      const h = Math.round(w * 0.52);
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
  useEffect(draw, [pos, skill]);

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 rounded-lg bg-surface-2 p-3 text-center font-mono text-base">
        {p.ctx.split(' ').map((tok, i) => (
          <span key={i} class="mx-0.5 rounded px-1.5 py-0.5" style="background:rgba(79,70,229,0.12)">{tok}</span>
        ))}
        <span class="mx-0.5 rounded border-2 border-dashed px-2 py-0.5 text-muted" style="border-color:#10b981">?</span>
      </div>

      <div class="grid gap-4 md:grid-cols-[1fr,auto] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

        <div class="space-y-3 text-sm md:w-56">
          <div class="flex flex-wrap gap-2">
            <button onClick={() => setPos((q) => Math.max(0, q - 1))} class="rounded-lg bg-surface-2 px-3 py-1.5 font-semibold text-muted hover:text-text">‹</button>
            <button onClick={() => setPos((q) => Math.min(POSITIONS.length - 1, q + 1))} class="rounded-lg bg-brand px-3 py-1.5 font-semibold text-white">Next position ›</button>
          </div>
          <label class="block">
            <span class="mb-1 block text-muted">training progress = {(skill * 100).toFixed(0)}%</span>
            <input type="range" min={0} max={1} step={0.01} value={skill}
              onInput={(e) => setSkill(parseFloat((e.target as HTMLInputElement).value))}
              class="w-full accent-[#10b981]" />
          </label>
          <div class="grid grid-cols-1 gap-2">
            <Readout label={`p("${VOCAB[p.target]}") — the true next token`} color={COLORS.target} value={pTrue.toFixed(3)} />
            <Readout label="loss this step  −ln p(true)" value={`${stepLoss.toFixed(3)} nats`} />
            <Readout label="perplexity this step" value={stepPpl.toFixed(2)} />
          </div>
          <div class="rounded-lg border border-brand/30 bg-brand-soft p-3">
            <div class="flex justify-between text-xs"><span class="text-muted">avg loss (sentence)</span><strong>{avgLoss.toFixed(3)}</strong></div>
            <div class="flex justify-between text-xs"><span class="text-muted">perplexity (sentence)</span><strong>{sentencePpl.toFixed(2)}</strong></div>
            <p class="mt-1 text-xs text-muted">Perplexity ≈ how many tokens the model is "choosing between". Drag training to 100% and watch it fall toward 1.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function roundRectTop(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, h);
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x, y + rr);
  ctx.arcTo(x, y, x + rr, y, rr);
  ctx.lineTo(x + w - rr, y);
  ctx.arcTo(x + w, y, x + w, y + rr, rr);
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
}

function Readout({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div class="rounded-lg bg-surface-2 px-3 py-2">
      <span class="text-muted" style={color ? `color:${color}` : ''}>{label}</span>
      <div class="font-mono font-semibold">{value}</div>
    </div>
  );
}
