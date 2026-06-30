import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Optimizer descent race (audio / EQ-tuning framing).
   A 2-D loss surface  L(x, y) = 0.5 (x^2 + 10 y^2)  — a narrow valley
   (think: tuning two EQ gains where one matters far more than the other).
   Pick an optimizer and a learning rate, hit Run, and watch the path
   descend. The narrow direction makes SGD zig-zag while momentum,
   RMSprop and Adam handle it more gracefully.
   ------------------------------------------------------------------ */

type Opt = 'sgd' | 'momentum' | 'rmsprop' | 'adam';
type P = { x: number; y: number };

const COLORS = { path: '#10b981', dot: '#4f46e5', min: '#ef4444' };
const START: P = { x: -4.2, y: 1.5 };
const MAX_STEPS = 160;
const XR = 5, YR = 2; // window: x in [-XR,XR], y in [-YR,YR]

const loss = (x: number, y: number) => 0.5 * (x * x + 10 * y * y);
const grad = (x: number, y: number): P => ({ x, y: 10 * y });

export default function OptimizerDescentRace() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [opt, setOpt] = useState<Opt>('sgd');
  const [lr, setLr] = useState(0.08);
  const [running, setRunning] = useState(false);
  const [stepN, setStepN] = useState(0);

  const sizeRef = useRef({ w: 480, h: 300, ox: 240, oy: 150, sx: 48, sy: 75 });
  const pathRef = useRef<P[]>([{ ...START }]);
  const stateRef = useRef({ p: { ...START }, m: { x: 0, y: 0 }, v: { x: 0, y: 0 }, t: 0 });
  const rafRef = useRef<number | null>(null);

  const toPx = (p: P) => {
    const { ox, oy, sx, sy } = sizeRef.current;
    return { x: ox + p.x * sx, y: oy - p.y * sy };
  };

  const drawBg = (ctx: CanvasRenderingContext2D) => {
    const { w, h, ox, oy, sx, sy } = sizeRef.current;
    // shade by loss value
    const cell = 10;
    let lmax = loss(XR, YR);
    for (let px = 0; px < w; px += cell) {
      for (let py = 0; py < h; py += cell) {
        const mx = (px + cell / 2 - ox) / sx;
        const my = (oy - (py + cell / 2)) / sy;
        const v = Math.min(1, loss(mx, my) / lmax);
        const shade = 0.05 + 0.32 * v;
        ctx.fillStyle = `rgba(79,70,229,${shade.toFixed(3)})`;
        ctx.fillRect(px, py, cell, cell);
      }
    }
    // contour rings
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    for (const level of [0.5, 2, 5, 10, 20]) {
      ctx.beginPath();
      for (let a = 0; a <= Math.PI * 2 + 0.1; a += 0.1) {
        // ellipse for 0.5(x^2+10y^2)=level -> x^2/(2L)+y^2/(2L/10)=1
        const ax = Math.sqrt(2 * level), ay = Math.sqrt(2 * level / 10);
        const p = toPx({ x: ax * Math.cos(a), y: ay * Math.sin(a) });
        if (a === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }
    // minimum
    const mn = toPx({ x: 0, y: 0 });
    ctx.beginPath(); ctx.arc(mn.x, mn.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.min; ctx.fill();
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);
    drawBg(ctx);

    const path = pathRef.current;
    ctx.strokeStyle = COLORS.path; ctx.lineWidth = 2.5; ctx.beginPath();
    path.forEach((p, i) => {
      const q = toPx(p);
      if (i === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y);
    });
    ctx.stroke();
    // step dots
    ctx.fillStyle = COLORS.path;
    for (const p of path) { const q = toPx(p); ctx.beginPath(); ctx.arc(q.x, q.y, 2, 0, Math.PI * 2); ctx.fill(); }
    // current
    const cur = toPx(path[path.length - 1]);
    ctx.beginPath(); ctx.arc(cur.x, cur.y, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = COLORS.dot; ctx.stroke();
  };

  const stepOnce = () => {
    const st = stateRef.current;
    const g = grad(st.p.x, st.p.y);
    st.t += 1;
    if (opt === 'sgd') {
      st.p = { x: st.p.x - lr * g.x, y: st.p.y - lr * g.y };
    } else if (opt === 'momentum') {
      st.m = { x: 0.9 * st.m.x - lr * g.x, y: 0.9 * st.m.y - lr * g.y };
      st.p = { x: st.p.x + st.m.x, y: st.p.y + st.m.y };
    } else if (opt === 'rmsprop') {
      st.v = { x: 0.9 * st.v.x + 0.1 * g.x * g.x, y: 0.9 * st.v.y + 0.1 * g.y * g.y };
      st.p = { x: st.p.x - (lr * g.x) / (Math.sqrt(st.v.x) + 1e-8), y: st.p.y - (lr * g.y) / (Math.sqrt(st.v.y) + 1e-8) };
    } else {
      st.m = { x: 0.9 * st.m.x + 0.1 * g.x, y: 0.9 * st.m.y + 0.1 * g.y };
      st.v = { x: 0.999 * st.v.x + 0.001 * g.x * g.x, y: 0.999 * st.v.y + 0.001 * g.y * g.y };
      const mh = { x: st.m.x / (1 - 0.9 ** st.t), y: st.m.y / (1 - 0.9 ** st.t) };
      const vh = { x: st.v.x / (1 - 0.999 ** st.t), y: st.v.y / (1 - 0.999 ** st.t) };
      st.p = { x: st.p.x - (lr * mh.x) / (Math.sqrt(vh.x) + 1e-8), y: st.p.y - (lr * mh.y) / (Math.sqrt(vh.y) + 1e-8) };
    }
    // clamp so a diverging run stays drawable
    st.p.x = Math.max(-XR * 1.4, Math.min(XR * 1.4, st.p.x));
    st.p.y = Math.max(-YR * 1.4, Math.min(YR * 1.4, st.p.y));
    pathRef.current.push({ ...st.p });
  };

  const reset = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    setRunning(false);
    stateRef.current = { p: { ...START }, m: { x: 0, y: 0 }, v: { x: 0, y: 0 }, t: 0 };
    pathRef.current = [{ ...START }];
    setStepN(0);
    draw();
  };

  const run = () => {
    reset();
    setRunning(true);
    let frame = 0;
    const loop = () => {
      frame++;
      if (frame % 2 === 0) {
        stepOnce();
        setStepN(pathRef.current.length - 1);
        draw();
      }
      if (pathRef.current.length - 1 < MAX_STEPS) {
        rafRef.current = requestAnimationFrame(loop);
      } else {
        setRunning(false);
        rafRef.current = null;
      }
    };
    rafRef.current = requestAnimationFrame(loop);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 520);
      const h = Math.round(w * 0.6);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w, h, ox: w / 2, oy: h / 2, sx: w / (2 * XR), sy: h / (2 * YR) };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // reset when optimizer or lr changes
  useEffect(() => { reset(); }, [opt, lr]);

  const cur = pathRef.current[pathRef.current.length - 1];
  const curLoss = loss(cur.x, cur.y);

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap gap-2">
        {(['sgd', 'momentum', 'rmsprop', 'adam'] as Opt[]).map((o) => (
          <button
            key={o}
            onClick={() => setOpt(o)}
            class={`rounded-lg px-3 py-1.5 text-sm font-semibold uppercase transition ${
              opt === o ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
            }`}
          >
            {o}
          </button>
        ))}
      </div>
      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />
        <div class="space-y-3 text-sm">
          <p class="text-muted">
            The valley is steep along y and gentle along x. Run each optimizer and compare how directly
            it reaches the red minimum.
          </p>
          <label class="block">
            <span class="mb-1 block text-muted">learning rate = {lr.toFixed(3)}</span>
            <input
              type="range" min={0.005} max={0.22} step={0.005} value={lr}
              onInput={(e) => setLr(parseFloat((e.target as HTMLInputElement).value))}
              class="w-full accent-[#4f46e5]"
            />
          </label>
          <div class="flex gap-2">
            <button onClick={run} disabled={running}
              class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">
              {running ? 'Running…' : 'Run'}
            </button>
            <button onClick={reset}
              class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">
              Reset
            </button>
          </div>
          <div class="rounded-lg bg-surface-2 p-3 text-xs">
            <div class="flex justify-between"><span class="text-muted">step</span><strong>{stepN} / {MAX_STEPS}</strong></div>
            <div class="flex justify-between"><span class="text-muted">current loss</span><strong>{curLoss.toFixed(3)}</strong></div>
            <p class="mt-1 text-muted">
              {lr > 0.18 && opt === 'sgd'
                ? 'High lr + plain SGD → the path overshoots the narrow valley and oscillates.'
                : 'Lower the lr to stabilize; raise it to converge faster (until it overshoots).'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
