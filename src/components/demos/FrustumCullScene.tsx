import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Frustum-culling scene (top-down).
   - A camera sits at the bottom; drag to aim it, slide its FOV.
   - Scattered objects of a few "types" fill the world. Objects inside
     the view wedge are drawn solid; the rest are culled (faint).
   - Counters show draw calls with culling on/off and with batching
     (objects of the same type drawn in one call). Far objects drop LOD.
   ------------------------------------------------------------------ */

type Obj = { x: number; y: number; type: number };
const TYPE_COLORS = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b'];

export default function FrustumCullScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 480, h: 380 });
  const objsRef = useRef<Obj[]>([]);
  const [aim, setAim] = useState(-Math.PI / 2); // pointing "up"
  const [fov, setFov] = useState(50);
  const [culling, setCulling] = useState(true);
  const [batching, setBatching] = useState(false);
  const dragRef = useRef(false);

  const buildObjs = (w: number, h: number) => {
    const rng = mulberry32(42);
    const arr: Obj[] = [];
    for (let i = 0; i < 36; i++) {
      arr.push({ x: 30 + rng() * (w - 60), y: 20 + rng() * (h - 120), type: Math.floor(rng() * 4) });
    }
    objsRef.current = arr;
  };

  const camPos = () => ({ x: sizeRef.current.w / 2, y: sizeRef.current.h - 30 });

  const visibleSet = () => {
    const cam = camPos();
    const half = (fov * Math.PI) / 360;
    const vis: boolean[] = [];
    objsRef.current.forEach((o) => {
      const ang = Math.atan2(o.y - cam.y, o.x - cam.x);
      let d = ang - aim;
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      vis.push(Math.abs(d) <= half);
    });
    return vis;
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);
    const cam = camPos();
    const half = (fov * Math.PI) / 360;
    const reach = Math.hypot(w, h);

    // frustum wedge
    ctx.fillStyle = 'rgba(79,70,229,0.12)';
    ctx.strokeStyle = 'rgba(79,70,229,0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cam.x, cam.y);
    ctx.lineTo(cam.x + Math.cos(aim - half) * reach, cam.y + Math.sin(aim - half) * reach);
    ctx.lineTo(cam.x + Math.cos(aim + half) * reach, cam.y + Math.sin(aim + half) * reach);
    ctx.closePath(); ctx.fill(); ctx.stroke();

    const vis = visibleSet();
    objsRef.current.forEach((o, i) => {
      const seen = !culling || vis[i];
      const dist = Math.hypot(o.x - cam.x, o.y - cam.y);
      const lod = dist > reach * 0.55 ? 'lo' : 'hi'; // far -> low detail
      ctx.globalAlpha = seen ? 1 : 0.16;
      ctx.fillStyle = TYPE_COLORS[o.type];
      ctx.beginPath();
      const r = lod === 'hi' ? 9 : 6;
      if (lod === 'hi' && seen) {
        // high detail: a little square gem
        ctx.save();
        ctx.translate(o.x, o.y);
        ctx.rotate(Math.PI / 4);
        ctx.fillRect(-r, -r, r * 2, r * 2);
        ctx.restore();
      } else {
        ctx.arc(o.x, o.y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    });

    // camera
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.arc(cam.x, cam.y, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#4f46e5';
    ctx.beginPath(); ctx.arc(cam.x, cam.y, 5, 0, Math.PI * 2); ctx.fill();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 520);
      const h = Math.round(w * 0.8);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr; canvas.height = h * dpr;
      canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w, h };
      buildObjs(w, h);
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(draw, [aim, fov, culling, batching]);

  const pointer = (e: PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const cam = camPos();
    return Math.atan2(e.clientY - rect.top - cam.y, e.clientX - rect.left - cam.x);
  };
  const onDown = (e: PointerEvent) => {
    dragRef.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setAim(pointer(e)); e.preventDefault();
  };
  const onMove = (e: PointerEvent) => { if (dragRef.current) setAim(pointer(e)); };
  const onUp = () => { dragRef.current = false; };

  const total = objsRef.current.length;
  const vis = visibleSet();
  const visCount = vis.filter(Boolean).length;
  const drawn = culling ? visCount : total;
  const distinctTypes = new Set(objsRef.current.filter((_, i) => !culling || vis[i]).map((o) => o.type)).size;
  const drawCalls = batching ? distinctTypes : drawn;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap gap-2">
        <button onClick={() => setCulling((c) => !c)}
          class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${culling ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'}`}>
          Frustum culling: {culling ? 'on' : 'off'}
        </button>
        <button onClick={() => setBatching((b) => !b)}
          class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${batching ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'}`}>
          Batching: {batching ? 'on' : 'off'}
        </button>
      </div>
      <div class="grid gap-4 md:grid-cols-[1fr,auto] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2"
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} />
        <div class="space-y-3 text-sm md:w-52">
          <p class="text-muted">Drag in the scene to aim the camera.</p>
          <label class="block">
            <span class="mb-1 block text-muted">FOV = {fov}°</span>
            <input type="range" min={20} max={120} value={fov}
              onInput={(e) => setFov(parseInt((e.target as HTMLInputElement).value))}
              class="w-full accent-[#4f46e5]" />
          </label>
          <div class="rounded-lg bg-surface-2 p-3 space-y-1">
            <div class="flex justify-between"><span class="text-muted">objects in scene</span><strong>{total}</strong></div>
            <div class="flex justify-between"><span class="text-muted">in view</span><strong>{visCount}</strong></div>
            <div class="flex justify-between text-base"><span class="text-muted">draw calls</span><strong class="text-brand">{drawCalls}</strong></div>
          </div>
          <p class="text-xs text-muted">Diamonds are full detail; far objects fall back to simple dots (LOD).</p>
        </div>
      </div>
    </div>
  );
}

// tiny deterministic RNG so the scene is stable across redraws
function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
