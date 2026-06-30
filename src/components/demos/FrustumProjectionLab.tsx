import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Projection & cameras demo (top-down view of the view frustum).
   - Slide FOV, near plane and far plane.
   - Toggle perspective vs orthographic.
   - Scene points are projected to a 1D "screen" strip below; watch
     how perspective shrinks far objects and clips outside the frustum.
   ------------------------------------------------------------------ */

type Pt = { z: number; x: number; tag: string };

const COLORS = {
  frustum: 'rgba(79,70,229,0.18)',
  frustumLine: '#4f46e5',
  near: '#0ea5e9',
  far: '#10b981',
  pt: '#4f46e5',
  ptClip: 'rgba(128,128,128,0.5)',
};

// fixed little scene: objects at various depths (z) and lateral (x) positions
const SCENE: Pt[] = [
  { z: 3, x: -1.2, tag: 'A' },
  { z: 4.5, x: 0.8, tag: 'B' },
  { z: 6, x: -0.4, tag: 'C' },
  { z: 8, x: 1.6, tag: 'D' },
  { z: 10, x: -1.8, tag: 'E' },
  { z: 12.5, x: 0.3, tag: 'F' },
];

export default function FrustumProjectionLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fov, setFov] = useState(60);
  const [near, setNear] = useState(2);
  const [far, setFar] = useState(11);
  const [persp, setPersp] = useState(true);
  const sizeRef = useRef({ w: 480, h: 420 });

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);

    // camera at top-center, looking DOWN the canvas (increasing z = down)
    const camX = w / 2;
    const camY = 24;
    const sceneTop = camY;
    const sceneBottom = h - 70;
    const zToY = (z: number) => sceneTop + (z / 14) * (sceneBottom - sceneTop);
    const halfFovRad = (fov * Math.PI) / 360;

    // frustum wedge (perspective) or box (ortho)
    const yNear = zToY(near);
    const yFar = zToY(far);
    ctx.fillStyle = COLORS.frustum;
    ctx.strokeStyle = COLORS.frustumLine;
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (persp) {
      // half-width grows linearly with distance from the camera
      const hwNear = Math.tan(halfFovRad) * (yNear - camY);
      const hwFar = Math.tan(halfFovRad) * (yFar - camY);
      ctx.moveTo(camX - hwNear, yNear);
      ctx.lineTo(camX + hwNear, yNear);
      ctx.lineTo(camX + hwFar, yFar);
      ctx.lineTo(camX - hwFar, yFar);
    } else {
      const hw = Math.tan(halfFovRad) * (zToY(7) - camY);
      ctx.moveTo(camX - hw, yNear);
      ctx.lineTo(camX + hw, yNear);
      ctx.lineTo(camX + hw, yFar);
      ctx.lineTo(camX - hw, yFar);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();

    // near & far planes
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = COLORS.near;
    ctx.beginPath(); ctx.moveTo(camX - 120, yNear); ctx.lineTo(camX + 120, yNear); ctx.stroke();
    ctx.strokeStyle = COLORS.far;
    ctx.beginPath(); ctx.moveTo(camX - 130, yFar); ctx.lineTo(camX + 130, yFar); ctx.stroke();
    ctx.font = '600 11px Inter, sans-serif';
    ctx.fillStyle = COLORS.near; ctx.fillText('near', camX - 118, yNear - 5);
    ctx.fillStyle = COLORS.far; ctx.fillText('far', camX - 128, yFar - 5);

    // camera
    ctx.fillStyle = COLORS.frustumLine;
    ctx.beginPath(); ctx.arc(camX, camY, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillText('camera', camX + 10, camY + 4);

    // screen strip at bottom
    const stripY = h - 40;
    const stripX0 = 30, stripX1 = w - 30;
    ctx.strokeStyle = 'rgba(128,128,128,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(stripX0, stripY); ctx.lineTo(stripX1, stripY); ctx.stroke();
    ctx.fillStyle = 'rgba(128,128,128,0.9)';
    ctx.fillText('projected screen', stripX0, stripY + 22);

    // draw scene points + projection
    SCENE.forEach((p) => {
      const sy = zToY(p.z);
      const sx = camX + p.x * 26 * (p.z / 5);
      const inFrustum = p.z >= near && p.z <= far;
      // world dot
      ctx.beginPath(); ctx.arc(sx, sy, 6, 0, Math.PI * 2);
      ctx.fillStyle = inFrustum ? COLORS.pt : COLORS.ptClip;
      ctx.fill();
      ctx.fillStyle = inFrustum ? '#fff' : 'rgba(255,255,255,0.7)';
      ctx.font = '700 9px Inter, sans-serif';
      ctx.fillText(p.tag, sx - 3, sy + 3);

      if (inFrustum) {
        // project onto screen: perspective divides by z, ortho ignores z
        const ndc = persp
          ? p.x / (Math.tan(halfFovRad) * p.z)
          : p.x / (Math.tan(halfFovRad) * 7);
        const screenX = camX + Math.max(-1, Math.min(1, ndc)) * ((stripX1 - stripX0) / 2);
        ctx.strokeStyle = 'rgba(79,70,229,0.35)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(screenX, stripY); ctx.stroke();
        ctx.setLineDash([]);
        // projected mark, size shrinks with depth in perspective
        const r = persp ? Math.max(2.5, 8 - p.z * 0.5) : 5;
        ctx.beginPath(); ctx.arc(screenX, stripY, r, 0, Math.PI * 2);
        ctx.fillStyle = COLORS.pt; ctx.fill();
      }
    });
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 520);
      const h = Math.round(w * 0.85);
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

  useEffect(draw, [fov, near, far, persp]);

  const visible = SCENE.filter((p) => p.z >= near && p.z <= far).length;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap gap-2">
        {([['persp', 'Perspective'], ['ortho', 'Orthographic']] as const).map(([m, label]) => (
          <button
            key={m}
            onClick={() => setPersp(m === 'persp')}
            class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              (m === 'persp') === persp ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div class="grid gap-4 md:grid-cols-[1fr,auto] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

        <div class="space-y-3 text-sm md:w-56">
          <Slider label={`FOV = ${fov}°`} min={20} max={110} step={1} value={fov} onChange={setFov} disabled={!persp} />
          <Slider label={`near = ${near.toFixed(1)}`} min={1} max={5} step={0.5} value={near} onChange={(v) => setNear(Math.min(v, far - 1))} />
          <Slider label={`far = ${far.toFixed(1)}`} min={5} max={13} step={0.5} value={far} onChange={(v) => setFar(Math.max(v, near + 1))} />
          <div class="rounded-lg bg-surface-2 p-3">
            <div class="flex justify-between"><span class="text-muted">objects in frustum</span><strong>{visible} / {SCENE.length}</strong></div>
            <p class="mt-1 text-xs text-muted">
              {persp ? 'Perspective: far objects shrink, like real eyes.' : 'Orthographic: size is constant — great for CAD and 2D.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Slider({ label, min, max, step, value, onChange, disabled }: {
  label: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void; disabled?: boolean;
}) {
  return (
    <label class={`block ${disabled ? 'opacity-40' : ''}`}>
      <span class="mb-1 block text-muted">{label}</span>
      <input
        type="range" min={min} max={max} step={step} value={value} disabled={disabled}
        onInput={(e) => onChange(parseFloat((e.target as HTMLInputElement).value))}
        class="w-full accent-[#4f46e5]"
      />
    </label>
  );
}
