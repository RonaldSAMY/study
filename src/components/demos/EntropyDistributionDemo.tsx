import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Entropy explorer.
   - Drag the top of each bar to reshape a probability distribution.
   - Weights are auto-normalized so the bars always sum to 1.
   - Watch H = -Σ p·log2(p) (in bits) rise toward its maximum when the
     distribution is uniform, and fall toward 0 when it spikes.
   Canvas conventions copied from VectorPlayground.
   ------------------------------------------------------------------ */

const COLORS = {
  bar: '#4f46e5',
  barTop: '#6366f1',
  max: '#10b981',
  grid: 'rgba(128,128,128,0.18)',
  axis: 'rgba(128,128,128,0.5)',
};

const LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];

type Preset = 'uniform' | 'spike' | 'skew';

const PRESETS: Record<Preset, number[]> = {
  uniform: [1, 1, 1, 1, 1, 1],
  spike: [12, 1, 1, 1, 1, 1],
  skew: [8, 5, 3, 2, 1, 1],
};

export default function EntropyDistributionDemo() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [weights, setWeights] = useState<number[]>([...PRESETS.skew]);
  const dragRef = useRef<number | null>(null);
  const sizeRef = useRef({ w: 480, h: 320, padL: 36, padB: 28, padT: 16, padR: 12 });

  const n = weights.length;
  const total = weights.reduce((s, v) => s + v, 0) || 1;
  const probs = weights.map((w) => w / total);

  // entropy in bits
  const H = probs.reduce((s, p) => (p > 1e-9 ? s - p * Math.log2(p) : s), 0);
  const Hmax = Math.log2(n);

  // ---- pixel helpers ----
  const plot = () => {
    const { w, h, padL, padB, padT, padR } = sizeRef.current;
    return { x0: padL, y0: h - padB, plotW: w - padL - padR, plotH: h - padB - padT };
  };
  const barGeom = (i: number) => {
    const { x0, plotW } = plot();
    const slot = plotW / n;
    const bw = slot * 0.62;
    const cx = x0 + slot * (i + 0.5);
    return { cx, bw, left: cx - bw / 2 };
  };
  const pToY = (p: number) => {
    const { y0, plotH } = plot();
    return y0 - p * plotH; // probability 0..1 maps to full height
  };
  const yToP = (py: number) => {
    const { y0, plotH } = plot();
    return Math.min(1, Math.max(0.001, (y0 - py) / plotH));
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    const { x0, y0, plotW, plotH } = plot();
    ctx.clearRect(0, 0, w, h);

    // horizontal gridlines + y labels (probability)
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let g = 0; g <= 4; g++) {
      const p = g / 4;
      const y = y0 - p * plotH;
      ctx.strokeStyle = COLORS.grid;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x0 + plotW, y); ctx.stroke();
      ctx.fillStyle = 'rgba(128,128,128,0.85)';
      ctx.fillText(p.toFixed(2), x0 - 6, y);
    }

    // uniform reference line (1/n)
    const yu = pToY(1 / n);
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = COLORS.max;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x0, yu); ctx.lineTo(x0 + plotW, yu); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = COLORS.max;
    ctx.textAlign = 'left';
    ctx.fillText('uniform 1/n', x0 + 4, yu - 8);

    // bars
    ctx.textAlign = 'center';
    for (let i = 0; i < n; i++) {
      const { left, bw, cx } = barGeom(i);
      const yTop = pToY(probs[i]);
      const grad = ctx.createLinearGradient(0, yTop, 0, y0);
      grad.addColorStop(0, COLORS.barTop);
      grad.addColorStop(1, COLORS.bar);
      ctx.fillStyle = grad;
      ctx.beginPath();
      const r = 5;
      const bh = y0 - yTop;
      // rounded-top rectangle
      ctx.moveTo(left, y0);
      ctx.lineTo(left, yTop + Math.min(r, bh));
      ctx.quadraticCurveTo(left, yTop, left + Math.min(r, bw / 2), yTop);
      ctx.lineTo(left + bw - Math.min(r, bw / 2), yTop);
      ctx.quadraticCurveTo(left + bw, yTop, left + bw, yTop + Math.min(r, bh));
      ctx.lineTo(left + bw, y0);
      ctx.closePath();
      ctx.fill();

      // draggable handle
      ctx.beginPath();
      ctx.arc(cx, yTop, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = COLORS.barTop;
      ctx.stroke();

      // value above bar
      ctx.fillStyle = 'rgba(128,128,128,0.95)';
      ctx.font = '600 11px Inter, sans-serif';
      ctx.fillText(probs[i].toFixed(2), cx, yTop - 14);

      // x label
      ctx.fillStyle = 'rgba(128,128,128,0.95)';
      ctx.font = '600 12px Inter, sans-serif';
      ctx.fillText(LABELS[i], cx, y0 + 14);
    }

    // axes
    ctx.strokeStyle = COLORS.axis;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x0, padTopY()); ctx.lineTo(x0, y0); ctx.lineTo(x0 + plotW, y0); ctx.stroke();
  };

  const padTopY = () => plot().y0 - plot().plotH;

  // ---- responsive sizing ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 560);
      const h = Math.round(w * 0.62);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w, h, padL: 36, padB: 28, padT: 22, padR: 12 };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(draw, [weights]);

  // ---- pointer dragging ----
  const pointer = (e: PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { px: e.clientX - rect.left, py: e.clientY - rect.top };
  };
  const barAt = (px: number) => {
    for (let i = 0; i < n; i++) {
      const { left, bw } = barGeom(i);
      if (px >= left - 8 && px <= left + bw + 8) return i;
    }
    return null;
  };
  const setProbAt = (i: number, py: number) => {
    const newP = yToP(py);
    // set weights so that bar i has probability newP, others keep their relative shares
    const others = probs.reduce((s, p, j) => (j === i ? s : s + p), 0) || 1e-9;
    const next = probs.map((p, j) =>
      j === i ? newP : (p / others) * (1 - newP),
    );
    setWeights(next.map((p) => Math.max(p, 0.0001)));
  };
  const onDown = (e: PointerEvent) => {
    const { px, py } = pointer(e);
    const i = barAt(px);
    if (i !== null) {
      dragRef.current = i;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      setProbAt(i, py);
      e.preventDefault();
    }
  };
  const onMove = (e: PointerEvent) => {
    if (dragRef.current === null) return;
    const { py } = pointer(e);
    setProbAt(dragRef.current, py);
  };
  const onUp = () => { dragRef.current = null; };

  const surprise = (p: number) => (p > 1e-9 ? Math.log2(1 / p) : Infinity);
  const fillPct = Math.round((H / Hmax) * 100);

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap gap-2">
        {(['uniform', 'skew', 'spike'] as Preset[]).map((p) => (
          <button
            key={p}
            onClick={() => setWeights([...PRESETS[p]])}
            class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold capitalize text-muted transition hover:text-text"
          >
            {p}
          </button>
        ))}
      </div>

      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas
          ref={canvasRef}
          class="touch-none rounded-xl bg-surface-2"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        />

        <div class="space-y-3 text-sm">
          <p class="text-muted">Drag the white handle on each bar. Probabilities always sum to 1.</p>

          <div class="rounded-lg bg-surface-2 p-3">
            <div class="flex items-baseline justify-between">
              <span class="text-muted">Entropy H</span>
              <strong class="font-mono text-lg" style={`color:${COLORS.bar}`}>{H.toFixed(3)} bits</strong>
            </div>
            <div class="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-border">
              <div class="h-full rounded-full" style={`width:${fillPct}%;background:${COLORS.bar}`} />
            </div>
            <div class="mt-1 flex justify-between text-xs text-muted">
              <span>0 (certain)</span>
              <span>max = log₂{n} = {Hmax.toFixed(2)}</span>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <Readout label="Outcomes" value={`${n}`} />
            <Readout label="H / Hmax" value={`${fillPct}%`} />
          </div>

          <div class="rounded-lg bg-surface-2 p-3 text-xs">
            <p class="mb-1 font-semibold text-text">Surprise of each outcome — log₂(1/p):</p>
            <div class="grid grid-cols-3 gap-1 font-mono">
              {probs.map((p, i) => (
                <span key={i} class="text-muted">
                  {LABELS[i]}: {surprise(p).toFixed(2)}
                </span>
              ))}
            </div>
          </div>

          <p class="text-xs text-muted">
            {fillPct > 98
              ? 'Flat distribution → maximum uncertainty, every outcome equally surprising.'
              : fillPct < 25
              ? 'Sharp spike → little uncertainty; one outcome is nearly certain.'
              : 'Somewhere in between: skew lowers entropy, flatness raises it.'}
          </p>
        </div>
      </div>
    </div>
  );
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div class="rounded-lg bg-surface-2 px-3 py-2">
      <span class="text-muted">{label}</span>
      <div class="font-mono font-semibold">{value}</div>
    </div>
  );
}
