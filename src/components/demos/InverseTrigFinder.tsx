import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Inverse trig finder.
   - Choose a function: arcsin, arccos, or arctan.
   - Slide the input ratio; the demo finds the angle and shows it on
     the unit circle, marking the matching coordinate.
   ------------------------------------------------------------------ */

const COLORS = {
  sin: '#10b981',
  cos: '#0ea5e9',
  brand: '#4f46e5',
  grid: 'rgba(128,128,128,0.18)',
  axis: 'rgba(128,128,128,0.5)',
};
const TAU = Math.PI * 2;
type Fn = 'asin' | 'acos' | 'atan';

export default function InverseTrigFinder() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fn, setFn] = useState<Fn>('asin');
  const [ratio, setRatio] = useState(0.5);
  const sizeRef = useRef({ w: 360, h: 360, cx: 180, cy: 180, r: 130 });

  // valid input range and resulting angle (principal value)
  const isAtan = fn === 'atan';
  const r = isAtan ? ratio : Math.max(-1, Math.min(1, ratio));
  const theta =
    fn === 'asin' ? Math.asin(r) : fn === 'acos' ? Math.acos(r) : Math.atan(r);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h, cx, cy, r: R } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);

    ctx.strokeStyle = COLORS.axis; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(w, cy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, h); ctx.stroke();

    ctx.strokeStyle = COLORS.grid; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();

    const px = cx + R * Math.cos(theta);
    const py = cy - R * Math.sin(theta);

    // highlight which coordinate is the known input
    ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.setLineDash([5, 5]);
    if (fn === 'asin') {
      ctx.strokeStyle = COLORS.sin;
      ctx.beginPath(); ctx.moveTo(px, cy); ctx.lineTo(px, py); ctx.stroke(); // sin leg
    } else if (fn === 'acos') {
      ctx.strokeStyle = COLORS.cos;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(px, cy); ctx.stroke(); // cos leg
    } else {
      // tan = slope of the radius line; show the line itself dashed extended
      ctx.strokeStyle = COLORS.brand;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + R * 1.3 * Math.cos(theta), cy - R * 1.3 * Math.sin(theta)); ctx.stroke();
    }
    ctx.setLineDash([]);

    // radius arrow
    ctx.strokeStyle = COLORS.brand; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(px, py); ctx.stroke();

    // angle arc
    ctx.strokeStyle = '#a855f7'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, 26, 0, -theta, theta < 0); ctx.stroke();

    // point
    ctx.beginPath(); ctx.arc(px, py, 7, 0, TAU);
    ctx.fillStyle = '#fff'; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = COLORS.brand; ctx.stroke();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 360);
      const h = w;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w, h, cx: w / 2, cy: h / 2, r: w * 0.36 };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(draw, [fn, ratio]);

  const deg = (theta * 180) / Math.PI;
  const label = fn === 'asin' ? 'sin θ' : fn === 'acos' ? 'cos θ' : 'tan θ';
  const fname = fn === 'asin' ? 'arcsin' : fn === 'acos' ? 'arccos' : 'arctan';
  const rangeTxt = fn === 'asin' ? '[−90°, 90°]' : fn === 'acos' ? '[0°, 180°]' : '(−90°, 90°)';

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap gap-2">
        {(['asin', 'acos', 'atan'] as Fn[]).map((f) => (
          <button
            key={f}
            onClick={() => setFn(f)}
            class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              fn === f ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
            }`}
          >
            {f === 'asin' ? 'arcsin' : f === 'acos' ? 'arccos' : 'arctan'}
          </button>
        ))}
      </div>

      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

        <div class="space-y-3 text-sm">
          <label class="block">
            <span class="mb-1 block text-muted">known ratio {label} = {r.toFixed(2)}</span>
            <input
              type="range"
              min={isAtan ? -4 : -1} max={isAtan ? 4 : 1} step={0.01} value={ratio}
              onInput={(e) => setRatio(parseFloat((e.target as HTMLInputElement).value))}
              class="w-full accent-[#4f46e5]"
            />
          </label>

          <div class="rounded-lg bg-surface-2 p-3 font-mono text-sm">
            <div class="flex justify-between">
              <span class="text-muted">θ = {fname}({r.toFixed(2)})</span>
              <strong>{deg.toFixed(1)}°</strong>
            </div>
            <div class="flex justify-between">
              <span class="text-muted">in radians</span>
              <strong>{theta.toFixed(3)}</strong>
            </div>
          </div>

          <p class="text-xs text-muted">
            Each inverse returns ONE principal angle in the range <strong>{rangeTxt}</strong>, so it is a true function. Other
            angles share the same ratio, but the calculator hands you this canonical one.
          </p>
        </div>
      </div>
    </div>
  );
}
