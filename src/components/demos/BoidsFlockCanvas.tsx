import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Boids flocking demo.
   - A flock of boids steered by three classic rules:
       separation (avoid crowding), alignment (match heading),
       cohesion (steer toward the group's center).
   - The cursor acts as a "seek" target the flock chases.
   - Sliders tune each rule's weight; watch the behavior change live.
   ------------------------------------------------------------------ */

type Vec = { x: number; y: number };
interface Boid { p: Vec; v: Vec }

const COLOR = '#4f46e5';
const TARGET = '#ef4444';

function limit(v: Vec, max: number): Vec {
  const m = Math.hypot(v.x, v.y);
  if (m > max && m > 0) return { x: (v.x / m) * max, y: (v.y / m) * max };
  return v;
}

export default function BoidsFlockCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boidsRef = useRef<Boid[]>([]);
  const targetRef = useRef<Vec>({ x: 240, y: 160 });
  const haveTargetRef = useRef(false);
  const sizeRef = useRef({ w: 480, h: 320 });
  const rafRef = useRef<number | null>(null);

  const [sep, setSep] = useState(1.6);
  const [ali, setAli] = useState(1.0);
  const [coh, setCoh] = useState(0.9);
  const [seek, setSeek] = useState(0.8);
  const weights = useRef({ sep, ali, coh, seek });
  useEffect(() => { weights.current = { sep, ali, coh, seek }; }, [sep, ali, coh, seek]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 560);
      const h = Math.round(w * 0.66);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w, h };
    };
    resize();
    window.addEventListener('resize', resize);

    // seed flock
    const { w, h } = sizeRef.current;
    boidsRef.current = Array.from({ length: 60 }, () => ({
      p: { x: Math.random() * w, y: Math.random() * h },
      v: { x: (Math.random() - 0.5) * 60, y: (Math.random() - 0.5) * 60 },
    }));
    targetRef.current = { x: w / 2, y: h / 2 };

    const MAX_SPEED = 110;
    const MAX_FORCE = 200;
    const NEIGHBOR = 48;
    const SEPARATE = 26;

    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.04, (now - last) / 1000);
      last = now;
      const { w, h } = sizeRef.current;
      const boids = boidsRef.current;
      const wt = weights.current;

      for (const b of boids) {
        let cohX = 0, cohY = 0, aliX = 0, aliY = 0, sepX = 0, sepY = 0;
        let nCount = 0, sCount = 0;
        for (const o of boids) {
          if (o === b) continue;
          const dx = o.p.x - b.p.x, dy = o.p.y - b.p.y;
          const d = Math.hypot(dx, dy);
          if (d < NEIGHBOR && d > 0) {
            cohX += o.p.x; cohY += o.p.y;
            aliX += o.v.x; aliY += o.v.y;
            nCount++;
            if (d < SEPARATE) { sepX -= dx / d; sepY -= dy / d; sCount++; }
          }
        }

        let ax = 0, ay = 0;
        if (nCount > 0) {
          // cohesion: steer toward average position
          const cx = cohX / nCount - b.p.x, cy = cohY / nCount - b.p.y;
          ax += cx * wt.coh; ay += cy * wt.coh;
          // alignment: match average velocity
          const avx = aliX / nCount - b.v.x, avy = aliY / nCount - b.v.y;
          ax += avx * wt.ali; ay += avy * wt.ali;
        }
        if (sCount > 0) { ax += sepX * 40 * wt.sep; ay += sepY * 40 * wt.sep; }

        // seek the cursor target
        if (haveTargetRef.current) {
          const tx = targetRef.current.x - b.p.x, ty = targetRef.current.y - b.p.y;
          ax += tx * wt.seek; ay += ty * wt.seek;
        }

        const f = limit({ x: ax, y: ay }, MAX_FORCE);
        b.v = limit({ x: b.v.x + f.x * dt, y: b.v.y + f.y * dt }, MAX_SPEED);
        b.p.x += b.v.x * dt; b.p.y += b.v.y * dt;

        // wrap around edges
        if (b.p.x < 0) b.p.x += w; if (b.p.x > w) b.p.x -= w;
        if (b.p.y < 0) b.p.y += h; if (b.p.y > h) b.p.y -= h;
      }

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, w, h);
        if (haveTargetRef.current) {
          ctx.beginPath();
          ctx.arc(targetRef.current.x, targetRef.current.y, 6, 0, Math.PI * 2);
          ctx.fillStyle = TARGET; ctx.fill();
        }
        ctx.fillStyle = COLOR;
        for (const b of boids) {
          const ang = Math.atan2(b.v.y, b.v.x);
          ctx.save();
          ctx.translate(b.p.x, b.p.y);
          ctx.rotate(ang);
          ctx.beginPath();
          ctx.moveTo(7, 0); ctx.lineTo(-5, 3.5); ctx.lineTo(-5, -3.5);
          ctx.closePath(); ctx.fill();
          ctx.restore();
        }
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener('resize', resize);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const pointer = (e: PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    targetRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    haveTargetRef.current = true;
  };

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas
          ref={canvasRef}
          class="touch-none rounded-xl bg-surface-2"
          onPointerMove={pointer}
          onPointerDown={(e) => { pointer(e); }}
          onPointerLeave={() => { haveTargetRef.current = false; }}
        />
        <div class="space-y-3 text-sm">
          <p class="text-muted">Move the cursor (or drag on touch) over the canvas — the flock <strong>seeks</strong> it. Tune each rule:</p>
          <Slider label="Separation" value={sep} set={setSep} />
          <Slider label="Alignment" value={ali} set={setAli} />
          <Slider label="Cohesion" value={coh} set={setCoh} />
          <Slider label="Seek cursor" value={seek} max={2} set={setSeek} />
          <p class="text-xs text-muted">Drop cohesion to zero and the flock scatters; crank separation and they refuse to touch.</p>
        </div>
      </div>
    </div>
  );
}

function Slider({ label, value, set, max = 3 }: { label: string; value: number; set: (n: number) => void; max?: number }) {
  return (
    <label class="block">
      <span class="mb-1 flex justify-between text-muted"><span>{label}</span><span class="font-mono">{value.toFixed(1)}</span></span>
      <input
        type="range" min={0} max={max} step={0.1} value={value}
        onInput={(e) => set(parseFloat((e.target as HTMLInputElement).value))}
        class="w-full accent-[#4f46e5]"
      />
    </label>
  );
}
