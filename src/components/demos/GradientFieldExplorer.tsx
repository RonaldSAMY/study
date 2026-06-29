import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   The gradient — steepest ascent on a contour map.
   Drag the white handle anywhere on the terrain. The emerald arrow is
   ∇f: it points in the direction of steepest uphill and is always
   perpendicular to the contour line through the point.
   ------------------------------------------------------------------ */

type Vec = { x: number; y: number };

function elev(x: number, y: number): number {
  return (
    1.7 * Math.exp(-((x - 0.8) ** 2 + (y - 0.6) ** 2) / 2.0) +
    1.1 * Math.exp(-((x + 1.4) ** 2 + (y + 1.0) ** 2) / 1.2) -
    0.5 * Math.exp(-(x ** 2 + (y + 1.7) ** 2) / 0.6)
  );
}

const DOMAIN = 3;
const Z_MIN = -0.6;
const Z_MAX = 1.8;

function color(t: number): string {
  const c = Math.max(0, Math.min(1, t));
  const stops: [number, [number, number, number]][] = [
    [0, [22, 60, 80]],
    [0.4, [16, 120, 110]],
    [0.65, [120, 165, 80]],
    [0.85, [210, 188, 112]],
    [1, [245, 246, 250]],
  ];
  for (let i = 1; i < stops.length; i++) {
    if (c <= stops[i][0]) {
      const [t0, a] = stops[i - 1];
      const [t1, b] = stops[i];
      const f = (c - t0) / (t1 - t0);
      return `rgb(${Math.round(a[0] + f * (b[0] - a[0]))},${Math.round(
        a[1] + f * (b[1] - a[1]),
      )},${Math.round(a[2] + f * (b[2] - a[2]))})`;
    }
  }
  return 'rgb(245,246,250)';
}

function grad(x: number, y: number): Vec {
  const e = 1e-3;
  return {
    x: (elev(x + e, y) - elev(x - e, y)) / (2 * e),
    y: (elev(x, y + e) - elev(x, y - e)) / (2 * e),
  };
}

export default function GradientFieldExplorer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 460, h: 460 });
  const [p, setP] = useState<Vec>({ x: -0.5, y: 0.3 });
  const dragRef = useRef(false);

  const toPx = (v: Vec) => {
    const { w, h } = sizeRef.current;
    return { x: ((v.x + DOMAIN) / (2 * DOMAIN)) * w, y: ((DOMAIN - v.y) / (2 * DOMAIN)) * h };
  };
  const toMath = (px: number, py: number): Vec => {
    const { w, h } = sizeRef.current;
    return { x: (px / w) * 2 * DOMAIN - DOMAIN, y: DOMAIN - (py / h) * 2 * DOMAIN };
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);
    const cell = 4;
    for (let py = 0; py < h; py += cell) {
      for (let px = 0; px < w; px += cell) {
        const m = toMath(px + cell / 2, py + cell / 2);
        ctx.fillStyle = color((elev(m.x, m.y) - Z_MIN) / (Z_MAX - Z_MIN));
        ctx.fillRect(px, py, cell, cell);
      }
    }
    // contours
    const levels = [-0.3, 0, 0.3, 0.6, 0.9, 1.2, 1.5];
    const N = 110;
    const step = (2 * DOMAIN) / N;
    ctx.lineWidth = 1;
    for (const lv of levels) {
      // highlight the contour passing through the handle
      const close = Math.abs(elev(p.x, p.y) - lv) < 0.05;
      ctx.strokeStyle = close ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.4)';
      ctx.beginPath();
      for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
          const x0 = -DOMAIN + i * step;
          const y0 = -DOMAIN + j * step;
          const a = elev(x0, y0) - lv;
          const bb = elev(x0 + step, y0) - lv;
          const c = elev(x0, y0 + step) - lv;
          if (a * bb < 0) {
            const f = a / (a - bb);
            const q = toPx({ x: x0 + f * step, y: y0 });
            ctx.moveTo(q.x, q.y); ctx.lineTo(q.x + 0.6, q.y + 0.6);
          }
          if (a * c < 0) {
            const f = a / (a - c);
            const q = toPx({ x: x0, y: y0 + f * step });
            ctx.moveTo(q.x, q.y); ctx.lineTo(q.x + 0.6, q.y + 0.6);
          }
        }
      }
      ctx.stroke();
    }

    // gradient arrow at the handle
    const g = grad(p.x, p.y);
    const gLen = Math.hypot(g.x, g.y) || 1e-9;
    const ph = toPx(p);
    // scale arrow length for visibility (cap it)
    const drawLen = Math.min(0.9, 0.35 + gLen * 0.35); // in math units
    const tip = toPx({ x: p.x + (g.x / gLen) * drawLen, y: p.y + (g.y / gLen) * drawLen });
    arrow(ctx, ph, tip, '#10b981', 4);
    // descent (negative gradient) ghost arrow
    const tipDown = toPx({ x: p.x - (g.x / gLen) * drawLen * 0.7, y: p.y - (g.y / gLen) * drawLen * 0.7 });
    ctx.globalAlpha = 0.5;
    arrow(ctx, ph, tipDown, '#0ea5e9', 2.5);
    ctx.globalAlpha = 1;
    // handle
    ctx.beginPath(); ctx.arc(ph.x, ph.y, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#fff'; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = '#4f46e5'; ctx.stroke();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 460);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr; canvas.height = w * dpr;
      canvas.style.width = `${w}px`; canvas.style.height = `${w}px`;
      canvas.getContext('2d')?.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w, h: w };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(draw, [p]);

  const pointer = (e: PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return toMath(e.clientX - rect.left, e.clientY - rect.top);
  };
  const onDown = (e: PointerEvent) => {
    dragRef.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setP(pointer(e));
    e.preventDefault();
  };
  const onMove = (e: PointerEvent) => { if (dragRef.current) setP(pointer(e)); };
  const onUp = () => { dragRef.current = false; };

  const g = grad(p.x, p.y);
  const gMag = Math.hypot(g.x, g.y);

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2"
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} />
        <div class="space-y-3 text-sm">
          <p class="text-muted">Drag the handle. The <span style="color:#10b981" class="font-semibold">green arrow</span> is the gradient ∇f — the steepest way uphill from where you stand.</p>
          <div class="grid grid-cols-2 gap-2">
            <Readout label="∂f/∂x" value={g.x.toFixed(2)} />
            <Readout label="∂f/∂y" value={g.y.toFixed(2)} />
            <Readout label="‖∇f‖ (steepness)" value={gMag.toFixed(2)} />
            <Readout label="height f" value={elev(p.x, p.y).toFixed(2)} />
          </div>
          <div class="rounded-lg bg-surface-2 p-3 text-xs text-muted">
            Notice the green arrow always crosses the bright contour at a
            <strong class="text-text"> right angle</strong>. The faint
            <span style="color:#0ea5e9" class="font-semibold"> blue arrow</span> is −∇f:
            the steepest way <em>downhill</em> — the direction gradient descent takes.
          </div>
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

function arrow(ctx: CanvasRenderingContext2D, from: Vec, to: Vec, c: string, width: number) {
  const ang = Math.atan2(to.y - from.y, to.x - from.x);
  const head = 12;
  ctx.strokeStyle = c; ctx.fillStyle = c; ctx.lineWidth = width; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(to.x - head * Math.cos(ang - 0.4), to.y - head * Math.sin(ang - 0.4));
  ctx.lineTo(to.x - head * Math.cos(ang + 0.4), to.y - head * Math.sin(ang + 0.4));
  ctx.closePath(); ctx.fill();
}
