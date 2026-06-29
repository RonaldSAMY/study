import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Graphic equalizer + scrolling spectrogram.
   - Ten frequency bands, each with a gain slider (like a stereo EQ).
   - A synthetic source gives each band a living, pulsing energy.
   - The spectrogram scrolls in real time; raising/lowering a band
     brightens or darkens that horizontal stripe, exactly like
     boosting bass or cutting treble.
   - rAF is paired with cancelAnimationFrame on unmount / pause.
   ------------------------------------------------------------------ */

const NB = 10; // bands
const BAND_LABELS = ['32', '64', '125', '250', '500', '1k', '2k', '4k', '8k', '16k']; // Hz

export default function SpectrogramEqualizer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 560, h: 280, cols: 120 });
  const colsRef = useRef<number[][]>([]);   // ring of columns, each = NB energies
  const rafRef = useRef<number | null>(null);
  const tRef = useRef(0);
  const lastPushRef = useRef(0);

  const [gains, setGains] = useState<number[]>(Array(NB).fill(0.7));
  const gainsRef = useRef(gains);
  gainsRef.current = gains;
  const [playing, setPlaying] = useState(true);

  // per-band pulse rates / phases for a lively source
  const rates = useRef(Array.from({ length: NB }, (_, i) => 0.25 + i * 0.18));
  const phases = useRef(Array.from({ length: NB }, (_, i) => (i * 1.7) % (2 * Math.PI)));

  const energyAt = (t: number): number[] => {
    const g = gainsRef.current;
    return Array.from({ length: NB }, (_, i) => {
      const pulse = 0.5 + 0.5 * Math.sin(2 * Math.PI * rates.current[i] * t + phases.current[i]);
      const env = 0.55 + 0.45 * Math.sin(2 * Math.PI * 0.12 * t + i); // slow swell
      return Math.max(0, Math.min(1, pulse * env * g[i]));
    });
  };

  // viridis-ish heat color
  const heat = (v: number): string => {
    const c = Math.max(0, Math.min(1, v));
    // dark navy -> blue -> teal -> green -> yellow
    const stops = [
      [13, 8, 38], [38, 30, 110], [30, 110, 140],
      [16, 185, 129], [240, 220, 60],
    ];
    const x = c * (stops.length - 1);
    const i = Math.floor(x);
    const f = x - i;
    const a = stops[i];
    const b = stops[Math.min(stops.length - 1, i + 1)];
    const r = Math.round(a[0] + (b[0] - a[0]) * f);
    const gg = Math.round(a[1] + (b[1] - a[1]) * f);
    const bl = Math.round(a[2] + (b[2] - a[2]) * f);
    return `rgb(${r},${gg},${bl})`;
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h, cols } = sizeRef.current;
    const labelW = 30;
    const specW = w - labelW;
    ctx.clearRect(0, 0, w, h);

    const colW = specW / cols;
    const rowH = h / NB;
    const buf = colsRef.current;

    for (let c = 0; c < buf.length; c++) {
      const col = buf[c];
      const x = labelW + c * colW;
      for (let b = 0; b < NB; b++) {
        // band 0 (low) drawn at the BOTTOM
        const y = h - (b + 1) * rowH;
        ctx.fillStyle = heat(col[b]);
        ctx.fillRect(x, y, Math.ceil(colW) + 1, Math.ceil(rowH) + 1);
      }
    }

    // band labels on the left
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '10px Inter, sans-serif';
    for (let b = 0; b < NB; b++) {
      const y = h - (b + 0.5) * rowH;
      ctx.fillStyle = 'rgba(160,160,170,0.95)';
      ctx.fillText(BAND_LABELS[b], 2, y + 3);
    }
    // "now" edge
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillRect(w - 1.5, 0, 1.5, h);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 620);
      const h = Math.round(Math.min(300, Math.max(220, w * 0.5)));
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr; canvas.height = h * dpr;
      canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const cols = Math.max(60, Math.round((w - 30) / 4));
      sizeRef.current = { w, h, cols };
      // keep buffer length in range
      const buf = colsRef.current;
      while (buf.length > cols) buf.shift();
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // animation
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
      tRef.current += dt;
      // push a new column ~30 times/sec
      if (now - lastPushRef.current > 33) {
        lastPushRef.current = now;
        const buf = colsRef.current;
        buf.push(energyAt(tRef.current));
        while (buf.length > sizeRef.current.cols) buf.shift();
        draw();
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [playing]);

  // redraw if gains change while paused
  useEffect(() => { if (!playing) draw(); }, [gains, playing]);

  const setGain = (i: number, v: number) =>
    setGains((prev) => prev.map((g, j) => (j === i ? v : g)));

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
          onClick={() => setGains(Array(NB).fill(0.7))}
          class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted transition hover:text-text"
        >
          Reset EQ
        </button>
        <button
          onClick={() => setGains(Array.from({ length: NB }, (_, i) => i < NB / 2 ? 1 : 0.15))}
          class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted transition hover:text-text"
        >
          Bass boost
        </button>
      </div>

      <canvas ref={canvasRef} class="touch-none rounded-xl" style="background:#0d0826" />

      <div class="mt-4 grid grid-cols-5 gap-x-3 gap-y-2 sm:grid-cols-10">
        {gains.map((g, i) => (
          <label key={i} class="flex flex-col items-center gap-1">
            <input
              type="range" min={0} max={1} step={0.05} value={g}
              onInput={(e) => setGain(i, parseFloat((e.target as HTMLInputElement).value))}
              class="w-full accent-[#10b981]"
            />
            <span class="text-[10px] text-muted">{BAND_LABELS[i]}</span>
          </label>
        ))}
      </div>
      <p class="mt-3 text-xs text-muted">
        Each row is a frequency band; brightness is how much energy that band carries right now, scrolling
        left as time passes — a live <strong>spectrogram</strong>. Pull a slider down to "cut" that band
        and watch its stripe go dark, exactly how a music EQ or noise-cancelling filter works.
      </p>
    </div>
  );
}
