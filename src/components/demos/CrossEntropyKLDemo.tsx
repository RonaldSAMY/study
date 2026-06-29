import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Cross-entropy & KL divergence explorer.
   - p (true distribution) shown as emerald outlined bars.
   - q (predicted distribution) shown as filled indigo bars — drag them.
   - Live readouts: H(p), cross-entropy H(p,q) = -Σ p·log2(q),
     and KL(p‖q) = Σ p·log2(p/q) = H(p,q) - H(p) ≥ 0, zero only at q = p.
   Canvas conventions copied from VectorPlayground.
   ------------------------------------------------------------------ */

const COLORS = {
  q: '#4f46e5',
  qTop: '#6366f1',
  p: '#10b981',
  grid: 'rgba(128,128,128,0.18)',
  axis: 'rgba(128,128,128,0.5)',
};

const LABELS = ['cat', 'dog', 'fox', 'owl'];

type Preset = 'confident' | 'wrong' | 'flat';
const Q_PRESETS: Record<Preset, number[]> = {
  confident: [0.7, 0.15, 0.1, 0.05],
  wrong: [0.05, 0.1, 0.15, 0.7],
  flat: [0.25, 0.25, 0.25, 0.25],
};

// true distribution: a one-ish-hot label with a little mass elsewhere
const P_TRUE = [0.6, 0.25, 0.1, 0.05];

export default function CrossEntropyKLDemo() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [q, setQ] = useState<number[]>([...Q_PRESETS.flat]);
  const dragRef = useRef<number | null>(null);
  const sizeRef = useRef({ w: 480, h: 300 });

  const n = P_TRUE.length;
  const p = P_TRUE;

  const pad = { L: 36, R: 12, T: 20, B: 28 };
  const plot = () => {
    const { w, h } = sizeRef.current;
    return { x0: pad.L, y0: h - pad.B, plotW: w - pad.L - pad.R, plotH: h - pad.B - pad.T };
  };
  const slotGeom = (i: number) => {
    const { x0, plotW } = plot();
    const slot = plotW / n;
    const cx = x0 + slot * (i + 0.5);
    const bw = slot * 0.5;
    return { cx, bw, slot };
  };
  const pToY = (prob: number) => {
    const { y0, plotH } = plot();
    return y0 - prob * plotH;
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

    // gridlines
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let g = 0; g <= 4; g++) {
      const prob = g / 4;
      const y = y0 - prob * plotH;
      ctx.strokeStyle = COLORS.grid;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x0 + plotW, y); ctx.stroke();
      ctx.fillStyle = 'rgba(128,128,128,0.85)';
      ctx.fillText(prob.toFixed(2), x0 - 6, y);
    }

    ctx.textAlign = 'center';
    for (let i = 0; i < n; i++) {
      const { cx, bw } = slotGeom(i);

      // p (true) — emerald outlined bar, slightly left
      const pX = cx - bw * 0.55;
      const pY = pToY(p[i]);
      ctx.strokeStyle = COLORS.p;
      ctx.lineWidth = 2;
      ctx.fillStyle = 'rgba(16,185,129,0.15)';
      ctx.beginPath();
      ctx.rect(pX - bw / 2, pY, bw, y0 - pY);
      ctx.fill();
      ctx.stroke();

      // q (predicted) — filled indigo bar, slightly right
      const qX = cx + bw * 0.55;
      const qY = pToY(q[i]);
      const grad = ctx.createLinearGradient(0, qY, 0, y0);
      grad.addColorStop(0, COLORS.qTop);
      grad.addColorStop(1, COLORS.q);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.rect(qX - bw / 2, qY, bw, y0 - qY);
      ctx.fill();

      // drag handle on q
      ctx.beginPath();
      ctx.arc(qX, qY, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = COLORS.qTop;
      ctx.stroke();

      // label
      ctx.fillStyle = 'rgba(128,128,128,0.95)';
      ctx.font = '600 12px Inter, sans-serif';
      ctx.fillText(LABELS[i], cx, y0 + 14);
    }

    // axes
    ctx.strokeStyle = COLORS.axis;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x0, pToY(1)); ctx.lineTo(x0, y0); ctx.lineTo(x0 + plotW, y0); ctx.stroke();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 560);
      const h = Math.round(w * 0.6);
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

  useEffect(draw, [q]);

  // ---- pointer drag on q bars; renormalize q to sum 1 ----
  const pointer = (e: PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { px: e.clientX - rect.left, py: e.clientY - rect.top };
  };
  const qBarAt = (px: number) => {
    for (let i = 0; i < n; i++) {
      const { cx, bw } = slotGeom(i);
      const qX = cx + bw * 0.55;
      if (px >= qX - bw / 2 - 8 && px <= qX + bw / 2 + 8) return i;
    }
    return null;
  };
  const setQAt = (i: number, py: number) => {
    const newQ = yToP(py);
    const others = q.reduce((s, v, j) => (j === i ? s : s + v), 0) || 1e-9;
    const next = q.map((v, j) => (j === i ? newQ : (v / others) * (1 - newQ)));
    setQ(next.map((v) => Math.max(v, 0.001)));
  };
  const onDown = (e: PointerEvent) => {
    const { px, py } = pointer(e);
    const i = qBarAt(px);
    if (i !== null) {
      dragRef.current = i;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      setQAt(i, py);
      e.preventDefault();
    }
  };
  const onMove = (e: PointerEvent) => {
    if (dragRef.current === null) return;
    setQAt(dragRef.current, pointer(e).py);
  };
  const onUp = () => { dragRef.current = null; };

  // ---- metrics (bits) ----
  const Hp = p.reduce((s, pi) => (pi > 1e-9 ? s - pi * Math.log2(pi) : s), 0);
  const Hpq = p.reduce((s, pi, i) => s - pi * Math.log2(Math.max(q[i], 1e-9)), 0);
  const KL = Math.max(0, Hpq - Hp);

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <span class="text-xs font-semibold text-muted">Set q:</span>
        {(['confident', 'wrong', 'flat'] as Preset[]).map((pr) => (
          <button
            key={pr}
            onClick={() => setQ([...Q_PRESETS[pr]])}
            class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold capitalize text-muted transition hover:text-text"
          >
            {pr}
          </button>
        ))}
        <button
          onClick={() => setQ([...p])}
          class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white transition"
        >
          set q = p
        </button>
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
          <div class="flex gap-4 text-xs">
            <span class="flex items-center gap-1.5">
              <span class="inline-block h-3 w-3 rounded-sm border-2" style={`border-color:${COLORS.p};background:rgba(16,185,129,0.15)`} /> p (true)
            </span>
            <span class="flex items-center gap-1.5">
              <span class="inline-block h-3 w-3 rounded-sm" style={`background:${COLORS.q}`} /> q (predicted)
            </span>
          </div>
          <p class="text-muted">Drag the indigo q bars. q renormalizes to sum to 1.</p>

          <div class="space-y-2">
            <Readout label="H(p) — true entropy" value={`${Hp.toFixed(3)} bits`} />
            <Readout label="H(p,q) — cross-entropy" value={`${Hpq.toFixed(3)} bits`} color={COLORS.q} />
            <Readout label="KL(p‖q) = H(p,q) − H(p)" value={`${KL.toFixed(3)} bits`} color={KL < 0.01 ? COLORS.p : '#e11d48'} />
          </div>

          <p class="text-xs text-muted">
            {KL < 0.01
              ? 'q ≈ p → KL ≈ 0 and cross-entropy bottoms out at H(p). This is the best a predictor can do.'
              : 'Cross-entropy > H(p). The gap above H(p) is exactly the KL divergence — the wasted bits from using q instead of p.'}
          </p>
        </div>
      </div>
    </div>
  );
}

function Readout({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div class="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2">
      <span class="text-muted">{label}</span>
      <strong class="font-mono" style={color ? `color:${color}` : ''}>{value}</strong>
    </div>
  );
}
