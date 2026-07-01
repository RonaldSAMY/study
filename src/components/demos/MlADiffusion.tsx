import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Diffusion, forward then reverse, on a 2D point cloud.
   - Pick a shape. Forward process (t: 0 -> T) adds Gaussian noise until
     the cloud is pure noise:  x_t = sqrt(aBar_t) x0 + sqrt(1-aBar_t) eps.
   - Reverse process (t: T -> 0) walks the SAME timeline backward — the
     learned denoiser recovering the shape from noise.
   - Frame index runs 0..2T: first half noises, second half denoises.
   - Transport: Play / Pause / Step / Back / Reset + speed.
   ------------------------------------------------------------------ */

const T = 40;
const N = 260; // points
const COLORS = { pt: '#4f46e5', noise: '#0ea5e9', clean: '#10b981' };

type Shape = 'ring' | 'clusters' | 'spiral';

function makeShape(shape: Shape): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < N; i++) {
    const u = i / N;
    if (shape === 'ring') {
      const a = u * Math.PI * 2; pts.push({ x: Math.cos(a) * 0.6, y: Math.sin(a) * 0.6 });
    } else if (shape === 'clusters') {
      const c = i % 3; const cx = [-0.5, 0.5, 0][c]; const cy = [-0.4, -0.4, 0.5][c];
      pts.push({ x: cx + (Math.random() - 0.5) * 0.28, y: cy + (Math.random() - 0.5) * 0.28 });
    } else {
      const a = u * Math.PI * 4; const r = 0.12 + u * 0.55; pts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
    }
  }
  return pts;
}

// linear beta schedule -> cumulative alpha-bar
function alphaBars(): number[] {
  const betas = Array.from({ length: T }, (_, t) => 0.0001 + (0.05 - 0.0001) * (t / (T - 1)));
  const out: number[] = []; let cp = 1;
  for (const b of betas) { cp *= 1 - b; out.push(cp); }
  return out;
}
const AB = alphaBars();

function randn() { const u = Math.random() || 1e-9, v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

export default function MlADiffusion() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ s: 320 });
  const rafRef = useRef<number | null>(null);

  const [shape, setShape] = useState<Shape>('ring');
  const [frame, setFrame] = useState(0); // 0..2T
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const lastRef = useRef(0);
  const frameRef = useRef(0);
  frameRef.current = frame;

  // fixed base points + fixed per-point noise so the animation is smooth & reversible
  const dataRef = useRef<{ x0: { x: number; y: number }[]; eps: { x: number; y: number }[] }>({ x0: [], eps: [] });
  useEffect(() => {
    const x0 = makeShape(shape);
    const eps = Array.from({ length: N }, () => ({ x: randn(), y: randn() }));
    dataRef.current = { x0, eps };
    setFrame(0); setPlaying(false);
    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shape]);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const s = sizeRef.current.s;
    ctx.clearRect(0, 0, s, s);
    const { x0, eps } = dataRef.current;
    if (!x0.length) return;
    const f = frameRef.current;
    const t = f <= T ? f : 2 * T - f; // timeline index 0..T
    const ab = AB[Math.min(t, T - 1)];
    const sa = Math.sqrt(ab), sn = Math.sqrt(1 - ab);
    const toPx = (v: number) => s / 2 + v * (s * 0.4);
    const noisiness = t / T;
    // colour blends clean(green) -> noise(blue) with t
    const r = Math.round(16 + (14 - 16) * noisiness);
    const g = Math.round(185 + (165 - 185) * noisiness);
    const b = Math.round(129 + (233 - 129) * noisiness);
    ctx.fillStyle = `rgba(${r},${g},${b},0.8)`;
    for (let i = 0; i < N; i++) {
      const x = sa * x0[i].x + sn * eps[i].x * 0.6;
      const y = sa * x0[i].y + sn * eps[i].y * 0.6;
      ctx.beginPath();
      ctx.arc(toPx(x), toPx(y), 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const s = Math.min(parent.clientWidth, 360);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = s * dpr; canvas.height = s * dpr;
      canvas.style.width = `${s}px`; canvas.style.height = `${s}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { s };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => { window.removeEventListener('resize', resize); if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(draw, [frame]);

  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 90 / speed;
    const tick = (tm: number) => {
      if (!lastRef.current) lastRef.current = tm;
      if (tm - lastRef.current >= interval) {
        lastRef.current = tm;
        const next = frameRef.current + 1;
        if (next > 2 * T) { setFrame(2 * T); setPlaying(false); return; }
        setFrame(next);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
  }, [playing, speed]);

  const reset = () => { setPlaying(false); setFrame(0); lastRef.current = 0; };
  const stepF = () => { setPlaying(false); setFrame((v) => Math.min(2 * T, v + 1)); };
  const stepB = () => { setPlaying(false); setFrame((v) => Math.max(0, v - 1)); };
  const play = () => { if (frame >= 2 * T) setFrame(0); lastRef.current = 0; setPlaying((p) => !p); };

  const t = frame <= T ? frame : 2 * T - frame;
  const forward = frame <= T;
  const caption = frame === 0
    ? 'Step 0: the clean data. Press Play to add noise, then watch it denoise back.'
    : forward
      ? `Forward step ${t}/${T}: adding Gaussian noise. The structure is dissolving toward pure static.`
      : `Reverse step ${T - t}/${T}: the learned denoiser is removing noise, and the shape re-emerges.`;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        {(['ring', 'clusters', 'spiral'] as Shape[]).map((sh) => (
          <button key={sh} onClick={() => setShape(sh)} class={`rounded-lg px-3 py-1.5 text-sm font-semibold capitalize transition ${shape === sh ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'}`}>{sh}</button>
        ))}
        <span class="ml-auto rounded-md bg-surface-2 px-2 py-1 font-mono text-xs text-muted">{forward ? 'noising' : 'denoising'} · t={t}</span>
      </div>
      <canvas ref={canvasRef} class="mx-auto touch-none rounded-xl bg-surface-2" />
      <p class="mt-3 min-h-[3rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">{caption}</p>
      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={stepB} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏮ Back</button>
        <button onClick={play} class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90">{playing ? '⏸ Pause' : '▶ Play'}</button>
        <button onClick={stepF} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏭ Step</button>
        <button onClick={reset} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">↺ Reset</button>
        <label class="ml-auto flex items-center gap-2 text-xs text-muted">speed
          <input type="range" min={0.5} max={3} step={0.5} value={speed} onInput={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))} class="w-24 accent-[#4f46e5]" />
        </label>
      </div>
      <p class="mt-2 text-center text-xs text-muted">Forward noising is fixed math; only the reverse denoiser is learned. Same schedule runs both ways here.</p>
    </div>
  );
}
