import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Explore a camera's projection.
   - Sliders: field of view, near plane, far plane.
   - Toggle perspective vs orthographic.
   - Left: a side view of the camera frustum with scene objects.
   - Right: the projected "screen" — under perspective, distant
     objects shrink; under orthographic, they keep their size.
   - Everything updates live on a crisp, responsive canvas.
   ------------------------------------------------------------------ */

type Obj = { d: number; y: number; half: number; color: string };

const OBJECTS: Obj[] = [
  { d: 3, y: 0.7, half: 0.5, color: '#4f46e5' },
  { d: 6, y: -0.9, half: 0.5, color: '#0ea5e9' },
  { d: 10, y: 0.5, half: 0.5, color: '#10b981' },
  { d: 15, y: -0.4, half: 0.5, color: '#f59e0b' },
];

const WORLD_VIEW_HALF = 6; // vertical world units shown in the side view
const ORTHO_HALF = 2.8; // half-height of the orthographic box

export default function FrustumProjectionExplorer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fov, setFov] = useState(60);
  const [near, setNear] = useState(2);
  const [far, setFar] = useState(16);
  const [perspective, setPerspective] = useState(true);
  const sizeRef = useRef({ w: 540, h: 360 });

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);

    const t = Math.tan((fov * Math.PI) / 180 / 2);
    const halfAt = (d: number) => (perspective ? d * t : ORTHO_HALF);

    // ----- layout: left side view, right projected screen -----
    const gap = 14;
    const leftW = Math.round(w * 0.6);
    const sx0 = 8;
    const sx1 = leftW - gap;
    const sy0 = 8;
    const sy1 = h - 8;
    const camX = sx0 + 10;
    const centerY = (sy0 + sy1) / 2;
    const pixPerUnit = (sy1 - sy0) / 2 / WORLD_VIEW_HALF - 0.5;
    const viewMaxDepth = Math.max(far, 1);
    const depthToX = (d: number) => camX + (d / viewMaxDepth) * (sx1 - camX);
    const yToPix = (y: number) => centerY - y * pixPerUnit;

    // ---- side view ----
    ctx.save();
    ctx.beginPath();
    ctx.rect(sx0, sy0, sx1 - sx0, sy1 - sy0);
    ctx.clip();

    // optical axis
    ctx.strokeStyle = 'rgba(128,128,128,0.45)';
    ctx.setLineDash([5, 5]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(camX, centerY);
    ctx.lineTo(sx1, centerY);
    ctx.stroke();
    ctx.setLineDash([]);

    // frustum shape
    const nTop = yToPix(halfAt(near));
    const nBot = yToPix(-halfAt(near));
    const fTop = yToPix(halfAt(far));
    const fBot = yToPix(-halfAt(far));
    const nX = depthToX(near);
    const fX = depthToX(far);

    ctx.beginPath();
    ctx.moveTo(nX, nTop);
    ctx.lineTo(fX, fTop);
    ctx.lineTo(fX, fBot);
    ctx.lineTo(nX, nBot);
    ctx.closePath();
    ctx.fillStyle = 'rgba(79,70,229,0.10)';
    ctx.fill();
    ctx.strokeStyle = '#4f46e5';
    ctx.lineWidth = 2;
    ctx.stroke();

    if (perspective) {
      // rays from the camera through the near-plane edges
      ctx.strokeStyle = 'rgba(79,70,229,0.45)';
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.moveTo(camX, centerY);
      ctx.lineTo(fX, fTop);
      ctx.moveTo(camX, centerY);
      ctx.lineTo(fX, fBot);
      ctx.stroke();
    }

    // near & far plane labels
    ctx.fillStyle = '#0ea5e9';
    ctx.font = '600 11px Inter, sans-serif';
    ctx.fillText('near', nX - 8, sy1 - 6);
    ctx.fillStyle = '#10b981';
    ctx.fillText('far', fX - 8, sy1 - 6);

    // camera marker
    ctx.fillStyle = '#4f46e5';
    ctx.beginPath();
    ctx.arc(camX, centerY, 5, 0, Math.PI * 2);
    ctx.fill();

    // objects in the world
    OBJECTS.forEach((o) => {
      const ox = depthToX(o.d);
      const oy = yToPix(o.y);
      const s = o.half * pixPerUnit;
      const visible = o.d >= near && o.d <= far;
      ctx.globalAlpha = visible ? 1 : 0.28;
      ctx.fillStyle = o.color;
      ctx.fillRect(ox - s, oy - s, 2 * s, 2 * s);
      ctx.globalAlpha = 1;
    });

    ctx.restore();

    // ---- projected screen ----
    const px0 = leftW + 6;
    const px1 = w - 8;
    const py0 = 26;
    const py1 = h - 8;
    const scrW = px1 - px0;
    const scrH = py1 - py0;
    const scrCx = (px0 + px1) / 2;
    const scrCy = (py0 + py1) / 2;

    ctx.fillStyle = 'rgba(14,165,233,0.06)';
    ctx.fillRect(px0, py0, scrW, scrH);
    ctx.strokeStyle = 'rgba(128,128,128,0.5)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(px0, py0, scrW, scrH);
    ctx.fillStyle = '#0ea5e9';
    ctx.font = '600 11px Inter, sans-serif';
    ctx.fillText('what the camera sees', px0, py0 - 8);

    // NDC [-1,1] -> screen pixels (fit by smaller half-extent)
    const halfPx = Math.min(scrW, scrH) / 2 - 6;
    ctx.save();
    ctx.beginPath();
    ctx.rect(px0, py0, scrW, scrH);
    ctx.clip();
    // draw far objects first so near ones overlap on top
    [...OBJECTS]
      .filter((o) => o.d >= near && o.d <= far)
      .sort((a, b) => b.d - a.d)
      .forEach((o) => {
        const denom = perspective ? o.d * t : ORTHO_HALF;
        const ndcY = o.y / denom;
        const ndcHalf = o.half / denom;
        const cy = scrCy - ndcY * halfPx;
        const sz = ndcHalf * halfPx;
        ctx.fillStyle = o.color;
        ctx.globalAlpha = 0.9;
        ctx.fillRect(scrCx - sz, cy - sz, 2 * sz, 2 * sz);
        ctx.globalAlpha = 1;
      });
    ctx.restore();

    // center crosshair on screen
    ctx.strokeStyle = 'rgba(128,128,128,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(scrCx, py0);
    ctx.lineTo(scrCx, py1);
    ctx.moveTo(px0, scrCy);
    ctx.lineTo(px1, scrCy);
    ctx.stroke();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const wd = Math.min(parent.clientWidth, 600);
      const ht = Math.round(wd * 0.62);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = wd * dpr;
      canvas.height = ht * dpr;
      canvas.style.width = `${wd}px`;
      canvas.style.height = `${ht}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w: wd, h: ht };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(draw, [fov, near, far, perspective]);

  // keep near < far
  const setNearSafe = (v: number) => setNear(Math.min(v, far - 1));
  const setFarSafe = (v: number) => setFar(Math.max(v, near + 1));

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap gap-2">
        {[true, false].map((p) => (
          <button
            key={String(p)}
            onClick={() => setPerspective(p)}
            class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              perspective === p ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
            }`}
          >
            {p ? 'Perspective' : 'Orthographic'}
          </button>
        ))}
      </div>

      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

        <div class="space-y-3 text-sm">
          <label class="block">
            <span class="mb-1 flex justify-between text-muted">
              <span>field of view</span>
              <strong class="text-text">{fov}°</strong>
            </span>
            <input
              type="range" min={20} max={110} step={1} value={fov}
              disabled={!perspective}
              onInput={(e) => setFov(parseInt((e.target as HTMLInputElement).value))}
              class="w-full accent-[#4f46e5] disabled:opacity-40"
            />
          </label>
          <label class="block">
            <span class="mb-1 flex justify-between text-muted">
              <span>near plane</span>
              <strong class="text-text">{near.toFixed(1)}</strong>
            </span>
            <input
              type="range" min={0.5} max={6} step={0.5} value={near}
              onInput={(e) => setNearSafe(parseFloat((e.target as HTMLInputElement).value))}
              class="w-full accent-[#0ea5e9]"
            />
          </label>
          <label class="block">
            <span class="mb-1 flex justify-between text-muted">
              <span>far plane</span>
              <strong class="text-text">{far.toFixed(1)}</strong>
            </span>
            <input
              type="range" min={8} max={20} step={0.5} value={far}
              onInput={(e) => setFarSafe(parseFloat((e.target as HTMLInputElement).value))}
              class="w-full accent-[#10b981]"
            />
          </label>

          <div class="rounded-lg bg-surface-2 p-3 text-xs text-muted">
            {perspective
              ? "Perspective: on-screen size equals real size divided by depth, so farther objects shrink."
              : "Orthographic: depth is ignored, so every object keeps the same size no matter how far away it is."}
          </div>
        </div>
      </div>
    </div>
  );
}
