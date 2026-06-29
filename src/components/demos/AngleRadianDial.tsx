import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Angles & radians dial.
   - Drag the point around the circle (or use the slider) to set an angle.
   - Reads out the angle in BOTH degrees and radians, and the arc length
     swept on a circle of the chosen radius.
   - The swept arc is highlighted in emerald.
   ------------------------------------------------------------------ */

const COLORS = {
  brand: '#4f46e5',
  sky: '#0ea5e9',
  arc: '#10b981',
  grid: 'rgba(128,128,128,0.18)',
  axis: 'rgba(128,128,128,0.5)',
};

const TAU = Math.PI * 2;

export default function AngleRadianDial() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [theta, setTheta] = useState(Math.PI / 3); // radians, 0..2π
  const [radius, setRadius] = useState(2); // metres
  const draggingRef = useRef(false);
  const sizeRef = useRef({ w: 420, h: 420, cx: 210, cy: 210, r: 150 });

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h, cx, cy, r } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);

    // axes
    ctx.strokeStyle = COLORS.axis;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(w, cy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, h); ctx.stroke();

    // base circle
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke();

    // swept arc (counter-clockwise from positive x-axis)
    ctx.strokeStyle = COLORS.arc;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, -theta, true); // canvas y is flipped → negative angle
    ctx.stroke();

    // radius line to the point
    const px = cx + r * Math.cos(theta);
    const py = cy - r * Math.sin(theta);
    ctx.strokeStyle = COLORS.brand;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(px, py); ctx.stroke();

    // small angle marker near the centre
    ctx.strokeStyle = COLORS.sky;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, 26, 0, -theta, true); ctx.stroke();

    // draggable handle
    ctx.beginPath(); ctx.arc(px, py, 8, 0, TAU);
    ctx.fillStyle = '#fff'; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = COLORS.brand; ctx.stroke();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 420);
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

  useEffect(draw, [theta, radius]);

  const pointerAngle = (e: PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const { cx, cy } = sizeRef.current;
    const dx = e.clientX - rect.left - cx;
    const dy = cy - (e.clientY - rect.top);
    let ang = Math.atan2(dy, dx);
    if (ang < 0) ang += TAU;
    return ang;
  };

  const onDown = (e: PointerEvent) => {
    draggingRef.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setTheta(pointerAngle(e));
    e.preventDefault();
  };
  const onMove = (e: PointerEvent) => {
    if (!draggingRef.current) return;
    setTheta(pointerAngle(e));
  };
  const onUp = () => { draggingRef.current = false; };

  const deg = (theta * 180) / Math.PI;
  const arcLen = radius * theta;
  // radians as a multiple of π for a friendly readout
  const piFrac = theta / Math.PI;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas
          ref={canvasRef}
          class="touch-none rounded-xl bg-surface-2"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        />

        <div class="space-y-3 text-sm">
          <p class="text-muted">Drag the dot around the circle, or use the slider, to sweep an angle.</p>

          <label class="block">
            <span class="mb-1 block text-muted">angle = {deg.toFixed(0)}°</span>
            <input
              type="range" min={0} max={360} step={1} value={deg}
              onInput={(e) => setTheta((parseFloat((e.target as HTMLInputElement).value) * Math.PI) / 180)}
              class="w-full accent-[#4f46e5]"
            />
          </label>

          <div class="grid grid-cols-2 gap-2">
            <Readout label="degrees" value={`${deg.toFixed(1)}°`} />
            <Readout label="radians" value={`${theta.toFixed(3)}`} />
            <Readout label="in terms of π" value={`${piFrac.toFixed(2)}π`} />
            <Readout label="fraction of turn" value={`${(theta / TAU).toFixed(2)}`} />
          </div>

          <label class="block">
            <span class="mb-1 block text-muted">circle radius = {radius.toFixed(1)} m</span>
            <input
              type="range" min={0.5} max={5} step={0.1} value={radius}
              onInput={(e) => setRadius(parseFloat((e.target as HTMLInputElement).value))}
              class="w-full accent-[#10b981]"
            />
          </label>

          <div class="rounded-lg bg-surface-2 p-3">
            <div class="flex justify-between"><span class="text-muted">arc length s = r·θ</span><strong>{arcLen.toFixed(2)} m</strong></div>
            <p class="mt-1 text-xs text-muted">
              The emerald arc has length <strong>r · θ</strong> only when θ is in <strong>radians</strong> — that is the whole reason radians win.
            </p>
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
