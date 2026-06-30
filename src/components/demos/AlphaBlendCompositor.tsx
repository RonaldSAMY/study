import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Alpha-blend compositor.
   - A source (top) color is composited over a destination (background).
   - Drag the handle (or the slider) to change the top layer's alpha.
   - Toggle gamma-correct blending (mix in LINEAR light) vs naive
     blending (mix raw sRGB bytes) and watch the result change.
   - The big swatch + RGBA readout follow the current mode; two small
     reference swatches always show both so the difference is visible.
   ------------------------------------------------------------------ */

type RGB = { r: number; g: number; b: number };

const BRAND = '#4f46e5';

// hex string "#rrggbb" -> 0..255 channels
function hexToRgb(hex: string): RGB {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function rgbToHex({ r, g, b }: RGB): string {
  const h = (v: number) => Math.round(v).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

// sRGB byte (0..255) <-> linear light (0..1)
function srgbToLinear(c8: number): number {
  const c = c8 / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
function linearToSrgb(c: number): number {
  const s = c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, s * 255));
}

// composite src OVER dst at the given alpha, in the chosen space
function composite(src: RGB, dst: RGB, alpha: number, gamma: boolean): RGB {
  if (!gamma) {
    return {
      r: src.r * alpha + dst.r * (1 - alpha),
      g: src.g * alpha + dst.g * (1 - alpha),
      b: src.b * alpha + dst.b * (1 - alpha),
    };
  }
  const mix = (s: number, d: number) =>
    linearToSrgb(srgbToLinear(s) * alpha + srgbToLinear(d) * (1 - alpha));
  return { r: mix(src.r, dst.r), g: mix(src.g, dst.g), b: mix(src.b, dst.b) };
}

export default function AlphaBlendCompositor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [srcHex, setSrcHex] = useState('#0ea5e9'); // top layer (sky)
  const [dstHex, setDstHex] = useState('#facc15'); // background (amber)
  const [alpha, setAlpha] = useState(0.5);
  const [gamma, setGamma] = useState(true);
  const draggingRef = useRef(false);
  const sizeRef = useRef({ w: 480, h: 200, stripX: 16, stripY: 24, stripW: 448, stripH: 64 });

  const src = hexToRgb(srcHex);
  const dst = hexToRgb(dstHex);
  const result = composite(src, dst, alpha, gamma);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h, stripX, stripY, stripW, stripH } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);

    // gradient strip: alpha 0 (left) .. 1 (right) in the CURRENT blend mode
    const steps = Math.max(48, Math.floor(stripW));
    for (let i = 0; i < steps; i++) {
      const aa = i / (steps - 1);
      const c = composite(src, dst, aa, gamma);
      ctx.fillStyle = rgbToHex(c);
      ctx.fillRect(stripX + (i / steps) * stripW, stripY, stripW / steps + 1, stripH);
    }
    ctx.strokeStyle = 'rgba(128,128,128,0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(stripX, stripY, stripW, stripH);

    // draggable handle at current alpha
    const hx = stripX + alpha * stripW;
    ctx.strokeStyle = BRAND;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(hx, stripY - 6);
    ctx.lineTo(hx, stripY + stripH + 6);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(hx, stripY + stripH + 6, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = BRAND;
    ctx.stroke();

    // endpoint labels
    ctx.font = '600 12px Inter, sans-serif';
    ctx.fillStyle = 'rgba(128,128,128,0.95)';
    ctx.fillText('alpha 0 (background)', stripX, stripY - 10);
    const rightLabel = 'alpha 1 (top color)';
    ctx.fillText(rightLabel, stripX + stripW - ctx.measureText(rightLabel).width, stripY - 10);
  };

  // responsive sizing with devicePixelRatio
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 560);
      const h = 130;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const stripX = 16;
      const stripW = w - 32;
      sizeRef.current = { w, h, stripX, stripY: 28, stripW, stripH: 64 };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(draw, [srcHex, dstHex, alpha, gamma]);

  // pointer dragging sets alpha from x position on the strip
  const setAlphaFromEvent = (e: PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const { stripX, stripW } = sizeRef.current;
    const px = e.clientX - rect.left;
    setAlpha(Math.max(0, Math.min(1, (px - stripX) / stripW)));
  };
  const onDown = (e: PointerEvent) => {
    draggingRef.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
    setAlphaFromEvent(e);
  };
  const onMove = (e: PointerEvent) => {
    if (draggingRef.current) setAlphaFromEvent(e);
  };
  const onUp = () => {
    draggingRef.current = false;
  };

  const naive = composite(src, dst, alpha, false);
  const linear = composite(src, dst, alpha, true);
  const a255 = Math.round(alpha * 255);

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setGamma(true)}
          class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
            gamma ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
          }`}
        >
          Gamma-correct (linear)
        </button>
        <button
          onClick={() => setGamma(false)}
          class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
            !gamma ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
          }`}
        >
          Naive (raw sRGB)
        </button>
      </div>

      <canvas
        ref={canvasRef}
        class="touch-none rounded-xl bg-surface-2"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      />

      <div class="mt-3 grid gap-4 md:grid-cols-[1fr,auto] md:items-start">
        <div class="space-y-3 text-sm">
          <label class="block">
            <span class="mb-1 block text-muted">top-layer alpha = {alpha.toFixed(2)} ({a255}/255)</span>
            <input
              type="range" min={0} max={1} step={0.01} value={alpha}
              onInput={(e) => setAlpha(parseFloat((e.target as HTMLInputElement).value))}
              class="w-full accent-[#4f46e5]"
            />
          </label>
          <div class="flex flex-wrap gap-4">
            <label class="flex items-center gap-2">
              <span class="text-muted">top color</span>
              <input type="color" value={srcHex} onInput={(e) => setSrcHex((e.target as HTMLInputElement).value)} class="h-7 w-10 cursor-pointer rounded" />
              <span class="font-mono text-xs">{srcHex}</span>
            </label>
            <label class="flex items-center gap-2">
              <span class="text-muted">background</span>
              <input type="color" value={dstHex} onInput={(e) => setDstHex((e.target as HTMLInputElement).value)} class="h-7 w-10 cursor-pointer rounded" />
              <span class="font-mono text-xs">{dstHex}</span>
            </label>
          </div>
        </div>

        <div class="space-y-2 text-sm">
          <div class="flex items-center gap-3">
            <div class="h-14 w-14 rounded-lg border border-border" style={`background:${rgbToHex(result)}`} />
            <div>
              <div class="text-muted text-xs">composited result</div>
              <div class="font-mono font-semibold">
                rgba({Math.round(result.r)}, {Math.round(result.g)}, {Math.round(result.b)}, {alpha.toFixed(2)})
              </div>
              <div class="font-mono text-xs text-muted">{rgbToHex(result)}</div>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <Readout label="naive" value={rgbToHex(naive)} color={rgbToHex(naive)} />
            <Readout label="linear" value={rgbToHex(linear)} color={rgbToHex(linear)} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Readout({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div class="flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2">
      <span class="h-5 w-5 shrink-0 rounded border border-border" style={`background:${color}`} />
      <div>
        <div class="text-muted text-xs">{label}</div>
        <div class="font-mono text-xs font-semibold">{value}</div>
      </div>
    </div>
  );
}
