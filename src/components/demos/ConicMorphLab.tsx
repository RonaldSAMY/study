import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   ConicMorphLab — morph between the four conics by varying ECCENTRICITY.

   We draw the focus–directrix polar curve  r = l / (1 + e·cosθ),
   where l is the semi-latus rectum (size) and e the eccentricity:
     e = 0        → circle
     0 < e < 1    → ellipse
     e = 1        → parabola
     e > 1        → hyperbola
   The focus sits at the origin. We sweep θ, convert to pixels, and
   BREAK the path wherever the denominator (1 + e·cosθ) is near zero
   or negative (the branch that runs off to infinity) so the hyperbola
   and parabola never draw garbage lines across the canvas.
   ------------------------------------------------------------------ */

type Vec = { x: number; y: number };

const COLORS = {
  curve: '#10b981',
  focus: '#4f46e5',
  guide: '#0ea5e9',
  grid: 'rgba(128,128,128,0.18)',
  axis: 'rgba(128,128,128,0.5)',
  dash: 'rgba(128,128,128,0.6)',
};

function conicName(e: number): { name: string; blurb: string } {
  if (e < 0.001) return { name: 'Circle', blurb: 'Every point the same distance from the centre.' };
  if (e < 0.999) return { name: 'Ellipse', blurb: 'A closed, squashed loop with two foci.' };
  if (e <= 1.001) return { name: 'Parabola', blurb: 'The boundary case — it opens up forever.' };
  return { name: 'Hyperbola', blurb: 'Two open branches that fly off along asymptotes.' };
}

export default function ConicMorphLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [e, setE] = useState(0.5); // eccentricity
  const [l, setL] = useState(3); // semi-latus rectum (size)
  const sizeRef = useRef({ w: 480, h: 360, scale: 36, ox: 240, oy: 180 });

  const toPx = (v: Vec) => {
    const { scale, ox, oy } = sizeRef.current;
    return { x: ox + v.x * scale, y: oy - v.y * scale };
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h, scale, ox, oy } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);

    // grid
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    for (let gx = ox % scale; gx < w; gx += scale) {
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke();
    }
    for (let gy = oy % scale; gy < h; gy += scale) {
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke();
    }
    // axes
    ctx.strokeStyle = COLORS.axis;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, oy); ctx.lineTo(w, oy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ox, 0); ctx.lineTo(ox, h); ctx.stroke();

    // ---- the conic curve, r = l / (1 + e·cosθ) ----
    ctx.strokeStyle = COLORS.curve;
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    const STEP = 0.004; // radians
    let drawing = false;
    ctx.beginPath();
    for (let theta = 0; theta <= Math.PI * 2 + STEP; theta += STEP) {
      const denom = 1 + e * Math.cos(theta);
      // break the path where the curve goes to infinity / wrong branch
      if (denom <= 0.02) { drawing = false; continue; }
      const r = l / denom;
      // clip absurdly large radii so off-screen branches don't span the canvas
      if (r > 60) { drawing = false; continue; }
      const p = toPx({ x: r * Math.cos(theta), y: r * Math.sin(theta) });
      // also break if a single step jumps very far in pixels (safety)
      if (!drawing) {
        ctx.moveTo(p.x, p.y);
        drawing = true;
      } else {
        ctx.lineTo(p.x, p.y);
      }
    }
    ctx.stroke();

    // ---- directrix (vertical line at x = l / e), shown for e > 0 ----
    if (e > 0.001) {
      const dx = l / e;
      const dpx = toPx({ x: dx, y: 0 }).x;
      if (dpx > 0 && dpx < w) {
        ctx.save();
        ctx.setLineDash([6, 6]);
        ctx.strokeStyle = COLORS.guide;
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(dpx, 0); ctx.lineTo(dpx, h); ctx.stroke();
        ctx.restore();
        ctx.font = '600 12px Inter, sans-serif';
        ctx.fillStyle = COLORS.guide;
        ctx.fillText('directrix', Math.min(dpx + 6, w - 64), 16);
      }
    }

    // ---- focus marker at the origin ----
    const f = toPx({ x: 0, y: 0 });
    ctx.beginPath(); ctx.arc(f.x, f.y, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#fff'; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = COLORS.focus; ctx.stroke();
    ctx.font = '600 13px Inter, sans-serif';
    ctx.fillStyle = COLORS.focus;
    ctx.fillText('focus', f.x + 10, f.y - 8);
  };

  // responsive sizing with devicePixelRatio
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 560);
      const h = Math.round(w * 0.72);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const scale = Math.max(14, Math.min(30, w / 18));
      // shift origin (focus) left of centre so opening curves have room
      sizeRef.current = { w, h, scale, ox: w * 0.42, oy: h / 2 };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // redraw on state change
  useEffect(draw, [e, l]);

  const info = conicName(e);

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

        <div class="space-y-4 text-sm">
          <div class="rounded-lg bg-surface-2 p-3">
            <div class="flex items-baseline justify-between">
              <span class="text-muted">This conic is a</span>
              <strong class="text-lg" style={`color:${COLORS.curve}`}>{info.name}</strong>
            </div>
            <p class="mt-1 text-xs text-muted">{info.blurb}</p>
          </div>

          <label class="block">
            <span class="mb-1 block text-muted">eccentricity e = {e.toFixed(2)}</span>
            <input
              type="range" min={0} max={2.4} step={0.01} value={e}
              onInput={(ev) => setE(parseFloat((ev.target as HTMLInputElement).value))}
              class="w-full accent-[#10b981]"
            />
            <span class="mt-1 flex justify-between text-[0.7rem] text-muted">
              <span>0 circle</span><span>&lt;1 ellipse</span><span>1 parab.</span><span>&gt;1 hyperb.</span>
            </span>
          </label>

          <label class="block">
            <span class="mb-1 block text-muted">size (semi-latus rectum) l = {l.toFixed(1)}</span>
            <input
              type="range" min={1} max={6} step={0.1} value={l}
              onInput={(ev) => setL(parseFloat((ev.target as HTMLInputElement).value))}
              class="w-full accent-[#10b981]"
            />
          </label>

          <div class="grid grid-cols-2 gap-2">
            <Readout label="e" value={e.toFixed(2)} />
            <Readout label="type" value={info.name} />
          </div>

          <p class="text-xs text-muted">
            Slide <strong>e</strong> from 0 upward and watch one curve morph through all four conics.
            The <span style={`color:${COLORS.focus}`}>focus</span> stays put at the origin.
          </p>
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
