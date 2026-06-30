import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Policy-gradient ascent lab (a robot learning to aim).
   - The policy is a Gaussian π(a) = N(μ, σ) over a continuous action a
     (where to aim). The reward landscape peaks at a hidden target.
   - Each "step" samples actions, then nudges μ along the REINFORCE
     gradient  μ ← μ + lr · E[ R(a) · (a − μ)/σ² ]  to climb the curve.
   - "Run" animates many steps; the animation frame is cleaned up.
   ------------------------------------------------------------------ */

const COLORS = { policy: '#4f46e5', reward: '#10b981', sample: '#0ea5e9', target: '#ef4444' };

// action space mapped to [-6, 6]
const A_MIN = -6, A_MAX = 6;
const rewardFn = (a: number, target: number) => Math.exp(-((a - target) ** 2) / 4);

export default function PolicyGradientAscentLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 480, h: 300 });
  const rafRef = useRef<number | null>(null);
  const muRef = useRef(-4);
  const [, force] = useState(0);
  const [target, setTarget] = useState(2.5);
  const [lr, setLr] = useState(0.6);
  const [sigma, setSigma] = useState(1.2);
  const [steps, setSteps] = useState(0);
  const [expR, setExpR] = useState(0);
  const [samples, setSamples] = useState<number[]>([]);
  const [running, setRunning] = useState(false);

  const gaussSample = (mu: number, sd: number) => {
    const u1 = Math.random() || 1e-9, u2 = Math.random();
    return mu + sd * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  };

  const step = () => {
    const N = 24;
    const drawn: number[] = [];
    let gradSum = 0, rSum = 0;
    for (let i = 0; i < N; i++) {
      const a = gaussSample(muRef.current, sigma);
      const r = rewardFn(a, target);
      drawn.push(a);
      gradSum += r * (a - muRef.current) / (sigma * sigma);
      rSum += r;
    }
    muRef.current += (lr * gradSum) / N;
    muRef.current = Math.max(A_MIN, Math.min(A_MAX, muRef.current));
    setSamples(drawn);
    setExpR(rSum / N);
    setSteps((s) => s + 1);
    force((x) => x + 1);
  };

  const run = () => {
    if (running) return;
    setRunning(true);
    let count = 0;
    const loop = () => {
      step();
      count++;
      if (count >= 60) { setRunning(false); rafRef.current = null; return; }
      const start = performance.now();
      const wait = () => {
        if (performance.now() - start > 90) rafRef.current = requestAnimationFrame(loop);
        else rafRef.current = requestAnimationFrame(wait);
      };
      rafRef.current = requestAnimationFrame(wait);
    };
    loop();
  };

  const reset = () => {
    muRef.current = -4;
    setSteps(0); setExpR(0); setSamples([]);
    force((x) => x + 1);
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);
    const pad = 28;
    const x0 = pad, x1 = w - pad, y0 = h - pad, yTop = 16;
    const ax = (a: number) => x0 + ((a - A_MIN) / (A_MAX - A_MIN)) * (x1 - x0);
    const ay = (v: number) => y0 - v * (y0 - yTop); // v in [0,1]

    // axis
    ctx.strokeStyle = 'rgba(128,128,128,0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y0); ctx.stroke();

    // reward landscape
    ctx.strokeStyle = COLORS.reward;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let px = x0; px <= x1; px += 2) {
      const a = A_MIN + ((px - x0) / (x1 - x0)) * (A_MAX - A_MIN);
      const v = rewardFn(a, target);
      px === x0 ? ctx.moveTo(px, ay(v)) : ctx.lineTo(px, ay(v));
    }
    ctx.stroke();

    // policy gaussian (normalized to peak 1 for display)
    const mu = muRef.current;
    ctx.strokeStyle = COLORS.policy;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let px = x0; px <= x1; px += 2) {
      const a = A_MIN + ((px - x0) / (x1 - x0)) * (A_MAX - A_MIN);
      const v = Math.exp(-((a - mu) ** 2) / (2 * sigma * sigma));
      px === x0 ? ctx.moveTo(px, ay(v)) : ctx.lineTo(px, ay(v));
    }
    ctx.stroke();

    // samples
    ctx.fillStyle = COLORS.sample;
    samples.forEach((a) => {
      ctx.beginPath();
      ctx.arc(ax(a), y0 - 6, 3.5, 0, Math.PI * 2);
      ctx.fill();
    });

    // target marker
    ctx.strokeStyle = COLORS.target;
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(ax(target), y0); ctx.lineTo(ax(target), yTop); ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = '20px serif';
    ctx.fillText('🎯', ax(target) - 11, yTop + 4);

    // mu marker
    ctx.fillStyle = COLORS.policy;
    ctx.beginPath();
    ctx.arc(ax(mu), y0, 5, 0, Math.PI * 2);
    ctx.fill();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 540);
      const h = Math.round(w * 0.6);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w, h };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(draw);

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

        <div class="space-y-3 text-sm">
          <p class="text-muted">
            <span style="color:#4f46e5" class="font-semibold">Indigo</span> = the policy π(a); <span style="color:#10b981" class="font-semibold">green</span> = the reward landscape. Each step ascends the gradient toward the 🎯.
          </p>

          <div class="flex flex-wrap gap-2">
            <button class="rounded-lg bg-brand px-3 py-1.5 font-semibold text-white disabled:opacity-50" disabled={running} onClick={step}>Step ▲</button>
            <button class="rounded-lg bg-surface-2 px-3 py-1.5 font-semibold text-muted hover:text-text disabled:opacity-50" disabled={running} onClick={run}>Run</button>
            <button class="rounded-lg bg-surface-2 px-3 py-1.5 font-semibold text-muted hover:text-text disabled:opacity-50" disabled={running} onClick={reset}>Reset</button>
          </div>

          <label class="block">
            <span class="mb-1 block text-muted">target location</span>
            <input type="range" min={-5} max={5} step={0.5} value={target}
              onInput={(e) => setTarget(parseFloat((e.target as HTMLInputElement).value))}
              class="w-full accent-[#ef4444]" />
          </label>
          <label class="block">
            <span class="mb-1 block text-muted">learning rate = {lr.toFixed(2)}</span>
            <input type="range" min={0.1} max={1.5} step={0.1} value={lr}
              onInput={(e) => setLr(parseFloat((e.target as HTMLInputElement).value))}
              class="w-full accent-[#4f46e5]" />
          </label>
          <label class="block">
            <span class="mb-1 block text-muted">policy spread σ = {sigma.toFixed(1)}</span>
            <input type="range" min={0.4} max={2.5} step={0.1} value={sigma}
              onInput={(e) => setSigma(parseFloat((e.target as HTMLInputElement).value))}
              class="w-full accent-[#0ea5e9]" />
          </label>

          <div class="grid grid-cols-2 gap-2">
            <PgReadout label="steps" value={`${steps}`} />
            <PgReadout label="expected reward" value={expR.toFixed(3)} />
          </div>
        </div>
      </div>
    </div>
  );
}

function PgReadout({ label, value }: { label: string; value: string }) {
  return (
    <div class="rounded-lg bg-surface-2 px-3 py-2">
      <span class="text-muted text-xs">{label}</span>
      <div class="font-mono font-semibold">{value}</div>
    </div>
  );
}
