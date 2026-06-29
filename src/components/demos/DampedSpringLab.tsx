import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Second-order linear ODE:  m·x'' + c·x' + k·x = 0  (mass-spring-damper).
   Sliders for stiffness k and damping c (mass fixed at 1).
   - Left: an animated mass bobbing on a spring + dashpot.
   - Right: its displacement-vs-time graph.
   The discriminant c² − 4mk decides under / critical / over damping.
   ------------------------------------------------------------------ */

const COLORS = {
  spring: '#4f46e5',
  mass: '#0ea5e9',
  curve: '#10b981',
  grid: 'rgba(128,128,128,0.16)',
  axis: 'rgba(128,128,128,0.5)',
};

const M = 1;
const X0 = 1;   // initial displacement
const T_MAX = 10;

// Analytic displacement of m x'' + c x' + k x = 0, x(0)=X0, x'(0)=0.
function displacement(t: number, c: number, k: number): number {
  const disc = c * c - 4 * M * k;
  if (Math.abs(disc) < 1e-6) {
    // critical
    const r = -c / (2 * M);
    return X0 * (1 - r * t) * Math.exp(r * t);
  }
  if (disc < 0) {
    // underdamped
    const alpha = -c / (2 * M);
    const w = Math.sqrt(-disc) / (2 * M);
    return X0 * Math.exp(alpha * t) * (Math.cos(w * t) - (alpha / w) * Math.sin(w * t));
  }
  // overdamped
  const s = Math.sqrt(disc);
  const r1 = (-c + s) / (2 * M);
  const r2 = (-c - s) / (2 * M);
  const A = (X0 * -r2) / (r1 - r2);
  const B = (X0 * r1) / (r1 - r2);
  return A * Math.exp(r1 * t) + B * Math.exp(r2 * t);
}

function regime(c: number, k: number): { name: string; color: string } {
  const disc = c * c - 4 * M * k;
  if (Math.abs(disc) < 0.05) return { name: 'critically damped', color: '#f59e0b' };
  if (disc < 0) return { name: 'underdamped (oscillates)', color: '#0ea5e9' };
  return { name: 'overdamped (no oscillation)', color: '#6366f1' };
}

export default function DampedSpringLab() {
  const graphRef = useRef<HTMLCanvasElement>(null);
  const springRef = useRef<HTMLCanvasElement>(null);
  const [k, setK] = useState(8);
  const [c, setC] = useState(0.6);
  const [playing, setPlaying] = useState(true);
  const tRef = useRef(0);
  const rafRef = useRef<number>();
  const lastRef = useRef<number>(0);
  const sizeRef = useRef({ gw: 360, gh: 240, sw: 150, sh: 240 });

  const drawGraph = (tNow: number) => {
    const canvas = graphRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { gw: w, gh: h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);
    const mid = h / 2;
    const toPx = (t: number, x: number) => ({ x: (t / T_MAX) * w, y: mid - x * (h / 2.6) });

    // grid + axes
    ctx.strokeStyle = COLORS.grid; ctx.lineWidth = 1;
    for (let t = 1; t < T_MAX; t++) { const p = toPx(t, 0); ctx.beginPath(); ctx.moveTo(p.x, 0); ctx.lineTo(p.x, h); ctx.stroke(); }
    ctx.strokeStyle = COLORS.axis; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(0, mid); ctx.lineTo(w, mid); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, h); ctx.stroke();

    // displacement curve
    ctx.strokeStyle = COLORS.curve; ctx.lineWidth = 2.6;
    ctx.beginPath();
    for (let px = 0; px <= w; px += 2) {
      const t = (px / w) * T_MAX;
      const p = toPx(t, displacement(t, c, k));
      if (px === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();

    // moving marker
    const mk = toPx(Math.min(tNow, T_MAX), displacement(Math.min(tNow, T_MAX), c, k));
    ctx.beginPath(); ctx.arc(mk.x, mk.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.mass; ctx.fill();
  };

  const drawSpring = (tNow: number) => {
    const canvas = springRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { sw: w, sh: h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2;
    const ceiling = 16;
    const rest = h * 0.55;
    const x = displacement(Math.min(tNow, T_MAX), c, k);
    const massY = rest + x * (h * 0.22);

    // ceiling
    ctx.strokeStyle = COLORS.axis; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(cx - 34, ceiling); ctx.lineTo(cx + 34, ceiling); ctx.stroke();

    // spring zig-zag
    ctx.strokeStyle = COLORS.spring; ctx.lineWidth = 2.4;
    ctx.beginPath();
    const coils = 9;
    const top = ceiling;
    for (let i = 0; i <= coils; i++) {
      const yy = top + ((massY - 18 - top) * i) / coils;
      const xx = cx + (i % 2 === 0 ? -12 : 12);
      if (i === 0) ctx.moveTo(cx, yy); else ctx.lineTo(xx, yy);
    }
    ctx.lineTo(cx, massY - 18);
    ctx.stroke();

    // rest line
    ctx.setLineDash([4, 4]); ctx.strokeStyle = 'rgba(128,128,128,0.5)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(8, rest); ctx.lineTo(w - 8, rest); ctx.stroke();
    ctx.setLineDash([]);

    // mass
    ctx.fillStyle = COLORS.mass;
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(cx - 20, massY - 18, 40, 36, 7); ctx.fill(); ctx.stroke();
  };

  // animation loop
  useEffect(() => {
    const step = (ts: number) => {
      if (!lastRef.current) lastRef.current = ts;
      const dt = Math.min(0.05, (ts - lastRef.current) / 1000);
      lastRef.current = ts;
      if (playing) {
        tRef.current += dt;
        if (tRef.current > T_MAX + 1.5) tRef.current = 0;
      }
      drawGraph(tRef.current);
      drawSpring(tRef.current);
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); lastRef.current = 0; };
  }, [playing, k, c]);

  // sizing
  useEffect(() => {
    const resize = () => {
      const g = graphRef.current, s = springRef.current;
      if (!g || !s) return;
      const parent = g.parentElement!.parentElement!;
      const total = Math.min(parent.clientWidth, 600);
      const sw = Math.max(120, Math.min(170, total * 0.3));
      const gw = total - sw - 16;
      const gh = Math.round(gw * 0.6);
      const sh = gh;
      const dpr = window.devicePixelRatio || 1;
      for (const [cv, ww, hh] of [[g, gw, gh], [s, sw, sh]] as [HTMLCanvasElement, number, number][]) {
        cv.width = ww * dpr; cv.height = hh * dpr;
        cv.style.width = `${ww}px`; cv.style.height = `${hh}px`;
        const ctx = cv.getContext('2d');
        if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      sizeRef.current = { gw, gh, sw, sh };
      drawGraph(tRef.current); drawSpring(tRef.current);
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  const reg = regime(c, k);

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setPlaying((p) => !p)}
          class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white"
        >
          {playing ? 'Pause' : 'Play'}
        </button>
        <button
          onClick={() => { tRef.current = 0; }}
          class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text"
        >
          Restart
        </button>
        <span class="ml-auto rounded-full px-3 py-1 text-xs font-bold text-white" style={`background:${reg.color}`}>
          {reg.name}
        </span>
      </div>

      <div class="flex flex-wrap gap-4 md:flex-nowrap">
        <canvas ref={springRef} class="touch-none rounded-xl bg-surface-2" />
        <canvas ref={graphRef} class="touch-none rounded-xl bg-surface-2" />
      </div>

      <div class="mt-4 grid gap-4 sm:grid-cols-2">
        <label class="block text-sm">
          <span class="mb-1 block text-muted">stiffness k = {k.toFixed(1)}</span>
          <input type="range" min={1} max={20} step={0.5} value={k}
            onInput={(e) => { setK(parseFloat((e.target as HTMLInputElement).value)); tRef.current = 0; }}
            class="w-full accent-[#4f46e5]" />
        </label>
        <label class="block text-sm">
          <span class="mb-1 block text-muted">damping c = {c.toFixed(1)}</span>
          <input type="range" min={0} max={12} step={0.2} value={c}
            onInput={(e) => { setC(parseFloat((e.target as HTMLInputElement).value)); tRef.current = 0; }}
            class="w-full accent-[#10b981]" />
        </label>
      </div>
      <p class="mt-3 text-xs text-muted">
        Discriminant c² − 4mk = {(c * c - 4 * M * k).toFixed(1)}. Negative wobbles, zero is the fastest no-overshoot return,
        positive crawls home slowly.
      </p>
    </div>
  );
}
