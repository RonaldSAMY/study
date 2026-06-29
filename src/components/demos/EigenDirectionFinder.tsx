import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Eigenvector finder.
   - Adjust the four entries of a 2x2 matrix with sliders.
   - Many unit vectors (sky) are sampled around the circle; each is
     transformed (faint indigo). Vectors that land on the SAME line
     they started on are eigenvectors — they are highlighted in green
     and the eigen-lines + eigenvalues (stretch factors) are drawn.
   ------------------------------------------------------------------ */

type Vec = { x: number; y: number };

const COLORS = {
  unit: 'rgba(14,165,233,0.45)',
  mapped: 'rgba(79,70,229,0.40)',
  eigen: '#10b981',
  grid: 'rgba(128,128,128,0.16)',
  axis: 'rgba(128,128,128,0.5)',
};

export default function EigenDirectionFinder() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [m, setM] = useState({ a: 2, b: 1, c: 0, d: 1 });
  const sizeRef = useRef({ w: 480, h: 360, scale: 36, ox: 240, oy: 180 });

  const toPx = (v: Vec) => {
    const { scale, ox, oy } = sizeRef.current;
    return { x: ox + v.x * scale, y: oy - v.y * scale };
  };
  const apply = (v: Vec): Vec => ({ x: m.a * v.x + m.b * v.y, y: m.c * v.x + m.d * v.y });

  // real eigenvalues/eigenvectors of [[a,b],[c,d]]
  const eig = () => {
    const { a, b, c, d } = m;
    const tr = a + d;
    const det = a * d - b * c;
    const disc = tr * tr / 4 - det;
    if (disc < -1e-9) return null; // complex -> rotation-like, no real eigenvectors
    const s = Math.sqrt(Math.max(0, disc));
    const l1 = tr / 2 + s;
    const l2 = tr / 2 - s;
    const vecFor = (l: number): Vec => {
      // solve (A - lI) v = 0
      if (Math.abs(b) > 1e-9) return norm({ x: b, y: l - a });
      if (Math.abs(c) > 1e-9) return norm({ x: l - d, y: c });
      // diagonal: axes are eigenvectors
      return Math.abs(a - l) < 1e-9 ? { x: 1, y: 0 } : { x: 0, y: 1 };
    };
    return [{ l: l1, v: vecFor(l1) }, { l: l2, v: vecFor(l2) }];
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h, scale, ox, oy } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);

    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    for (let gx = ox % scale; gx < w; gx += scale) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke(); }
    for (let gy = oy % scale; gy < h; gy += scale) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke(); }
    ctx.strokeStyle = COLORS.axis; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, oy); ctx.lineTo(w, oy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ox, 0); ctx.lineTo(ox, h); ctx.stroke();

    const origin = { x: ox, y: oy };
    const NUM = 48;
    for (let i = 0; i < NUM; i++) {
      const th = (i / NUM) * Math.PI * 2;
      const u = { x: Math.cos(th), y: Math.sin(th) };
      const mu = apply(u);
      // input unit vector (short)
      const p0 = toPx({ x: u.x, y: u.y });
      ctx.strokeStyle = COLORS.unit; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(origin.x, origin.y); ctx.lineTo(p0.x, p0.y); ctx.stroke();
      // mapped vector
      const p1 = toPx(mu);
      ctx.strokeStyle = COLORS.mapped; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(origin.x, origin.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
    }

    const e = eig();
    if (e) {
      for (const { l, v } of e) {
        if (!isFinite(l)) continue;
        // eigen-line
        const far = 40;
        ctx.strokeStyle = 'rgba(16,185,129,0.45)';
        ctx.lineWidth = 1.5;
        const a0 = toPx({ x: -v.x * far, y: -v.y * far });
        const a1 = toPx({ x: v.x * far, y: v.y * far });
        ctx.beginPath(); ctx.moveTo(a0.x, a0.y); ctx.lineTo(a1.x, a1.y); ctx.stroke();
        // eigenvector (unit) and its image (scaled by lambda)
        arrow(ctx, origin, toPx(v), COLORS.eigen, 3.5);
        const img = { x: v.x * l, y: v.y * l };
        arrow(ctx, origin, toPx(img), '#0d9488', 2.5);
        label(ctx, toPx(img), `λ=${l.toFixed(2)}`, COLORS.eigen);
      }
    }
  };

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
      const scale = Math.max(20, Math.min(38, w / 14));
      sizeRef.current = { w, h, scale, ox: w / 2, oy: h / 2 };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(draw, [m]);

  const e = eig();
  const complex = !e;

  const set = (key: 'a' | 'b' | 'c' | 'd') => (ev: Event) =>
    setM({ ...m, [key]: parseFloat((ev.target as HTMLInputElement).value) });

  const presets: Record<string, typeof m> = {
    'Shear': { a: 1, b: 1, c: 0, d: 1 },
    'Stretch': { a: 2, b: 0, c: 0, d: 0.5 },
    'Rotation': { a: 0, b: -1, c: 1, d: 0 },
    'Symmetric': { a: 2, b: 1, c: 1, d: 2 },
  };

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap gap-2">
        {Object.keys(presets).map((name) => (
          <button
            key={name}
            onClick={() => setM(presets[name])}
            class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted transition hover:text-text"
          >
            {name}
          </button>
        ))}
      </div>
      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />
        <div class="space-y-3 text-sm">
          <p class="text-muted">Sky = input directions, indigo = where they land. Green = directions that stay on their own line (eigenvectors).</p>
          <div class="grid grid-cols-2 gap-3">
            {(['a', 'b', 'c', 'd'] as const).map((key) => (
              <label key={key} class="block">
                <span class="mb-1 block text-muted">{key} = {m[key].toFixed(1)}</span>
                <input type="range" min={-3} max={3} step={0.1} value={m[key]} onInput={set(key)} class="w-full accent-[#10b981]" />
              </label>
            ))}
          </div>
          <div class={`rounded-lg p-3 ${complex ? 'bg-geometry/10 text-geometry' : 'bg-surface-2'}`}>
            {complex ? (
              <p class="text-xs">No real eigenvectors — this matrix <strong>rotates</strong> every direction, so none stays on its own line. (The eigenvalues are complex.)</p>
            ) : (
              <div class="space-y-1">
                {e!.map((x, i) => (
                  <div key={i} class="flex justify-between">
                    <span class="text-muted">λ{i + 1}</span>
                    <strong>{x.l.toFixed(2)} <span class="font-normal text-muted">along ({x.v.x.toFixed(2)}, {x.v.y.toFixed(2)})</span></strong>
                  </div>
                ))}
                <p class="pt-1 text-xs text-muted">Each λ is the stretch factor along its eigen-line.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function norm(v: Vec): Vec { const L = Math.hypot(v.x, v.y) || 1; return { x: v.x / L, y: v.y / L }; }
function arrow(ctx: CanvasRenderingContext2D, from: Vec, to: Vec, color: string, width: number) {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const head = 11;
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(to.x - head * Math.cos(angle - 0.4), to.y - head * Math.sin(angle - 0.4));
  ctx.lineTo(to.x - head * Math.cos(angle + 0.4), to.y - head * Math.sin(angle + 0.4));
  ctx.closePath(); ctx.fill();
}
function label(ctx: CanvasRenderingContext2D, at: Vec, text: string, color: string) {
  ctx.font = '600 13px Inter, sans-serif';
  ctx.fillStyle = color;
  ctx.fillText(text, at.x + 10, at.y - 8);
}
