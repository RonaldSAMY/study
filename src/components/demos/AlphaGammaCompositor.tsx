import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Alpha + gamma compositor.
   - Two layers (back + front) each with an RGB color; the front has an
     alpha you slide. We composite front over back.
   - Toggle gamma-correct blending: blend in LINEAR light, then encode
     back to sRGB — vs naively blending the stored sRGB bytes.
   - A 50%-alpha gradient strip shows the difference dramatically.
   ------------------------------------------------------------------ */

type RGB = [number, number, number];

const toLin = (c: number) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
};
const toSrgb = (l: number) => {
  const s = l <= 0.0031308 ? l * 12.92 : 1.055 * Math.pow(l, 1 / 2.4) - 0.055;
  return Math.round(Math.max(0, Math.min(1, s)) * 255);
};

function blend(back: RGB, front: RGB, a: number, gamma: boolean): RGB {
  if (gamma) {
    return [0, 1, 2].map((k) => {
      const lb = toLin(back[k]), lf = toLin(front[k]);
      return toSrgb(lf * a + lb * (1 - a));
    }) as RGB;
  }
  return [0, 1, 2].map((k) => Math.round(front[k] * a + back[k] * (1 - a))) as RGB;
}

const hueToRgb = (h: number): RGB => {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return Math.round(255 * (1 - Math.max(0, Math.min(k, 4 - k, 1))));
  };
  return [f(5), f(3), f(1)];
};

export default function AlphaGammaCompositor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 460, h: 240 });
  const [backHue, setBackHue] = useState(120);  // green
  const [frontHue, setFrontHue] = useState(0);   // red
  const [alpha, setAlpha] = useState(0.5);
  const [gamma, setGamma] = useState(false);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);
    const back = hueToRgb(backHue);
    const front = hueToRgb(frontHue);
    const mid = blend(back, front, alpha, gamma);

    // back layer
    ctx.fillStyle = `rgb(${back.join(',')})`;
    ctx.fillRect(0, 0, w, h * 0.62);
    // front layer overlapping center
    const fx = w * 0.25, fy = h * 0.12, fw = w * 0.5, fh = h * 0.5;
    ctx.fillStyle = `rgba(${front.join(',')},${alpha})`;
    // we composite manually to honor gamma toggle: fill blended region
    ctx.fillStyle = `rgb(${mid.join(',')})`;
    ctx.fillRect(fx, fy, fw, fh);
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(fx, fy, fw, fh);
    ctx.font = '600 12px Inter, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillText('front over back', fx + 8, fy + 18);

    // gradient strip: alpha 0..1 at the bottom
    const sy = h * 0.7, sh = h * 0.25;
    const strip = ctx.createImageData(w, 1);
    for (let x = 0; x < w; x++) {
      const a = x / (w - 1);
      const c = blend(back, front, a, gamma);
      strip.data[x * 4] = c[0]; strip.data[x * 4 + 1] = c[1];
      strip.data[x * 4 + 2] = c[2]; strip.data[x * 4 + 3] = 255;
    }
    // stretch the 1px-tall strip down
    const tmp = document.createElement('canvas');
    tmp.width = w; tmp.height = 1;
    tmp.getContext('2d')!.putImageData(strip, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(tmp, 0, 0, w, 1, 0, sy, w, sh);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, sy, 96, 16);
    ctx.fillStyle = '#fff';
    ctx.fillText('alpha 0 → 1', 6, sy + 12);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 520);
      const h = Math.round(w * 0.52);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr; canvas.height = h * dpr;
      canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w, h };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(draw, [backHue, frontHue, alpha, gamma]);

  const back = hueToRgb(backHue), front = hueToRgb(frontHue);
  const mid = blend(back, front, alpha, gamma);

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3">
        <button onClick={() => setGamma((g) => !g)}
          class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${gamma ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'}`}>
          Gamma-correct: {gamma ? 'on (linear blend)' : 'off (sRGB blend)'}
        </button>
      </div>
      <div class="grid gap-4 md:grid-cols-[1fr,auto] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />
        <div class="space-y-3 text-sm md:w-56">
          <label class="block">
            <span class="mb-1 block text-muted">back color (hue {backHue}°)</span>
            <input type="range" min={0} max={360} value={backHue}
              onInput={(e) => setBackHue(parseInt((e.target as HTMLInputElement).value))}
              class="w-full accent-[#10b981]" />
          </label>
          <label class="block">
            <span class="mb-1 block text-muted">front color (hue {frontHue}°)</span>
            <input type="range" min={0} max={360} value={frontHue}
              onInput={(e) => setFrontHue(parseInt((e.target as HTMLInputElement).value))}
              class="w-full accent-[#4f46e5]" />
          </label>
          <label class="block">
            <span class="mb-1 block text-muted">front alpha = {alpha.toFixed(2)}</span>
            <input type="range" min={0} max={1} step={0.01} value={alpha}
              onInput={(e) => setAlpha(parseFloat((e.target as HTMLInputElement).value))}
              class="w-full accent-[#0ea5e9]" />
          </label>
          <div class="rounded-lg bg-surface-2 p-3">
            <div class="flex items-center justify-between">
              <span class="text-muted">result</span>
              <span class="inline-block h-5 w-10 rounded" style={`background:rgb(${mid.join(',')})`} />
            </div>
            <div class="mt-1 font-mono text-xs">rgb({mid.join(', ')})</div>
          </div>
        </div>
      </div>
    </div>
  );
}
