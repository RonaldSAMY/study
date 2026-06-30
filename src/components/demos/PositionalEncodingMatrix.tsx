import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Sinusoidal positional-encoding matrix.
   - Heatmap: rows = position, columns = embedding dimension.
   - Even columns use sin, odd columns use cos; the wavelength grows
     geometrically across dimensions.
   - Slide the model size d and pick a dimension to see its own wave
     (high-dim = slow wave, low-dim = fast wave).
   Canvas conventions copied from VectorPlayground.
   ------------------------------------------------------------------ */

const P = 32; // number of positions (rows)

const pe = (pos: number, i: number, d: number) => {
  const freq = Math.pow(10000, (2 * Math.floor(i / 2)) / d);
  return i % 2 === 0 ? Math.sin(pos / freq) : Math.cos(pos / freq);
};

// diverging colour: +1 → indigo, 0 → surface, -1 → amber
function colour(v: number) {
  const t = (v + 1) / 2; // 0..1
  const lerp = (a: number, b: number) => Math.round(a + (b - a) * t);
  const neg = [245, 158, 11];  // amber
  const pos = [79, 70, 229];   // indigo
  return `rgb(${lerp(neg[0], pos[0])},${lerp(neg[1], pos[1])},${lerp(neg[2], pos[2])})`;
}

export default function PositionalEncodingMatrix() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [d, setD] = useState(16);
  const [dim, setDim] = useState(2);
  const sizeRef = useRef({ w: 480, h: 360 });

  const safeDim = Math.min(dim, d - 1);
  const freqSel = Math.pow(10000, (2 * Math.floor(safeDim / 2)) / d);
  const wavelength = 2 * Math.PI * freqSel;

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);

    const padL = 30, padT = 22, padR = 10;
    const heatH = h * 0.58;
    const gridW = w - padL - padR;
    const cellW = gridW / d;
    const cellH = (heatH - padT) / P;

    // heatmap
    for (let pos = 0; pos < P; pos++) {
      for (let i = 0; i < d; i++) {
        ctx.fillStyle = colour(pe(pos, i, d));
        ctx.fillRect(padL + i * cellW, padT + pos * cellH, cellW + 0.5, cellH + 0.5);
      }
    }
    // highlight selected column
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2;
    ctx.strokeRect(padL + safeDim * cellW, padT, cellW, P * cellH);

    // axis labels
    ctx.fillStyle = 'rgba(128,128,128,0.9)';
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillText('dimension →', padL + gridW / 2, 14);
    ctx.save();
    ctx.translate(12, padT + (P * cellH) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('position →', 0, 0);
    ctx.restore();

    // wave of the selected dimension across positions
    const wy0 = heatH + 24;
    const wyH = h - wy0 - 18;
    const mid = wy0 + wyH / 2;
    ctx.strokeStyle = 'rgba(128,128,128,0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(padL, mid); ctx.lineTo(padL + gridW, mid); ctx.stroke();

    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    ctx.beginPath();
    for (let pos = 0; pos < P; pos++) {
      const x = padL + (pos / (P - 1)) * gridW;
      const y = mid - pe(pos, safeDim, d) * (wyH / 2 - 2);
      pos === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.fillStyle = '#10b981';
    ctx.font = '600 11px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`dim ${safeDim} (${safeDim % 2 === 0 ? 'sin' : 'cos'}) across positions`, padL, wy0 + 2);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 560);
      const h = Math.round(w * 0.74);
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

  useEffect(draw, [d, dim]);

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

      <div class="mt-3 grid gap-3 text-sm sm:grid-cols-2">
        <label class="block">
          <span class="mb-1 block text-muted">model dimension d = {d}</span>
          <input type="range" min={4} max={48} step={2} value={d}
            onInput={(e) => setD(parseInt((e.target as HTMLInputElement).value))}
            class="w-full accent-[#4f46e5]" />
        </label>
        <label class="block">
          <span class="mb-1 block text-muted">highlighted dimension = {safeDim}</span>
          <input type="range" min={0} max={d - 1} step={1} value={safeDim}
            onInput={(e) => setDim(parseInt((e.target as HTMLInputElement).value))}
            class="w-full accent-[#10b981]" />
        </label>
      </div>

      <div class="mt-3 rounded-lg bg-surface-2 p-3 text-xs">
        <div class="flex justify-between"><span class="text-muted">wavelength of dim {safeDim}</span><strong class="font-mono">{wavelength.toFixed(1)} positions</strong></div>
        <p class="mt-1 text-muted">
          Low dimensions wiggle fast (short wavelength); high dimensions change slowly. Together these
          sines and cosines give every position a unique fingerprint — and the gap between two positions
          is a fixed rotation, which is exactly what attention can read.
        </p>
      </div>
    </div>
  );
}
