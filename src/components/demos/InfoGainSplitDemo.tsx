import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Decision-tree split chooser — information gain.
   - A set of labeled items (two classes) is plotted along a feature axis.
   - Drag the vertical threshold to split into left/right groups.
   - Switch the feature to compare how much a split is worth.
   - Readouts: parent entropy, weighted child entropy, information gain
     IG = H(parent) - [w_L·H(left) + w_R·H(right)].
   Canvas conventions copied from VectorPlayground.
   ------------------------------------------------------------------ */

const COLORS = {
  c0: '#0ea5e9', // class "safe"  (sky)
  c1: '#e11d48', // class "risk"  (rose)
  thr: '#10b981',
  grid: 'rgba(128,128,128,0.18)',
  axis: 'rgba(128,128,128,0.5)',
  text: 'rgba(128,128,128,0.95)',
};

type Feature = 'age' | 'noise';

// 14 patients: label 1 = "needs follow-up", 0 = "clear".
// "age" separates classes cleanly; "noise" barely separates them.
type Item = { age: number; noise: number; label: 0 | 1 };
const DATA: Item[] = [
  { age: 0.12, noise: 0.55, label: 0 },
  { age: 0.18, noise: 0.20, label: 0 },
  { age: 0.25, noise: 0.80, label: 0 },
  { age: 0.30, noise: 0.40, label: 0 },
  { age: 0.36, noise: 0.65, label: 0 },
  { age: 0.42, noise: 0.30, label: 0 },
  { age: 0.50, noise: 0.72, label: 1 },
  { age: 0.55, noise: 0.18, label: 0 },
  { age: 0.62, noise: 0.50, label: 1 },
  { age: 0.68, noise: 0.85, label: 1 },
  { age: 0.74, noise: 0.35, label: 1 },
  { age: 0.82, noise: 0.60, label: 1 },
  { age: 0.88, noise: 0.25, label: 1 },
  { age: 0.94, noise: 0.78, label: 1 },
];

function entropy(items: Item[]): number {
  if (items.length === 0) return 0;
  const ones = items.filter((d) => d.label === 1).length;
  const p = ones / items.length;
  const q = 1 - p;
  let h = 0;
  if (p > 1e-9) h -= p * Math.log2(p);
  if (q > 1e-9) h -= q * Math.log2(q);
  return h;
}

export default function InfoGainSplitDemo() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [feature, setFeature] = useState<Feature>('age');
  const [thr, setThr] = useState(0.46); // threshold in feature units 0..1
  const draggingRef = useRef(false);
  const sizeRef = useRef({ w: 480, h: 240 });

  const pad = { L: 24, R: 16, T: 18, B: 34 };
  const fx = (v: number) => {
    const { w } = sizeRef.current;
    return pad.L + v * (w - pad.L - pad.R);
  };
  const xToFeat = (px: number) => {
    const { w } = sizeRef.current;
    return Math.min(1, Math.max(0, (px - pad.L) / (w - pad.L - pad.R)));
  };

  const val = (d: Item) => (feature === 'age' ? d.age : d.noise);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);
    const yTop = pad.T;
    const yBot = h - pad.B;

    // axis line
    ctx.strokeStyle = COLORS.axis;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(pad.L, yBot); ctx.lineTo(w - pad.R, yBot); ctx.stroke();

    // threshold band shading
    const tx = fx(thr);
    ctx.fillStyle = 'rgba(14,165,233,0.06)';
    ctx.fillRect(pad.L, yTop, tx - pad.L, yBot - yTop);
    ctx.fillStyle = 'rgba(225,29,72,0.06)';
    ctx.fillRect(tx, yTop, w - pad.R - tx, yBot - yTop);

    // threshold line + handle
    ctx.strokeStyle = COLORS.thr;
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(tx, yTop - 4); ctx.lineTo(tx, yBot + 4); ctx.stroke();
    ctx.beginPath(); ctx.arc(tx, yTop - 2, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#fff'; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = COLORS.thr; ctx.stroke();

    // points (vertical jitter by index so they don't overlap)
    DATA.forEach((d, i) => {
      const x = fx(val(d));
      const y = yTop + 14 + ((i * 53) % Math.max(1, yBot - yTop - 28));
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.fillStyle = d.label === 1 ? COLORS.c1 : COLORS.c0;
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#fff';
      ctx.stroke();
    });

    // labels
    ctx.fillStyle = COLORS.text;
    ctx.font = '600 12px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(`${feature === 'age' ? 'patient age' : 'lab noise'} →`, w / 2, yBot + 12);
    ctx.textAlign = 'left';
    ctx.fillText('left split', pad.L + 2, yTop - 2);
    ctx.textAlign = 'right';
    ctx.fillText('right split', w - pad.R - 2, yTop - 2);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 560);
      const h = Math.round(w * 0.5);
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

  useEffect(draw, [thr, feature]);

  const pointer = (e: PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return e.clientX - rect.left;
  };
  const onDown = (e: PointerEvent) => {
    draggingRef.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setThr(xToFeat(pointer(e)));
    e.preventDefault();
  };
  const onMove = (e: PointerEvent) => {
    if (draggingRef.current) setThr(xToFeat(pointer(e)));
  };
  const onUp = () => { draggingRef.current = false; };

  // ---- metrics ----
  const left = DATA.filter((d) => val(d) <= thr);
  const right = DATA.filter((d) => val(d) > thr);
  const Hparent = entropy(DATA);
  const HL = entropy(left);
  const HR = entropy(right);
  const wL = left.length / DATA.length;
  const wR = right.length / DATA.length;
  const childH = wL * HL + wR * HR;
  const IG = Math.max(0, Hparent - childH);

  const count = (arr: Item[], lab: 0 | 1) => arr.filter((d) => d.label === lab).length;

  // best gain over all thresholds for this feature (for the bar scale)
  const bestIG = (() => {
    const vals = [...new Set(DATA.map(val))].sort((a, b) => a - b);
    let best = 0;
    for (let i = 0; i < vals.length - 1; i++) {
      const t = (vals[i] + vals[i + 1]) / 2;
      const l = DATA.filter((d) => val(d) <= t);
      const r = DATA.filter((d) => val(d) > t);
      const g = Hparent - ((l.length / DATA.length) * entropy(l) + (r.length / DATA.length) * entropy(r));
      if (g > best) best = g;
    }
    return best;
  })();

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <span class="text-xs font-semibold text-muted">Split on feature:</span>
        {(['age', 'noise'] as Feature[]).map((f) => (
          <button
            key={f}
            onClick={() => setFeature(f)}
            class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              feature === f ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
            }`}
          >
            {f === 'age' ? 'age (good)' : 'lab noise (weak)'}
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
          <div class="flex gap-4 text-xs">
            <span class="flex items-center gap-1.5">
              <span class="inline-block h-3 w-3 rounded-full" style={`background:${COLORS.c0}`} /> clear
            </span>
            <span class="flex items-center gap-1.5">
              <span class="inline-block h-3 w-3 rounded-full" style={`background:${COLORS.c1}`} /> follow-up
            </span>
          </div>
          <p class="text-muted">Drag the green threshold. Each side becomes a child node.</p>

          <div class="grid grid-cols-2 gap-2 text-xs">
            <Readout label={`left (${left.length})`} value={`${count(left, 0)} clear / ${count(left, 1)} follow-up`} />
            <Readout label={`right (${right.length})`} value={`${count(right, 0)} clear / ${count(right, 1)} follow-up`} />
          </div>

          <div class="space-y-2">
            <Readout label="H(parent)" value={`${Hparent.toFixed(3)} bits`} />
            <Readout label="weighted child H" value={`${childH.toFixed(3)} bits`} />
            <Readout label="information gain" value={`${IG.toFixed(3)} bits`} color={COLORS.thr} />
          </div>

          <div class="rounded-lg bg-surface-2 p-3">
            <div class="mb-1 flex justify-between text-xs text-muted">
              <span>gain</span><span>best on this feature: {bestIG.toFixed(3)}</span>
            </div>
            <div class="h-2.5 w-full overflow-hidden rounded-full bg-border">
              <div class="h-full rounded-full" style={`width:${Math.round((IG / Math.max(bestIG, 1e-6)) * 100)}%;background:${COLORS.thr}`} />
            </div>
          </div>

          <p class="text-xs text-muted">
            A decision tree picks the feature and threshold with the <strong>highest gain</strong>.
            Notice how "age" can reach a much larger gain than "lab noise".
          </p>
        </div>
      </div>
    </div>
  );
}

function Readout({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div class="rounded-lg bg-surface-2 px-3 py-2">
      <span class="text-muted">{label}</span>
      <div class="font-mono font-semibold" style={color ? `color:${color}` : ''}>{value}</div>
    </div>
  );
}
