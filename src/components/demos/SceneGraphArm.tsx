import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Interactive scene-graph (parent/child transforms) playground.
   A jointed arm: shoulder -> upper arm -> forearm -> hand.
   Each joint stores only a LOCAL angle. A node's WORLD matrix is its
   parent's world matrix times its own local matrix:
       world = parent_world * local
   So rotating the shoulder drags the whole arm; rotating the wrist
   moves only the hand. Everything redraws live on a crisp canvas.
   ------------------------------------------------------------------ */

type Vec = { x: number; y: number };
// 2D affine transform. A point maps as:
//   x' = a*x + c*y + e ,  y' = b*x + d*y + f
type Mat = { a: number; b: number; c: number; d: number; e: number; f: number };

const COLORS = {
  upper: '#4f46e5', // indigo  (shoulder + upper arm)
  fore: '#0ea5e9', // sky      (elbow + forearm)
  hand: '#10b981', // emerald  (wrist + hand)
  grid: 'rgba(128,128,128,0.18)',
  axis: 'rgba(128,128,128,0.5)',
};

// identity, rotate (counter-clockwise on screen), translate, and compose
const ident: Mat = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
function rotate(rad: number): Mat {
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  // negate sin so a positive angle reads counter-clockwise on a y-down canvas
  return { a: cos, b: -sin, c: sin, d: cos, e: 0, f: 0 };
}
function translate(tx: number, ty: number): Mat {
  return { a: 1, b: 0, c: 0, d: 1, e: tx, f: ty };
}
// m ∘ n : apply n first, then m  (matrix product m * n)
function mul(m: Mat, n: Mat): Mat {
  return {
    a: m.a * n.a + m.c * n.b,
    b: m.b * n.a + m.d * n.b,
    c: m.a * n.c + m.c * n.d,
    d: m.b * n.c + m.d * n.d,
    e: m.a * n.e + m.c * n.f + m.e,
    f: m.b * n.e + m.d * n.f + m.f,
  };
}
function apply(m: Mat, p: Vec): Vec {
  return { x: m.a * p.x + m.c * p.y + m.e, y: m.b * p.x + m.d * p.y + m.f };
}

const DEG = Math.PI / 180;
const DEFAULTS = { shoulder: -35, elbow: 55, wrist: 30 };

export default function SceneGraphArm() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [shoulder, setShoulder] = useState(DEFAULTS.shoulder);
  const [elbow, setElbow] = useState(DEFAULTS.elbow);
  const [wrist, setWrist] = useState(DEFAULTS.wrist);
  const sizeRef = useRef({ w: 480, h: 360, base: { x: 150, y: 300 }, len: [90, 70, 45] });

  // ---- compute the world matrices up the hierarchy ----
  const chain = () => {
    const { base, len } = sizeRef.current;
    const root = translate(base.x, base.y); // where the figure sits in the world

    // world = parent_world * (translate to joint) * rotate(local angle)
    const wShoulder = mul(root, rotate(shoulder * DEG));
    const wElbow = mul(mul(wShoulder, translate(len[0], 0)), rotate(elbow * DEG));
    const wWrist = mul(mul(wElbow, translate(len[1], 0)), rotate(wrist * DEG));

    const pShoulder = apply(wShoulder, { x: 0, y: 0 });
    const pElbow = apply(wElbow, { x: 0, y: 0 });
    const pWrist = apply(wWrist, { x: 0, y: 0 });
    const pHand = apply(wWrist, { x: len[2], y: 0 });
    return { wWrist, pShoulder, pElbow, pWrist, pHand, len };
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);

    // faint grid
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    for (let gx = 0; gx < w; gx += 30) {
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke();
    }
    for (let gy = 0; gy < h; gy += 30) {
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke();
    }
    // ground line through the base
    const { base } = sizeRef.current;
    ctx.strokeStyle = COLORS.axis;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, base.y); ctx.lineTo(w, base.y); ctx.stroke();

    const { pShoulder, pElbow, pWrist, pHand } = chain();

    // bones (each drawn in its segment color)
    bone(ctx, pShoulder, pElbow, COLORS.upper);
    bone(ctx, pElbow, pWrist, COLORS.fore);
    bone(ctx, pWrist, pHand, COLORS.hand);

    // joints
    joint(ctx, pShoulder, COLORS.upper);
    joint(ctx, pElbow, COLORS.fore);
    joint(ctx, pWrist, COLORS.hand);

    // hand tip marker
    ctx.beginPath();
    ctx.arc(pHand.x, pHand.y, 9, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.hand;
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // labels
    label(ctx, pShoulder, 'shoulder', COLORS.upper);
    label(ctx, pElbow, 'elbow', COLORS.fore);
    label(ctx, pWrist, 'wrist', COLORS.hand);
  };

  // ---- responsive sizing with devicePixelRatio ----
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
      const s = w / 480; // scale bones with the canvas
      sizeRef.current = {
        w,
        h,
        base: { x: w * 0.32, y: h * 0.82 },
        len: [90 * s, 70 * s, 45 * s],
      };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // redraw whenever a joint angle changes
  useEffect(draw, [shoulder, elbow, wrist]);

  // ---- live readout for the hand (its WORLD position + angle) ----
  const { wWrist, pShoulder, pHand } = chain();
  // direction of the hand bone, converted to a y-up world angle
  const dir = apply(wWrist, { x: 1, y: 0 });
  const o = apply(wWrist, { x: 0, y: 0 });
  const worldAngle = (Math.atan2(-(dir.y - o.y), dir.x - o.x) * 180) / Math.PI;
  // hand position relative to the shoulder base, with y pointing up
  const handX = pHand.x - pShoulder.x;
  const handY = pShoulder.y - pHand.y;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

        <div class="space-y-3 text-sm">
          <p class="text-muted">
            Each slider sets one joint's <strong>local</strong> angle. Rotate the
            shoulder and the whole arm follows; rotate the wrist and only the hand moves.
          </p>

          <Slider
            label="shoulder (local)"
            color={COLORS.upper}
            value={shoulder}
            onChange={setShoulder}
          />
          <Slider label="elbow (local)" color={COLORS.fore} value={elbow} onChange={setElbow} />
          <Slider label="wrist (local)" color={COLORS.hand} value={wrist} onChange={setWrist} />

          <div class="grid grid-cols-2 gap-2">
            <Readout label="hand x" value={handX.toFixed(0)} />
            <Readout label="hand y" value={handY.toFixed(0)} />
            <Readout label="hand angle" color={COLORS.hand} value={`${worldAngle.toFixed(0)}°`} />
            <Readout
              label="Σ local"
              value={`${(shoulder + elbow + wrist).toFixed(0)}°`}
            />
          </div>

          <div class="rounded-lg bg-surface-2 p-3 text-xs text-muted">
            The hand's <strong>world</strong> angle equals the sum of every local angle up the
            chain — that is the matrix product in action.
          </div>

          <button
            onClick={() => {
              setShoulder(DEFAULTS.shoulder);
              setElbow(DEFAULTS.elbow);
              setWrist(DEFAULTS.wrist);
            }}
            class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white transition hover:opacity-90"
          >
            Reset pose
          </button>
        </div>
      </div>
    </div>
  );
}

function Slider({
  label,
  color,
  value,
  onChange,
}: {
  label: string;
  color: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <label class="block">
      <span class="mb-1 block text-muted">
        <span class="font-semibold" style={`color:${color}`}>
          {label}
        </span>{' '}
        = {value.toFixed(0)}°
      </span>
      <input
        type="range"
        min={-180}
        max={180}
        step={1}
        value={value}
        onInput={(e) => onChange(parseFloat((e.target as HTMLInputElement).value))}
        class="w-full"
        style={`accent-color:${color}`}
      />
    </label>
  );
}

function Readout({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div class="rounded-lg bg-surface-2 px-3 py-2">
      <span class="text-muted" style={color ? `color:${color}` : ''}>
        {label}
      </span>
      <div class="font-mono font-semibold">{value}</div>
    </div>
  );
}

// ---- canvas drawing primitives ----
function bone(ctx: CanvasRenderingContext2D, from: Vec, to: Vec, color: string) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
}
function joint(ctx: CanvasRenderingContext2D, at: Vec, color: string) {
  ctx.beginPath();
  ctx.arc(at.x, at.y, 6, 0, Math.PI * 2);
  ctx.fillStyle = '#fff';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = color;
  ctx.stroke();
}
function label(ctx: CanvasRenderingContext2D, at: Vec, text: string, color: string) {
  ctx.font = '600 12px Inter, sans-serif';
  ctx.fillStyle = color;
  ctx.fillText(text, at.x + 10, at.y - 10);
}
