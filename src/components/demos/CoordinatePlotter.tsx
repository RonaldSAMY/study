import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Coordinate-plane plotter.
   - Click (or tap) anywhere to drop a point; it snaps to the integer grid.
   - Reads off (x, y) and names the quadrant / axis.
   - Crisp devicePixelRatio canvas, responsive on resize.
   ------------------------------------------------------------------ */

type Pt = { x: number; y: number };
const COLORS = {
  pt: '#4f46e5',
  last: '#10b981',
  grid: 'rgba(128,128,128,0.18)',
  axis: 'rgba(128,128,128,0.6)',
};

function quadrant(p: Pt): string {
  if (p.x === 0 && p.y === 0) return 'the origin';
  if (p.x === 0) return 'on the y-axis';
  if (p.y === 0) return 'on the x-axis';
  if (p.x > 0 && p.y > 0) return 'Quadrant I';
  if (p.x < 0 && p.y > 0) return 'Quadrant II';
  if (p.x < 0 && p.y < 0) return 'Quadrant III';
  return 'Quadrant IV';
}

export default function CoordinatePlotter() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [points, setPoints] = useState<Pt[]>([{ x: 3, y: 2 }]);
  const sizeRef = useRef({ w: 480, h: 360, scale: 36, ox: 240, oy: 180 });
  const ptsRef = useRef(points);
  ptsRef.current = points;

  const toPx = (v: Pt) => {
    const { scale, ox, oy } = sizeRef.current;
    return { x: ox + v.x * scale, y: oy - v.y * scale };
  };
  const toMath = (px: number, py: number): Pt => {
    const { scale, ox, oy } = sizeRef.current;
    return { x: Math.round((px - ox) / scale), y: Math.round((oy - py) / scale) };
  };

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

    // axis tick labels
    ctx.fillStyle = 'rgba(128,128,128,0.85)';
    ctx.font = '11px Inter, sans-serif';
    const maxX = Math.floor((w - ox) / scale);
    const maxY = Math.floor(oy / scale);
    for (let i = -maxX; i <= maxX; i++) {
      if (i === 0) continue;
      ctx.fillText(`${i}`, ox + i * scale - 3, oy + 14);
    }
    for (let j = -maxY; j <= maxY; j++) {
      if (j === 0) continue;
      ctx.fillText(`${j}`, ox + 6, oy - j * scale + 4);
    }

    // points
    ptsRef.current.forEach((p, i) => {
      const px = toPx(p);
      const isLast = i === ptsRef.current.length - 1;
      const color = isLast ? COLORS.last : COLORS.pt;
      // dashed guide lines for the last point
      if (isLast) {
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = 'rgba(16,185,129,0.7)';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(px.x, px.y); ctx.lineTo(px.x, oy); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(px.x, px.y); ctx.lineTo(ox, px.y); ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.beginPath();
      ctx.arc(px.x, px.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = color; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
      ctx.fillStyle = color;
      ctx.font = '600 13px Inter, sans-serif';
      ctx.fillText(`(${p.x}, ${p.y})`, px.x + 9, px.y - 9);
    });
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 560);
      const h = Math.round(w * 0.72);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const scale = Math.max(24, Math.min(40, w / 13));
      sizeRef.current = { w, h, scale, ox: w / 2, oy: h / 2 };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(draw, [points]);

  const onClick = (e: PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const m = toMath(e.clientX - rect.left, e.clientY - rect.top);
    setPoints((ps) => [...ps, m]);
  };

  const last = points[points.length - 1];

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas
          ref={canvasRef}
          class="touch-none cursor-crosshair rounded-xl bg-surface-2"
          onPointerDown={onClick}
        />
        <div class="space-y-3 text-sm">
          <p class="text-muted">Click (or tap) the grid to plot a point.</p>
          {last && (
            <div class="rounded-xl bg-brand-soft p-3">
              <p class="text-xs font-semibold uppercase tracking-wide text-brand">last point</p>
              <p class="font-mono text-2xl font-bold text-brand">({last.x}, {last.y})</p>
              <p class="mt-1 text-xs text-muted">
                x = {last.x} (right/left), y = {last.y} (up/down) → <strong>{quadrant(last)}</strong>
              </p>
            </div>
          )}
          <div class="flex items-center justify-between">
            <span class="text-muted">{points.length} point{points.length === 1 ? '' : 's'} plotted</span>
            <button
              onClick={() => setPoints([])}
              class="rounded-lg bg-surface-2 px-3 py-1.5 font-semibold text-muted transition hover:text-text"
            >
              clear
            </button>
          </div>
          <p class="text-xs text-muted">
            Always read the <strong>x</strong> (horizontal) coordinate first, then the <strong>y</strong> (vertical).
          </p>
        </div>
      </div>
    </div>
  );
}
