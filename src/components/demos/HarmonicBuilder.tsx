import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Fourier-series harmonic builder.
   - Pick a target wave (square / sawtooth / triangle).
   - Slide the number of harmonics and watch the partial sum
     converge to the target. Toggle the individual harmonics on/off.
   ------------------------------------------------------------------ */

type Target = 'square' | 'sawtooth' | 'triangle';

const COLORS = {
  partial: '#4f46e5', // indigo – partial sum
  target: '#0ea5e9',  // sky    – ideal target
  harm: '#10b981',    // emerald – individual harmonics
  grid: 'rgba(128,128,128,0.16)',
  axis: 'rgba(128,128,128,0.5)',
};

// nth-harmonic contribution at angle x (fundamental period 2π)
function term(target: Target, n: number, x: number): number {
  if (target === 'square') {
    const k = 2 * n - 1; // odd harmonics
    return (4 / Math.PI) * Math.sin(k * x) / k;
  }
  if (target === 'sawtooth') {
    return (2 / Math.PI) * ((n % 2 === 1 ? 1 : -1) * Math.sin(n * x)) / n;
  }
  // triangle: odd harmonics, 1/k^2, alternating sign
  const k = 2 * n - 1;
  const sign = n % 2 === 1 ? 1 : -1;
  return (8 / (Math.PI * Math.PI)) * sign * Math.sin(k * x) / (k * k);
}

const MAX_H = 12;

export default function HarmonicBuilder() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 560, h: 300 });

  const [target, setTarget] = useState<Target>('square');
  const [nHarm, setNHarm] = useState(1);
  const [showHarm, setShowHarm] = useState(true);

  const partial = (x: number) => {
    let s = 0;
    for (let n = 1; n <= nHarm; n++) s += term(target, n, x);
    return s;
  };
  const ideal = (x: number) => {
    let s = 0;
    for (let n = 1; n <= 200; n++) s += term(target, n, x);
    return s;
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);

    const padX = 8;
    const midY = h / 2;
    const yScale = (h / 2 - 16) / 1.3;
    const X0 = -Math.PI, X1 = 3 * Math.PI; // two periods

    ctx.strokeStyle = COLORS.grid; ctx.lineWidth = 1;
    for (let gx = 0; gx <= 8; gx++) {
      const x = padX + (gx / 8) * (w - 2 * padX);
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    ctx.strokeStyle = COLORS.axis; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, midY); ctx.lineTo(w, midY); ctx.stroke();

    const plot = (fn: (x: number) => number, color: string, width: number) => {
      ctx.strokeStyle = color; ctx.lineWidth = width;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath();
      const N = Math.max(360, w);
      for (let i = 0; i <= N; i++) {
        const frac = i / N;
        const x = X0 + frac * (X1 - X0);
        const px = padX + frac * (w - 2 * padX);
        const py = midY - fn(x) * yScale;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
    };

    // target (faint, behind)
    plot(ideal, COLORS.target + '66', 2);
    // individual harmonics (faint)
    if (showHarm) {
      for (let n = 1; n <= nHarm; n++) {
        plot((x) => term(target, n, x), COLORS.harm + '55', 1.5);
      }
    }
    // partial sum (bold, front)
    plot(partial, COLORS.partial, 3.5);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 620);
      const h = Math.round(Math.min(320, Math.max(220, w * 0.5)));
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr; canvas.height = h * dpr;
      canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w, h };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(draw, [target, nHarm, showHarm]);

  const targets: { id: Target; label: string }[] = [
    { id: 'square', label: 'Square' },
    { id: 'sawtooth', label: 'Sawtooth' },
    { id: 'triangle', label: 'Triangle' },
  ];

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap gap-2">
        {targets.map((t) => (
          <button
            key={t.id}
            onClick={() => setTarget(t.id)}
            class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              target === t.id ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
            }`}
          >
            {t.label}
          </button>
        ))}
        <button
          onClick={() => setShowHarm((v) => !v)}
          class={`ml-auto rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
            showHarm ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
          }`}
        >
          {showHarm ? 'Hide harmonics' : 'Show harmonics'}
        </button>
      </div>

      <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

      <div class="mt-4 space-y-2">
        <label class="block">
          <span class="mb-1 flex justify-between text-sm text-muted">
            <span>harmonics in the partial sum</span>
            <span class="font-mono font-semibold text-text">{nHarm} / {MAX_H}</span>
          </span>
          <input
            type="range" min={1} max={MAX_H} step={1} value={nHarm}
            onInput={(e) => setNHarm(parseInt((e.target as HTMLInputElement).value, 10))}
            class="w-full accent-[#4f46e5]"
          />
        </label>
        <div class="flex flex-wrap gap-3 text-xs">
          <Legend color={COLORS.partial} text={`partial sum (${nHarm} terms)`} />
          <Legend color={COLORS.target} text="ideal target wave" />
          {showHarm && <Legend color={COLORS.harm} text="individual harmonics" />}
        </div>
        <p class="text-xs text-muted">
          Drag the slider up: each new sine adds detail and the indigo curve snaps closer to the target.
          Notice the stubborn overshoot at the jumps — that wiggle is the famous <strong>Gibbs phenomenon</strong>.
        </p>
      </div>
    </div>
  );
}

function Legend({ color, text }: { color: string; text: string }) {
  return (
    <span class="flex items-center gap-1.5 text-muted">
      <span class="inline-block h-2.5 w-4 rounded-full" style={`background:${color}`} />
      {text}
    </span>
  );
}
