import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Diffusion forward/reverse process on a tiny image.
   x_t = sqrt(abar_t) * x_0 + sqrt(1 - abar_t) * eps,   eps ~ N(0, I)
   - Slide t from 0 (clean data) to 1 (pure noise).
   - The noise field eps is fixed, so sliding back and forth is the same
     trajectory: forward noising one way, (ideal) reverse denoising the other.
   ------------------------------------------------------------------ */

const RES = 46;

// deterministic data image (a little smiley) + fixed gaussian noise field
function buildData(): Float32Array {
  const d = new Float32Array(RES * RES * 3);
  for (let j = 0; j < RES; j++) {
    for (let i = 0; i < RES; i++) {
      const u = (i / (RES - 1)) * 2 - 1;
      const v = (j / (RES - 1)) * 2 - 1;
      const r = Math.sqrt(u * u + v * v);
      let cr = 30, cg = 41, cb = 59; // background slate
      if (r < 0.8) { cr = 251; cg = 191; cb = 36; } // face amber
      const eyeL = Math.hypot(u + 0.3, v - 0.28);
      const eyeR = Math.hypot(u - 0.3, v - 0.28);
      const mouth = Math.abs(Math.hypot(u, v - 0.05) - 0.45);
      if (eyeL < 0.11 || eyeR < 0.11) { cr = 30; cg = 30; cb = 40; }
      if (mouth < 0.07 && v < -0.05) { cr = 30; cg = 30; cb = 40; }
      const idx = (j * RES + i) * 3;
      d[idx] = cr; d[idx + 1] = cg; d[idx + 2] = cb;
    }
  }
  return d;
}

function randn(): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function buildNoise(): Float32Array {
  const n = new Float32Array(RES * RES * 3);
  for (let i = 0; i < n.length; i++) n[i] = randn();
  return n;
}

export default function DiffusionNoiserDemo() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dataRef = useRef<Float32Array | null>(null);
  const noiseRef = useRef<Float32Array | null>(null);
  const rafRef = useRef<number | null>(null);
  const runningRef = useRef(false);
  const dirRef = useRef(1);
  const tRef = useRef(0);
  const sizeRef = useRef({ s: 300 });

  const [t, setT] = useState(0);
  const [running, setRunning] = useState(false);

  if (!dataRef.current) dataRef.current = buildData();
  if (!noiseRef.current) noiseRef.current = buildNoise();

  // cosine schedule: abar(0)=1 (clean), abar(1)=0 (pure noise)
  const abarOf = (tt: number) => Math.cos((tt * Math.PI) / 2) ** 2;

  const render = (tt: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const data = dataRef.current!;
    const noise = noiseRef.current!;
    const { s } = sizeRef.current;
    const cell = s / RES;
    const abar = abarOf(tt);
    const sa = Math.sqrt(abar);
    const sn = Math.sqrt(1 - abar) * 60; // noise std in pixel units
    for (let j = 0; j < RES; j++) {
      for (let i = 0; i < RES; i++) {
        const idx = (j * RES + i) * 3;
        const r = Math.max(0, Math.min(255, sa * data[idx] + sn * noise[idx]));
        const g = Math.max(0, Math.min(255, sa * data[idx + 1] + sn * noise[idx + 1]));
        const b = Math.max(0, Math.min(255, sa * data[idx + 2] + sn * noise[idx + 2]));
        ctx.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
        ctx.fillRect(i * cell, j * cell, cell + 1, cell + 1);
      }
    }
  };

  const loop = () => {
    if (!runningRef.current) return;
    let nt = tRef.current + dirRef.current * 0.012;
    if (nt >= 1) { nt = 1; dirRef.current = -1; }
    if (nt <= 0) { nt = 0; dirRef.current = 1; }
    tRef.current = nt;
    setT(nt);
    render(nt);
    rafRef.current = requestAnimationFrame(loop);
  };

  const toggle = () => {
    const next = !runningRef.current;
    runningRef.current = next;
    setRunning(next);
    if (next) rafRef.current = requestAnimationFrame(loop);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const s = Math.max(200, Math.min(parent.clientWidth, 320));
      const dpr = window.devicePixelRatio || 1;
      canvas.width = s * dpr;
      canvas.height = s * dpr;
      canvas.style.width = `${s}px`;
      canvas.style.height = `${s}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { s };
      render(tRef.current);
    };
    resize();
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const abar = abarOf(t);
  const signal = abar;
  const noiseFrac = 1 - abar;
  const snr = noiseFrac > 1e-4 ? signal / noiseFrac : Infinity;
  const stepLabel = Math.round(t * 1000);

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <div class="text-center">
          <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />
          <p class="mt-1 text-xs text-muted">
            {t < 0.02 ? 'clean data x₀' : t > 0.98 ? 'pure noise x_T' : `noisy x_t`}
          </p>
        </div>

        <div class="space-y-3 text-sm">
          <div class="flex flex-wrap gap-2">
            <button
              onClick={toggle}
              class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white transition hover:opacity-90"
            >
              {running ? 'Pause' : 'Play forward ⇄ reverse'}
            </button>
          </div>
          <label class="block">
            <span class="mb-1 block text-muted">timestep t = {stepLabel} / 1000</span>
            <input
              type="range" min={0} max={1} step={0.005} value={t}
              onInput={(e) => {
                const v = parseFloat((e.target as HTMLInputElement).value);
                tRef.current = v;
                setT(v);
                render(v);
              }}
              class="w-full accent-[#4f46e5]"
            />
          </label>
          <div class="grid grid-cols-2 gap-2">
            <Stat label="signal ᾱ" value={signal.toFixed(3)} color="#10b981" />
            <Stat label="noise 1−ᾱ" value={noiseFrac.toFixed(3)} color="#0ea5e9" />
          </div>
          <div class="rounded-lg bg-surface-2 p-3 text-xs text-muted">
            Forward (left → right) gradually drowns the image in Gaussian noise on a fixed
            schedule. A diffusion model learns to run this <strong>backward</strong>:
            predict the noise, subtract a little, repeat — turning static into a picture.
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div class="rounded-lg bg-surface-2 px-3 py-2">
      <span class="text-muted" style={color ? `color:${color}` : ''}>
        {label}
      </span>
      <div class="font-mono font-semibold">{value}</div>
    </div>
  );
}
