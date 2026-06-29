import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Pythagorean theorem with a square drawn on each side.
   - Drag the two open vertices (or use sliders) to change legs a and b.
   - The squares on the legs (areas a² and b²) always tile exactly into
     the square on the hypotenuse (area c²).
   ------------------------------------------------------------------ */

const COLORS = {
  a: '#4f46e5',
  b: '#0ea5e9',
  c: '#10b981',
  tri: '#64748b',
};

export default function PythagorasSquaresDemo() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [a, setA] = useState(3);
  const [b, setB] = useState(4);
  const sizeRef = useRef({ w: 480, h: 360 });
  const tf = useRef({ s: 30, ox: 0, oy: 0 });
  const dragRef = useRef<null | 'a' | 'b'>(null);

  // math (y-up) -> screen
  const M = (mx: number, my: number) => {
    const { s, ox, oy } = tf.current;
    return { x: ox + mx * s, y: oy - my * s };
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);

    // fit current figure: bbox x in [-b, a+b], y in [-a, a+b]
    const pad = 26;
    const bw = a + 2 * b;
    const bh = 2 * a + b;
    const s = Math.min((w - 2 * pad) / bw, (h - 2 * pad) / bh);
    // center the bbox; corner C is math (0,0)
    const contentW = bw * s;
    const contentH = bh * s;
    const ox = (w - contentW) / 2 + b * s; // screen x of math x=0
    const oy = (h - contentH) / 2 + (a + b) * s; // screen y of math y=0
    tf.current = { s, ox, oy };

    const C = M(0, 0);
    const B = M(a, 0);
    const A = M(0, b);

    // squares
    fillPoly(ctx, [M(0, 0), M(a, 0), M(a, -a), M(0, -a)], COLORS.a, `a² = ${(a * a).toFixed(1)}`);
    fillPoly(ctx, [M(0, 0), M(0, b), M(-b, b), M(-b, 0)], COLORS.b, `b² = ${(b * b).toFixed(1)}`);
    fillPoly(ctx, [M(0, b), M(a, 0), M(a + b, a), M(b, a + b)], COLORS.c, `c² = ${(a * a + b * b).toFixed(1)}`);

    // triangle
    ctx.beginPath();
    ctx.moveTo(C.x, C.y); ctx.lineTo(B.x, B.y); ctx.lineTo(A.x, A.y); ctx.closePath();
    ctx.fillStyle = 'rgba(100,116,139,0.18)';
    ctx.fill();
    ctx.strokeStyle = COLORS.tri;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // right-angle marker at C
    const r = Math.min(14, s * 0.4);
    ctx.strokeStyle = COLORS.tri;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(C.x + r, C.y); ctx.lineTo(C.x + r, C.y - r); ctx.lineTo(C.x, C.y - r);
    ctx.stroke();

    // leg labels
    ctx.fillStyle = COLORS.a; ctx.font = '700 13px Inter, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(`a = ${a.toFixed(1)}`, (C.x + B.x) / 2, C.y + 16);
    ctx.fillStyle = COLORS.b;
    ctx.fillText(`b = ${b.toFixed(1)}`, C.x - 18, (C.y + A.y) / 2);

    // draggable handles
    handle(ctx, B.x, B.y, COLORS.a);
    handle(ctx, A.x, A.y, COLORS.b);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
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
      sizeRef.current = { w, h };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(draw, [a, b]);

  const pointer = (e: PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { px: e.clientX - rect.left, py: e.clientY - rect.top };
  };
  const onDown = (e: PointerEvent) => {
    const { px, py } = pointer(e);
    const B = M(a, 0); const A = M(0, b);
    const dB = Math.hypot(px - B.x, py - B.y);
    const dA = Math.hypot(px - A.x, py - A.y);
    if (dB < 24 && dB <= dA) dragRef.current = 'a';
    else if (dA < 24) dragRef.current = 'b';
    if (dragRef.current) {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      e.preventDefault();
    }
  };
  const onMove = (e: PointerEvent) => {
    if (!dragRef.current) return;
    const { px, py } = pointer(e);
    const { s, ox, oy } = tf.current;
    if (dragRef.current === 'a') {
      const v = (px - ox) / s;
      setA(clamp(Math.round(v * 2) / 2));
    } else {
      const v = (oy - py) / s;
      setB(clamp(Math.round(v * 2) / 2));
    }
  };
  const onUp = () => { dragRef.current = null; };

  const c = Math.sqrt(a * a + b * b);

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
          <p class="text-muted">Drag the indigo and sky dots — or use the sliders.</p>
          <label class="block">
            <span class="mb-1 block text-muted" style={`color:${COLORS.a}`}>leg a = {a.toFixed(1)}</span>
            <input type="range" min={1} max={6} step={0.5} value={a}
              onInput={(e) => setA(clamp(parseFloat((e.target as HTMLInputElement).value)))}
              class="w-full accent-[#4f46e5]" />
          </label>
          <label class="block">
            <span class="mb-1 block text-muted" style={`color:${COLORS.b}`}>leg b = {b.toFixed(1)}</span>
            <input type="range" min={1} max={6} step={0.5} value={b}
              onInput={(e) => setB(clamp(parseFloat((e.target as HTMLInputElement).value)))}
              class="w-full accent-[#0ea5e9]" />
          </label>
          <div class="rounded-lg bg-surface-2 p-3 font-mono text-[0.8rem] leading-relaxed">
            <div>a² + b² = {(a * a).toFixed(1)} + {(b * b).toFixed(1)} = <strong>{(a * a + b * b).toFixed(1)}</strong></div>
            <div class="mt-1" style={`color:${COLORS.c}`}>c = √{(a * a + b * b).toFixed(1)} = <strong>{c.toFixed(3)}</strong></div>
          </div>
        </div>
      </div>
    </div>
  );
}

function clamp(v: number) { return Math.max(1, Math.min(6, v)); }

function fillPoly(ctx: CanvasRenderingContext2D, pts: { x: number; y: number }[], color: string, label: string) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  ctx.fillStyle = hexA(color, 0.18);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();
  const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  ctx.fillStyle = color;
  ctx.font = '700 12px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, cx, cy);
}
function handle(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
  ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2);
  ctx.fillStyle = '#fff'; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = color; ctx.stroke();
}
function hexA(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
