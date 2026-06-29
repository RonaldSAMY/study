import { useEffect, useMemo, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Application gallery: pick a real-world scenario, press play, and
   watch its ODE solution evolve in time. Every scenario is integrated
   with RK4; the curves are revealed left-to-right as the clock runs.
   ------------------------------------------------------------------ */

type Series = { label: string; color: string };
type Scenario = {
  key: string;
  name: string;
  blurb: string;
  tMax: number;
  yMax: number;
  yLabel: string;
  series: Series[];
  init: number[];
  deriv: (s: number[]) => number[];
};

const PALETTE = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b'];

const SCENARIOS: Scenario[] = [
  {
    key: 'sir',
    name: 'Epidemic (SIR)',
    blurb: "S′=−βSI, I′=βSI−γI, R′=γI. The infected curve climbs, peaks, then collapses as susceptibles run out.",
    tMax: 60, yMax: 1, yLabel: 'fraction of population',
    series: [{ label: 'Susceptible', color: PALETTE[0] }, { label: 'Infected', color: '#ef4444' }, { label: 'Recovered', color: PALETTE[2] }],
    init: [0.99, 0.01, 0],
    deriv: ([S, I]) => { const beta = 0.45, gamma = 0.12; const inf = beta * S * I; return [-inf, inf - gamma * I, gamma * I]; },
  },
  {
    key: 'lv',
    name: 'Predator–prey (foxes & rabbits)',
    blurb: 'R′=aR−bRF, F′=−cF+dRF. Rabbits boom, foxes follow, rabbits crash, foxes starve — endless cycles.',
    tMax: 40, yMax: 9, yLabel: 'population (hundreds)',
    series: [{ label: 'Rabbits', color: PALETTE[2] }, { label: 'Foxes', color: '#ef4444' }],
    init: [4, 2],
    deriv: ([R, F]) => { const a = 0.9, b = 0.4, c = 0.9, d = 0.2; return [a * R - b * R * F, -c * F + d * R * F]; },
  },
  {
    key: 'sky',
    name: 'Skydiver (terminal velocity)',
    blurb: "v′=g−(k/m)v². Gravity pulls, air resistance grows with speed, until they exactly cancel.",
    tMax: 15, yMax: 60, yLabel: 'speed (m/s)',
    series: [{ label: 'Fall speed', color: PALETTE[1] }],
    init: [0],
    deriv: ([v]) => { const g = 9.8, k = 0.27, m = 80; return [g - (k / m) * v * v]; },
  },
  {
    key: 'drug',
    name: 'Drug dosing (absorption)',
    blurb: "gut′=−ka·gut, blood′=ka·gut−ke·blood. The pill dissolves, blood level rises, then clears.",
    tMax: 12, yMax: 1, yLabel: 'concentration',
    series: [{ label: 'In gut', color: PALETTE[3] }, { label: 'In bloodstream', color: PALETTE[0] }],
    init: [1, 0],
    deriv: ([g, b]) => { const ka = 1.1, ke = 0.4; return [-ka * g, ka * g - ke * b]; },
  },
];

const COLORS = { grid: 'rgba(128,128,128,0.16)', axis: 'rgba(128,128,128,0.5)' };

export default function ODEScenarioSimulator() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [key, setKey] = useState('sir');
  const [playing, setPlaying] = useState(true);
  const tRef = useRef(0);
  const rafRef = useRef<number>();
  const lastRef = useRef(0);
  const sizeRef = useRef({ w: 480, h: 300 });

  const sc = SCENARIOS.find((s) => s.key === key)!;

  // Pre-integrate the whole trajectory once per scenario (RK4).
  const traj = useMemo(() => {
    const dt = sc.tMax / 1000;
    let s = [...sc.init];
    const out: number[][] = [s];
    const add = (a: number[], b: number[], f: number) => a.map((v, i) => v + b[i] * f);
    for (let i = 0; i < 1000; i++) {
      const k1 = sc.deriv(s);
      const k2 = sc.deriv(add(s, k1, dt / 2));
      const k3 = sc.deriv(add(s, k2, dt / 2));
      const k4 = sc.deriv(add(s, k3, dt));
      s = s.map((v, j) => v + (dt / 6) * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j]));
      out.push(s);
    }
    return out;
  }, [key]);

  const draw = (tNow: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);
    const pad = 6;
    const toPx = (t: number, y: number) => ({
      x: pad + (t / sc.tMax) * (w - 2 * pad),
      y: h - pad - (y / sc.yMax) * (h - 2 * pad),
    });

    // grid
    ctx.strokeStyle = COLORS.grid; ctx.lineWidth = 1;
    for (let i = 1; i < 6; i++) {
      const y = (sc.yMax / 6) * i; const p = toPx(0, y);
      ctx.beginPath(); ctx.moveTo(0, p.y); ctx.lineTo(w, p.y); ctx.stroke();
    }
    ctx.strokeStyle = COLORS.axis; ctx.lineWidth = 1.4;
    const o = toPx(0, 0);
    ctx.beginPath(); ctx.moveTo(pad, pad); ctx.lineTo(pad, o.y); ctx.lineTo(w - pad, o.y); ctx.stroke();

    const frac = Math.min(1, tNow / sc.tMax);
    const lastIdx = Math.max(1, Math.floor(frac * (traj.length - 1)));

    sc.series.forEach((ser, si) => {
      ctx.strokeStyle = ser.color; ctx.lineWidth = 2.6;
      ctx.beginPath();
      for (let i = 0; i <= lastIdx; i++) {
        const t = (i / (traj.length - 1)) * sc.tMax;
        const p = toPx(t, traj[i][si]);
        if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
      // leading dot
      const t = (lastIdx / (traj.length - 1)) * sc.tMax;
      const p = toPx(t, traj[lastIdx][si]);
      ctx.beginPath(); ctx.arc(p.x, p.y, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = ser.color; ctx.fill();
    });
  };

  useEffect(() => {
    const stepLoop = (ts: number) => {
      if (!lastRef.current) lastRef.current = ts;
      const dt = Math.min(0.05, (ts - lastRef.current) / 1000);
      lastRef.current = ts;
      if (playing) {
        tRef.current += dt * (sc.tMax / 8); // full run ~8s
        if (tRef.current > sc.tMax + sc.tMax * 0.1) tRef.current = 0;
      }
      draw(tRef.current);
      rafRef.current = requestAnimationFrame(stepLoop);
    };
    rafRef.current = requestAnimationFrame(stepLoop);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); lastRef.current = 0; };
  }, [playing, key, traj]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 600);
      const h = Math.round(w * 0.6);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr; canvas.height = h * dpr;
      canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w, h };
      draw(tRef.current);
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap gap-2">
        {SCENARIOS.map((s) => (
          <button
            key={s.key}
            onClick={() => { setKey(s.key); tRef.current = 0; }}
            class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${key === s.key ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'}`}
          >
            {s.name}
          </button>
        ))}
      </div>

      <div class="mb-2 flex items-center gap-2">
        <button onClick={() => setPlaying((p) => !p)} class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white">
          {playing ? 'Pause' : 'Play'}
        </button>
        <button onClick={() => { tRef.current = 0; }} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">
          Restart
        </button>
        <div class="ml-auto flex flex-wrap gap-3 text-xs">
          {sc.series.map((ser) => (
            <span key={ser.label} class="flex items-center gap-1">
              <span class="inline-block h-2.5 w-2.5 rounded-full" style={`background:${ser.color}`} />
              {ser.label}
            </span>
          ))}
        </div>
      </div>

      <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />
      <p class="mt-1 text-right text-xs text-muted">{sc.yLabel} vs. time</p>
      <p class="mt-2 rounded-lg bg-surface-2 p-3 text-xs text-muted">{sc.blurb}</p>
    </div>
  );
}
