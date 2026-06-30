import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Fragment-shader sandbox.
   - Each pixel computes its OWN color from its (u, v) in [0,1] — just
     like a fragment shader, but written in JS and run via ImageData.
   - Two "uniforms" you control with sliders: frequency and phase.
   - We compute on a small buffer and scale up for speed, mimicking a
     GPU running the same tiny program across thousands of fragments.
   ------------------------------------------------------------------ */

type Pattern = 'plasma' | 'stripes' | 'gradient';

// small offscreen buffer — the "fragments" we shade per frame
const BW = 160;
const BH = 110;

export default function FragmentShaderSandbox() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bufRef = useRef<HTMLCanvasElement | null>(null);
  const imgRef = useRef<ImageData | null>(null);
  const rafRef = useRef<number | null>(null);
  const sizeRef = useRef({ w: 480, h: 330 });

  const [freq, setFreq] = useState(8);
  const [phase, setPhase] = useState(0);
  const [pattern, setPattern] = useState<Pattern>('plasma');
  const [animate, setAnimate] = useState(false);

  // refs so the animation loop always reads fresh values without restarting
  const stateRef = useRef({ freq, phase, pattern });
  stateRef.current = { freq, phase, pattern };

  // ---- the "fragment shader": color for one pixel from its (u, v) ----
  const shade = (u: number, v: number, f: number, p: number, pat: Pattern) => {
    if (pat === 'gradient') {
      return [u, v, 0.5 + 0.5 * Math.sin(p)] as const;
    }
    if (pat === 'stripes') {
      const s = 0.5 + 0.5 * Math.sin((u + v) * f + p);
      return [s, s * 0.6, 1 - s] as const;
    }
    // plasma: sum of a few sine waves, like a classic demoscene effect
    const a = Math.sin(u * f + p);
    const b = Math.sin(v * f - p * 0.7);
    const c = Math.sin((u + v) * f * 0.5 + p);
    const d = Math.sin(Math.hypot(u - 0.5, v - 0.5) * f * 2 - p);
    const r = 0.5 + 0.5 * Math.sin(a + d);
    const g = 0.5 + 0.5 * Math.sin(b + c);
    const bl = 0.5 + 0.5 * Math.sin(c - a);
    return [r, g, bl] as const;
  };

  const renderBuffer = () => {
    const buf = bufRef.current;
    const img = imgRef.current;
    if (!buf || !img) return;
    const { freq: f, phase: p, pattern: pat } = stateRef.current;
    const data = img.data;
    let i = 0;
    for (let y = 0; y < BH; y++) {
      const v = y / (BH - 1);
      for (let x = 0; x < BW; x++) {
        const u = x / (BW - 1);
        const [r, g, b] = shade(u, v, f, p, pat);
        data[i++] = Math.max(0, Math.min(255, r * 255)) | 0;
        data[i++] = Math.max(0, Math.min(255, g * 255)) | 0;
        data[i++] = Math.max(0, Math.min(255, b * 255)) | 0;
        data[i++] = 255;
      }
    }
    const bctx = buf.getContext('2d');
    if (bctx) bctx.putImageData(img, 0, 0);
    blit();
  };

  // scale the small buffer up onto the visible canvas (smooth interpolation)
  const blit = () => {
    const canvas = canvasRef.current;
    const buf = bufRef.current;
    if (!canvas || !buf) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.imageSmoothingEnabled = true;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(buf, 0, 0, BW, BH, 0, 0, w, h);
  };

  // ---- one-time buffer + responsive sizing with devicePixelRatio ----
  useEffect(() => {
    const buf = document.createElement('canvas');
    buf.width = BW;
    buf.height = BH;
    bufRef.current = buf;
    const bctx = buf.getContext('2d');
    imgRef.current = bctx ? bctx.createImageData(BW, BH) : null;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 560);
      const h = Math.round(w * 0.68);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w, h };
      renderBuffer();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // redraw when the "uniforms" change
  useEffect(() => {
    renderBuffer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [freq, phase, pattern]);

  // optional animation: advance the phase each frame, cancel on unmount
  useEffect(() => {
    if (!animate) return;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setPhase((p) => (p + dt * 1.5) % (Math.PI * 2));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [animate]);

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap gap-2">
        {(['plasma', 'stripes', 'gradient'] as Pattern[]).map((p) => (
          <button
            key={p}
            onClick={() => setPattern(p)}
            class={`rounded-lg px-3 py-1.5 text-sm font-semibold capitalize transition ${
              pattern === p ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
            }`}
          >
            {p}
          </button>
        ))}
        <button
          onClick={() => setAnimate((a) => !a)}
          class={`ml-auto rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
            animate ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
          }`}
        >
          {animate ? 'Pause' : 'Animate'}
        </button>
      </div>

      <div class="grid gap-4 md:grid-cols-[1fr,auto] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

        <div class="space-y-3 text-sm md:w-56">
          <p class="text-muted">
            Every pixel runs the same little formula on its own (u, v). The sliders are the shader's
            uniforms — they change for all pixels at once.
          </p>

          <label class="block">
            <span class="mb-1 block text-muted">frequency = {freq.toFixed(1)}</span>
            <input
              type="range" min={1} max={24} step={0.1} value={freq}
              onInput={(e) => setFreq(parseFloat((e.target as HTMLInputElement).value))}
              class="w-full accent-[#4f46e5]"
            />
          </label>

          <label class="block">
            <span class="mb-1 block text-muted">phase = {phase.toFixed(2)}</span>
            <input
              type="range" min={0} max={6.28} step={0.01} value={phase}
              onInput={(e) => setPhase(parseFloat((e.target as HTMLInputElement).value))}
              class="w-full accent-[#0ea5e9]"
            />
          </label>

          <div class="grid grid-cols-2 gap-2">
            <Readout label="fragments" value={`${BW}×${BH}`} />
            <Readout label="total" value={(BW * BH).toLocaleString()} />
          </div>
          <p class="text-xs text-muted">
            That is {(BW * BH).toLocaleString()} independent pixel programs per frame — and a real GPU
            shades millions, all in parallel.
          </p>
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
