import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Procedural terrain from seeded Perlin noise.
   - A seeded PRNG (mulberry32) builds the gradient table, so the SAME
     seed always rebuilds the SAME world — reseed for a fresh one.
   - "scale" zooms the noise; "octaves" stacks finer detail on top of
     broad shapes (fractal noise). Heights are colored as terrain.
   ------------------------------------------------------------------ */

export default function NoiseTerrainForge() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const offRef = useRef<HTMLCanvasElement | null>(null);
  const geomRef = useRef({ w: 480, h: 320 });
  const [seed, setSeed] = useState(1337);
  const [scale, setScale] = useState(70);
  const [octaves, setOctaves] = useState(4);
  const permRef = useRef<Uint8Array>(buildPerm(1337));

  // rebuild the gradient table whenever the seed changes
  useEffect(() => { permRef.current = buildPerm(seed); }, [seed]);

  const render = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = geomRef.current;
    const perm = permRef.current;

    let off = offRef.current;
    if (!off) { off = document.createElement('canvas'); offRef.current = off; }
    off.width = w; off.height = h;
    const octx = off.getContext('2d');
    if (!octx) return;
    const img = octx.createImageData(w, h);
    const data = img.data;
    const freq = 1 / scale;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const n = fractal(perm, x * freq, y * freq, octaves); // ~[0,1]
        const [r, g, b] = terrainColor(n);
        const i = (y * w + x) * 4;
        data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255;
      }
    }
    octx.putImageData(img, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(off, 0, 0, w, h);
  };

  // ---- responsive sizing ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 560);
      const h = Math.round(w * 0.62);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      geomRef.current = { w, h };
      render();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(render, [seed, scale, octaves]);

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

        <div class="space-y-3 text-sm">
          <button
            onClick={() => setSeed(Math.floor(Math.random() * 100000))}
            class="w-full rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white transition hover:opacity-90"
          >
            🎲 Reseed world
          </button>
          <div class="rounded-lg bg-surface-2 px-3 py-2 font-mono text-xs">seed = {seed}</div>

          <label class="block">
            <span class="mb-1 block text-muted">scale = {scale}px {scale < 45 ? '(jagged)' : scale > 95 ? '(broad)' : ''}</span>
            <input
              type="range" min={20} max={140} step={2} value={scale}
              onInput={(e) => setScale(parseInt((e.target as HTMLInputElement).value))}
              class="w-full" style="accent-color:#10b981"
            />
          </label>

          <label class="block">
            <span class="mb-1 block text-muted">octaves = {octaves}</span>
            <input
              type="range" min={1} max={6} step={1} value={octaves}
              onInput={(e) => setOctaves(parseInt((e.target as HTMLInputElement).value))}
              class="w-full" style="accent-color:#0ea5e9"
            />
          </label>

          <p class="rounded-lg bg-surface-2 p-3 text-xs text-muted">
            Same seed → same world, every time. Raise <strong>octaves</strong> to add finer ridges on top
            of the broad continents; raise <strong>scale</strong> to zoom out to bigger landmasses.
          </p>
        </div>
      </div>
    </div>
  );
}

// ---- seeded PRNG + permutation table -----------------------------
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function buildPerm(seed: number): Uint8Array {
  const rng = mulberry32(seed);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = p[i]; p[i] = p[j]; p[j] = tmp;
  }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  return perm;
}

// ---- Perlin noise -------------------------------------------------
function fade(t: number) { return t * t * t * (t * (t * 6 - 15) + 10); }
function lerp(a: number, b: number, t: number) { return a + t * (b - a); }
function gradDot(hash: number, x: number, y: number) {
  const a = (hash / 256) * Math.PI * 2;
  return Math.cos(a) * x + Math.sin(a) * y;
}
function perlin(perm: Uint8Array, x: number, y: number) {
  const xi = Math.floor(x) & 255, yi = Math.floor(y) & 255;
  const xf = x - Math.floor(x), yf = y - Math.floor(y);
  const u = fade(xf), v = fade(yf);
  const aa = perm[perm[xi] + yi], ab = perm[perm[xi] + yi + 1];
  const ba = perm[perm[xi + 1] + yi], bb = perm[perm[xi + 1] + yi + 1];
  const x1 = lerp(gradDot(aa, xf, yf), gradDot(ba, xf - 1, yf), u);
  const x2 = lerp(gradDot(ab, xf, yf - 1), gradDot(bb, xf - 1, yf - 1), u);
  return lerp(x1, x2, v); // ~[-0.7, 0.7]
}
function fractal(perm: Uint8Array, x: number, y: number, octaves: number) {
  let amp = 1, freq = 1, sum = 0, norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amp * perlin(perm, x * freq, y * freq);
    norm += amp;
    amp *= 0.5; freq *= 2;
  }
  return sum / norm / 1.4 + 0.5; // map to ~[0,1]
}

// ---- height → terrain color --------------------------------------
function terrainColor(n: number): [number, number, number] {
  if (n < 0.34) return [40, 78, 138];   // deep water
  if (n < 0.43) return [62, 120, 184];  // shallow water
  if (n < 0.49) return [214, 200, 142]; // sand
  if (n < 0.62) return [96, 162, 84];   // grass
  if (n < 0.76) return [54, 110, 62];   // forest
  if (n < 0.88) return [128, 120, 112]; // rock
  return [240, 240, 246];               // snow
}
