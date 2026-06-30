import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Interactive k-Nearest-Neighbors explorer.
   - Fixed labeled training points in three classes (three brand colors).
   - Drag the white query handle around the feature space.
   - Slide k (1..9, odd values preferred) and watch the k nearest
     neighbors get highlighted with connecting lines.
   - Toggle Euclidean / Manhattan distance and recompute neighbors.
   - Live readout of k and the majority-vote predicted class.
   ------------------------------------------------------------------ */

type Vec = { x: number; y: number };
type Metric = 'euclidean' | 'manhattan';
type Point = { x: number; y: number; cls: number };

// class palette: indigo, sky, emerald
const CLASS_COLORS = ['#4f46e5', '#0ea5e9', '#10b981'];
const CLASS_NAMES = ['Class A', 'Class B', 'Class C'];

const COLORS = {
  grid: 'rgba(128,128,128,0.18)',
  axis: 'rgba(128,128,128,0.5)',
  link: 'rgba(128,128,128,0.85)',
};

// fixed training set in math coords (roughly -5..5 on both axes)
const TRAIN: Point[] = [
  { x: -4.0, y: 3.5, cls: 0 },
  { x: -3.2, y: 2.2, cls: 0 },
  { x: -4.4, y: 1.4, cls: 0 },
  { x: -2.6, y: 3.6, cls: 0 },
  { x: -3.6, y: 0.4, cls: 0 },
  { x: -1.8, y: 1.6, cls: 0 },
  { x: 3.6, y: 3.4, cls: 1 },
  { x: 4.2, y: 2.0, cls: 1 },
  { x: 2.8, y: 2.6, cls: 1 },
  { x: 3.0, y: 1.0, cls: 1 },
  { x: 4.6, y: 3.2, cls: 1 },
  { x: 1.8, y: 2.0, cls: 1 },
  { x: 0.2, y: -3.4, cls: 2 },
  { x: -1.2, y: -2.6, cls: 2 },
  { x: 1.4, y: -2.8, cls: 2 },
  { x: -0.6, y: -4.2, cls: 2 },
  { x: 0.8, y: -1.8, cls: 2 },
  { x: 2.0, y: -3.8, cls: 2 },
];

export default function KNNNeighborhoodExplorer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [query, setQuery] = useState<Vec>({ x: 0, y: 0.6 });
  const [k, setK] = useState(3);
  const [metric, setMetric] = useState<Metric>('euclidean');
  const draggingRef = useRef(false);
  const sizeRef = useRef({ w: 480, h: 360, scale: 32, ox: 240, oy: 180 });

  // ---- coordinate helpers (math space <-> pixels) ----
  const toPx = (v: Vec) => {
    const { scale, ox, oy } = sizeRef.current;
    return { x: ox + v.x * scale, y: oy - v.y * scale };
  };
  const toMath = (px: number, py: number): Vec => {
    const { scale, ox, oy } = sizeRef.current;
    return {
      x: Math.round(((px - ox) / scale) * 10) / 10,
      y: Math.round(((oy - py) / scale) * 10) / 10,
    };
  };

  // ---- distance + neighbor computation ----
  const distOf = (p: Point, q: Vec) =>
    metric === 'euclidean'
      ? Math.hypot(p.x - q.x, p.y - q.y)
      : Math.abs(p.x - q.x) + Math.abs(p.y - q.y);

  const ranked = TRAIN.map((p, i) => ({ i, d: distOf(p, query) })).sort((a, b) => a.d - b.d);
  const neighborIdx = ranked.slice(0, k).map((r) => r.i);

  const votes = [0, 0, 0];
  neighborIdx.forEach((i) => {
    votes[TRAIN[i].cls] += 1;
  });
  let predicted = 0;
  for (let c = 1; c < votes.length; c++) if (votes[c] > votes[predicted]) predicted = c;
  // detect a tie for the top vote count
  const topVotes = votes[predicted];
  const tie = votes.filter((v) => v === topVotes).length > 1;

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h, scale, ox, oy } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);

    // grid
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    for (let gx = ox % scale; gx < w; gx += scale) {
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke();
    }
    for (let gy = oy % scale; gy < h; gy += scale) {
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke();
    }
    // axes
    ctx.strokeStyle = COLORS.axis;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, oy); ctx.lineTo(w, oy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ox, 0); ctx.lineTo(ox, h); ctx.stroke();

    const qpx = toPx(query);
    const neighborSet = new Set(neighborIdx);

    // links from query to each of the k neighbors (draw under the points)
    ctx.lineWidth = 2;
    ctx.strokeStyle = COLORS.link;
    neighborIdx.forEach((i) => {
      const ppx = toPx(TRAIN[i]);
      ctx.beginPath(); ctx.moveTo(qpx.x, qpx.y); ctx.lineTo(ppx.x, ppx.y); ctx.stroke();
    });

    // training points
    TRAIN.forEach((p, i) => {
      const ppx = toPx(p);
      const isNeighbor = neighborSet.has(i);
      // highlight ring for neighbors
      if (isNeighbor) {
        ctx.beginPath();
        ctx.arc(ppx.x, ppx.y, 11, 0, Math.PI * 2);
        ctx.strokeStyle = CLASS_COLORS[p.cls];
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(ppx.x, ppx.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = CLASS_COLORS[p.cls];
      ctx.globalAlpha = isNeighbor ? 1 : 0.55;
      ctx.fill();
      ctx.globalAlpha = 1;
    });

    // query handle (white dot, ringed in the predicted color)
    const ringColor = tie ? COLORS.axis : CLASS_COLORS[predicted];
    ctx.beginPath();
    ctx.arc(qpx.x, qpx.y, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = ringColor;
    ctx.stroke();
    ctx.font = '600 13px Inter, sans-serif';
    ctx.fillStyle = ringColor;
    ctx.fillText('?', qpx.x - 4, qpx.y - 12);
  };

  // ---- responsive sizing with devicePixelRatio ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let raf = 0;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 560);
      const h = Math.round(w * 0.78);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const scale = Math.max(22, Math.min(40, w / 13));
      sizeRef.current = { w, h, scale, ox: w / 2, oy: h / 2 };
      raf = requestAnimationFrame(draw);
    };
    resize();
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(raf);
    };
  }, []);

  // redraw whenever state changes
  useEffect(draw, [query, k, metric]);

  // ---- pointer dragging of the query point ----
  const pointer = (e: PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { px: e.clientX - rect.left, py: e.clientY - rect.top };
  };
  const onDown = (e: PointerEvent) => {
    const { px, py } = pointer(e);
    const qpx = toPx(query);
    if (Math.hypot(qpx.x - px, qpx.y - py) < 26) {
      draggingRef.current = true;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      e.preventDefault();
    } else {
      // tap-to-move: also let the learner reposition by clicking anywhere
      setQuery(toMath(px, py));
    }
  };
  const onMove = (e: PointerEvent) => {
    if (!draggingRef.current) return;
    const { px, py } = pointer(e);
    setQuery(toMath(px, py));
  };
  const onUp = () => { draggingRef.current = false; };

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        {(['euclidean', 'manhattan'] as Metric[]).map((m) => (
          <button
            key={m}
            onClick={() => setMetric(m)}
            class={`rounded-lg px-3 py-1.5 text-sm font-semibold capitalize transition ${
              metric === m ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
            }`}
          >
            {m === 'euclidean' ? 'Euclidean' : 'Manhattan'}
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
            Drag the white <strong>?</strong> handle (or tap the grid) to move the point we want to
            classify. It votes among its nearest neighbors.
          </p>

          <label class="block">
            <span class="mb-1 block text-muted">k = {k} {k % 2 === 0 ? '(even — can tie)' : ''}</span>
            <input
              type="range" min={1} max={9} step={1} value={k}
              onInput={(e) => setK(parseInt((e.target as HTMLInputElement).value, 10))}
              class="w-full accent-[#4f46e5]"
            />
          </label>

          <div class="grid grid-cols-3 gap-2">
            {votes.map((v, c) => (
              <Readout key={c} label={CLASS_NAMES[c]} color={CLASS_COLORS[c]} value={`${v} vote${v === 1 ? '' : 's'}`} />
            ))}
          </div>

          <div class="rounded-lg bg-surface-2 p-3">
            <div class="flex items-center justify-between">
              <span class="text-muted">Predicted class</span>
              {tie ? (
                <span class="rounded-full bg-surface px-2.5 py-0.5 font-semibold text-muted">tie — raise k</span>
              ) : (
                <span
                  class="rounded-full px-2.5 py-0.5 font-semibold text-white"
                  style={`background:${CLASS_COLORS[predicted]}`}
                >
                  {CLASS_NAMES[predicted]}
                </span>
              )}
            </div>
            <p class="mt-1 text-xs text-muted">
              Majority vote among the {k} nearest point{k === 1 ? '' : 's'} using {metric} distance.
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
