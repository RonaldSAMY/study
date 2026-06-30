import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   UV mapping dragboard.
   - Left: a procedural texture in UV space (0..1, 0..1) with a draggable
     rectangle marking which region is mapped onto the quad.
   - Right: the quad, sampled from that UV region.
   - Toggle nearest vs bilinear filtering, and mipmaps (which tame the
     sparkle when the UV region is much larger than the quad).
   ------------------------------------------------------------------ */

type Vec = { x: number; y: number };

const COLORS = { uv0: '#4f46e5', uv1: '#10b981', frame: 'rgba(128,128,128,0.6)' };
const TEX = 128;

// procedural texture: colorful tiles + fine detail (to show aliasing)
function texel(u: number, v: number): [number, number, number] {
  const tile = (Math.floor(u * 8) + Math.floor(v * 8)) % 2;
  const fine = 0.5 + 0.5 * Math.sin(u * 90) * Math.sin(v * 90);
  const r = tile ? 60 + fine * 60 : 230 - fine * 50;
  const g = tile ? 90 + fine * 120 : 70 + fine * 60;
  const b = tile ? 220 - fine * 40 : 120 + fine * 100;
  return [r, g, b];
}

export default function UvMappingDragboard() {
  const texRef = useRef<HTMLCanvasElement>(null);   // left: texture + UV rect
  const quadRef = useRef<HTMLCanvasElement>(null);  // right: sampled quad
  const sizeRef = useRef({ s: 220 });
  const texBuf = useRef<ImageData | null>(null);
  const [uvMin, setUvMin] = useState<Vec>({ x: 0.1, y: 0.1 });
  const [uvMax, setUvMax] = useState<Vec>({ x: 0.6, y: 0.6 });
  const [linear, setLinear] = useState(true);
  const [mipmaps, setMipmaps] = useState(false);
  const dragRef = useRef<null | 'min' | 'max'>(null);

  // sample texture (with optional bilinear + crude mip blur)
  const sample = (u: number, v: number, lod: number): [number, number, number] => {
    u = ((u % 1) + 1) % 1; v = ((v % 1) + 1) % 1;
    const step = mipmaps ? Math.max(1, Math.round(lod)) : 1;
    if (!linear) {
      return texel(Math.floor(u * (TEX / step)) * step / TEX, Math.floor(v * (TEX / step)) * step / TEX);
    }
    // bilinear over a (possibly mip-stepped) grid
    const g = TEX / step;
    const fx = u * g - 0.5, fy = v * g - 0.5;
    const x0 = Math.floor(fx), y0 = Math.floor(fy);
    const tx = fx - x0, ty = fy - y0;
    const at = (xi: number, yi: number) => texel(((xi % g) + g) % g / g, ((yi % g) + g) % g / g);
    const c00 = at(x0, y0), c10 = at(x0 + 1, y0), c01 = at(x0, y0 + 1), c11 = at(x0 + 1, y0 + 1);
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    return [0, 1, 2].map((k) =>
      lerp(lerp(c00[k], c10[k], tx), lerp(c01[k], c11[k], tx), ty)
    ) as [number, number, number];
  };

  const drawTexture = () => {
    const canvas = texRef.current;
    if (!canvas || !texBuf.current) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { s } = sizeRef.current;
    // blit prebuilt texture
    const tmp = document.createElement('canvas');
    tmp.width = TEX; tmp.height = TEX;
    tmp.getContext('2d')!.putImageData(texBuf.current, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.clearRect(0, 0, s, s);
    ctx.drawImage(tmp, 0, 0, s, s);
    // UV rect
    const x0 = uvMin.x * s, y0 = uvMin.y * s, x1 = uvMax.x * s, y1 = uvMax.y * s;
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
    handle(ctx, { x: x0, y: y0 }, COLORS.uv0);
    handle(ctx, { x: x1, y: y1 }, COLORS.uv1);
  };

  const drawQuad = () => {
    const canvas = quadRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { s } = sizeRef.current;
    const out = ctx.createImageData(s, s);
    const du = uvMax.x - uvMin.x, dv = uvMax.y - uvMin.y;
    // level-of-detail: how many texels per output pixel
    const lod = Math.max(1, (Math.abs(du) * TEX) / s);
    let i = 0;
    for (let py = 0; py < s; py++) {
      for (let px = 0; px < s; px++) {
        const u = uvMin.x + (px / s) * du;
        const v = uvMin.y + (py / s) * dv;
        const [r, g, b] = sample(u, v, lod);
        out.data[i++] = r | 0; out.data[i++] = g | 0; out.data[i++] = b | 0; out.data[i++] = 255;
      }
    }
    ctx.putImageData(out, 0, 0);
  };

  useEffect(() => {
    // build texture once
    const buf = document.createElement('canvas').getContext('2d')!.createImageData(TEX, TEX);
    let i = 0;
    for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) {
      const [r, g, b] = texel(x / TEX, y / TEX);
      buf.data[i++] = r | 0; buf.data[i++] = g | 0; buf.data[i++] = b | 0; buf.data[i++] = 255;
    }
    texBuf.current = buf;

    const resize = () => {
      const parent = texRef.current?.parentElement?.parentElement;
      const avail = parent ? parent.clientWidth : 460;
      const s = Math.max(140, Math.min(220, Math.floor((avail - 24) / 2)));
      const dpr = window.devicePixelRatio || 1;
      [texRef.current, quadRef.current].forEach((c) => {
        if (!c) return;
        c.width = s * dpr; c.height = s * dpr;
        c.style.width = `${s}px`; c.style.height = `${s}px`;
        const ctx = c.getContext('2d');
        if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      });
      sizeRef.current = { s };
      drawTexture(); drawQuad();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(() => { drawTexture(); drawQuad(); }, [uvMin, uvMax, linear, mipmaps]);

  const pointer = (e: PointerEvent) => {
    const canvas = texRef.current!;
    const rect = canvas.getBoundingClientRect();
    const { s } = sizeRef.current;
    return { x: (e.clientX - rect.left) / s, y: (e.clientY - rect.top) / s };
  };
  const onDown = (e: PointerEvent) => {
    const p = pointer(e);
    const dMin = Math.hypot(p.x - uvMin.x, p.y - uvMin.y);
    const dMax = Math.hypot(p.x - uvMax.x, p.y - uvMax.y);
    if (dMin < 0.12 && dMin <= dMax) dragRef.current = 'min';
    else if (dMax < 0.12) dragRef.current = 'max';
    if (dragRef.current) {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      e.preventDefault();
    }
  };
  const onMove = (e: PointerEvent) => {
    if (!dragRef.current) return;
    const p = pointer(e);
    const cl = (v: number) => Math.max(-0.5, Math.min(1.5, v));
    if (dragRef.current === 'min') setUvMin({ x: cl(p.x), y: cl(p.y) });
    else setUvMax({ x: cl(p.x), y: cl(p.y) });
  };
  const onUp = () => { dragRef.current = null; };

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap gap-2">
        <button onClick={() => setLinear((l) => !l)}
          class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${linear ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'}`}>
          {linear ? 'Bilinear' : 'Nearest'}
        </button>
        <button onClick={() => setMipmaps((m) => !m)}
          class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${mipmaps ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'}`}>
          Mipmaps: {mipmaps ? 'on' : 'off'}
        </button>
      </div>
      <div class="flex flex-wrap items-start gap-4">
        <div class="text-center">
          <canvas ref={texRef} class="touch-none rounded-xl bg-surface-2"
            onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} />
          <p class="mt-1 text-xs text-muted">texture (drag the UV corners)</p>
        </div>
        <div class="text-center">
          <canvas ref={quadRef} class="rounded-xl bg-surface-2" />
          <p class="mt-1 text-xs text-muted">quad (sampled result)</p>
        </div>
      </div>
      <p class="mt-3 text-sm text-muted">
        Stretch the UV box small to magnify (watch nearest go blocky); make it large to minify (watch the fine pattern sparkle — then switch mipmaps on to calm it).
      </p>
    </div>
  );
}

function handle(ctx: CanvasRenderingContext2D, at: Vec, color: string) {
  ctx.beginPath(); ctx.arc(at.x, at.y, 7, 0, Math.PI * 2);
  ctx.fillStyle = '#fff'; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = color; ctx.stroke();
}
