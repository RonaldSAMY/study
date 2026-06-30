import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Scaled dot-product attention, one query at a time.
   - Five key/value tokens sit in a 2D space (values = key positions).
   - Drag the indigo QUERY. Scores = (q · kᵢ)/√d, softmax → weights.
   - The emerald OUTPUT is the weight-blended value Σ wᵢ·vᵢ.
   Canvas conventions copied from VectorPlayground.
   ------------------------------------------------------------------ */

type Vec = { x: number; y: number };

const COLORS = {
  q: '#4f46e5',
  k: '#0ea5e9',
  out: '#10b981',
  grid: 'rgba(128,128,128,0.18)',
  axis: 'rgba(128,128,128,0.5)',
};

// a short "sentence" — each token is a key (and its value = same point)
const TOKENS = ['The', 'cat', 'sat', 'on', 'mat'];
const KEYS: Vec[] = [
  { x: -3.2, y: 1.8 },
  { x: 2.8, y: 2.6 },
  { x: 3.4, y: -1.2 },
  { x: -1.0, y: -2.8 },
  { x: -3.0, y: -1.6 },
];

const softmax = (s: number[]) => {
  const m = Math.max(...s);
  const ex = s.map((v) => Math.exp(v - m));
  const z = ex.reduce((a, b) => a + b, 0) || 1;
  return ex.map((v) => v / z);
};

export default function AttentionWeightLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [q, setQ] = useState<Vec>({ x: 2.4, y: 2.0 });
  const [scaled, setScaled] = useState(true);
  const dragRef = useRef(false);
  const sizeRef = useRef({ w: 480, h: 360, scale: 36, ox: 240, oy: 180 });

  const d = 2;
  const scores = KEYS.map((k) => (q.x * k.x + q.y * k.y) / (scaled ? Math.sqrt(d) : 1));
  const weights = softmax(scores);
  const out: Vec = KEYS.reduce(
    (acc, k, i) => ({ x: acc.x + weights[i] * k.x, y: acc.y + weights[i] * k.y }),
    { x: 0, y: 0 },
  );

  const toPx = (v: Vec) => {
    const { scale, ox, oy } = sizeRef.current;
    return { x: ox + v.x * scale, y: oy - v.y * scale };
  };
  const toMath = (px: number, py: number): Vec => {
    const { scale, ox, oy } = sizeRef.current;
    return { x: (px - ox) / scale, y: (oy - py) / scale };
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h, scale, ox, oy } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);

    ctx.strokeStyle = COLORS.grid; ctx.lineWidth = 1;
    for (let gx = ox % scale; gx < w; gx += scale) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke(); }
    for (let gy = oy % scale; gy < h; gy += scale) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke(); }
    ctx.strokeStyle = COLORS.axis; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, oy); ctx.lineTo(w, oy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ox, 0); ctx.lineTo(ox, h); ctx.stroke();

    // attention "beams" from query to each key, opacity = weight
    KEYS.forEach((k, i) => {
      ctx.strokeStyle = `rgba(16,185,129,${0.12 + 0.85 * weights[i]})`;
      ctx.lineWidth = 1 + 7 * weights[i];
      const p1 = toPx(q), p2 = toPx(k);
      ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
    });

    // keys
    KEYS.forEach((k, i) => {
      const p = toPx(k);
      ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.k; ctx.fill();
      ctx.font = '600 13px Inter, sans-serif'; ctx.fillStyle = COLORS.k;
      ctx.fillText(`${TOKENS[i]} ${(weights[i] * 100).toFixed(0)}%`, p.x + 9, p.y - 8);
    });

    // output blended value
    const op = toPx(out);
    ctx.beginPath(); ctx.arc(op.x, op.y, 7, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.out; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
    ctx.font = '700 13px Inter, sans-serif'; ctx.fillStyle = COLORS.out;
    ctx.fillText('output', op.x + 10, op.y + 16);

    // query handle
    const qp = toPx(q);
    ctx.beginPath(); ctx.arc(qp.x, qp.y, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#fff'; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = COLORS.q; ctx.stroke();
    ctx.font = '700 14px Inter, sans-serif'; ctx.fillStyle = COLORS.q;
    ctx.fillText('query', qp.x + 11, qp.y - 9);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 540);
      const h = Math.round(w * 0.74);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr; canvas.height = h * dpr;
      canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const scale = Math.max(26, Math.min(46, w / 11));
      sizeRef.current = { w, h, scale, ox: w / 2, oy: h / 2 };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(draw, [q, scaled]);

  const pointer = (e: PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { px: e.clientX - rect.left, py: e.clientY - rect.top };
  };
  const onDown = (e: PointerEvent) => {
    const { px, py } = pointer(e);
    const qp = toPx(q);
    if (Math.hypot(qp.x - px, qp.y - py) < 26) {
      dragRef.current = true;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      e.preventDefault();
    }
  };
  const onMove = (e: PointerEvent) => {
    if (!dragRef.current) return;
    const { px, py } = pointer(e);
    setQ(toMath(px, py));
  };
  const onUp = () => { dragRef.current = false; };

  const top = weights.indexOf(Math.max(...weights));

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-3">
        <label class="flex items-center gap-2 text-sm font-semibold text-muted">
          <input type="checkbox" checked={scaled} onChange={(e) => setScaled((e.target as HTMLInputElement).checked)} class="accent-[#4f46e5]" />
          divide scores by √d
        </label>
        <span class="text-xs text-muted">d = {d}, √d = {Math.sqrt(d).toFixed(2)}</span>
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
          <p class="text-muted">Drag the indigo <strong>query</strong>. The brightest beam is where attention flows.</p>
          <div class="rounded-lg bg-surface-2 p-3">
            <p class="mb-2 font-semibold text-text">Attention weights (softmax):</p>
            <div class="space-y-1 font-mono text-xs">
              {TOKENS.map((tk, i) => (
                <div key={tk} class="flex items-center gap-2">
                  <span class="w-10">{tk}</span>
                  <span class="h-2.5 rounded-full" style={`width:${Math.max(2, weights[i] * 120)}px;background:${i === top ? COLORS.out : COLORS.k}`} />
                  <span class="text-muted">{weights[i].toFixed(3)}</span>
                </div>
              ))}
            </div>
          </div>
          <div class="rounded-lg bg-surface-2 p-3 text-xs">
            <div class="flex justify-between"><span class="text-muted">output = Σ wᵢ·vᵢ</span><strong class="font-mono">({out.x.toFixed(2)}, {out.y.toFixed(2)})</strong></div>
            <p class="mt-1 text-muted">
              {scaled
                ? 'Scaling keeps scores tame, so the softmax stays soft instead of collapsing onto one token.'
                : 'Unscaled, large dot products make softmax razor-sharp — almost all weight on one token.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
