import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Law of Sines & Cosines explorer for a general (non-right) triangle.
   - Drag any of the three vertices A, B, C.
   - Sides: a = BC (opposite A), b = CA (opposite B), c = AB (opposite C).
   - Live: each ratio side/sin(angle) (law of sines) and a law-of-cosines
     check for side c.
   ------------------------------------------------------------------ */

type P = { x: number; y: number };
const COLORS = {
  A: '#4f46e5',
  B: '#0ea5e9',
  C: '#10b981',
  fill: 'rgba(79,70,229,0.07)',
  edge: 'rgba(128,128,128,0.55)',
};

export default function TriangleLawsExplorer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // vertices in pixel space (set on resize, scaled to canvas)
  const [pts, setPts] = useState<{ A: P; B: P; C: P }>({
    A: { x: 90, y: 250 },
    B: { x: 330, y: 270 },
    C: { x: 210, y: 70 },
  });
  const dragRef = useRef<null | 'A' | 'B' | 'C'>(null);
  const sizeRef = useRef({ w: 420, h: 340 });

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);
    const { A, B, C } = pts;

    ctx.beginPath();
    ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.lineTo(C.x, C.y); ctx.closePath();
    ctx.fillStyle = COLORS.fill; ctx.fill();
    ctx.strokeStyle = COLORS.edge; ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.stroke();

    // side labels at midpoints
    ctx.font = '600 14px Inter, sans-serif';
    mid(ctx, B, C, 'a', COLORS.A);
    mid(ctx, C, A, 'b', COLORS.B);
    mid(ctx, A, B, 'c', COLORS.C);

    // vertices
    vertex(ctx, A, 'A', COLORS.A);
    vertex(ctx, B, 'B', COLORS.B);
    vertex(ctx, C, 'C', COLORS.C);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 460);
      const h = Math.round(w * 0.8);
      const dpr = window.devicePixelRatio || 1;
      // rescale points if canvas size changes
      const prev = sizeRef.current;
      const sx = w / prev.w, sy = h / prev.h;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w, h };
      if (sx !== 1 || sy !== 1) {
        setPts((p) => ({
          A: { x: p.A.x * sx, y: p.A.y * sy },
          B: { x: p.B.x * sx, y: p.B.y * sy },
          C: { x: p.C.x * sx, y: p.C.y * sy },
        }));
      } else {
        draw();
      }
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(draw, [pts]);

  const pointer = (e: PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };
  const onDown = (e: PointerEvent) => {
    const p = pointer(e);
    const near = (q: P) => Math.hypot(p.x - q.x, p.y - q.y) < 24;
    const which = near(pts.A) ? 'A' : near(pts.B) ? 'B' : near(pts.C) ? 'C' : null;
    if (which) {
      dragRef.current = which;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      e.preventDefault();
    }
  };
  const onMove = (e: PointerEvent) => {
    if (!dragRef.current) return;
    const p = pointer(e);
    const { w, h } = sizeRef.current;
    const cx = Math.max(16, Math.min(w - 16, p.x));
    const cy = Math.max(16, Math.min(h - 16, p.y));
    setPts((prev) => ({ ...prev, [dragRef.current!]: { x: cx, y: cy } }));
  };
  const onUp = () => { dragRef.current = null; };

  // ---- geometry (note: pixel y is flipped, but lengths/angles are invariant) ----
  const { A, B, C } = pts;
  const a = Math.hypot(B.x - C.x, B.y - C.y); // opposite A
  const b = Math.hypot(C.x - A.x, C.y - A.y); // opposite B
  const c = Math.hypot(A.x - B.x, A.y - B.y); // opposite C
  const angle = (u: P, v: P, w2: P) => {
    // angle at vertex u
    const ux = v.x - u.x, uy = v.y - u.y;
    const wx = w2.x - u.x, wy = w2.y - u.y;
    const d = (ux * wx + uy * wy) / (Math.hypot(ux, uy) * Math.hypot(wx, wy) || 1);
    return Math.acos(Math.max(-1, Math.min(1, d)));
  };
  const Aang = angle(A, B, C);
  const Bang = angle(B, A, C);
  const Cang = angle(C, A, B);
  const deg = (r: number) => (r * 180) / Math.PI;

  const rA = a / Math.sin(Aang);
  const rB = b / Math.sin(Bang);
  const rC = c / Math.sin(Cang);

  // law of cosines check on side c
  const cosPredict = Math.sqrt(Math.max(0, a * a + b * b - 2 * a * b * Math.cos(Cang)));

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
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
          <p class="text-muted">Drag vertices A, B, C. Sides and angles update live (lengths in pixels).</p>

          <div class="grid grid-cols-3 gap-2">
            <Readout label="∠A" color={COLORS.A} value={`${deg(Aang).toFixed(0)}°`} />
            <Readout label="∠B" color={COLORS.B} value={`${deg(Bang).toFixed(0)}°`} />
            <Readout label="∠C" color={COLORS.C} value={`${deg(Cang).toFixed(0)}°`} />
          </div>
          <p class="text-center text-xs text-muted">angles sum to {(deg(Aang) + deg(Bang) + deg(Cang)).toFixed(0)}°</p>

          <div class="rounded-lg bg-surface-2 p-3 font-mono text-[0.78rem]">
            <p class="mb-1 font-sans text-xs font-bold text-muted">Law of Sines — all equal:</p>
            <div class="flex justify-between"><span style={`color:${COLORS.A}`}>a / sin A</span><strong>{rA.toFixed(1)}</strong></div>
            <div class="flex justify-between"><span style={`color:${COLORS.B}`}>b / sin B</span><strong>{rB.toFixed(1)}</strong></div>
            <div class="flex justify-between"><span style={`color:${COLORS.C}`}>c / sin C</span><strong>{rC.toFixed(1)}</strong></div>
          </div>

          <div class="rounded-lg bg-surface-2 p-3 font-mono text-[0.78rem]">
            <p class="mb-1 font-sans text-xs font-bold text-muted">Law of Cosines — predict side c:</p>
            <div class="flex justify-between"><span>√(a²+b²−2ab·cosC)</span><strong>{cosPredict.toFixed(1)}</strong></div>
            <div class="flex justify-between"><span class="text-muted">measured c</span><strong>{c.toFixed(1)}</strong></div>
          </div>
        </div>
      </div>
    </div>
  );
}

function vertex(ctx: CanvasRenderingContext2D, p: P, name: string, color: string) {
  ctx.beginPath(); ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
  ctx.fillStyle = '#fff'; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = color; ctx.stroke();
  ctx.fillStyle = color; ctx.font = '700 14px Inter, sans-serif';
  ctx.fillText(name, p.x + 11, p.y - 9);
}
function mid(ctx: CanvasRenderingContext2D, p: P, q: P, name: string, color: string) {
  ctx.fillStyle = color;
  ctx.fillText(name, (p.x + q.x) / 2 - 4, (p.y + q.y) / 2 + 4);
}

function Readout({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div class="rounded-lg bg-surface-2 px-3 py-2">
      <span class="text-muted" style={color ? `color:${color}` : ""}>{label}</span>
      <div class="font-mono font-semibold">{value}</div>
    </div>
  );
}
