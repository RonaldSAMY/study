import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Frustum-culling scene (top-down).
   - Drag the camera (indigo) to move it; drag the aim handle (sky)
     or use the sliders to set heading and field-of-view.
   - Objects inside the view frustum render bright; objects outside
     are culled (dimmed). A live counter shows drawn vs total.
   ------------------------------------------------------------------ */

type Vec = { x: number; y: number };

const COLORS = {
  camera: '#4f46e5',
  aim: '#0ea5e9',
  inside: '#10b981',
  frustum: 'rgba(79,70,229,0.12)',
  frustumEdge: 'rgba(79,70,229,0.55)',
  culled: 'rgba(128,128,128,0.35)',
};

// deterministic pseudo-random so the scene is stable across renders
function makeObjects(n: number): Vec[] {
  let seed = 1337;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  return Array.from({ length: n }, () => ({ x: rnd(), y: rnd() })); // normalized 0..1
}

export default function FrustumCullingScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cam, setCam] = useState<Vec>({ x: 0.5, y: 0.85 }); // normalized
  const [heading, setHeading] = useState(-90); // degrees, -90 = up the screen
  const [fov, setFov] = useState(60); // degrees
  const dragRef = useRef<null | 'cam' | 'aim'>(null);
  const sizeRef = useRef({ w: 480, h: 360 });
  const objsRef = useRef<Vec[]>(makeObjects(48));

  const far = 0.75; // far distance as a fraction of canvas diagonal-ish
  const px = (v: Vec): Vec => ({ x: v.x * sizeRef.current.w, y: v.y * sizeRef.current.h });

  // is a normalized object inside the frustum?
  const inFrustum = (o: Vec): boolean => {
    const dx = o.x - cam.x;
    const dy = o.y - cam.y;
    const d = Math.hypot(dx, dy);
    if (d > far || d < 0.001) return false;
    const ang = Math.atan2(dy, dx); // radians
    const h = (heading * Math.PI) / 180;
    let diff = ang - h;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    return Math.abs(diff) <= (fov * Math.PI) / 360; // half-fov
  };

  const aimPoint = (): Vec => {
    const h = (heading * Math.PI) / 180;
    return { x: cam.x + Math.cos(h) * 0.22, y: cam.y + Math.sin(h) * 0.22 };
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);

    const camP = px(cam);
    const hRad = (heading * Math.PI) / 180;
    const halfFov = (fov * Math.PI) / 360;
    const farPx = far * Math.hypot(w, h) * 0.62;

    // frustum wedge
    const a0 = hRad - halfFov;
    const a1 = hRad + halfFov;
    ctx.beginPath();
    ctx.moveTo(camP.x, camP.y);
    ctx.lineTo(camP.x + Math.cos(a0) * farPx, camP.y + Math.sin(a0) * farPx);
    ctx.arc(camP.x, camP.y, farPx, a0, a1);
    ctx.closePath();
    ctx.fillStyle = COLORS.frustum;
    ctx.fill();
    ctx.strokeStyle = COLORS.frustumEdge;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // objects
    for (const o of objsRef.current) {
      const p = px(o);
      const inside = inFrustum(o);
      ctx.beginPath();
      ctx.arc(p.x, p.y, inside ? 6 : 4, 0, Math.PI * 2);
      ctx.fillStyle = inside ? COLORS.inside : COLORS.culled;
      ctx.fill();
    }

    // aim handle + camera
    const aP = px(aimPoint());
    ctx.strokeStyle = COLORS.aim;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(camP.x, camP.y);
    ctx.lineTo(aP.x, aP.y);
    ctx.stroke();
    ctx.setLineDash([]);
    handle(ctx, aP, COLORS.aim);
    handle(ctx, camP, COLORS.camera);
    ctx.font = '600 12px Inter, sans-serif';
    ctx.fillStyle = COLORS.camera;
    ctx.fillText('camera', camP.x + 10, camP.y + 18);
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
      sizeRef.current = { w, h };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(draw, [cam, heading, fov]);

  const pointer = (e: PointerEvent): Vec => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const { w, h } = sizeRef.current;
    return { x: (e.clientX - rect.left) / w, y: (e.clientY - rect.top) / h };
  };
  const onDown = (e: PointerEvent) => {
    const p = pointer(e);
    const { w, h } = sizeRef.current;
    const toPxDist = (a: Vec, b: Vec) => Math.hypot((a.x - b.x) * w, (a.y - b.y) * h);
    const dCam = toPxDist(p, cam);
    const dAim = toPxDist(p, aimPoint());
    if (dAim < 24 && dAim <= dCam) dragRef.current = 'aim';
    else if (dCam < 30) dragRef.current = 'cam';
    if (dragRef.current) {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      e.preventDefault();
    }
  };
  const onMove = (e: PointerEvent) => {
    if (!dragRef.current) return;
    const p = pointer(e);
    if (dragRef.current === 'cam') {
      setCam({ x: Math.max(0, Math.min(1, p.x)), y: Math.max(0, Math.min(1, p.y)) });
    } else {
      const deg = (Math.atan2(p.y - cam.y, p.x - cam.x) * 180) / Math.PI;
      setHeading(deg);
    }
  };
  const onUp = () => {
    dragRef.current = null;
  };

  const total = objsRef.current.length;
  const drawn = objsRef.current.filter(inFrustum).length;
  const headingDisp = ((heading % 360) + 360) % 360;

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
          <p class="text-muted">Drag the camera to move it, drag the aim handle to rotate, or use the sliders.</p>
          <div class="rounded-lg bg-surface-2 p-3">
            <div class="flex items-baseline justify-between">
              <span class="text-muted">draw calls</span>
              <strong class="font-mono text-lg" style={`color:${COLORS.inside}`}>{drawn} / {total}</strong>
            </div>
            <p class="mt-1 text-xs text-muted">{total - drawn} objects culled this frame.</p>
          </div>
          <label class="block">
            <span class="mb-1 block text-muted">heading = {headingDisp.toFixed(0)}°</span>
            <input
              type="range" min={-180} max={180} step={1} value={heading}
              onInput={(e) => setHeading(parseFloat((e.target as HTMLInputElement).value))}
              class="w-full accent-[#4f46e5]"
            />
          </label>
          <label class="block">
            <span class="mb-1 block text-muted">field of view = {fov.toFixed(0)}°</span>
            <input
              type="range" min={10} max={170} step={1} value={fov}
              onInput={(e) => setFov(parseFloat((e.target as HTMLInputElement).value))}
              class="w-full accent-[#0ea5e9]"
            />
          </label>
        </div>
      </div>
    </div>
  );
}

function handle(ctx: CanvasRenderingContext2D, at: Vec, color: string) {
  ctx.beginPath();
  ctx.arc(at.x, at.y, 8, 0, Math.PI * 2);
  ctx.fillStyle = '#fff';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = color;
  ctx.stroke();
}
