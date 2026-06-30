import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Boids flocking sandbox.
   - Each boid steers with three local rules: separation, alignment,
     cohesion. Sliders re-weight them live.
   - Move the cursor over the canvas to drop a target the flock seeks
     (or flees, if you flip the toggle).
   ------------------------------------------------------------------ */

type Boid = { x: number; y: number; vx: number; vy: number };

const N = 70;
const MAX_SPEED = 2.6;
const NEIGHBOR = 46;
const SEP_DIST = 22;

export default function BoidsFlockDemo() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 480, h: 340 });
  const rafRef = useRef<number | null>(null);
  const boidsRef = useRef<Boid[]>([]);
  const targetRef = useRef<{ x: number; y: number } | null>(null);

  const [sep, setSep] = useState(1.4);
  const [ali, setAli] = useState(1.0);
  const [coh, setCoh] = useState(0.9);
  const [flee, setFlee] = useState(false);
  const sepRef = useRef(sep); const aliRef = useRef(ali); const cohRef = useRef(coh); const fleeRef = useRef(flee);
  sepRef.current = sep; aliRef.current = ali; cohRef.current = coh; fleeRef.current = flee;

  const seed = () => {
    const { w, h } = sizeRef.current;
    boidsRef.current = Array.from({ length: N }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 2,
      vy: (Math.random() - 0.5) * 2,
    }));
  };

  const step = () => {
    const { w, h } = sizeRef.current;
    const boids = boidsRef.current;
    const sW = sepRef.current, aW = aliRef.current, cW = cohRef.current;
    const target = targetRef.current;

    for (const b of boids) {
      let sepX = 0, sepY = 0, aliX = 0, aliY = 0, cohX = 0, cohY = 0, count = 0;
      for (const o of boids) {
        if (o === b) continue;
        const dx = o.x - b.x, dy = o.y - b.y;
        const d2 = dx * dx + dy * dy;
        if (d2 > NEIGHBOR * NEIGHBOR || d2 === 0) continue;
        const d = Math.sqrt(d2);
        count++;
        aliX += o.vx; aliY += o.vy;
        cohX += o.x; cohY += o.y;
        if (d < SEP_DIST) { sepX -= dx / d; sepY -= dy / d; }
      }
      let ax = 0, ay = 0;
      if (count > 0) {
        ax += sepX * sW * 0.06;
        ay += sepY * sW * 0.06;
        ax += (aliX / count) * aW * 0.05;
        ay += (aliY / count) * aW * 0.05;
        ax += ((cohX / count) - b.x) * cW * 0.0012;
        ay += ((cohY / count) - b.y) * cW * 0.0012;
      }
      if (target) {
        const dx = target.x - b.x, dy = target.y - b.y;
        const d = Math.hypot(dx, dy) || 1;
        const sign = fleeRef.current ? -1 : 1;
        ax += (dx / d) * sign * 0.08;
        ay += (dy / d) * sign * 0.08;
      }
      b.vx += ax; b.vy += ay;
      const sp = Math.hypot(b.vx, b.vy);
      if (sp > MAX_SPEED) { b.vx = (b.vx / sp) * MAX_SPEED; b.vy = (b.vy / sp) * MAX_SPEED; }
      b.x += b.vx; b.y += b.vy;
      // wrap around edges
      if (b.x < 0) b.x += w; else if (b.x > w) b.x -= w;
      if (b.y < 0) b.y += h; else if (b.y > h) b.y -= h;
    }
    draw();
    rafRef.current = requestAnimationFrame(step);
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);

    const target = targetRef.current;
    if (target) {
      ctx.beginPath();
      ctx.arc(target.x, target.y, 8, 0, Math.PI * 2);
      ctx.fillStyle = fleeRef.current ? 'rgba(239,68,68,0.85)' : 'rgba(79,70,229,0.85)';
      ctx.fill();
    }

    for (const b of boidsRef.current) {
      const ang = Math.atan2(b.vy, b.vx);
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(ang);
      ctx.beginPath();
      ctx.moveTo(8, 0);
      ctx.lineTo(-5, 4);
      ctx.lineTo(-5, -4);
      ctx.closePath();
      ctx.fillStyle = '#0ea5e9';
      ctx.fill();
      ctx.restore();
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 560);
      const h = Math.round(w * 0.7);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const first = boidsRef.current.length === 0;
      sizeRef.current = { w, h };
      if (first) seed();
    };
    resize();
    window.addEventListener('resize', resize);
    rafRef.current = requestAnimationFrame(step);
    return () => {
      window.removeEventListener('resize', resize);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onMove = (e: PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    targetRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };
  const onLeave = () => { targetRef.current = null; };

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas
          ref={canvasRef}
          class="touch-none rounded-xl bg-surface-2"
          onPointerMove={onMove}
          onPointerDown={onMove}
          onPointerLeave={onLeave}
          onPointerUp={onLeave}
        />

        <div class="space-y-3 text-sm">
          <p class="text-muted">Hover the canvas to lead the flock. Tune the three steering weights:</p>

          <Slider label="Separation" value={sep} color="#ef4444" onInput={setSep} />
          <Slider label="Alignment" value={ali} color="#0ea5e9" onInput={setAli} />
          <Slider label="Cohesion" value={coh} color="#10b981" onInput={setCoh} />

          <label class="flex items-center gap-2">
            <input
              type="checkbox" checked={flee}
              onInput={(e) => setFlee((e.target as HTMLInputElement).checked)}
              class="h-4 w-4 accent-[#ef4444]"
            />
            <span>Cursor repels (flee) instead of attracts</span>
          </label>

          <button onClick={seed} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">
            Scatter
          </button>

          <p class="text-xs text-muted">
            Set separation to 0 and the boids clump into a blob; drop cohesion and they drift apart. The
            lifelike flock lives in the balance of all three.
          </p>
        </div>
      </div>
    </div>
  );
}

function Slider({ label, value, color, onInput }: { label: string; value: number; color: string; onInput: (v: number) => void }) {
  return (
    <label class="block">
      <span class="mb-1 block text-muted" style={`color:${color}`}>{label} = {value.toFixed(2)}</span>
      <input
        type="range" min={0} max={2.5} step={0.05} value={value}
        onInput={(e) => onInput(parseFloat((e.target as HTMLInputElement).value))}
        class="w-full"
        style={`accent-color:${color}`}
      />
    </label>
  );
}
