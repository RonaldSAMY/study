import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   SGD vs Momentum vs Adam rolling down an ill-conditioned loss bowl.
   - Loss L(x,y) = 0.5*(a*x^2 + b*y^2) with a >> b: a narrow, steep valley.
   - Three optimizers start at the same point; watch how each descends:
       SGD zig-zags, Momentum builds speed, Adam normalizes per-axis.
   - Drag the learning-rate slider; click the surface to move the start.
   - Transport: Play / Pause / Step / Back / Reset + speed.
   ------------------------------------------------------------------ */

const A = 6, B = 0.4;   // curvature: steep in x, shallow in y
const STEPS = 60;
const COLORS = { sgd: '#4f46e5', mom: '#0ea5e9', adam: '#10b981' };
const loss = (x: number, y: number) => 0.5 * (A * x * x + B * y * y);
const grad = (x: number, y: number) => [A * x, B * y];

type Traj = { pts: [number, number][] };

function run(sx: number, sy: number, lr: number): { sgd: Traj; mom: Traj; adam: Traj } {
  const sgd: [number, number][] = [[sx, sy]];
  const mom: [number, number][] = [[sx, sy]];
  const adam: [number, number][] = [[sx, sy]];
  let g = { x: sx, y: sy };
  let m = { x: sx, y: sy }, mv = { x: 0, y: 0 };
  let a = { x: sx, y: sy }, am = { x: 0, y: 0 }, av = { x: 0, y: 0 };
  const b1 = 0.9, b2 = 0.999, eps = 1e-8;
  for (let t = 1; t <= STEPS; t++) {
    // plain SGD
    let [gx, gy] = grad(g.x, g.y); g = { x: g.x - lr * gx, y: g.y - lr * gy }; sgd.push([g.x, g.y]);
    // momentum
    [gx, gy] = grad(m.x, m.y); mv = { x: 0.9 * mv.x + gx, y: 0.9 * mv.y + gy }; m = { x: m.x - lr * mv.x, y: m.y - lr * mv.y }; mom.push([m.x, m.y]);
    // adam
    [gx, gy] = grad(a.x, a.y);
    am = { x: b1 * am.x + (1 - b1) * gx, y: b1 * am.y + (1 - b1) * gy };
    av = { x: b2 * av.x + (1 - b2) * gx * gx, y: b2 * av.y + (1 - b2) * gy * gy };
    const mhx = am.x / (1 - b1 ** t), mhy = am.y / (1 - b1 ** t);
    const vhx = av.x / (1 - b2 ** t), vhy = av.y / (1 - b2 ** t);
    a = { x: a.x - (lr * 8) * mhx / (Math.sqrt(vhx) + eps), y: a.y - (lr * 8) * mhy / (Math.sqrt(vhy) + eps) };
    adam.push([a.x, a.y]);
  }
  return { sgd: { pts: sgd }, mom: { pts: mom }, adam: { pts: adam } };
}

export default function MlAOptimizerDescent() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ s: 360 });
  const rafRef = useRef<number | null>(null);
  const RANGE = 2.4; // world coords span [-RANGE, RANGE]

  const [start, setStart] = useState<[number, number]>([-1.9, 2.1]);
  const [lr, setLr] = useState(0.06);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const lastRef = useRef(0);
  const stepRef = useRef(0);
  stepRef.current = step;

  const trajs = run(start[0], start[1], lr);
  const trajRef = useRef(trajs);
  trajRef.current = trajs;

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const s = sizeRef.current.s;
    const toPx = (wx: number, wy: number) => [s / 2 + (wx / RANGE) * (s / 2), s / 2 - (wy / RANGE) * (s / 2)];
    // heatmap background
    const cells = 60, cs = s / cells;
    let maxL = loss(RANGE, RANGE);
    for (let i = 0; i < cells; i++) for (let j = 0; j < cells; j++) {
      const wx = (i / cells * 2 - 1) * RANGE, wy = -(j / cells * 2 - 1) * RANGE;
      const l = loss(wx, wy) / maxL;
      const shade = Math.pow(l, 0.4);
      const r = Math.round(30 + shade * 40), g = Math.round(35 + shade * 45), b = Math.round(60 + shade * 90);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(i * cs, j * cs, cs + 1, cs + 1);
    }
    // minimum marker
    const [ox, oy] = toPx(0, 0);
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(ox - 6, oy); ctx.lineTo(ox + 6, oy); ctx.moveTo(ox, oy - 6); ctx.lineTo(ox, oy + 6); ctx.stroke();

    const drawTraj = (pts: [number, number][], color: string) => {
      const upto = Math.min(stepRef.current, pts.length - 1);
      ctx.strokeStyle = color; ctx.lineWidth = 2.2; ctx.lineJoin = 'round';
      ctx.beginPath();
      for (let i = 0; i <= upto; i++) { const [px, py] = toPx(pts[i][0], pts[i][1]); i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py); }
      ctx.stroke();
      const [hx, hy] = toPx(pts[upto][0], pts[upto][1]);
      ctx.beginPath(); ctx.arc(hx, hy, 4.5, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
      ctx.lineWidth = 1.5; ctx.strokeStyle = '#fff'; ctx.stroke();
    };
    drawTraj(trajRef.current.sgd.pts, COLORS.sgd);
    drawTraj(trajRef.current.mom.pts, COLORS.mom);
    drawTraj(trajRef.current.adam.pts, COLORS.adam);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const s = Math.min(parent.clientWidth, 380);
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

  useEffect(draw, [step, start, lr]);

  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 160 / speed;
    const tick = (tm: number) => {
      if (!lastRef.current) lastRef.current = tm;
      if (tm - lastRef.current >= interval) {
        lastRef.current = tm;
        const next = stepRef.current + 1;
        if (next > STEPS) { setStep(STEPS); setPlaying(false); return; }
        setStep(next);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
  }, [playing, speed]);

  const onClick = (e: PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const s = sizeRef.current.s;
    const wx = ((e.clientX - rect.left) - s / 2) / (s / 2) * RANGE;
    const wy = -((e.clientY - rect.top) - s / 2) / (s / 2) * RANGE;
    setStart([Math.max(-RANGE, Math.min(RANGE, wx)), Math.max(-RANGE, Math.min(RANGE, wy))]);
    setStep(0); setPlaying(false);
  };

  const reset = () => { setPlaying(false); setStep(0); lastRef.current = 0; };
  const stepF = () => { setPlaying(false); setStep((v) => Math.min(STEPS, v + 1)); };
  const stepB = () => { setPlaying(false); setStep((v) => Math.max(0, v - 1)); };
  const play = () => { if (step >= STEPS) setStep(0); lastRef.current = 0; setPlaying((p) => !p); };

  const dist = (tr: Traj) => { const p = tr.pts[Math.min(step, STEPS)]; return Math.hypot(p[0], p[1]); };

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" onPointerDown={onClick} />
        <div class="space-y-2 text-sm">
          <p class="text-muted">A steep, narrow valley (steep in x, shallow in y). Click to move the start; drag the learning rate.</p>
          <div class="space-y-1">
            <Row color={COLORS.sgd} label="SGD" v={dist(trajs.sgd)} />
            <Row color={COLORS.mom} label="Momentum" v={dist(trajs.mom)} />
            <Row color={COLORS.adam} label="Adam" v={dist(trajs.adam)} />
          </div>
          <label class="block text-xs text-muted">learning rate: {lr.toFixed(3)}
            <input type="range" min={0.01} max={0.16} step={0.005} value={lr} onInput={(e) => { setLr(parseFloat((e.target as HTMLInputElement).value)); setStep(0); setPlaying(false); }} class="mt-1 w-full accent-[#4f46e5]" />
          </label>
          <p class="rounded-lg bg-surface-2 p-2 text-xs text-muted">Distance-to-minimum for each optimizer at step {step}. Push the learning rate up until SGD diverges (shoots off) while Adam stays stable.</p>
        </div>
      </div>
      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={stepB} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏮ Back</button>
        <button onClick={play} class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90">{playing ? '⏸ Pause' : '▶ Play'}</button>
        <button onClick={stepF} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏭ Step</button>
        <button onClick={reset} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">↺ Reset</button>
        <span class="ml-1 rounded-md bg-surface-2 px-2 py-1 font-mono text-xs text-muted">step {step}/{STEPS}</span>
        <label class="ml-auto flex items-center gap-2 text-xs text-muted">speed
          <input type="range" min={0.5} max={3} step={0.5} value={speed} onInput={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))} class="w-24 accent-[#4f46e5]" />
        </label>
      </div>
    </div>
  );
}

function Row({ color, label, v }: { color: string; label: string; v: number }) {
  return (
    <div class="flex items-center gap-2">
      <span class="inline-block h-3 w-3 rounded-full" style={`background:${color}`}></span>
      <span class="w-24 font-semibold">{label}</span>
      <span class="font-mono text-xs text-muted">dist {v.toFixed(3)}</span>
    </div>
  );
}
