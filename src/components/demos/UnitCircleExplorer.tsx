import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Interactive unit-circle explorer.
   - Drag the point around the circle (left) to set the angle theta.
   - A slider gives an alternative, synced control over theta.
   - Right side traces the sine (or cosine) wave as theta grows.
   - Press Play to sweep theta and watch the wave unfold.
   - Crisp, responsive canvas in the VectorPlayground style.
   ------------------------------------------------------------------ */

type Func = 'sin' | 'cos';

const COLORS = {
  circle: '#4f46e5', // indigo (circle + radius)
  sin: '#10b981', // emerald
  cos: '#0ea5e9', // sky
  grid: 'rgba(128,128,128,0.18)',
  axis: 'rgba(128,128,128,0.5)',
  dash: 'rgba(128,128,128,0.7)',
};

const TAU = Math.PI * 2;

type Layout = {
  w: number;
  h: number;
  cx: number;
  cy: number;
  R: number;
  waveX0: number;
  waveW: number;
  amp: number;
};

export default function UnitCircleExplorer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [theta, setTheta] = useState(Math.PI / 4);
  const [func, setFunc] = useState<Func>('sin');
  const [playing, setPlaying] = useState(false);
  const dragRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef<number | null>(null);
  const layoutRef = useRef<Layout>({
    w: 560,
    h: 300,
    cx: 110,
    cy: 150,
    R: 90,
    waveX0: 240,
    waveW: 280,
    amp: 90,
  });

  const f = (t: number) => (func === 'sin' ? Math.sin(t) : Math.cos(t));

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h, cx, cy, R, waveX0, waveW, amp } = layoutRef.current;
    ctx.clearRect(0, 0, w, h);

    // current point on the circle
    const px = cx + R * Math.cos(theta);
    const py = cy - R * Math.sin(theta);
    const val = f(theta);
    const waveY = cy - amp * val;

    // ---------- LEFT: unit circle ----------
    // axes through the circle centre
    ctx.strokeStyle = COLORS.axis;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(cx - R - 16, cy); ctx.lineTo(cx + R + 16, cy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, cy - R - 16); ctx.lineTo(cx, cy + R + 16); ctx.stroke();

    // the unit circle
    ctx.strokeStyle = COLORS.circle;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();

    // angle arc at the origin
    ctx.strokeStyle = COLORS.circle;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, 26, 0, -theta, true); ctx.stroke();

    // cos leg (horizontal, sky)
    ctx.strokeStyle = COLORS.cos;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(px, cy); ctx.stroke();

    // sin leg (vertical, emerald)
    ctx.strokeStyle = COLORS.sin;
    ctx.beginPath(); ctx.moveTo(px, cy); ctx.lineTo(px, py); ctx.stroke();

    // radius line (indigo)
    ctx.strokeStyle = COLORS.circle;
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(px, py); ctx.stroke();

    // draggable handle on the circle
    handle(ctx, px, py, COLORS.circle);

    // ---------- connector from circle height to the wave ----------
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = COLORS.dash;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(px, waveY); ctx.lineTo(waveX0 + (theta / TAU) * waveW, waveY); ctx.stroke();
    ctx.restore();

    // ---------- RIGHT: the traced wave ----------
    const waveColor = func === 'sin' ? COLORS.sin : COLORS.cos;
    // wave axis (theta axis)
    ctx.strokeStyle = COLORS.axis;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(waveX0, cy); ctx.lineTo(waveX0 + waveW, cy); ctx.stroke();
    // vertical axis at theta = 0
    ctx.beginPath(); ctx.moveTo(waveX0, cy - amp - 12); ctx.lineTo(waveX0, cy + amp + 12); ctx.stroke();

    // faint full reference curve 0..2pi
    ctx.strokeStyle = 'rgba(128,128,128,0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i <= 120; i++) {
      const t = (i / 120) * TAU;
      const x = waveX0 + (t / TAU) * waveW;
      const y = cy - amp * f(t);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();

    // bold traced portion 0..theta
    ctx.strokeStyle = waveColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    const steps = Math.max(2, Math.round((theta / TAU) * 120));
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * theta;
      const x = waveX0 + (t / TAU) * waveW;
      const y = cy - amp * f(t);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();

    // current point on the wave
    const wpx = waveX0 + (theta / TAU) * waveW;
    handle(ctx, wpx, waveY, waveColor);

    // small axis labels
    ctx.fillStyle = 'rgba(128,128,128,0.8)';
    ctx.font = '600 11px Inter, sans-serif';
    ctx.fillText('0', waveX0 - 3, cy + amp + 26);
    ctx.fillText('2π', waveX0 + waveW - 10, cy + amp + 26);
    ctx.fillText(func === 'sin' ? 'sin θ' : 'cos θ', waveX0 + 6, cy - amp - 2);
  };

  // ---- responsive sizing with devicePixelRatio ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 680);
      const h = Math.max(240, Math.min(340, Math.round(w * 0.52)));
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const pad = 18;
      const cy = h / 2;
      const R = Math.max(48, Math.min(h * 0.36, w * 0.2));
      const cx = pad + R + 16;
      const waveX0 = cx + R + 34;
      const waveW = Math.max(60, w - pad - waveX0);
      layoutRef.current = { w, h, cx, cy, R, waveX0, waveW, amp: R };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // redraw whenever state changes
  useEffect(draw, [theta, func]);

  // ---- play / pause animation ----
  useEffect(() => {
    if (!playing) {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastRef.current = null;
      return;
    }
    const omega = TAU / 6; // one full sweep every ~6 seconds
    const step = (ts: number) => {
      if (lastRef.current == null) lastRef.current = ts;
      const dt = (ts - lastRef.current) / 1000;
      lastRef.current = ts;
      setTheta((prev) => (prev + omega * dt) % TAU);
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastRef.current = null;
    };
  }, [playing]);

  // ---- pointer dragging on the circle ----
  const pointer = (e: PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { px: e.clientX - rect.left, py: e.clientY - rect.top };
  };
  const angleFrom = (px: number, py: number) => {
    const { cx, cy } = layoutRef.current;
    let ang = Math.atan2(cy - py, px - cx);
    if (ang < 0) ang += TAU;
    return ang;
  };

  const onDown = (e: PointerEvent) => {
    const { px, py } = pointer(e);
    const { cx, cy, R } = layoutRef.current;
    if (Math.hypot(px - cx, py - cy) <= R + 34) {
      dragRef.current = true;
      setPlaying(false);
      setTheta(angleFrom(px, py));
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      e.preventDefault();
    }
  };
  const onMove = (e: PointerEvent) => {
    if (!dragRef.current) return;
    const { px, py } = pointer(e);
    setTheta(angleFrom(px, py));
  };
  const onUp = () => { dragRef.current = false; };

  // ---- live numeric readout ----
  const deg = (theta * 180) / Math.PI;
  const sinV = Math.sin(theta);
  const cosV = Math.cos(theta);
  const tanV = Math.abs(cosV) < 1e-6 ? null : sinV / cosV;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setPlaying((p) => !p)}
          class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white transition hover:opacity-90"
        >
          {playing ? '⏸ Pause' : '▶ Play'}
        </button>
        {(['sin', 'cos'] as Func[]).map((m) => (
          <button
            key={m}
            onClick={() => setFunc(m)}
            class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              func === m ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
            }`}
          >
            trace {m === 'sin' ? 'sin θ' : 'cos θ'}
          </button>
        ))}
      </div>

      <div class="grid gap-4 md:grid-cols-[1fr,auto] md:items-start">
        <canvas
          ref={canvasRef}
          class="touch-none rounded-xl bg-surface-2"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        />

        <div class="space-y-3 text-sm">
          <p class="text-muted">Drag the point around the circle, or use the slider.</p>

          <label class="block">
            <span class="mb-1 block text-muted">θ = {theta.toFixed(2)} rad ({deg.toFixed(0)}°)</span>
            <input
              type="range" min={0} max={TAU} step={0.01} value={theta}
              onInput={(e) => { setPlaying(false); setTheta(parseFloat((e.target as HTMLInputElement).value)); }}
              class="w-full accent-[#4f46e5]"
            />
          </label>

          <div class="grid grid-cols-2 gap-2">
            <Readout label="sin θ" color={COLORS.sin} value={sinV.toFixed(3)} />
            <Readout label="cos θ" color={COLORS.cos} value={cosV.toFixed(3)} />
            <Readout label="tan θ" value={tanV === null ? '∞' : tanV.toFixed(3)} />
            <Readout label="θ°" value={`${deg.toFixed(1)}°`} />
          </div>

          <div class="rounded-lg bg-surface-2 p-3 text-xs text-muted">
            The point is at <strong>(cos θ, sin θ)</strong>. Its height (emerald) is exactly the
            sine wave being traced on the right.
          </div>
        </div>
      </div>
    </div>
  );
}

function Readout({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div class="rounded-lg bg-surface-2 px-3 py-2">
      <span class="text-muted" style={color ? `color:${color}` : ''}>{label}</span>
      <div class="font-mono font-semibold">{value}</div>
    </div>
  );
}

// ---- canvas drawing primitive ----
function handle(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
  ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2);
  ctx.fillStyle = '#fff'; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = color; ctx.stroke();
}
