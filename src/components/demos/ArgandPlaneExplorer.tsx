import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Argand-plane explorer.
   - Drag the point z around the complex plane.
   - Watch the modulus |z| (length of the arrow) and the argument
     arg(z) (angle from the positive real axis) update live.
   - A dashed circle of radius |z| and an angle arc make both
     quantities visible at once.
   ------------------------------------------------------------------ */

const COLORS = {
  z: '#4f46e5',
  mod: '#10b981',
  arg: '#0ea5e9',
  grid: 'rgba(128,128,128,0.18)',
  axis: 'rgba(128,128,128,0.5)',
};

export default function ArgandPlaneExplorer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [z, setZ] = useState({ re: 3, im: 2 });
  const draggingRef = useRef(false);
  const sizeRef = useRef({ w: 480, h: 360, scale: 36, ox: 240, oy: 180 });

  const toPx = (re: number, im: number) => {
    const { scale, ox, oy } = sizeRef.current;
    return { x: ox + re * scale, y: oy - im * scale };
  };
  const toMath = (px: number, py: number) => {
    const { scale, ox, oy } = sizeRef.current;
    return {
      re: Math.round(((px - ox) / scale) * 2) / 2,
      im: Math.round(((oy - py) / scale) * 2) / 2,
    };
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
    ctx.font = '600 12px Inter, sans-serif';
    ctx.fillStyle = 'rgba(128,128,128,0.9)';
    ctx.fillText('Re', w - 24, oy - 8);
    ctx.fillText('Im', ox + 8, 14);

    const r = Math.hypot(z.re, z.im);
    const origin = { x: ox, y: oy };

    // modulus circle
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = 'rgba(16,185,129,0.45)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(ox, oy, r * scale, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);

    // argument arc
    if (r > 0.001) {
      const ang = Math.atan2(z.im, z.re);
      ctx.strokeStyle = COLORS.arg;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(ox, oy, Math.min(34, r * scale * 0.6), 0, -ang, ang < 0);
      ctx.stroke();
    }

    // the vector z
    arrow(ctx, origin, toPx(z.re, z.im), COLORS.z, 3.5);
    label(ctx, toPx(z.re, z.im), 'z', COLORS.z);

    // dropdowns to the axes (re / im components)
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = 'rgba(128,128,128,0.6)';
    ctx.lineWidth = 1;
    const p = toPx(z.re, z.im);
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x, oy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(ox, p.y); ctx.stroke();
    ctx.setLineDash([]);

    handle(ctx, p, COLORS.z);
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
      const scale = Math.max(22, Math.min(40, w / 13));
      sizeRef.current = { w, h, scale, ox: w / 2, oy: h / 2 };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(draw, [z]);

  const pointer = (e: PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { px: e.clientX - rect.left, py: e.clientY - rect.top };
  };
  const onDown = (e: PointerEvent) => {
    const { px, py } = pointer(e);
    const p = toPx(z.re, z.im);
    if (Math.hypot(p.x - px, p.y - py) < 26) {
      draggingRef.current = true;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      e.preventDefault();
    } else {
      setZ(toMath(px, py));
    }
  };
  const onMove = (e: PointerEvent) => {
    if (!draggingRef.current) return;
    const { px, py } = pointer(e);
    setZ(toMath(px, py));
  };
  const onUp = () => { draggingRef.current = false; };

  const r = Math.hypot(z.re, z.im);
  const degRaw = (Math.atan2(z.im, z.re) * 180) / Math.PI;
  const deg = r < 0.001 ? 0 : degRaw;

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
          <p class="text-muted">Drag the point (or tap anywhere) to move z.</p>
          <div class="grid grid-cols-2 gap-2">
            <Readout label="z = a + bi" color={COLORS.z} value={`${z.re} ${z.im >= 0 ? '+' : '−'} ${Math.abs(z.im)}i`} />
            <Readout label="(a, b)" value={`(${z.re}, ${z.im})`} />
            <Readout label="modulus |z|" color={COLORS.mod} value={r.toFixed(2)} />
            <Readout label="argument" color={COLORS.arg} value={`${deg.toFixed(1)}°`} />
          </div>
          <div class="rounded-lg bg-surface-2 p-3 text-xs text-muted">
            <p>
              <strong>|z| = √(a² + b²)</strong> = √({z.re}² + {z.im}²) = {r.toFixed(2)} — the
              distance from the origin.
            </p>
            <p class="mt-1">
              <strong>arg(z) = atan2(b, a)</strong> = {deg.toFixed(1)}° — the angle measured
              counter-clockwise from the positive real axis.
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

// ---- canvas primitives ----
function arrow(ctx: CanvasRenderingContext2D, from: { x: number; y: number }, to: { x: number; y: number }, color: string, width: number) {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const head = 11;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(to.x - head * Math.cos(angle - 0.4), to.y - head * Math.sin(angle - 0.4));
  ctx.lineTo(to.x - head * Math.cos(angle + 0.4), to.y - head * Math.sin(angle + 0.4));
  ctx.closePath(); ctx.fill();
}
function handle(ctx: CanvasRenderingContext2D, at: { x: number; y: number }, color: string) {
  ctx.beginPath(); ctx.arc(at.x, at.y, 7, 0, Math.PI * 2);
  ctx.fillStyle = '#fff'; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = color; ctx.stroke();
}
function label(ctx: CanvasRenderingContext2D, at: { x: number; y: number }, text: string, color: string) {
  ctx.font = '600 14px Inter, sans-serif';
  ctx.fillStyle = color;
  ctx.fillText(text, at.x + 10, at.y - 8);
}
