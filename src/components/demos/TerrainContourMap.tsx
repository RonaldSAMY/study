import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Functions of several variables — a hoverable terrain map.
   z = f(x, y) is drawn as a colored heatmap with contour lines.
   Move the pointer to read the elevation at any (x, y) point.
   ------------------------------------------------------------------ */

type Vec = { x: number; y: number };

// Terrain elevation in metres-ish units. Two hills and a small valley.
function elevation(x: number, y: number): number {
  return (
    1.7 * Math.exp(-((x - 1) ** 2 + (y - 1) ** 2) / 1.6) +
    1.1 * Math.exp(-((x + 1.3) ** 2 + (y + 0.9) ** 2) / 0.9) -
    0.6 * Math.exp(-((x - 0.6) ** 2 + (y + 1.4) ** 2) / 0.5)
  );
}

const DOMAIN = 3; // x, y range is [-DOMAIN, DOMAIN]
const Z_MIN = -0.7;
const Z_MAX = 1.8;

// A terrain colormap: deep teal (low) → green → tan → snowy white (high).
function terrainColor(t: number): [number, number, number] {
  const stops: [number, [number, number, number]][] = [
    [0.0, [14, 74, 92]],
    [0.35, [16, 132, 110]],
    [0.55, [120, 168, 78]],
    [0.72, [206, 184, 110]],
    [0.88, [150, 120, 92]],
    [1.0, [245, 245, 248]],
  ];
  const c = Math.max(0, Math.min(1, t));
  for (let i = 1; i < stops.length; i++) {
    if (c <= stops[i][0]) {
      const [t0, c0] = stops[i - 1];
      const [t1, c1] = stops[i];
      const f = (c - t0) / (t1 - t0);
      return [
        Math.round(c0[0] + f * (c1[0] - c0[0])),
        Math.round(c0[1] + f * (c1[1] - c0[1])),
        Math.round(c0[2] + f * (c1[2] - c0[2])),
      ];
    }
  }
  return stops[stops.length - 1][1];
}

export default function TerrainContourMap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 460, h: 460 });
  const [hover, setHover] = useState<Vec | null>(null);
  const hoverRef = useRef<Vec | null>(null);

  const toMath = (px: number, py: number): Vec => {
    const { w, h } = sizeRef.current;
    return {
      x: (px / w) * 2 * DOMAIN - DOMAIN,
      y: DOMAIN - (py / h) * 2 * DOMAIN,
    };
  };
  const toPx = (v: Vec) => {
    const { w, h } = sizeRef.current;
    return { x: ((v.x + DOMAIN) / (2 * DOMAIN)) * w, y: ((DOMAIN - v.y) / (2 * DOMAIN)) * h };
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);

    // heatmap (blocky fill for speed)
    const cell = 4;
    for (let py = 0; py < h; py += cell) {
      for (let px = 0; px < w; px += cell) {
        const m = toMath(px + cell / 2, py + cell / 2);
        const z = elevation(m.x, m.y);
        const t = (z - Z_MIN) / (Z_MAX - Z_MIN);
        const [r, g, b] = terrainColor(t);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(px, py, cell, cell);
      }
    }

    // contour lines via marching-squares-lite: draw cells where elevation
    // crosses a level by checking sign changes along a fine grid.
    const levels = [-0.4, -0.1, 0.2, 0.5, 0.8, 1.1, 1.4, 1.6];
    const N = 120;
    const step = (2 * DOMAIN) / N;
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    for (const lv of levels) {
      ctx.beginPath();
      for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
          const x0 = -DOMAIN + i * step;
          const y0 = -DOMAIN + j * step;
          const a = elevation(x0, y0) - lv;
          const bb = elevation(x0 + step, y0) - lv;
          const c = elevation(x0, y0 + step) - lv;
          // horizontal crossing on bottom edge
          if (a * bb < 0) {
            const f = a / (a - bb);
            const p = toPx({ x: x0 + f * step, y: y0 });
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x + 0.6, p.y + 0.6);
          }
          // vertical crossing on left edge
          if (a * c < 0) {
            const f = a / (a - c);
            const p = toPx({ x: x0, y: y0 + f * step });
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x + 0.6, p.y + 0.6);
          }
        }
      }
      ctx.stroke();
    }

    // hover crosshair + marker
    const hv = hoverRef.current;
    if (hv) {
      const p = toPx(hv);
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(p.x, 0); ctx.lineTo(p.x, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, p.y); ctx.lineTo(w, p.y); ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#4f46e5'; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 460);
      const h = w;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w, h };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(draw, [hover]);

  const onMove = (e: PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const m = toMath(e.clientX - rect.left, e.clientY - rect.top);
    hoverRef.current = m;
    setHover(m);
  };
  const onLeave = () => { hoverRef.current = null; setHover(null); };

  const z = hover ? elevation(hover.x, hover.y) : null;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas
          ref={canvasRef}
          class="touch-none rounded-xl bg-surface-2"
          onPointerMove={onMove}
          onPointerDown={onMove}
          onPointerLeave={onLeave}
        />
        <div class="space-y-3 text-sm">
          <p class="text-muted">
            Hover (or tap and drag) anywhere on the terrain to read its elevation
            <span class="whitespace-nowrap"> z = f(x, y)</span>.
          </p>
          <div class="grid grid-cols-3 gap-2">
            <Readout label="x (east)" value={hover ? hover.x.toFixed(2) : '—'} />
            <Readout label="y (north)" value={hover ? hover.y.toFixed(2) : '—'} />
            <Readout label="z (height)" value={z !== null ? z.toFixed(2) : '—'} />
          </div>
          <div class="rounded-lg bg-surface-2 p-3 text-xs text-muted">
            Bright rings are <strong class="text-text">contour lines</strong> — each
            traces points of equal height, exactly like a hiking map. Where rings bunch
            together, the slope is steep.
          </div>
          <div class="flex items-center gap-2 text-xs text-muted">
            <span>low</span>
            <div class="h-3 flex-1 rounded-full"
              style="background:linear-gradient(90deg,#0e4a5c,#10846e,#78a84e,#ceb86e,#96785c,#f5f5f8)" />
            <span>high</span>
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
