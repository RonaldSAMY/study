import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Diffuse / specular lighting studio.
   - A lit "sphere" rendered per-pixel: for each surface point we build
     a normal N, take the light direction L, and shade with N·L (Lambert)
     plus an optional specular highlight and ambient floor.
   - Drag the light (amber). Toggle specular; slide ambient.
   ------------------------------------------------------------------ */

type Vec3 = { x: number; y: number; z: number };

const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
const norm = (a: Vec3): Vec3 => {
  const l = Math.hypot(a.x, a.y, a.z) || 1;
  return { x: a.x / l, y: a.y / l, z: a.z / l };
};

export default function DiffuseLightStudio() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bufRef = useRef<HTMLCanvasElement | null>(null);
  const imgRef = useRef<ImageData | null>(null);
  const sizeRef = useRef({ w: 360, h: 360 });
  // light position in screen-ish coords, normalized -1..1 (z fixed toward viewer)
  const [light, setLight] = useState({ x: -0.55, y: -0.5 });
  const [ambient, setAmbient] = useState(0.12);
  const [specular, setSpecular] = useState(true);
  const dragRef = useRef(false);
  const BW = 150, BH = 150;

  // base material color (indigo-ish)
  const base = { r: 90, g: 90, b: 230 };

  const renderBuffer = () => {
    const buf = bufRef.current, img = imgRef.current;
    if (!buf || !img) return;
    const L = norm({ x: light.x, y: light.y, z: 0.75 });
    const V: Vec3 = { x: 0, y: 0, z: 1 }; // viewer toward +z
    const data = img.data;
    let i = 0;
    for (let py = 0; py < BH; py++) {
      for (let px = 0; px < BW; px++) {
        // map pixel to -1..1 disk
        const nx = (px / (BW - 1)) * 2 - 1;
        const ny = (py / (BH - 1)) * 2 - 1;
        const r2 = nx * nx + ny * ny;
        if (r2 > 1) {
          data[i++] = 0; data[i++] = 0; data[i++] = 0; data[i++] = 0;
          continue;
        }
        const nz = Math.sqrt(1 - r2);
        const N: Vec3 = { x: nx, y: ny, z: nz };
        // Lambert diffuse
        const diff = Math.max(0, dot(N, L));
        let intensity = ambient + (1 - ambient) * diff;
        // Blinn-Phong specular highlight
        let spec = 0;
        if (specular && diff > 0) {
          const H = norm({ x: L.x + V.x, y: L.y + V.y, z: L.z + V.z });
          spec = Math.pow(Math.max(0, dot(N, H)), 40);
        }
        const r = Math.min(255, base.r * intensity + spec * 255);
        const g = Math.min(255, base.g * intensity + spec * 255);
        const b = Math.min(255, base.b * intensity + spec * 255);
        data[i++] = r | 0; data[i++] = g | 0; data[i++] = b | 0; data[i++] = 255;
      }
    }
    buf.getContext('2d')!.putImageData(img, 0, 0);
    blit();
  };

  const blit = () => {
    const canvas = canvasRef.current, buf = bufRef.current;
    if (!canvas || !buf) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(buf, 0, 0, BW, BH, 0, 0, w, h);
    // draw the light handle
    const lx = (light.x * 0.5 + 0.5) * w;
    const ly = (light.y * 0.5 + 0.5) * h;
    ctx.beginPath(); ctx.arc(lx, ly, 9, 0, Math.PI * 2);
    ctx.fillStyle = '#f59e0b'; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
    ctx.font = '600 12px Inter, sans-serif';
    ctx.fillStyle = '#f59e0b';
    ctx.fillText('light', lx + 12, ly + 4);
  };

  useEffect(() => {
    const buf = document.createElement('canvas');
    buf.width = BW; buf.height = BH;
    bufRef.current = buf;
    imgRef.current = buf.getContext('2d')!.createImageData(BW, BH);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 360);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr; canvas.height = w * dpr;
      canvas.style.width = `${w}px`; canvas.style.height = `${w}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w, h: w };
      renderBuffer();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(renderBuffer, [light, ambient, specular]);

  const pointer = (e: PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const { w, h } = sizeRef.current;
    return {
      x: ((e.clientX - rect.left) / w) * 2 - 1,
      y: ((e.clientY - rect.top) / h) * 2 - 1,
    };
  };
  const onDown = (e: PointerEvent) => {
    dragRef.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setLight(pointer(e));
    e.preventDefault();
  };
  const onMove = (e: PointerEvent) => {
    if (!dragRef.current) return;
    setLight(pointer(e));
  };
  const onUp = () => { dragRef.current = false; };

  const NdotL = Math.max(0, dot(norm({ x: 0, y: 0, z: 1 }), norm({ x: light.x, y: light.y, z: 0.75 })));

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
          <p class="text-muted">Drag the amber light around the sphere. Brightness at the front-facing point is N·L.</p>
          <label class="block">
            <span class="mb-1 block text-muted">ambient = {ambient.toFixed(2)}</span>
            <input type="range" min={0} max={0.5} step={0.01} value={ambient}
              onInput={(e) => setAmbient(parseFloat((e.target as HTMLInputElement).value))}
              class="w-full accent-[#4f46e5]" />
          </label>
          <button
            onClick={() => setSpecular((s) => !s)}
            class={`rounded-lg px-3 py-1.5 font-semibold transition ${
              specular ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
            }`}
          >
            Specular highlight: {specular ? 'on' : 'off'}
          </button>
          <div class="rounded-lg bg-surface-2 p-3">
            <div class="flex justify-between"><span class="text-muted">N·L (front point)</span><strong class="font-mono">{NdotL.toFixed(2)}</strong></div>
            <p class="mt-1 text-xs text-muted">Faces pointing at the light are bright; faces turned away fall to the ambient floor.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
