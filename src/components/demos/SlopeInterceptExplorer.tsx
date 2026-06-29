import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Slope & intercept explorer for y = m x + b.
   - Drag the m (slope) and b (intercept) sliders.
   - The line moves live; a rise/run triangle shows the slope and the
     y-intercept dot marks where the line crosses the y-axis.
   - Crisp devicePixelRatio canvas, responsive on resize.
   ------------------------------------------------------------------ */

const COLORS = {
  line: '#4f46e5',
  rise: '#10b981',
  run: '#0ea5e9',
  intercept: '#f59e0b',
  grid: 'rgba(128,128,128,0.18)',
  axis: 'rgba(128,128,128,0.6)',
};

export default function SlopeInterceptExplorer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [m, setM] = useState(1);
  const [b, setB] = useState(1);
  const sizeRef = useRef({ w: 480, h: 360, scale: 28, ox: 240, oy: 180 });
  const stateRef = useRef({ m, b });
  stateRef.current = { m, b };

  const toPx = (vx: number, vy: number) => {
    const { scale, ox, oy } = sizeRef.current;
    return { x: ox + vx * scale, y: oy - vy * scale };
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h, scale, ox, oy } = sizeRef.current;
    const { m, b } = stateRef.current;
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

    // the line across the whole canvas
    const leftX = (0 - ox) / scale;
    const rightX = (w - ox) / scale;
    const p1 = toPx(leftX, m * leftX + b);
    const p2 = toPx(rightX, m * rightX + b);
    ctx.strokeStyle = COLORS.line;
    ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();

    // rise/run triangle from (0,b) to (1, m+b)
    const a0 = toPx(0, b);
    const aRun = toPx(1, b);
    const aRise = toPx(1, b + m);
    ctx.lineWidth = 3;
    ctx.strokeStyle = COLORS.run;
    ctx.beginPath(); ctx.moveTo(a0.x, a0.y); ctx.lineTo(aRun.x, aRun.y); ctx.stroke();
    ctx.strokeStyle = COLORS.rise;
    ctx.beginPath(); ctx.moveTo(aRun.x, aRun.y); ctx.lineTo(aRise.x, aRise.y); ctx.stroke();
    ctx.font = '600 12px Inter, sans-serif';
    ctx.fillStyle = COLORS.run; ctx.fillText('run 1', (a0.x + aRun.x) / 2 - 12, a0.y + 16);
    ctx.fillStyle = COLORS.rise; ctx.fillText(`rise ${m}`, aRun.x + 6, (aRun.y + aRise.y) / 2 + 4);

    // y-intercept dot
    ctx.beginPath(); ctx.arc(a0.x, a0.y, 7, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.intercept; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
    ctx.fillStyle = COLORS.intercept;
    ctx.font = '600 13px Inter, sans-serif';
    ctx.fillText(`(0, ${b})`, a0.x + 10, a0.y - 10);
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
      const scale = Math.max(18, Math.min(32, w / 15));
      sizeRef.current = { w, h, scale, ox: w / 2, oy: h / 2 };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(draw, [m, b]);

  const eqn = `y = ${m}x ${b >= 0 ? '+ ' + b : '− ' + Math.abs(b)}`;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

        <div class="space-y-3 text-sm">
          <div class="rounded-xl bg-brand-soft p-3 text-center">
            <p class="font-mono text-xl font-bold text-brand">{eqn}</p>
          </div>

          <label class="block">
            <span class="mb-1 flex justify-between text-muted">
              <span>slope m</span>
              <span class="font-mono font-bold text-text">{m}</span>
            </span>
            <input
              type="range" min={-4} max={4} step={1} value={m}
              onInput={(e) => setM(parseInt((e.target as HTMLInputElement).value, 10))}
              class="w-full accent-[#10b981]"
            />
          </label>

          <label class="block">
            <span class="mb-1 flex justify-between text-muted">
              <span>intercept b</span>
              <span class="font-mono font-bold text-text">{b}</span>
            </span>
            <input
              type="range" min={-5} max={5} step={1} value={b}
              onInput={(e) => setB(parseInt((e.target as HTMLInputElement).value, 10))}
              class="w-full accent-[#f59e0b]"
            />
          </label>

          <div class="rounded-lg bg-surface-2 p-3 text-xs text-muted">
            <p>
              <strong class="text-text">Slope m = {m}:</strong>{' '}
              {m === 0 ? 'flat — y never changes.' : `every step right, y changes by ${m}.`}
            </p>
            <p class="mt-1">
              <strong class="text-text">Intercept b = {b}:</strong> the line crosses the y-axis at (0, {b}).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
