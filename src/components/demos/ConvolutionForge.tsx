import { useEffect, useMemo, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Convolution theorem demo.
   - A noisy signal is convolved with a smoothing kernel (a box /
     "blur" of adjustable width).
   - Top: original (faint) vs smoothed (bold).
   - Bottom: the signal spectrum, the kernel's frequency response,
     and the result spectrum — showing result = signal × response,
     i.e. convolution in time = multiplication in frequency.
   ------------------------------------------------------------------ */

const N = 64;

const COLORS = {
  orig: 'rgba(79,70,229,0.45)', // faint indigo
  smooth: '#4f46e5',            // indigo
  sigBar: '#0ea5e9',            // sky – signal spectrum
  resBar: '#10b981',            // emerald – result spectrum
  resp: '#4f46e5',              // indigo – kernel response curve
  grid: 'rgba(128,128,128,0.16)',
  axis: 'rgba(128,128,128,0.5)',
};

// deterministic "noise" so it doesn't jump around on every render
function makeSignal(): number[] {
  const x: number[] = [];
  let seed = 12345;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff - 0.5;
  };
  for (let n = 0; n < N; n++) {
    const smooth = Math.sin((2 * Math.PI * 2 * n) / N);          // low freq content
    const spiky = 0.5 * Math.sin((2 * Math.PI * 19 * n) / N);    // high freq content
    x.push(smooth + spiky + 0.4 * rand());
  }
  return x;
}

function dftMag(s: number[], nbins: number): number[] {
  const out: number[] = [];
  for (let k = 0; k < nbins; k++) {
    let re = 0, im = 0;
    for (let n = 0; n < s.length; n++) {
      const ang = (-2 * Math.PI * k * n) / s.length;
      re += s[n] * Math.cos(ang);
      im += s[n] * Math.sin(ang);
    }
    out.push((2 / s.length) * Math.hypot(re, im));
  }
  return out;
}

export default function ConvolutionForge() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 560, h: 380 });
  const signal = useMemo(makeSignal, []);
  const [width, setWidth] = useState(5); // kernel half-info: box width (odd)

  const result = useMemo(() => {
    const K = width;
    const half = Math.floor(K / 2);
    const y: number[] = [];
    for (let n = 0; n < N; n++) {
      let s = 0;
      for (let j = -half; j <= half; j++) s += signal[(n + j + N) % N];
      y.push(s / K);
    }
    return y;
  }, [signal, width]);

  const nbins = N / 2;

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);

    const gap = 18;
    const topH = (h - gap) * 0.48;
    const botY = topH + gap;
    const botH = h - botY;
    const padX = 10;

    // ---------- TIME ----------
    const midY = topH / 2;
    const yScale = (topH / 2 - 8) / 1.8;
    ctx.strokeStyle = COLORS.axis; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, midY); ctx.lineTo(w, midY); ctx.stroke();

    const plotSeq = (seq: number[], color: string, width2: number) => {
      ctx.strokeStyle = color; ctx.lineWidth = width2;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath();
      for (let n = 0; n < N; n++) {
        const px = padX + (n / (N - 1)) * (w - 2 * padX);
        const py = midY - seq[n] * yScale;
        if (n === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
    };
    plotSeq(signal, COLORS.orig, 2);
    plotSeq(result, COLORS.smooth, 3);

    ctx.fillStyle = 'rgba(128,128,128,0.85)';
    ctx.font = '600 12px Inter, sans-serif';
    ctx.fillText('noisy signal (faint)  vs  smoothed (bold)', padX + 2, 16);

    // ---------- FREQUENCY ----------
    const sigMag = dftMag(signal, nbins);
    const resMag = dftMag(result, nbins);
    const maxMag = Math.max(0.001, ...sigMag);
    const base = botY + botH - 16;
    const barMaxH = botH - 28;

    ctx.strokeStyle = COLORS.axis; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(padX, base); ctx.lineTo(w - padX, base); ctx.stroke();

    const slot = (w - 2 * padX) / nbins;
    const barW = Math.max(2, slot * 0.34);
    for (let k = 0; k < nbins; k++) {
      const xs = padX + k * slot + slot / 2;
      const hSig = (sigMag[k] / maxMag) * barMaxH;
      const hRes = (resMag[k] / maxMag) * barMaxH;
      ctx.fillStyle = COLORS.sigBar;
      ctx.fillRect(xs - barW - 1, base - hSig, barW, hSig);
      ctx.fillStyle = COLORS.resBar;
      ctx.fillRect(xs + 1, base - hRes, barW, hRes);
    }

    // kernel frequency response H[k] (box -> sinc), overlaid as a curve
    const K = width;
    ctx.strokeStyle = COLORS.resp; ctx.lineWidth = 2; ctx.setLineDash([5, 4]);
    ctx.beginPath();
    for (let k = 0; k < nbins; k++) {
      const omega = (Math.PI * k) / nbins; // 0..~pi
      // magnitude response of normalized box of width K (Dirichlet kernel)
      const denom = K * Math.sin(omega / 2);
      const H = Math.abs(omega < 1e-6 ? 1 : Math.sin((K * omega) / 2) / denom);
      const px = padX + k * slot + slot / 2;
      const py = base - H * barMaxH;
      if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke(); ctx.setLineDash([]);

    ctx.fillStyle = 'rgba(128,128,128,0.85)';
    ctx.font = '600 12px Inter, sans-serif';
    ctx.fillText('↓ spectra: signal × kernel-response = result', padX + 2, botY + 14);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 620);
      const h = Math.round(Math.min(420, Math.max(320, w * 0.66)));
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

  useEffect(draw, [width, signal, result]);

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

      <div class="mt-4">
        <label class="block">
          <span class="mb-1 flex justify-between text-sm text-muted">
            <span>blur kernel width (samples averaged)</span>
            <span class="font-mono font-semibold text-text">{width}</span>
          </span>
          <input
            type="range" min={1} max={15} step={2} value={width}
            onInput={(e) => setWidth(parseInt((e.target as HTMLInputElement).value, 10))}
            class="w-full accent-[#4f46e5]"
          />
        </label>
      </div>

      <div class="mt-3 flex flex-wrap gap-3 text-xs">
        <Legend color={COLORS.sigBar} text="signal spectrum |X|" />
        <Legend color={COLORS.resBar} text="result spectrum |Y|" />
        <Legend color={COLORS.resp} text="kernel response H (dashed)" />
      </div>
      <p class="mt-2 text-xs text-muted">
        Widen the kernel and the dashed response squeezes toward low frequencies. The result spectrum is
        just the signal spectrum scaled by that response, bin by bin — high-frequency noise is multiplied
        away. That is the <strong>convolution theorem</strong> in one picture.
      </p>
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
