import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Verlet rope / chain of point masses joined by distance constraints.
   - The first point is pinned to an anchor.
   - Gravity pulls every other point down; the rope settles into a
     hanging catenary.
   - Drag ANY point with the pointer and the whole chain follows
     and swings, because we re-satisfy the distance constraints
     several times each frame.
   - Sliders control gravity and the number of constraint
     (stiffness) iterations.
   ------------------------------------------------------------------ */

type Pt = { x: number; y: number; px: number; py: number; pinned: boolean };

const COLORS = {
  rope: '#4f46e5',   // indigo
  node: '#4f46e5',
  anchor: '#10b981', // emerald
  drag: '#0ea5e9',   // sky
  ceiling: 'rgba(128,128,128,0.55)',
};

const N = 16; // number of point masses

export default function RopeChainLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ptsRef = useRef<Pt[]>([]);
  const segRef = useRef(28);
  const dragRef = useRef<number | null>(null);
  const rafRef = useRef<number>();
  const sizeRef = useRef({ w: 480, h: 360 });

  const [iters, setIters] = useState(8);
  const [gravity, setGravity] = useState(0.45);
  const itersRef = useRef(iters);
  const gravRef = useRef(gravity);
  useEffect(() => { itersRef.current = iters; }, [iters]);
  useEffect(() => { gravRef.current = gravity; }, [gravity]);

  const initRope = (w: number, h: number) => {
    const seg = Math.min(30, (w * 0.6) / (N - 1));
    segRef.current = seg;
    const startX = w * 0.26;
    const startY = h * 0.16;
    const pts: Pt[] = [];
    for (let i = 0; i < N; i++) {
      const x = startX + i * seg;
      const y = startY;
      pts.push({ x, y, px: x, py: y, pinned: i === 0 });
    }
    ptsRef.current = pts;
  };

  const simulate = () => {
    const pts = ptsRef.current;
    if (pts.length === 0) return;
    const g = gravRef.current;
    const friction = 0.99;
    const { w, h } = sizeRef.current;

    // Verlet integration
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      if (p.pinned || dragRef.current === i) continue;
      const vx = (p.x - p.px) * friction;
      const vy = (p.y - p.py) * friction;
      p.px = p.x;
      p.py = p.y;
      p.x += vx;
      p.y += vy + g;
    }

    // distance-constraint satisfaction (Jakobsen relaxation)
    const seg = segRef.current;
    const it = itersRef.current;
    for (let k = 0; k < it; k++) {
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i];
        const b = pts[i + 1];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 0.0001;
        const diff = (d - seg) / d;
        const wa = a.pinned || dragRef.current === i ? 0 : 1;
        const wb = b.pinned || dragRef.current === i + 1 ? 0 : 1;
        const sum = wa + wb;
        if (sum === 0) continue;
        const fa = wa / sum;
        const fb = wb / sum;
        a.x += dx * diff * fa;
        a.y += dy * diff * fa;
        b.x -= dx * diff * fb;
        b.y -= dy * diff * fb;
      }
    }

    // keep points inside the view
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      if (p.pinned || dragRef.current === i) continue;
      if (p.x < 6) p.x = 6;
      if (p.x > w - 6) p.x = w - 6;
      if (p.y > h - 6) p.y = h - 6;
      if (p.y < 6) p.y = 6;
    }
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    const pts = ptsRef.current;
    ctx.clearRect(0, 0, w, h);
    if (pts.length === 0) return;

    // ceiling hatch at the anchor
    const anc = pts[0];
    ctx.strokeStyle = COLORS.ceiling;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(anc.x - 26, anc.y - 10);
    ctx.lineTo(anc.x + 26, anc.y - 10);
    ctx.stroke();
    ctx.lineWidth = 1.4;
    for (let hx = -24; hx <= 24; hx += 8) {
      ctx.beginPath();
      ctx.moveTo(anc.x + hx, anc.y - 10);
      ctx.lineTo(anc.x + hx - 7, anc.y - 17);
      ctx.stroke();
    }

    // rope
    ctx.strokeStyle = COLORS.rope;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();

    // nodes
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const isAnchor = p.pinned;
      const isDrag = dragRef.current === i;
      ctx.beginPath();
      ctx.arc(p.x, p.y, isAnchor || isDrag ? 7 : 4.5, 0, Math.PI * 2);
      ctx.fillStyle = isAnchor ? COLORS.anchor : isDrag ? COLORS.drag : '#fff';
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = isAnchor ? COLORS.anchor : isDrag ? COLORS.drag : COLORS.node;
      ctx.stroke();
    }
  };

  // animation loop
  useEffect(() => {
    const step = () => {
      simulate();
      draw();
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []);

  // responsive sizing
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
      sizeRef.current = { w, h };
      initRope(w, h);
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // pointer dragging
  const pointer = (e: PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { px: e.clientX - rect.left, py: e.clientY - rect.top };
  };

  const onDown = (e: PointerEvent) => {
    const { px, py } = pointer(e);
    const pts = ptsRef.current;
    let best = -1;
    let bestD = 24;
    for (let i = 0; i < pts.length; i++) {
      const d = Math.hypot(pts[i].x - px, pts[i].y - py);
      if (d < bestD) { bestD = d; best = i; }
    }
    if (best >= 0) {
      dragRef.current = best;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      e.preventDefault();
    }
  };
  const onMove = (e: PointerEvent) => {
    const i = dragRef.current;
    if (i === null) return;
    const { px, py } = pointer(e);
    const p = ptsRef.current[i];
    // carry pointer motion into px/py so the rope swings on release
    p.px = p.x;
    p.py = p.y;
    p.x = px;
    p.y = py;
  };
  const onUp = () => { dragRef.current = null; };

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <canvas
        ref={canvasRef}
        class="touch-none w-full rounded-xl bg-surface-2"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      />

      <p class="mt-3 text-sm text-muted">
        Drag any point: the <span style={`color:${COLORS.anchor}`}>green</span> anchor is pinned, the rest
        follow with gravity. Let go to watch it swing and settle.
      </p>

      <div class="mt-3 grid gap-4 sm:grid-cols-2">
        <label class="block text-sm">
          <span class="mb-1 block text-muted">gravity = {gravity.toFixed(2)}</span>
          <input type="range" min={0} max={1.2} step={0.05} value={gravity}
            onInput={(e) => setGravity(parseFloat((e.target as HTMLInputElement).value))}
            class="w-full accent-[#10b981]" />
        </label>
        <label class="block text-sm">
          <span class="mb-1 block text-muted">stiffness (constraint iterations) = {iters}</span>
          <input type="range" min={1} max={30} step={1} value={iters}
            onInput={(e) => setIters(parseInt((e.target as HTMLInputElement).value))}
            class="w-full accent-[#4f46e5]" />
        </label>
      </div>

      <div class="mt-4 grid grid-cols-2 gap-2 text-sm">
        <Readout label="point masses" value={`${N}`} />
        <Readout label="iterations / frame" value={`${iters}`} />
      </div>
      <p class="mt-3 text-xs text-muted">
        Fewer iterations leave the chain stretchy and elastic; more iterations make it taut and rope-like.
      </p>
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
