import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Initialization & vanishing/exploding gradients lab.
   Pick a weight-init scheme and watch the *variance* of activations
   as a signal flows through many layers: it can stay alive (good),
   collapse to zero (vanishing), or blow up (exploding).
   The key fact: with fan-in n, a linear layer multiplies variance by
   n·σ². Choosing σ² = 1/n (Xavier) or 2/n (He, for ReLU) keeps it ~1.
   ------------------------------------------------------------------ */

type Scheme = 'tiny' | 'xavier' | 'he' | 'large';

const COLORS = {
  brand: '#4f46e5',
  sky: '#0ea5e9',
  emerald: '#10b981',
  warn: '#ef4444',
  grid: 'rgba(128,128,128,0.18)',
  axis: 'rgba(128,128,128,0.5)',
};

const SCHEMES: Record<Scheme, { label: string; gain: number; act: 'tanh' | 'relu'; sigma: string }> = {
  tiny:   { label: 'Too small', gain: 0.32, act: 'tanh', sigma: 'σ² ≈ 0.1 / n' },
  xavier: { label: 'Xavier',    gain: 1.0,  act: 'tanh', sigma: 'σ² = 1 / n' },
  he:     { label: 'He',        gain: Math.SQRT2, act: 'relu', sigma: 'σ² = 2 / n' },
  large:  { label: 'Too large', gain: 2.6,  act: 'relu', sigma: 'σ² ≈ 6 / n' },
};

export default function InitScaleVarianceLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scheme, setScheme] = useState<Scheme>('xavier');
  const [layers, setLayers] = useState(12);
  const sizeRef = useRef({ w: 480, h: 300 });

  // variance multiplier per layer: gain² for the linear part,
  // times 0.5 if a ReLU is used (ReLU keeps roughly half the variance).
  const cfg = SCHEMES[scheme];
  const mult = cfg.gain * cfg.gain * (cfg.act === 'relu' ? 0.5 : 1);

  const variances: number[] = [1];
  for (let l = 1; l <= layers; l++) variances.push(variances[l - 1] * mult);
  const finalV = variances[layers];

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);

    const padL = 44, padR = 12, padT = 14, padB = 26;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;

    // log10 variance axis from -12 (dead) to +12 (exploded)
    const LO = -12, HI = 12;
    const yOf = (logv: number) => padT + plotH * (1 - (logv - LO) / (HI - LO));

    // "alive" band 0.1 .. 10  (log10 -1 .. 1)
    ctx.fillStyle = 'rgba(16,185,129,0.10)';
    ctx.fillRect(padL, yOf(1), plotW, yOf(-1) - yOf(1));

    // gridlines at decades
    ctx.strokeStyle = COLORS.grid;
    ctx.fillStyle = 'rgba(128,128,128,0.85)';
    ctx.font = '11px Inter, sans-serif';
    ctx.lineWidth = 1;
    for (let p = LO; p <= HI; p += 4) {
      const y = yOf(p);
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
      ctx.fillText(`10^${p}`, 4, y + 4);
    }

    // bars per layer
    const n = layers + 1;
    const bw = plotW / n;
    for (let l = 0; l <= layers; l++) {
      const v = Math.max(variances[l], 1e-18);
      const logv = Math.log10(v);
      const yTop = yOf(Math.max(LO, Math.min(HI, logv)));
      const yBase = yOf(LO);
      const x = padL + l * bw + bw * 0.15;
      const bwi = bw * 0.7;
      let col = COLORS.emerald;
      if (v < 0.1) col = COLORS.sky;
      else if (v > 10) col = COLORS.warn;
      ctx.fillStyle = col;
      ctx.fillRect(x, yTop, bwi, yBase - yTop);
    }

    // x label
    ctx.fillStyle = 'rgba(128,128,128,0.85)';
    ctx.font = '11px Inter, sans-serif';
    ctx.fillText('layer 0  →  deeper', padL, h - 8);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 560);
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
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(draw, [scheme, layers]);

  const status =
    finalV < 0.01 ? { t: 'Vanishing — the signal has died.', c: COLORS.sky }
    : finalV > 100 ? { t: 'Exploding — the signal blew up.', c: COLORS.warn }
    : { t: 'Alive — variance is preserved across depth.', c: COLORS.emerald };

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap gap-2">
        {(Object.keys(SCHEMES) as Scheme[]).map((s) => (
          <button
            key={s}
            onClick={() => setScheme(s)}
            class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              scheme === s ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
            }`}
          >
            {SCHEMES[s].label}
          </button>
        ))}
      </div>

      <div class="grid gap-4 md:grid-cols-[1fr,auto] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

        <div class="space-y-3 text-sm md:w-48">
          <label class="block">
            <span class="mb-1 block text-muted">depth = {layers} layers</span>
            <input
              type="range" min={2} max={30} step={1} value={layers}
              onInput={(e) => setLayers(parseInt((e.target as HTMLInputElement).value))}
              class="w-full accent-[#4f46e5]"
            />
          </label>
          <Readout label="scheme" value={`${cfg.label} · ${cfg.act}`} />
          <Readout label="σ² rule" value={cfg.sigma} />
          <Readout label="per-layer ×var" value={mult.toFixed(2)} />
          <Readout label="final variance" value={finalV < 1e-3 || finalV > 1e3 ? finalV.toExponential(1) : finalV.toFixed(3)} />
          <div class="rounded-lg p-3 text-xs font-semibold" style={`background:${status.c}1a;color:${status.c}`}>
            {status.t}
          </div>
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
