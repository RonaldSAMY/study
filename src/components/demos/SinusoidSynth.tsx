import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Sinusoid synthesizer.
   - Shape one wave with amplitude / frequency / phase sliders.
   - Optionally add a second wave and watch the two SUM together.
   - Optional "play" scrolls the waves in time (rAF, cleaned up).
   ------------------------------------------------------------------ */

const COLORS = {
  a: '#4f46e5',      // indigo  – wave 1
  b: '#0ea5e9',      // sky     – wave 2
  sum: '#10b981',    // emerald – sum
  grid: 'rgba(128,128,128,0.16)',
  axis: 'rgba(128,128,128,0.5)',
};

const T_WINDOW = 2; // seconds shown across the canvas

export default function SinusoidSynth() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 560, h: 300 });
  const rafRef = useRef<number | null>(null);
  const tShiftRef = useRef(0);

  const [a1, setA1] = useState(1);
  const [f1, setF1] = useState(2);
  const [p1, setP1] = useState(0);

  const [two, setTwo] = useState(false);
  const [a2, setA2] = useState(0.5);
  const [f2, setF2] = useState(5);
  const [p2, setP2] = useState(0);

  const [playing, setPlaying] = useState(false);

  const wave = (t: number, A: number, f: number, phi: number) =>
    A * Math.sin(2 * Math.PI * f * t + phi);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    const ts = tShiftRef.current;
    ctx.clearRect(0, 0, w, h);

    const padX = 8;
    const midY = h / 2;
    const yScale = (h / 2 - 14) / 2.2; // total amplitude budget ~2.2

    // grid
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    for (let gx = 0; gx <= 8; gx++) {
      const x = padX + (gx / 8) * (w - 2 * padX);
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let gy = -2; gy <= 2; gy++) {
      const y = midY - gy * yScale;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    // zero axis
    ctx.strokeStyle = COLORS.axis;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, midY); ctx.lineTo(w, midY); ctx.stroke();

    const plot = (fn: (t: number) => number, color: string, width: number) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      const N = Math.max(240, w);
      for (let i = 0; i <= N; i++) {
        const frac = i / N;
        const t = frac * T_WINDOW + ts;
        const x = padX + frac * (w - 2 * padX);
        const y = midY - fn(t) * yScale;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    };

    if (two) {
      // faint component waves
      plot((t) => wave(t, a1, f1, p1), COLORS.a + '88', 2);
      plot((t) => wave(t, a2, f2, p2), COLORS.b + '88', 2);
      plot((t) => wave(t, a1, f1, p1) + wave(t, a2, f2, p2), COLORS.sum, 3.5);
    } else {
      plot((t) => wave(t, a1, f1, p1), COLORS.a, 3.5);
    }
  };

  // responsive sizing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 620);
      const h = Math.round(Math.min(320, Math.max(220, w * 0.5)));
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
    return () => window.removeEventListener('resize', resize);
  }, []);

  // redraw on state
  useEffect(draw, [a1, f1, p1, a2, f2, p2, two]);

  // animation loop
  useEffect(() => {
    if (!playing) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      return;
    }
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      tShiftRef.current += dt * 0.6;
      draw();
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [playing, a1, f1, p1, a2, f2, p2, two]);

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setPlaying((v) => !v)}
          class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
            playing ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
          }`}
        >
          {playing ? '❚❚ Pause' : '▶ Play'}
        </button>
        <button
          onClick={() => setTwo((v) => !v)}
          class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
            two ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
          }`}
        >
          {two ? 'Two waves (sum)' : 'One wave'}
        </button>
      </div>

      <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

      <div class="mt-4 grid gap-4 md:grid-cols-2">
        <div class="space-y-3 rounded-xl border border-border bg-surface-2 p-3">
          <p class="text-sm font-semibold" style={`color:${COLORS.a}`}>
            Wave 1 &nbsp;·&nbsp; y = A·sin(2πf·t + φ)
          </p>
          <Slider label="amplitude A" value={a1} min={0} max={1.5} step={0.05} onChange={setA1} fmt={(v) => v.toFixed(2)} />
          <Slider label="frequency f (Hz)" value={f1} min={0.5} max={10} step={0.5} onChange={setF1} fmt={(v) => v.toFixed(1)} />
          <Slider label="phase φ (rad)" value={p1} min={-Math.PI} max={Math.PI} step={0.05} onChange={setP1} fmt={(v) => v.toFixed(2)} />
        </div>

        <div class={`space-y-3 rounded-xl border border-border bg-surface-2 p-3 ${two ? '' : 'opacity-40'}`}>
          <p class="text-sm font-semibold" style={`color:${COLORS.b}`}>
            Wave 2 {two ? '' : '(enable “Two waves”)'}
          </p>
          <Slider label="amplitude A" value={a2} min={0} max={1.5} step={0.05} onChange={setA2} disabled={!two} fmt={(v) => v.toFixed(2)} />
          <Slider label="frequency f (Hz)" value={f2} min={0.5} max={10} step={0.5} onChange={setF2} disabled={!two} fmt={(v) => v.toFixed(1)} />
          <Slider label="phase φ (rad)" value={p2} min={-Math.PI} max={Math.PI} step={0.05} onChange={setP2} disabled={!two} fmt={(v) => v.toFixed(2)} />
        </div>
      </div>

      <p class="mt-3 text-xs text-muted">
        {two
          ? 'Faint indigo + sky are the two pure tones; the bold emerald wave is their sum — the start of building rich sounds from simple ones.'
          : 'Amplitude sets the height, frequency how many cycles fit in the window, phase slides the wave left/right.'}
      </p>
    </div>
  );
}

function Slider({
  label, value, min, max, step, onChange, fmt, disabled = false,
}: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; fmt: (v: number) => string; disabled?: boolean;
}) {
  return (
    <label class="block">
      <span class="mb-1 flex justify-between text-xs text-muted">
        <span>{label}</span>
        <span class="font-mono font-semibold text-text">{fmt(value)}</span>
      </span>
      <input
        type="range" min={min} max={max} step={step} value={value} disabled={disabled}
        onInput={(e) => onChange(parseFloat((e.target as HTMLInputElement).value))}
        class="w-full accent-[#4f46e5]"
      />
    </label>
  );
}
