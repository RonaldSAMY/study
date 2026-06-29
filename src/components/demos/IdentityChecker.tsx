import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Trig identity checker.
   - Drag the point on the unit circle to set θ.
   - Left: the circle with the cos/sin legs drawn.
   - A stacked bar shows cos²θ + sin²θ summing to exactly 1.
   - Pick an identity; both sides are evaluated live and compared.
   ------------------------------------------------------------------ */

const COLORS = {
  cos: '#0ea5e9',
  sin: '#10b981',
  brand: '#4f46e5',
  grid: 'rgba(128,128,128,0.18)',
  axis: 'rgba(128,128,128,0.5)',
};
const TAU = Math.PI * 2;

type Identity = {
  name: string;
  lhs: string;
  rhs: string;
  L: (t: number) => number;
  R: (t: number) => number;
};

const IDENTITIES: Identity[] = [
  { name: 'Pythagorean', lhs: 'sin²θ + cos²θ', rhs: '1',
    L: (t) => Math.sin(t) ** 2 + Math.cos(t) ** 2, R: () => 1 },
  { name: 'Double angle (sin)', lhs: 'sin(2θ)', rhs: '2 sinθ cosθ',
    L: (t) => Math.sin(2 * t), R: (t) => 2 * Math.sin(t) * Math.cos(t) },
  { name: 'Double angle (cos)', lhs: 'cos(2θ)', rhs: 'cos²θ − sin²θ',
    L: (t) => Math.cos(2 * t), R: (t) => Math.cos(t) ** 2 - Math.sin(t) ** 2 },
  { name: 'Co-function', lhs: 'sin(θ)', rhs: 'cos(π/2 − θ)',
    L: (t) => Math.sin(t), R: (t) => Math.cos(Math.PI / 2 - t) },
];

export default function IdentityChecker() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [theta, setTheta] = useState(0.9);
  const [idx, setIdx] = useState(0);
  const draggingRef = useRef(false);
  const sizeRef = useRef({ w: 360, h: 360, cx: 180, cy: 180, r: 130 });

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h, cx, cy, r } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);

    // axes
    ctx.strokeStyle = COLORS.axis; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(w, cy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, h); ctx.stroke();

    // unit circle
    ctx.strokeStyle = COLORS.grid; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke();

    const px = cx + r * Math.cos(theta);
    const py = cy - r * Math.sin(theta);

    // cos leg (horizontal) and sin leg (vertical)
    ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.strokeStyle = COLORS.cos;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(px, cy); ctx.stroke();
    ctx.strokeStyle = COLORS.sin;
    ctx.beginPath(); ctx.moveTo(px, cy); ctx.lineTo(px, py); ctx.stroke();

    // radius
    ctx.strokeStyle = COLORS.brand; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(px, py); ctx.stroke();

    // handle
    ctx.beginPath(); ctx.arc(px, py, 8, 0, TAU);
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

  useEffect(draw, [theta]);

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
  const onMove = (e: PointerEvent) => { if (draggingRef.current) setTheta(pointerAngle(e)); };
  const onUp = () => { draggingRef.current = false; };

  const cos2 = Math.cos(theta) ** 2;
  const sin2 = Math.sin(theta) ** 2;
  const id = IDENTITIES[idx];
  const lv = id.L(theta), rv = id.R(theta);
  const match = Math.abs(lv - rv) < 1e-9;

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
          <p class="text-muted">Drag the point to change θ = {((theta * 180) / Math.PI).toFixed(0)}°.</p>

          {/* stacked unit bar for the Pythagorean identity */}
          <div>
            <span class="mb-1 block text-muted">cos²θ + sin²θ stacks to a full unit:</span>
            <div class="flex h-7 w-full overflow-hidden rounded-lg border border-border">
              <div style={`width:${cos2 * 100}%;background:${COLORS.cos}`} class="grid place-items-center text-xs font-bold text-white">
                {cos2 > 0.12 ? `cos² ${cos2.toFixed(2)}` : ''}
              </div>
              <div style={`width:${sin2 * 100}%;background:${COLORS.sin}`} class="grid place-items-center text-xs font-bold text-white">
                {sin2 > 0.12 ? `sin² ${sin2.toFixed(2)}` : ''}
              </div>
            </div>
            <div class="mt-1 text-right font-mono text-xs text-muted">total = {(cos2 + sin2).toFixed(4)}</div>
          </div>

          <label class="block">
            <span class="mb-1 block text-muted">Check an identity:</span>
            <select
              value={idx}
              onChange={(e) => setIdx(parseInt((e.target as HTMLSelectElement).value))}
              class="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-text"
            >
              {IDENTITIES.map((it, i) => <option key={i} value={i}>{it.name}</option>)}
            </select>
          </label>

          <div class="rounded-lg bg-surface-2 p-3 font-mono text-[0.8rem]">
            <div class="flex justify-between"><span class="text-muted">{id.lhs}</span><strong>{lv.toFixed(4)}</strong></div>
            <div class="flex justify-between"><span class="text-muted">{id.rhs}</span><strong>{rv.toFixed(4)}</strong></div>
            <div class={`mt-2 rounded px-2 py-1 text-center font-bold ${match ? 'bg-calculus/15 text-calculus' : 'bg-geometry/15 text-geometry'}`}>
              {match ? '✓ both sides agree — for every θ' : '✗ mismatch'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
