import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Diffuse (Lambert) lighting stage.
   - A shaded sphere lit by a draggable light.
   - Brightness of every surface point = max(0, N · L): the dot product
     of the surface normal N and the direction to the light L.
   - Drag the light; the shading and the sampled-point readout update live.
   ------------------------------------------------------------------ */

// square offscreen buffer where we shade the sphere
const BS = 200;
// a fixed surface point we sample and report (as a unit normal direction)
const SAMPLE = (() => {
  const x = 0.42, y = 0.46;
  const z = Math.sqrt(Math.max(0, 1 - x * x - y * y));
  return { x, y, z };
})();
const AMBIENT = 0.08; // small fill so the dark side is not pure black

export default function DiffuseLightingStage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bufRef = useRef<HTMLCanvasElement | null>(null);
  const imgRef = useRef<ImageData | null>(null);
  const sizeRef = useRef({ w: 460, h: 340, cx: 230, cy: 170, R: 150 });
  const dragRef = useRef(false);

  // light direction in normalized sphere space; lz is depth toward viewer
  const [light, setLight] = useState({ x: 0.9, y: 0.9 });
  const lz = 0.85;

  const lightDir = () => {
    const len = Math.hypot(light.x, light.y, lz) || 1;
    return { x: light.x / len, y: light.y / len, z: lz / len };
  };

  const renderSphere = () => {
    const buf = bufRef.current;
    const img = imgRef.current;
    if (!buf || !img) return;
    const L = lightDir();
    const data = img.data;
    const half = BS / 2;
    const r = BS * 0.46;
    let i = 0;
    for (let y = 0; y < BS; y++) {
      const Y = (half - y) / r;
      for (let x = 0; x < BS; x++) {
        const X = (x - half) / r;
        const d2 = X * X + Y * Y;
        if (d2 > 1) {
          data[i++] = 0; data[i++] = 0; data[i++] = 0; data[i++] = 0;
          continue;
        }
        const Z = Math.sqrt(1 - d2);
        // N is the unit normal; for a unit sphere it equals the point itself
        const ndotl = X * L.x + Y * L.y + Z * L.z;
        const diff = Math.max(0, ndotl);
        const b = AMBIENT + (1 - AMBIENT) * diff;
        // base albedo: a warm indigo-ish clay
        data[i++] = (b * 120) | 0;
        data[i++] = (b * 130) | 0;
        data[i++] = (b * 235) | 0;
        data[i++] = 255;
      }
    }
    const bctx = buf.getContext('2d');
    if (bctx) bctx.putImageData(img, 0, 0);
    draw();
  };

  const draw = () => {
    const canvas = canvasRef.current;
    const buf = bufRef.current;
    if (!canvas || !buf) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h, cx, cy, R } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(buf, 0, 0, BS, BS, cx - R, cy - R, R * 2, R * 2);

    const toScreen = (nx: number, ny: number) => ({ x: cx + nx * R, y: cy - ny * R });
    const L = lightDir();

    // sample point marker + its normal arrow
    const sp = toScreen(SAMPLE.x, SAMPLE.y);
    const nTip = toScreen(SAMPLE.x + SAMPLE.x * 0.5, SAMPLE.y + SAMPLE.y * 0.5);
    arrow(ctx, sp, nTip, '#10b981', 2.5); // N
    // direction-to-light arrow from the sample point
    const lTip = { x: sp.x + L.x * R * 0.5, y: sp.y - L.y * R * 0.5 };
    arrow(ctx, sp, lTip, '#f59e0b', 2.5); // L
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#10b981';
    ctx.stroke();

    // light handle
    const lh = toScreen(light.x, light.y);
    ctx.beginPath();
    ctx.arc(lh.x, lh.y, 13, 0, Math.PI * 2);
    ctx.fillStyle = '#fbbf24';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#f59e0b';
    ctx.stroke();
    ctx.font = '600 13px Inter, sans-serif';
    ctx.fillStyle = '#92400e';
    ctx.fillText('drag', lh.x - 13, lh.y + 4);
  };

  // ---- one-time buffer + responsive sizing ----
  useEffect(() => {
    const buf = document.createElement('canvas');
    buf.width = BS;
    buf.height = BS;
    bufRef.current = buf;
    const bctx = buf.getContext('2d');
    imgRef.current = bctx ? bctx.createImageData(BS, BS) : null;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 520);
      const h = Math.round(w * 0.74);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const R = Math.min(w, h) * 0.42;
      sizeRef.current = { w, h, cx: w / 2, cy: h / 2, R };
      renderSphere();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    renderSphere();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [light]);

  // ---- pointer dragging of the light ----
  const setFromPointer = (e: PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const { cx, cy, R } = sizeRef.current;
    const nx = (e.clientX - rect.left - cx) / R;
    const ny = (cy - (e.clientY - rect.top)) / R;
    const clamp = (v: number) => Math.max(-1.8, Math.min(1.8, v));
    setLight({ x: clamp(nx), y: clamp(ny) });
  };
  const onDown = (e: PointerEvent) => {
    dragRef.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
    setFromPointer(e);
  };
  const onMove = (e: PointerEvent) => {
    if (dragRef.current) setFromPointer(e);
  };
  const onUp = () => { dragRef.current = false; };

  // ---- live readout for the sampled point ----
  const L = lightDir();
  const ndotl = SAMPLE.x * L.x + SAMPLE.y * L.y + SAMPLE.z * L.z;
  const brightness = Math.max(0, ndotl);

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="grid gap-4 md:grid-cols-[1fr,auto] md:items-start">
        <canvas
          ref={canvasRef}
          class="touch-none rounded-xl bg-surface-2"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        />

        <div class="space-y-3 text-sm md:w-56">
          <p class="text-muted">
            Drag the yellow light. Green is the surface normal N at the sampled point; orange points
            toward the light L.
          </p>
          <div class="grid grid-cols-2 gap-2">
            <Readout label="N · L" value={ndotl.toFixed(2)} />
            <Readout label="brightness" value={brightness.toFixed(2)} />
          </div>
          <div class="rounded-lg bg-surface-2 p-3 text-xs text-muted">
            {ndotl > 0.001
              ? 'The light faces the surface — it is lit.'
              : 'N · L is negative, so it is clamped to 0: the surface faces away and stays dark.'}
          </div>
          <div class="h-3 w-full overflow-hidden rounded-full bg-surface-2">
            <div
              class="h-full bg-brand transition-all"
              style={`width:${Math.round(brightness * 100)}%`}
            />
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

function arrow(ctx: CanvasRenderingContext2D, from: { x: number; y: number }, to: { x: number; y: number }, color: string, width: number) {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const head = 9;
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
