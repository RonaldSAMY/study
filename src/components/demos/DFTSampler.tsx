import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Sampling + DFT explorer.
   - A continuous signal (two tones) is sampled at N points.
   - The DFT of those samples is computed and shown as bins.
   - Op-count readout contrasts naive DFT O(N^2) vs FFT O(N log N).
   - Push N below Nyquist and watch a peak land in the wrong bin
     (aliasing).
   ------------------------------------------------------------------ */

const COLORS = {
  cont: '#4f46e5',  // indigo – continuous signal
  dot: '#10b981',   // emerald – samples
  bar: '#0ea5e9',   // sky – DFT bins
  grid: 'rgba(128,128,128,0.16)',
  axis: 'rgba(128,128,128,0.5)',
};

export default function DFTSampler() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 560, h: 360 });

  const [f1, setF1] = useState(3);
  const [f2, setF2] = useState(7);
  const [N, setN] = useState(32);

  const cont = (t: number) => Math.sin(2 * Math.PI * f1 * t) + 0.6 * Math.sin(2 * Math.PI * f2 * t);

  // DFT magnitude of N samples taken over [0,1)
  const computeBins = () => {
    const s: number[] = [];
    for (let n = 0; n < N; n++) s.push(cont(n / N));
    const half = Math.floor(N / 2);
    const mags: number[] = [];
    for (let k = 0; k <= half; k++) {
      let re = 0, im = 0;
      for (let n = 0; n < N; n++) {
        const ang = (-2 * Math.PI * k * n) / N;
        re += s[n] * Math.cos(ang);
        im += s[n] * Math.sin(ang);
      }
      mags.push((2 / N) * Math.hypot(re, im));
    }
    return { s, mags, half };
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);

    const gap = 18;
    const topH = (h - gap) * 0.52;
    const botY = topH + gap;
    const botH = h - botY;
    const padX = 10;

    const { s, mags, half } = computeBins();

    // ---------- continuous signal + samples ----------
    const midY = topH / 2;
    const yScale = (topH / 2 - 8) / 1.7;

    ctx.strokeStyle = COLORS.grid; ctx.lineWidth = 1;
    for (let gx = 0; gx <= 10; gx++) {
      const x = padX + (gx / 10) * (w - 2 * padX);
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, topH); ctx.stroke();
    }
    ctx.strokeStyle = COLORS.axis; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, midY); ctx.lineTo(w, midY); ctx.stroke();

    ctx.strokeStyle = COLORS.cont; ctx.lineWidth = 2.5;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    const M = Math.max(360, w);
    for (let i = 0; i <= M; i++) {
      const frac = i / M;
      const px = padX + frac * (w - 2 * padX);
      const py = midY - cont(frac) * yScale;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // sample dots + stems
    for (let n = 0; n < N; n++) {
      const frac = n / N;
      const px = padX + frac * (w - 2 * padX);
      const py = midY - s[n] * yScale;
      ctx.strokeStyle = 'rgba(16,185,129,0.35)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(px, midY); ctx.lineTo(px, py); ctx.stroke();
      ctx.fillStyle = COLORS.dot;
      ctx.beginPath(); ctx.arc(px, py, 2.6, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = 'rgba(128,128,128,0.85)';
    ctx.font = '600 12px Inter, sans-serif';
    ctx.fillText(`${N} samples of the signal  →`, padX + 2, 16);

    // ---------- DFT bins ----------
    const base = botY + botH - 18;
    const barMaxH = botH - 28;
    const maxMag = Math.max(0.001, ...mags);

    ctx.strokeStyle = COLORS.axis; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(padX, base); ctx.lineTo(w - padX, base); ctx.stroke();

    const nb = half + 1;
    const slot = (w - 2 * padX) / nb;
    const barW = Math.max(2, slot * 0.6);
    for (let k = 0; k < nb; k++) {
      const bh = (mags[k] / maxMag) * barMaxH;
      const x = padX + k * slot + (slot - barW) / 2;
      ctx.fillStyle = COLORS.bar;
      ctx.fillRect(x, base - bh, barW, bh);
    }
    ctx.fillStyle = 'rgba(128,128,128,0.85)';
    ctx.font = '600 12px Inter, sans-serif';
    ctx.fillText(`↓ DFT magnitude — bins 0 … ${half} (Nyquist)`, padX + 2, botY + 14);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 620);
      const h = Math.round(Math.min(400, Math.max(300, w * 0.62)));
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

  useEffect(draw, [f1, f2, N]);

  const naive = N * N;
  const fast = Math.round(N * Math.log2(N));
  const nyquist = N / 2;
  const aliased = f1 >= nyquist || f2 >= nyquist;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

      <div class="mt-4 grid gap-x-5 gap-y-2 sm:grid-cols-3">
        <Slider label="tone 1 (Hz)" value={f1} min={1} max={15} step={1} onChange={setF1} accent="#4f46e5" />
        <Slider label="tone 2 (Hz)" value={f2} min={1} max={15} step={1} onChange={setF2} accent="#4f46e5" />
        <Slider label="samples N" value={N} min={8} max={64} step={4} onChange={setN} accent="#10b981" />
      </div>

      <div class="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
        <Readout label="Naive DFT — N²" value={naive.toLocaleString()} />
        <Readout label="FFT — N·log₂N" value={fast.toLocaleString()} />
        <Readout label="speed-up" value={`${(naive / fast).toFixed(1)}×`} />
      </div>

      <p class={`mt-3 rounded-lg p-2 text-xs ${aliased ? 'bg-geometry/10 text-geometry' : 'text-muted'}`}>
        {aliased
          ? `⚠️ A tone is at or above the Nyquist limit (${nyquist} Hz). It folds back and its peak lands in the WRONG bin — that is aliasing. Add samples to fix it.`
          : `Both tones sit below Nyquist (${nyquist} Hz), so each shows up as a clean peak in its correct bin. The FFT gives identical bins to the naive DFT, just ${(naive / fast).toFixed(1)}× faster here.`}
      </p>
    </div>
  );
}

function Slider({
  label, value, min, max, step, onChange, accent,
}: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; accent: string;
}) {
  return (
    <label class="block">
      <span class="mb-1 flex justify-between text-xs text-muted">
        <span>{label}</span>
        <span class="font-mono font-semibold text-text">{value}</span>
      </span>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onInput={(e) => onChange(parseInt((e.target as HTMLInputElement).value, 10))}
        class="w-full"
        style={`accent-color:${accent}`}
      />
    </label>
  );
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div class="rounded-lg bg-surface-2 px-3 py-2">
      <div class="text-xs text-muted">{label}</div>
      <div class="font-mono text-base font-semibold">{value}</div>
    </div>
  );
}
