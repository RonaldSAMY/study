import { useEffect, useMemo, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Decision Split Explorer.
   - A fixed 2D scatter of points in two classes (sky vs indigo).
   - Drag a split threshold (vertical line on x, or horizontal on y).
   - Pick the impurity metric (Gini or Entropy).
   - Live: parent impurity, weighted child impurity, information gain,
     left/right class counts, and a marker for the best gain found.
   ------------------------------------------------------------------ */

type Axis = 'x' | 'y';
type Metric = 'gini' | 'entropy';
type Pt = { x: number; y: number; c: 0 | 1 };

const COLORS = {
  c0: '#0ea5e9', // sky  -> class 0
  c1: '#4f46e5', // indigo -> class 1
  best: '#10b981', // emerald
  line: '#10b981',
  grid: 'rgba(128,128,128,0.18)',
  axis: 'rgba(128,128,128,0.5)',
};

const DOM = 10; // data domain is 0..10 on both axes

// Fixed dataset: class 0 (sky) clusters left, class 1 (indigo) clusters right.
const POINTS: Pt[] = [
  { x: 1.2, y: 2.5, c: 0 }, { x: 2.0, y: 4.0, c: 0 }, { x: 1.8, y: 6.5, c: 0 },
  { x: 2.6, y: 1.5, c: 0 }, { x: 3.1, y: 5.2, c: 0 }, { x: 2.3, y: 7.8, c: 0 },
  { x: 3.6, y: 3.0, c: 0 }, { x: 1.5, y: 8.6, c: 0 }, { x: 4.0, y: 6.0, c: 0 },
  { x: 3.3, y: 8.8, c: 0 }, { x: 4.6, y: 2.2, c: 0 }, { x: 2.8, y: 3.6, c: 0 },
  { x: 6.4, y: 3.0, c: 1 }, { x: 7.1, y: 5.5, c: 1 }, { x: 6.8, y: 1.8, c: 1 },
  { x: 7.9, y: 6.8, c: 1 }, { x: 8.4, y: 3.4, c: 1 }, { x: 6.1, y: 7.6, c: 1 },
  { x: 8.8, y: 5.0, c: 1 }, { x: 7.5, y: 8.4, c: 1 }, { x: 9.0, y: 2.0, c: 1 },
  { x: 5.7, y: 4.4, c: 1 }, { x: 8.1, y: 8.0, c: 1 }, { x: 9.3, y: 6.2, c: 1 },
];

// ---- impurity math ----
function impurity(c0: number, c1: number, metric: Metric): number {
  const n = c0 + c1;
  if (n === 0) return 0;
  const p0 = c0 / n;
  const p1 = c1 / n;
  if (metric === 'gini') return 1 - p0 * p0 - p1 * p1;
  const term = (p: number) => (p > 0 ? -p * Math.log2(p) : 0);
  return term(p0) + term(p1);
}

type Split = { L: [number, number]; R: [number, number] };

function counts(axis: Axis, thr: number): Split {
  const L: [number, number] = [0, 0];
  const R: [number, number] = [0, 0];
  for (const p of POINTS) {
    const v = axis === 'x' ? p.x : p.y;
    if (v < thr) L[p.c] += 1;
    else R[p.c] += 1;
  }
  return { L, R };
}

function gain(axis: Axis, thr: number, metric: Metric, parent: number): number {
  const { L, R } = counts(axis, thr);
  const nL = L[0] + L[1];
  const nR = R[0] + R[1];
  const n = nL + nR || 1;
  const child = (nL / n) * impurity(L[0], L[1], metric) + (nR / n) * impurity(R[0], R[1], metric);
  return parent - child;
}

export default function DecisionSplitExplorer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [axis, setAxis] = useState<Axis>('x');
  const [metric, setMetric] = useState<Metric>('gini');
  const [thr, setThr] = useState(5);
  const draggingRef = useRef(false);
  const sizeRef = useRef({ w: 480, h: 360, pad: 28 });

  // ---- data <-> pixel helpers ----
  const dataToPx = (dx: number, dy: number) => {
    const { w, h, pad } = sizeRef.current;
    return {
      x: pad + (dx / DOM) * (w - 2 * pad),
      y: h - pad - (dy / DOM) * (h - 2 * pad),
    };
  };
  const pxToDataX = (px: number) => {
    const { w, pad } = sizeRef.current;
    return ((px - pad) / (w - 2 * pad)) * DOM;
  };
  const pxToDataY = (py: number) => {
    const { h, pad } = sizeRef.current;
    return ((h - pad - py) / (h - 2 * pad)) * DOM;
  };

  // ---- live impurity numbers ----
  const parent = useMemo(() => {
    let c0 = 0;
    let c1 = 0;
    for (const p of POINTS) {
      if (p.c === 0) c0 += 1;
      else c1 += 1;
    }
    return impurity(c0, c1, metric);
  }, [metric]);

  const { L, R } = useMemo(() => counts(axis, thr), [axis, thr]);
  const nL = L[0] + L[1];
  const nR = R[0] + R[1];
  const nTot = nL + nR || 1;
  const impL = impurity(L[0], L[1], metric);
  const impR = impurity(R[0], R[1], metric);
  const childImp = (nL / nTot) * impL + (nR / nTot) * impR;
  const infoGain = parent - childImp;

  // ---- best split for current axis + metric (scan candidate thresholds) ----
  const best = useMemo(() => {
    const vals = POINTS.map((p) => (axis === 'x' ? p.x : p.y)).sort((a, b) => a - b);
    let bThr = vals[0];
    let bGain = -Infinity;
    for (let i = 0; i < vals.length - 1; i++) {
      const mid = (vals[i] + vals[i + 1]) / 2;
      const g = gain(axis, mid, metric, parent);
      if (g > bGain) {
        bGain = g;
        bThr = mid;
      }
    }
    return { thr: bThr, gain: Math.max(0, bGain) };
  }, [axis, metric, parent]);

  // ---- drawing ----
  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h, pad } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);

    // shade the two regions, tinted by each region's majority class
    const lMaj = L[1] > L[0] ? COLORS.c1 : COLORS.c0;
    const rMaj = R[1] > R[0] ? COLORS.c1 : COLORS.c0;
    const tl = dataToPx(0, DOM);
    const br = dataToPx(DOM, 0);
    ctx.save();
    ctx.globalAlpha = 0.12;
    if (axis === 'x') {
      const sx = dataToPx(thr, 0).x;
      ctx.fillStyle = lMaj;
      ctx.fillRect(tl.x, tl.y, sx - tl.x, br.y - tl.y);
      ctx.fillStyle = rMaj;
      ctx.fillRect(sx, tl.y, br.x - sx, br.y - tl.y);
    } else {
      const sy = dataToPx(0, thr).y;
      ctx.fillStyle = rMaj; // above threshold (top)
      ctx.fillRect(tl.x, tl.y, br.x - tl.x, sy - tl.y);
      ctx.fillStyle = lMaj; // below threshold (bottom)
      ctx.fillRect(tl.x, sy, br.x - tl.x, br.y - sy);
    }
    ctx.restore();

    // grid
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    for (let g = 0; g <= DOM; g += 1) {
      const vx = dataToPx(g, 0).x;
      ctx.beginPath(); ctx.moveTo(vx, tl.y); ctx.lineTo(vx, br.y); ctx.stroke();
      const vy = dataToPx(0, g).y;
      ctx.beginPath(); ctx.moveTo(tl.x, vy); ctx.lineTo(br.x, vy); ctx.stroke();
    }
    // border / axes
    ctx.strokeStyle = COLORS.axis;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);

    // best-gain marker (dashed)
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = COLORS.best;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.75;
    if (axis === 'x') {
      const bx = dataToPx(best.thr, 0).x;
      ctx.beginPath(); ctx.moveTo(bx, tl.y); ctx.lineTo(bx, br.y); ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      ctx.fillStyle = COLORS.best;
      ctx.font = '600 11px Inter, sans-serif';
      ctx.fillText('best', bx + 4, tl.y + 12);
    } else {
      const by = dataToPx(0, best.thr).y;
      ctx.beginPath(); ctx.moveTo(tl.x, by); ctx.lineTo(br.x, by); ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      ctx.fillStyle = COLORS.best;
      ctx.font = '600 11px Inter, sans-serif';
      ctx.fillText('best', br.x - 26, by - 4);
    }
    ctx.restore();

    // points
    for (const p of POINTS) {
      const { x, y } = dataToPx(p.x, p.y);
      ctx.beginPath();
      ctx.arc(x, y, 5.5, 0, Math.PI * 2);
      ctx.fillStyle = p.c === 0 ? COLORS.c0 : COLORS.c1;
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#fff';
      ctx.stroke();
    }

    // the draggable split line (solid emerald, thicker)
    ctx.strokeStyle = COLORS.line;
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    if (axis === 'x') {
      const sx = dataToPx(thr, 0).x;
      ctx.beginPath(); ctx.moveTo(sx, tl.y); ctx.lineTo(sx, br.y); ctx.stroke();
      handle(ctx, { x: sx, y: (tl.y + br.y) / 2 }, COLORS.line);
    } else {
      const sy = dataToPx(0, thr).y;
      ctx.beginPath(); ctx.moveTo(tl.x, sy); ctx.lineTo(br.x, sy); ctx.stroke();
      handle(ctx, { x: (tl.x + br.x) / 2, y: sy }, COLORS.line);
    }
  };

  // ---- responsive sizing with devicePixelRatio ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parentEl = canvas.parentElement!;
      const w = Math.min(parentEl.clientWidth, 520);
      const h = Math.round(w * 0.82);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w, h, pad: 28 };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // redraw on state change
  useEffect(draw, [axis, thr, metric, L, R, best]);

  // ---- pointer dragging of the split line ----
  const updateFromPointer = (e: PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const v = axis === 'x' ? pxToDataX(px) : pxToDataY(py);
    setThr(Math.min(DOM, Math.max(0, Math.round(v * 100) / 100)));
  };
  const onDown = (e: PointerEvent) => {
    draggingRef.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
    updateFromPointer(e);
  };
  const onMove = (e: PointerEvent) => {
    if (!draggingRef.current) return;
    updateFromPointer(e);
  };
  const onUp = () => { draggingRef.current = false; };

  const metricName = metric === 'gini' ? 'Gini' : 'Entropy';

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <span class="text-xs font-semibold text-muted">Split on:</span>
        {(['x', 'y'] as Axis[]).map((ax) => (
          <button
            key={ax}
            onClick={() => setAxis(ax)}
            class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              axis === ax ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
            }`}
          >
            {ax === 'x' ? 'feature x (vertical line)' : 'feature y (horizontal line)'}
          </button>
        ))}
        <span class="ml-2 text-xs font-semibold text-muted">Metric:</span>
        {(['gini', 'entropy'] as Metric[]).map((m) => (
          <button
            key={m}
            onClick={() => setMetric(m)}
            class={`rounded-lg px-3 py-1.5 text-sm font-semibold capitalize transition ${
              metric === m ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
            }`}
          >
            {m}
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
          <p class="text-muted">
            Drag the green line to move the split threshold. Points left/below go to one child, right/above to the other.
          </p>

          <label class="block">
            <span class="mb-1 block text-muted">
              threshold ({axis}) = {thr.toFixed(2)}
            </span>
            <input
              type="range" min={0} max={DOM} step={0.05} value={thr}
              onInput={(e) => setThr(parseFloat((e.target as HTMLInputElement).value))}
              class="w-full accent-[#10b981]"
            />
          </label>

          <div class="grid grid-cols-2 gap-2">
            <Readout
              label={axis === 'x' ? 'left child' : 'bottom child'}
              value={`sky ${L[0]} / indigo ${L[1]}`}
            />
            <Readout
              label={axis === 'x' ? 'right child' : 'top child'}
              value={`sky ${R[0]} / indigo ${R[1]}`}
            />
            <Readout label={`parent ${metricName}`} value={parent.toFixed(3)} />
            <Readout label={`weighted child`} value={childImp.toFixed(3)} />
          </div>

          <div class="rounded-lg bg-surface-2 p-3">
            <div class="flex items-baseline justify-between">
              <span class="text-muted">information gain</span>
              <strong class="text-lg" style="color:#10b981">{infoGain.toFixed(3)}</strong>
            </div>
            <div class="mt-1 flex justify-between text-xs text-muted">
              <span>best gain found</span>
              <span class="font-mono">{best.gain.toFixed(3)} at {axis} = {best.thr.toFixed(2)}</span>
            </div>
            <p class="mt-1 text-xs text-muted">
              Gain = parent {metricName} − weighted child {metricName}. Bigger gain = purer children.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Readout({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div class="rounded-lg bg-surface-2 px-3 py-2">
      <span class="text-muted" style={color ? `color:${color}` : ''}>{label}</span>
      <div class="font-mono font-semibold">{value}</div>
    </div>
  );
}

// ---- canvas primitive ----
function handle(ctx: CanvasRenderingContext2D, at: { x: number; y: number }, color: string) {
  ctx.beginPath();
  ctx.arc(at.x, at.y, 7, 0, Math.PI * 2);
  ctx.fillStyle = '#fff';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = color;
  ctx.stroke();
}
