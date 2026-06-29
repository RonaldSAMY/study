import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Induction visualizer: a row of dominoes (each = the claim P(n)).
   - "Base case" topples domino 1.
   - "Inductive step" topples the next, because P(k) ⇒ P(k+1).
   - "Run full chain" lets the whole line fall — that is induction.
   The claim shown is P(n): 1 + 2 + … + n = n(n+1)/2.
   ------------------------------------------------------------------ */

const COLORS = {
  standing: '#4f46e5',
  falling: '#0ea5e9',
  fallen: '#10b981',
  floor: 'rgba(128,128,128,0.5)',
  grid: 'rgba(128,128,128,0.18)',
};
const MAX_ANGLE = 1.35; // radians a fully fallen domino leans

export default function DominoInductionVisualizer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [count, setCount] = useState(7);
  const [target, setTarget] = useState(0); // how many dominoes should be down
  const progRef = useRef<number[]>([]);
  const rafRef = useRef<number | null>(null);
  const sizeRef = useRef({ w: 480, h: 260 });

  // keep the progress array sized to `count`
  if (progRef.current.length !== count) {
    const next = new Array(count).fill(0);
    for (let i = 0; i < Math.min(count, progRef.current.length); i++) next[i] = progRef.current[i];
    progRef.current = next;
  }

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);

    const floorY = h - 42;
    const pad = 26;
    const span = (w - pad * 2) / count;
    const dw = Math.min(span * 0.34, 26);
    const dh = Math.min(span * 1.5, floorY - 40);

    // floor
    ctx.strokeStyle = COLORS.floor;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, floorY); ctx.lineTo(w, floorY); ctx.stroke();

    const prog = progRef.current;
    for (let i = 0; i < count; i++) {
      const cx = pad + span * (i + 0.5);
      const t = prog[i] ?? 0;
      const angle = t * MAX_ANGLE;
      ctx.save();
      ctx.translate(cx, floorY);
      ctx.rotate(angle);
      const col = t > 0.98 ? COLORS.fallen : t > 0.02 ? COLORS.falling : COLORS.standing;
      ctx.fillStyle = col;
      ctx.strokeStyle = 'rgba(0,0,0,0.18)';
      ctx.lineWidth = 1;
      roundRect(ctx, -dw / 2, -dh, dw, dh, 4);
      ctx.fill();
      ctx.stroke();
      // dividing notch
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath(); ctx.moveTo(-dw / 2 + 2, -dh / 2); ctx.lineTo(dw / 2 - 2, -dh / 2); ctx.stroke();
      ctx.restore();

      // label P(i+1)
      ctx.fillStyle = 'rgba(120,120,120,0.95)';
      ctx.font = '600 11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`P(${i + 1})`, cx, floorY + 18);
    }
    ctx.textAlign = 'start';
  };

  // animation loop toward target
  useEffect(() => {
    const animate = () => {
      const prog = progRef.current;
      let moving = false;
      for (let i = 0; i < count; i++) {
        // a domino starts falling once the previous is ~halfway down
        const shouldFall = i < target && (i === 0 || (prog[i - 1] ?? 0) > 0.45);
        const goal = shouldFall ? 1 : 0;
        const cur = prog[i] ?? 0;
        if (Math.abs(cur - goal) > 0.001) {
          prog[i] = cur + (goal - cur) * 0.16 + (goal > cur ? 0.012 : -0.012);
          if (goal === 1 && prog[i] > 1) prog[i] = 1;
          if (goal === 0 && prog[i] < 0) prog[i] = 0;
          moving = true;
        } else {
          prog[i] = goal;
        }
      }
      draw();
      rafRef.current = moving ? requestAnimationFrame(animate) : null;
    };
    if (rafRef.current == null) rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [target, count]);

  // responsive sizing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 560);
      const h = Math.round(w * 0.5);
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

  const k = target;
  const sum = (k * (k + 1)) / 2;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setTarget(1)}
          class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white transition hover:opacity-90"
        >
          Base case P(1)
        </button>
        <button
          onClick={() => setTarget((t) => Math.min(count, t + 1))}
          disabled={target < 1 || target >= count}
          class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-text transition hover:bg-brand-soft disabled:opacity-40"
        >
          Inductive step → next
        </button>
        <button
          onClick={() => setTarget(count)}
          class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-text transition hover:bg-brand-soft"
        >
          Run full chain
        </button>
        <button
          onClick={() => setTarget(0)}
          class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted transition hover:text-text"
        >
          Reset
        </button>
      </div>

      <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

      <div class="mt-3 grid gap-3 text-sm md:grid-cols-[1fr,auto] md:items-center">
        <label class="block">
          <span class="mb-1 block text-muted">number of dominoes = {count}</span>
          <input
            type="range" min={4} max={10} step={1} value={count}
            onInput={(e) => {
              const c = parseInt((e.target as HTMLInputElement).value, 10);
              setCount(c);
              setTarget((t) => Math.min(t, c));
            }}
            class="w-full accent-[#4f46e5]"
          />
        </label>
        <div class="rounded-lg bg-surface-2 p-3">
          <p class="text-muted">Claim P(n): 1 + 2 + … + n = n(n+1)/2</p>
          <p class="mt-1">
            {k === 0 ? (
              <span class="text-muted">Nothing proven yet — knock the base case.</span>
            ) : (
              <span>
                Proven up to <strong>P({k})</strong>: sum = <strong>{sum}</strong> ={' '}
                {k}·{k + 1}/2 ✓
              </span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}
