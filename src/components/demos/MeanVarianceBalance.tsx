import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Expectation & Variance — the balance-point intuition.
   - Drag the tops of the bars to reshape a probability distribution
     over the values 1..7 (weights auto-normalize to sum to 1).
   - A fulcrum slides to the MEAN E[X] — the point where the bars
     balance — and the spread (variance / std dev) is reported live.
   ------------------------------------------------------------------ */

const VALUES = [1, 2, 3, 4, 5, 6, 7];

const C = {
  bar: '#0ea5e9',
  barTop: '#38bdf8',
  mean: '#10b981',
  axis: 'rgba(128,128,128,0.55)',
  text: '#64748b',
};

export default function MeanVarianceBalance() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 560, h: 320 });
  const dragRef = useRef<number | null>(null);
  const [weights, setWeights] = useState<number[]>([1, 2, 4, 6, 4, 2, 1]);

  const total = weights.reduce((s, x) => s + x, 0) || 1;
  const probs = weights.map((w) => w / total);
  const mean = VALUES.reduce((s, v, i) => s + v * probs[i], 0);
  const varr = VALUES.reduce((s, v, i) => s + probs[i] * (v - mean) ** 2, 0);
  const std = Math.sqrt(varr);

  const layout = () => {
    const { w, h } = sizeRef.current;
    const padL = 32, padR = 16, padB = 52, padT = 16;
    const plotW = w - padL - padR;
    const baseY = h - padB;
    const plotH = baseY - padT;
    const slot = plotW / VALUES.length;
    return { padL, padR, padB, padT, plotW, baseY, plotH, slot, w, h };
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const L = layout();
    ctx.clearRect(0, 0, L.w, L.h);

    const maxP = Math.max(...probs, 0.15);

    // bars
    VALUES.forEach((v, i) => {
      const x = L.padL + i * L.slot + L.slot * 0.16;
      const bw = L.slot * 0.68;
      const bh = (probs[i] / maxP) * L.plotH;
      const y = L.baseY - bh;
      const grad = ctx.createLinearGradient(0, y, 0, L.baseY);
      grad.addColorStop(0, C.barTop); grad.addColorStop(1, C.bar);
      ctx.fillStyle = grad;
      ctx.fillRect(x, y, bw, bh);
      // handle cap
      ctx.fillStyle = '#fff';
      ctx.fillRect(x, y - 3, bw, 3);
      ctx.strokeStyle = C.bar; ctx.lineWidth = 2;
      ctx.strokeRect(x, y - 3, bw, 3);
      // value label + prob
      ctx.fillStyle = C.text; ctx.font = '12px Inter, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillText(String(v), x + bw / 2, L.baseY + 22);
      ctx.font = '10px Inter, sans-serif';
      ctx.fillText(probs[i].toFixed(2), x + bw / 2, y - 16);
    });

    // beam (the plank that balances)
    ctx.strokeStyle = C.axis; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(L.padL, L.baseY); ctx.lineTo(L.w - L.padR, L.baseY); ctx.stroke();

    // fulcrum at the mean
    const xMean = L.padL + ((mean - 1) / (VALUES.length - 1)) * (L.slot * (VALUES.length - 1)) + L.slot / 2;
    ctx.fillStyle = C.mean;
    ctx.beginPath();
    ctx.moveTo(xMean, L.baseY + 4);
    ctx.lineTo(xMean - 11, L.baseY + 26);
    ctx.lineTo(xMean + 11, L.baseY + 26);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = C.mean; ctx.font = '600 12px Inter, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText(`E[X]=${mean.toFixed(2)}`, xMean, L.baseY + 30);

    // ± std dev whiskers around mean
    const xAt = (val: number) => L.padL + ((val - 1) / (VALUES.length - 1)) * (L.slot * (VALUES.length - 1)) + L.slot / 2;
    ctx.strokeStyle = C.mean; ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]);
    [mean - std, mean + std].forEach((vx) => {
      if (vx >= 1 && vx <= 7) {
        ctx.beginPath(); ctx.moveTo(xAt(vx), L.padT); ctx.lineTo(xAt(vx), L.baseY); ctx.stroke();
      }
    });
    ctx.setLineDash([]);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 620);
      const h = Math.round(Math.min(w * 0.58, 340));
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

  useEffect(draw, [weights]);

  const setBarFromPointer = (e: PointerEvent, idx: number) => {
    const L = layout();
    const rect = canvasRef.current!.getBoundingClientRect();
    const py = e.clientY - rect.top;
    const maxP = Math.max(...probs, 0.15);
    const frac = Math.max(0.001, Math.min(1, (L.baseY - py) / L.plotH));
    // target probability for this bar, then convert back to a weight
    const targetP = frac * maxP;
    const others = total - weights[idx];
    // keep others fixed; pick weight so that weight/(weight+others) = targetP
    const newW = targetP >= 0.999 ? others * 50 : (targetP * others) / (1 - targetP);
    setWeights((ws) => ws.map((w, i) => (i === idx ? Math.max(0.05, newW) : w)));
  };

  const onDown = (e: PointerEvent) => {
    const L = layout();
    const rect = canvasRef.current!.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const idx = Math.floor((px - L.padL) / L.slot);
    if (idx < 0 || idx >= VALUES.length) return;
    dragRef.current = idx;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
    setBarFromPointer(e, idx);
  };
  const onMove = (e: PointerEvent) => {
    if (dragRef.current === null) return;
    setBarFromPointer(e, dragRef.current);
  };
  const onUp = () => { dragRef.current = null; };

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <canvas
        ref={canvasRef}
        class="w-full touch-none rounded-xl bg-surface-2"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      />
      <div class="mt-3 grid grid-cols-3 gap-2 text-sm">
        <Readout label="E[X] (mean)" value={mean.toFixed(2)} color={C.mean} />
        <Readout label="Var(X)" value={varr.toFixed(2)} />
        <Readout label="σ = √Var" value={std.toFixed(2)} />
      </div>
      <div class="mt-3 flex flex-wrap gap-2">
        <Preset label="Symmetric" onClick={() => setWeights([1, 2, 4, 6, 4, 2, 1])} />
        <Preset label="Skewed right" onClick={() => setWeights([7, 5, 3, 2, 1, 0.6, 0.3])} />
        <Preset label="Two peaks" onClick={() => setWeights([5, 2, 0.5, 0.3, 0.5, 2, 5])} />
        <Preset label="Flat" onClick={() => setWeights([1, 1, 1, 1, 1, 1, 1])} />
      </div>
      <p class="mt-2 text-xs text-muted">Drag any bar up or down. The green fulcrum is the mean — the point where the distribution balances.</p>
    </div>
  );
}

function Readout({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div class="rounded-lg bg-surface-2 px-3 py-2 text-center">
      <div class="text-muted text-xs">{label}</div>
      <div class="font-mono font-semibold" style={color ? `color:${color}` : ''}>{value}</div>
    </div>
  );
}
function Preset({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted transition hover:text-text">
      {label}
    </button>
  );
}
