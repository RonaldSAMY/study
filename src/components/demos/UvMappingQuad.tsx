import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   UV mapping playground.
   - LEFT: a rectangular quad on screen. Each pixel's UV is the bilinear
     blend of the four corner UVs, then it samples a checkerboard texture.
   - RIGHT: a UV-space editor. Drag the four corner handles to change the
     corner UVs, and watch the texture stretch / skew on the quad live.
   - Toggle nearest vs bilinear filtering, and mipmaps on/off. The "size"
     slider shrinks the quad so you can see shimmer fought by mipmaps.
   ------------------------------------------------------------------ */

type UV = { u: number; v: number };
// corner order: 0 = top-left, 1 = top-right, 2 = bottom-right, 3 = bottom-left
const DEFAULT_UVS: UV[] = [
  { u: 0, v: 0 },
  { u: 1, v: 0 },
  { u: 1, v: 1 },
  { u: 0, v: 1 },
];

const QBUF = 220; // quad render buffer (square)
const TEX = 256; // base texture size
const MAX_LEVEL = 8; // log2(256)

// ---- build a colored checkerboard + its mip pyramid ----
function buildTexture() {
  const levels: { size: number; data: Uint8ClampedArray }[] = [];
  const base = new Uint8ClampedArray(TEX * TEX * 3);
  const cells = 8;
  const cell = TEX / cells;
  for (let y = 0; y < TEX; y++) {
    for (let x = 0; x < TEX; x++) {
      const cxi = Math.floor(x / cell);
      const cyi = Math.floor(y / cell);
      const checker = (cxi + cyi) % 2 === 0;
      const onGrid = x % cell < 2 || y % cell < 2; // thin lines -> alias nicely
      const i = (y * TEX + x) * 3;
      if (onGrid) {
        base[i] = 16; base[i + 1] = 185; base[i + 2] = 129; // emerald grid
      } else if (checker) {
        base[i] = 79; base[i + 1] = 70; base[i + 2] = 229; // indigo
      } else {
        base[i] = 238; base[i + 1] = 242; base[i + 2] = 255; // near-white
      }
    }
  }
  levels.push({ size: TEX, data: base });
  // box-downsample to build each coarser mip level
  for (let l = 1; l <= MAX_LEVEL; l++) {
    const prev = levels[l - 1];
    const size = prev.size >> 1 || 1;
    const data = new Uint8ClampedArray(size * size * 3);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        for (let c = 0; c < 3; c++) {
          const p = prev.size;
          const a = prev.data[((2 * y) * p + 2 * x) * 3 + c];
          const b = prev.data[((2 * y) * p + 2 * x + 1) * 3 + c];
          const cc = prev.data[((2 * y + 1) * p + 2 * x) * 3 + c];
          const d = prev.data[((2 * y + 1) * p + 2 * x + 1) * 3 + c];
          data[(y * size + x) * 3 + c] = (a + b + cc + d) / 4;
        }
      }
    }
    levels.push({ size, data });
  }
  return levels;
}

function sample(
  levels: { size: number; data: Uint8ClampedArray }[],
  level: number,
  u: number,
  v: number,
  bilinear: boolean,
  out: number[],
) {
  const lv = levels[Math.max(0, Math.min(MAX_LEVEL, Math.round(level)))];
  const size = lv.size;
  const data = lv.data;
  // repeat wrap
  u = u - Math.floor(u);
  v = v - Math.floor(v);
  const wrap = (n: number) => ((n % size) + size) % size;
  if (!bilinear || size === 1) {
    const xi = wrap(Math.floor(u * size));
    const yi = wrap(Math.floor(v * size));
    const i = (yi * size + xi) * 3;
    out[0] = data[i]; out[1] = data[i + 1]; out[2] = data[i + 2];
    return;
  }
  const fx = u * size - 0.5;
  const fy = v * size - 0.5;
  const x0 = Math.floor(fx), y0 = Math.floor(fy);
  const tx = fx - x0, ty = fy - y0;
  const x0w = wrap(x0), x1w = wrap(x0 + 1), y0w = wrap(y0), y1w = wrap(y0 + 1);
  for (let c = 0; c < 3; c++) {
    const a = data[(y0w * size + x0w) * 3 + c];
    const b = data[(y0w * size + x1w) * 3 + c];
    const cc = data[(y1w * size + x0w) * 3 + c];
    const d = data[(y1w * size + x1w) * 3 + c];
    const top = a + (b - a) * tx;
    const bot = cc + (d - cc) * tx;
    out[c] = top + (bot - top) * ty;
  }
}

export default function UvMappingQuad() {
  const quadRef = useRef<HTMLCanvasElement>(null);
  const editRef = useRef<HTMLCanvasElement>(null);
  const qbufRef = useRef<HTMLCanvasElement | null>(null);
  const qimgRef = useRef<ImageData | null>(null);
  const levelsRef = useRef<ReturnType<typeof buildTexture> | null>(null);
  const qSizeRef = useRef({ w: 280, h: 280 });
  const eSizeRef = useRef({ w: 220, h: 220 });
  const dragRef = useRef<number | null>(null);

  const [uvs, setUvs] = useState<UV[]>(DEFAULT_UVS.map((p) => ({ ...p })));
  const [bilinear, setBilinear] = useState(true);
  const [mipmap, setMipmap] = useState(true);
  const [scale, setScale] = useState(1); // quad coverage of the buffer

  const stateRef = useRef({ uvs, bilinear, mipmap, scale });
  stateRef.current = { uvs, bilinear, mipmap, scale };

  // ---- render the textured quad ----
  const renderQuad = () => {
    const buf = qbufRef.current;
    const img = qimgRef.current;
    const levels = levelsRef.current;
    if (!buf || !img || !levels) return;
    const { uvs: U, bilinear: bl, mipmap: mip, scale: sc } = stateRef.current;
    const data = img.data;
    const side = QBUF * sc; // quad side in buffer pixels
    const off = (QBUF - side) / 2;
    const out = [0, 0, 0];
    let i = 0;
    for (let y = 0; y < QBUF; y++) {
      for (let x = 0; x < QBUF; x++) {
        const s = (x - off) / side;
        const t = (y - off) / side;
        if (s < 0 || s > 1 || t < 0 || t > 1) {
          data[i++] = 0; data[i++] = 0; data[i++] = 0; data[i++] = 0;
          continue;
        }
        // bilinear blend of the four corner UVs
        const uTop = U[0].u + (U[1].u - U[0].u) * s;
        const vTop = U[0].v + (U[1].v - U[0].v) * s;
        const uBot = U[3].u + (U[2].u - U[3].u) * s;
        const vBot = U[3].v + (U[2].v - U[3].v) * s;
        const u = uTop + (uBot - uTop) * t;
        const v = vTop + (vBot - vTop) * t;
        // texel footprint per buffer pixel -> mip level
        let level = 0;
        if (mip) {
          const dus = ((U[1].u - U[0].u) * (1 - t) + (U[2].u - U[3].u) * t) / side;
          const dvs = ((U[1].v - U[0].v) * (1 - t) + (U[2].v - U[3].v) * t) / side;
          const dut = (uBot - uTop) / side;
          const dvt = (vBot - vTop) / side;
          const fp = Math.max(Math.hypot(dus, dvs), Math.hypot(dut, dvt)) * TEX;
          level = Math.max(0, Math.log2(Math.max(1, fp)));
        }
        sample(levels, level, u, v, bl, out);
        data[i++] = out[0]; data[i++] = out[1]; data[i++] = out[2]; data[i++] = 255;
      }
    }
    const bctx = buf.getContext('2d');
    if (bctx) bctx.putImageData(img, 0, 0);
    drawQuad();
  };

  const drawQuad = () => {
    const canvas = quadRef.current;
    const buf = qbufRef.current;
    if (!canvas || !buf) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = qSizeRef.current;
    ctx.clearRect(0, 0, w, h);
    // pixelated when nearest so blocks are crisp; smooth otherwise
    ctx.imageSmoothingEnabled = stateRef.current.bilinear;
    const side = Math.min(w, h);
    ctx.drawImage(buf, 0, 0, QBUF, QBUF, (w - side) / 2, (h - side) / 2, side, side);
  };

  // ---- render the UV editor ----
  const drawEditor = () => {
    const canvas = editRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = eSizeRef.current;
    const pad = 22;
    const sx = w - pad * 2;
    const sy = h - pad * 2;
    const toPx = (p: UV) => ({ x: pad + p.u * sx, y: pad + p.v * sy });
    ctx.clearRect(0, 0, w, h);

    // texture thumbnail as the [0,1] backdrop
    const buf = qbufRef.current; // reuse not ideal; draw checker quickly
    ctx.fillStyle = '#0ea5e9';
    // draw a faint checker thumbnail
    const levels = levelsRef.current;
    if (levels) {
      const thumb = levels[2]; // 64px
      const ts = thumb.size;
      const cellW = sx / ts;
      // draw coarse blocks (sampled) — light, just for orientation
      for (let yy = 0; yy < ts; yy += 4) {
        for (let xx = 0; xx < ts; xx += 4) {
          const idx = (yy * ts + xx) * 3;
          ctx.fillStyle = `rgba(${thumb.data[idx]},${thumb.data[idx + 1]},${thumb.data[idx + 2]},0.5)`;
          ctx.fillRect(pad + xx * cellW, pad + yy * cellW, cellW * 4, cellW * 4);
        }
      }
    }
    void buf;

    // border of UV space [0,1]
    ctx.strokeStyle = 'rgba(128,128,128,0.5)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(pad, pad, sx, sy);

    // polygon of current corner UVs
    const pts = uvs.map(toPx);
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let k = 1; k < 4; k++) ctx.lineTo(pts[k].x, pts[k].y);
    ctx.closePath();
    ctx.strokeStyle = '#4f46e5';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = 'rgba(79,70,229,0.12)';
    ctx.fill();

    // handles
    const colors = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b'];
    pts.forEach((p, k) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = colors[k];
      ctx.stroke();
    });
  };

  // ---- setup buffers + responsive sizing ----
  useEffect(() => {
    levelsRef.current = buildTexture();
    const qbuf = document.createElement('canvas');
    qbuf.width = QBUF; qbuf.height = QBUF;
    qbufRef.current = qbuf;
    const bctx = qbuf.getContext('2d');
    qimgRef.current = bctx ? bctx.createImageData(QBUF, QBUF) : null;

    const setup = (canvas: HTMLCanvasElement, ratio: number, ref: { current: { w: number; h: number } }) => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 320);
      const h = Math.round(w * ratio);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ref.current = { w, h };
    };
    const resize = () => {
      if (quadRef.current) setup(quadRef.current, 1, qSizeRef);
      if (editRef.current) setup(editRef.current, 1, eSizeRef);
      renderQuad();
      drawEditor();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    renderQuad();
    drawEditor();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uvs, bilinear, mipmap, scale]);

  // ---- drag UV handles ----
  const editorPoint = (e: PointerEvent) => {
    const canvas = editRef.current!;
    const rect = canvas.getBoundingClientRect();
    const { w, h } = eSizeRef.current;
    const pad = 22;
    const sx = w - pad * 2;
    const sy = h - pad * 2;
    const u = (e.clientX - rect.left - pad) / sx;
    const v = (e.clientY - rect.top - pad) / sy;
    return { u, v };
  };
  const onDown = (e: PointerEvent) => {
    const { u, v } = editorPoint(e);
    let best = -1, bestD = 0.12;
    uvs.forEach((p, k) => {
      const d = Math.hypot(p.u - u, p.v - v);
      if (d < bestD) { bestD = d; best = k; }
    });
    if (best >= 0) {
      dragRef.current = best;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      e.preventDefault();
    }
  };
  const onMove = (e: PointerEvent) => {
    if (dragRef.current == null) return;
    const { u, v } = editorPoint(e);
    const clamp = (n: number) => Math.max(-0.5, Math.min(1.5, n));
    setUvs((prev) => prev.map((p, k) => (k === dragRef.current ? { u: clamp(u), v: clamp(v) } : p)));
  };
  const onUp = () => { dragRef.current = null; };

  const reset = () => setUvs(DEFAULT_UVS.map((p) => ({ ...p })));
  const cornerName = ['TL', 'TR', 'BR', 'BL'];

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap gap-2">
        <button
          onClick={() => setBilinear((b) => !b)}
          class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
            bilinear ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
          }`}
        >
          {bilinear ? 'Bilinear' : 'Nearest'}
        </button>
        <button
          onClick={() => setMipmap((m) => !m)}
          class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
            mipmap ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
          }`}
        >
          Mipmaps: {mipmap ? 'on' : 'off'}
        </button>
        <button
          onClick={reset}
          class="ml-auto rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted transition hover:text-text"
        >
          Reset UVs
        </button>
      </div>

      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <p class="mb-1 text-xs font-semibold text-muted">Textured quad</p>
          <canvas ref={quadRef} class="touch-none rounded-xl bg-surface-2" />
        </div>
        <div>
          <p class="mb-1 text-xs font-semibold text-muted">UV space (drag corners)</p>
          <canvas
            ref={editRef}
            class="touch-none rounded-xl bg-surface-2"
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
          />
        </div>
      </div>

      <label class="mt-3 block text-sm">
        <span class="mb-1 block text-muted">quad size = {(scale * 100).toFixed(0)}% (shrink to test mipmaps)</span>
        <input
          type="range" min={0.12} max={1} step={0.01} value={scale}
          onInput={(e) => setScale(parseFloat((e.target as HTMLInputElement).value))}
          class="w-full accent-[#0ea5e9]"
        />
      </label>

      <div class="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        {uvs.map((p, k) => (
          <Readout key={k} label={cornerName[k]} value={`(${p.u.toFixed(2)}, ${p.v.toFixed(2)})`} />
        ))}
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
