import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Time <-> frequency scope.
   - Build a signal by mixing a few pure tones (amplitude sliders).
   - Top panel: the signal in TIME. Bottom panel: its magnitude
     SPECTRUM, computed with a real DFT, so peaks pop up exactly
     at the frequencies you dialed in.
   ------------------------------------------------------------------ */

const COLORS = {
  signal: '#4f46e5', // indigo
  bar: '#0ea5e9',    // sky
  barHot: '#10b981', // emerald (tallest bin)
  grid: 'rgba(128,128,128,0.16)',
  axis: 'rgba(128,128,128,0.5)',
};

const NCOMP = 6;     // number of adjustable frequency components (1..6 Hz)
const NSAMP = 96;    // samples used for the DFT
const NBINS = 14;    // spectrum bars shown

// magnitude DFT of a real sampled signal -> array of NBINS magnitudes
function dftMag(samples: number[]): number[] {
  const N = samples.length;
  const mags: number[] = [];
  for (let k = 0; k < NBINS; k++) {
    let re = 0, im = 0;
    for (let n = 0; n < N; n++) {
      const ang = (-2 * Math.PI * k * n) / N;
      re += samples[n] * Math.cos(ang);
      im += samples[n] * Math.sin(ang);
    }
    mags.push((2 / N) * Math.hypot(re, im));
  }
  return mags;
}

const PRESETS: Record<string, number[]> = {
  'Pure tone': [0, 1, 0, 0, 0, 0],
  'Two tones': [1, 0, 0, 1, 0, 0],
  'Chord': [1, 0, 0.7, 0, 0.5, 0],
  'Buzzy': [1, 0.5, 0.33, 0.25, 0.2, 0.16],
};

export default function SpectrumScope() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 560, h: 360 });
  const [amps, setAmps] = useState<number[]>([0, 1, 0, 0, 0, 0]);

  const signalAt = (t: number) => {
    let s = 0;
    for (let k = 0; k < NCOMP; k++) s += amps[k] * Math.sin(2 * Math.PI * (k + 1) * t);
    return s;
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);

    const gap = 18;
    const topH = (h - gap) * 0.5;
    const botY = topH + gap;
    const botH = h - botY;
    const padX = 10;

    // ---------- TIME panel ----------
    const midY = topH / 2;
    const maxAmp = Math.max(1, amps.reduce((a, b) => a + b, 0));
    const yScale = (topH / 2 - 8) / maxAmp;

    ctx.strokeStyle = COLORS.grid; ctx.lineWidth = 1;
    for (let gx = 0; gx <= 8; gx++) {
      const x = padX + (gx / 8) * (w - 2 * padX);
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, topH); ctx.stroke();
    }
    ctx.strokeStyle = COLORS.axis; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, midY); ctx.lineTo(w, midY); ctx.stroke();

    ctx.strokeStyle = COLORS.signal; ctx.lineWidth = 3;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    const N = Math.max(360, w);
    for (let i = 0; i <= N; i++) {
      const frac = i / N;
      const t = frac; // one second window
      const px = padX + frac * (w - 2 * padX);
      const py = midY - signalAt(t) * yScale;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();

    ctx.font = '600 12px Inter, sans-serif';
    ctx.fillStyle = 'rgba(128,128,128,0.85)';
    ctx.fillText('signal in time  →', padX + 2, 16);

    // ---------- FREQUENCY panel ----------
    const samples: number[] = [];
    for (let n = 0; n < NSAMP; n++) samples.push(signalAt(n / NSAMP));
    const mags = dftMag(samples);
    const maxMag = Math.max(0.001, ...mags);
    const base = botY + botH - 18;
    const barMaxH = botH - 28;

    ctx.strokeStyle = COLORS.axis; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(padX, base); ctx.lineTo(w - padX, base); ctx.stroke();

    const slot = (w - 2 * padX) / NBINS;
    const barW = slot * 0.62;
    for (let k = 0; k < NBINS; k++) {
      const bh = (mags[k] / maxMag) * barMaxH;
      const x = padX + k * slot + (slot - barW) / 2;
      const isHot = mags[k] > 0.6 * maxMag && maxMag > 0.05;
      ctx.fillStyle = isHot ? COLORS.barHot : COLORS.bar;
      ctx.fillRect(x, base - bh, barW, bh);
      if (k % 2 === 0) {
        ctx.fillStyle = 'rgba(128,128,128,0.8)';
        ctx.font = '11px Inter, sans-serif';
        ctx.fillText(`${k}`, x + barW / 2 - 3, base + 13);
      }
    }
    ctx.fillStyle = 'rgba(128,128,128,0.85)';
    ctx.font = '600 12px Inter, sans-serif';
    ctx.fillText('↓ spectrum (frequency, Hz)', padX + 2, botY + 14);
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

  useEffect(draw, [amps]);

  const setAmp = (i: number, v: number) =>
    setAmps((prev) => prev.map((a, j) => (j === i ? v : a)));

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap gap-2">
        {Object.keys(PRESETS).map((name) => (
          <button
            key={name}
            onClick={() => setAmps(PRESETS[name].slice())}
            class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted transition hover:text-text"
          >
            {name}
          </button>
        ))}
      </div>

      <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

      <div class="mt-4 grid grid-cols-2 gap-x-5 gap-y-2 sm:grid-cols-3">
        {amps.map((a, i) => (
          <label key={i} class="block">
            <span class="mb-1 flex justify-between text-xs text-muted">
              <span>{i + 1} Hz</span>
              <span class="font-mono font-semibold text-text">{a.toFixed(2)}</span>
            </span>
            <input
              type="range" min={0} max={1} step={0.05} value={a}
              onInput={(e) => setAmp(i, parseFloat((e.target as HTMLInputElement).value))}
              class="w-full accent-[#0ea5e9]"
            />
          </label>
        ))}
      </div>
      <p class="mt-3 text-xs text-muted">
        Every slider you raise plants a peak in the spectrum below at exactly that frequency. The time
        signal and its spectrum are two views of the <strong>same</strong> information.
      </p>
    </div>
  );
}
