import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Partial derivatives — slice a surface and read the slope.
   Top: heatmap of a heated metal plate z = f(x, y) with a slice line.
   Bottom: the 1-D cross-section along that slice, plus the tangent
   line whose slope is the partial derivative at the chosen point.
   ------------------------------------------------------------------ */

type Axis = 'x' | 'y';

// Temperature of a metal plate (two warm spots).
function temp(x: number, y: number): number {
  return (
    1.5 * Math.exp(-((x + 1) ** 2 + (y + 0.5) ** 2) / 2.4) +
    1.0 * Math.exp(-((x - 1.4) ** 2 + (y - 1.1) ** 2) / 1.4)
  );
}

const DOMAIN = 3;
const Z_MIN = 0;
const Z_MAX = 1.6;

function heatColor(t: number): string {
  const c = Math.max(0, Math.min(1, t));
  // dark blue (cool) → magenta → orange → yellow (hot)
  const stops: [number, [number, number, number]][] = [
    [0, [20, 30, 90]],
    [0.4, [130, 30, 120]],
    [0.7, [230, 90, 50]],
    [1, [250, 230, 90]],
  ];
  for (let i = 1; i < stops.length; i++) {
    if (c <= stops[i][0]) {
      const [t0, a] = stops[i - 1];
      const [t1, b] = stops[i];
      const f = (c - t0) / (t1 - t0);
      return `rgb(${Math.round(a[0] + f * (b[0] - a[0]))},${Math.round(
        a[1] + f * (b[1] - a[1]),
      )},${Math.round(a[2] + f * (b[2] - a[2]))})`;
    }
  }
  return 'rgb(250,230,90)';
}

export default function SurfaceSlicer() {
  const mapRef = useRef<HTMLCanvasElement>(null);
  const sliceRef = useRef<HTMLCanvasElement>(null);
  const mapSize = useRef({ w: 360, h: 360 });
  const sliceSize = useRef({ w: 360, h: 200 });

  const [axis, setAxis] = useState<Axis>('x');
  const [fixed, setFixed] = useState(0); // value of the held-constant variable
  const [pos, setPos] = useState(-0.5); // position along the slice

  // numeric partial derivative at the current point
  const partial = () => {
    const eps = 1e-3;
    if (axis === 'x') return (temp(pos + eps, fixed) - temp(pos - eps, fixed)) / (2 * eps);
    return (temp(fixed, pos + eps) - temp(fixed, pos - eps)) / (2 * eps);
  };
  const valueAt = () => (axis === 'x' ? temp(pos, fixed) : temp(fixed, pos));

  const drawMap = () => {
    const canvas = mapRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = mapSize.current;
    ctx.clearRect(0, 0, w, h);
    const cell = 5;
    for (let py = 0; py < h; py += cell) {
      for (let px = 0; px < w; px += cell) {
        const mx = (px / w) * 2 * DOMAIN - DOMAIN;
        const my = DOMAIN - (py / h) * 2 * DOMAIN;
        ctx.fillStyle = heatColor((temp(mx, my) - Z_MIN) / (Z_MAX - Z_MIN));
        ctx.fillRect(px, py, cell, cell);
      }
    }
    // slice line + moving point
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2.5;
    const tx = (v: number) => ((v + DOMAIN) / (2 * DOMAIN)) * w;
    const ty = (v: number) => ((DOMAIN - v) / (2 * DOMAIN)) * h;
    ctx.beginPath();
    if (axis === 'x') {
      ctx.moveTo(0, ty(fixed)); ctx.lineTo(w, ty(fixed));
    } else {
      ctx.moveTo(tx(fixed), 0); ctx.lineTo(tx(fixed), h);
    }
    ctx.stroke();
    const px = axis === 'x' ? tx(pos) : tx(fixed);
    const py = axis === 'x' ? ty(fixed) : ty(pos);
    ctx.beginPath(); ctx.arc(px, py, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#4f46e5'; ctx.fill();
    ctx.lineWidth = 2.5; ctx.strokeStyle = '#fff'; ctx.stroke();
  };

  const drawSlice = () => {
    const canvas = sliceRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sliceSize.current;
    ctx.clearRect(0, 0, w, h);
    const pad = 8;
    const sx = (v: number) => pad + ((v + DOMAIN) / (2 * DOMAIN)) * (w - 2 * pad);
    const sy = (z: number) => h - pad - ((z - Z_MIN) / (Z_MAX - Z_MIN)) * (h - 2 * pad);
    // baseline
    ctx.strokeStyle = 'rgba(128,128,128,0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pad, sy(0)); ctx.lineTo(w - pad, sy(0)); ctx.stroke();
    // cross-section curve
    ctx.strokeStyle = '#0ea5e9';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i <= 200; i++) {
      const v = -DOMAIN + (i / 200) * 2 * DOMAIN;
      const z = axis === 'x' ? temp(v, fixed) : temp(fixed, v);
      const X = sx(v); const Y = sy(z);
      if (i === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
    }
    ctx.stroke();
    // tangent line (slope = partial derivative)
    const m = partial();
    const z0 = valueAt();
    const tangentZ = (v: number) => z0 + m * (v - pos);
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    const v1 = pos - 1.2, v2 = pos + 1.2;
    ctx.moveTo(sx(v1), sy(tangentZ(v1)));
    ctx.lineTo(sx(v2), sy(tangentZ(v2)));
    ctx.stroke();
    ctx.setLineDash([]);
    // point
    ctx.beginPath(); ctx.arc(sx(pos), sy(z0), 6, 0, Math.PI * 2);
    ctx.fillStyle = '#4f46e5'; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
    // axis label
    ctx.fillStyle = 'rgba(128,128,128,0.9)';
    ctx.font = '600 12px Inter, sans-serif';
    ctx.fillText(axis === 'x' ? 'moving along x →' : 'moving along y →', pad + 2, 14);
  };

  useEffect(() => {
    const resize = () => {
      const map = mapRef.current, slice = sliceRef.current;
      if (!map || !slice) return;
      const parent = map.parentElement!;
      const w = Math.min(parent.clientWidth, 360);
      const dpr = window.devicePixelRatio || 1;
      // map (square)
      map.width = w * dpr; map.height = w * dpr;
      map.style.width = `${w}px`; map.style.height = `${w}px`;
      map.getContext('2d')?.setTransform(dpr, 0, 0, dpr, 0, 0);
      mapSize.current = { w, h: w };
      // slice (shorter)
      const sh = Math.round(w * 0.55);
      slice.width = w * dpr; slice.height = sh * dpr;
      slice.style.width = `${w}px`; slice.style.height = `${sh}px`;
      slice.getContext('2d')?.setTransform(dpr, 0, 0, dpr, 0, 0);
      sliceSize.current = { w, h: sh };
      drawMap(); drawSlice();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(() => { drawMap(); drawSlice(); }, [axis, fixed, pos]);

  const m = partial();

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <span class="text-sm text-muted">Slice along:</span>
        {(['x', 'y'] as Axis[]).map((ax) => (
          <button
            key={ax}
            onClick={() => setAxis(ax)}
            class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              axis === ax ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
            }`}
          >
            {ax === 'x' ? '∂f/∂x (vary x)' : '∂f/∂y (vary y)'}
          </button>
        ))}
      </div>

      <div class="grid gap-4 md:grid-cols-2 md:items-start">
        <div class="space-y-2">
          <canvas ref={mapRef} class="touch-none rounded-xl bg-surface-2" />
          <p class="text-xs text-muted">Heat map of the plate. The white line is the slice you are looking at.</p>
        </div>
        <div class="space-y-3 text-sm">
          <canvas ref={sliceRef} class="touch-none rounded-xl bg-surface-2" />
          <label class="block">
            <span class="mb-1 block text-muted">
              hold {axis === 'x' ? 'y' : 'x'} = {fixed.toFixed(2)}
            </span>
            <input type="range" min={-DOMAIN} max={DOMAIN} step={0.05} value={fixed}
              onInput={(e) => setFixed(parseFloat((e.target as HTMLInputElement).value))}
              class="w-full accent-[#0ea5e9]" />
          </label>
          <label class="block">
            <span class="mb-1 block text-muted">
              point at {axis} = {pos.toFixed(2)}
            </span>
            <input type="range" min={-DOMAIN} max={DOMAIN} step={0.05} value={pos}
              onInput={(e) => setPos(parseFloat((e.target as HTMLInputElement).value))}
              class="w-full accent-[#4f46e5]" />
          </label>
          <div class="rounded-lg bg-surface-2 p-3">
            <div class="flex justify-between">
              <span class="text-muted">{axis === 'x' ? '∂f/∂x' : '∂f/∂y'} (slope)</span>
              <strong class="font-mono">{m.toFixed(2)}</strong>
            </div>
            <p class="mt-1 text-xs text-muted">
              {Math.abs(m) < 0.05
                ? 'Flat in this direction — a partial derivative of (almost) zero.'
                : m > 0
                ? 'Rising as you move along this axis (positive slope).'
                : 'Falling as you move along this axis (negative slope).'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
