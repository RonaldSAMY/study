import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   The Hessian — curvature at a critical point of a loss surface.
   Adjust a, b, c of  f(x,y) = a x² + b y² + c xy.
   The origin is always a critical point (∇f = 0 there). The Hessian
   H = [[2a, c],[c, 2b]] and its eigenvalues classify it as a bowl
   (min), a dome (max), or a saddle.
   ------------------------------------------------------------------ */

const R = 2;

function diverging(t: number): string {
  // t in [-1,1]: blue (negative/low) → light → red (positive/high)
  const c = Math.max(-1, Math.min(1, t));
  if (c < 0) {
    const f = c + 1; // 0..1
    return `rgb(${Math.round(40 + f * 200)},${Math.round(90 + f * 150)},${Math.round(160 + f * 80)})`;
  }
  const f = c;
  return `rgb(${Math.round(240 - f * 20)},${Math.round(240 - f * 150)},${Math.round(240 - f * 180)})`;
}

export default function HessianClassifier() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 380, h: 380 });
  const [a, setA] = useState(1);
  const [b, setB] = useState(1);
  const [c, setC] = useState(0);

  const f = (x: number, y: number) => a * x * x + b * y * y + c * x * y;

  const draw = () => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);
    // find max |f| for normalization
    let maxAbs = 1e-6;
    for (let i = 0; i <= 20; i++)
      for (let j = 0; j <= 20; j++) {
        const x = -R + (i / 20) * 2 * R;
        const y = -R + (j / 20) * 2 * R;
        maxAbs = Math.max(maxAbs, Math.abs(f(x, y)));
      }
    const cell = 4;
    for (let py = 0; py < h; py += cell) {
      for (let px = 0; px < w; px += cell) {
        const x = (px / w) * 2 * R - R;
        const y = R - (py / h) * 2 * R;
        ctx.fillStyle = diverging(f(x, y) / maxAbs);
        ctx.fillRect(px, py, cell, cell);
      }
    }
    // contour lines
    const toPx = (x: number, y: number) => ({ x: ((x + R) / (2 * R)) * w, y: ((R - y) / (2 * R)) * h });
    const levels = [-0.8, -0.5, -0.25, -0.1, 0.1, 0.25, 0.5, 0.8].map((l) => l * maxAbs);
    const N = 90; const step = (2 * R) / N;
    ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(80,80,80,0.45)';
    ctx.beginPath();
    for (const lv of levels) {
      for (let i = 0; i < N; i++)
        for (let j = 0; j < N; j++) {
          const x0 = -R + i * step, y0 = -R + j * step;
          const va = f(x0, y0) - lv, vb = f(x0 + step, y0) - lv, vc = f(x0, y0 + step) - lv;
          if (va * vb < 0) { const t = va / (va - vb); const p = toPx(x0 + t * step, y0); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + 0.6, p.y + 0.6); }
          if (va * vc < 0) { const t = va / (va - vc); const p = toPx(x0, y0 + t * step); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + 0.6, p.y + 0.6); }
        }
    }
    ctx.stroke();
    // critical point at origin
    const o = toPx(0, 0);
    ctx.beginPath(); ctx.arc(o.x, o.y, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#10b981'; ctx.fill();
    ctx.lineWidth = 2.5; ctx.strokeStyle = '#fff'; ctx.stroke();
  };

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 380);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr; canvas.height = w * dpr;
      canvas.style.width = `${w}px`; canvas.style.height = `${w}px`;
      canvas.getContext('2d')?.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w, h: w };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(draw, [a, b, c]);

  // Hessian H = [[2a, c],[c, 2b]] and its eigenvalues
  const p = 2 * a, q = c, rr = 2 * b;
  const mean = (p + rr) / 2;
  const diff = Math.sqrt(((p - rr) / 2) ** 2 + q * q);
  const l1 = mean + diff, l2 = mean - diff;
  const det = p * rr - q * q;

  let kind: string, blurb: string, badge: string;
  if (Math.abs(det) < 1e-6) {
    kind = 'Degenerate'; badge = 'bg-surface-2 text-muted';
    blurb = 'The Hessian is singular (an eigenvalue is 0) — second derivatives alone cannot decide. A flat valley floor, common in over-parameterized networks.';
  } else if (l1 > 0 && l2 > 0) {
    kind = 'Local minimum (convex bowl)'; badge = 'bg-calculus/15 text-calculus';
    blurb = 'Both eigenvalues positive → curves up in every direction. This is the kind of point gradient descent is trying to reach.';
  } else if (l1 < 0 && l2 < 0) {
    kind = 'Local maximum (dome)'; badge = 'bg-geometry/15 text-geometry';
    blurb = 'Both eigenvalues negative → curves down in every direction. Gradient descent flees from here.';
  } else {
    kind = 'Saddle point'; badge = 'bg-brand-soft text-brand';
    blurb = 'Eigenvalues have opposite signs → up one way, down another. Saddles vastly outnumber minima in high-dimensional loss surfaces.';
  }

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />
        <div class="space-y-3 text-sm">
          <p class="text-muted">Shape the loss surface near its critical point (green dot at the origin).</p>
          <Slider label="a  (x² curvature)" value={a} set={setA} />
          <Slider label="b  (y² curvature)" value={b} set={setB} />
          <Slider label="c  (xy twist)" value={c} set={setC} />
          <div class="rounded-lg bg-surface-2 p-3">
            <p class="mb-1 text-xs text-muted">Hessian H</p>
            <div class="font-mono text-xs">
              <div>[ {p.toFixed(1)}&nbsp;&nbsp;{q.toFixed(1)} ]</div>
              <div>[ {q.toFixed(1)}&nbsp;&nbsp;{rr.toFixed(1)} ]</div>
            </div>
            <div class="mt-2 flex justify-between text-xs"><span class="text-muted">eigenvalues</span><strong class="font-mono">{l1.toFixed(2)}, {l2.toFixed(2)}</strong></div>
          </div>
          <div class={`rounded-lg p-3 ${badge}`}>
            <strong>{kind}</strong>
            <p class="mt-1 text-xs opacity-90">{blurb}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Slider({ label, value, set }: { label: string; value: number; set: (n: number) => void }) {
  return (
    <label class="block">
      <span class="mb-1 block text-muted">{label} = {value.toFixed(1)}</span>
      <input type="range" min={-2} max={2} step={0.1} value={value}
        onInput={(e) => set(parseFloat((e.target as HTMLInputElement).value))}
        class="w-full accent-[#4f46e5]" />
    </label>
  );
}
