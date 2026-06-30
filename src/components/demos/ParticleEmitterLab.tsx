import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Particle emitter / fountain.
   - An emitter sits at a draggable point and spawns particles with
     a randomized upward velocity.
   - Gravity pulls each particle back down; a finite lifetime fades
     it out (alpha -> 0) and then RECYCLES the slot from a fixed pool.
   - Sliders control spawn rate, launch speed, gravity and lifetime.
   - Readout shows the live particle count.
   ------------------------------------------------------------------ */

type P = {
  x: number; y: number;
  vx: number; vy: number;
  age: number; life: number;
  active: boolean;
};

const POOL = 900; // fixed-size recycled pool

export default function ParticleEmitterLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const poolRef = useRef<P[]>([]);
  const emitRef = useRef({ x: 240, y: 300 });
  const accRef = useRef(0);          // fractional spawn accumulator
  const dragRef = useRef(false);
  const lastRef = useRef(0);
  const frameRef = useRef(0);
  const rafRef = useRef<number>();
  const sizeRef = useRef({ w: 480, h: 360 });

  const [rate, setRate] = useState(180);     // particles / second
  const [speed, setSpeed] = useState(220);   // launch speed (px/s)
  const [gravity, setGravity] = useState(420); // px/s^2
  const [lifetime, setLifetime] = useState(1.4); // seconds
  const [live, setLive] = useState(0);

  const rateRef = useRef(rate);
  const speedRef = useRef(speed);
  const gravRef = useRef(gravity);
  const lifeRef = useRef(lifetime);
  useEffect(() => { rateRef.current = rate; }, [rate]);
  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => { gravRef.current = gravity; }, [gravity]);
  useEffect(() => { lifeRef.current = lifetime; }, [lifetime]);

  // build the recycled pool once
  if (poolRef.current.length === 0) {
    const arr: P[] = [];
    for (let i = 0; i < POOL; i++) arr.push({ x: 0, y: 0, vx: 0, vy: 0, age: 0, life: 1, active: false });
    poolRef.current = arr;
  }

  const spawn = (n: number) => {
    const pool = poolRef.current;
    const e = emitRef.current;
    const s = speedRef.current;
    const L = lifeRef.current;
    let made = 0;
    for (let i = 0; i < pool.length && made < n; i++) {
      const p = pool[i];
      if (p.active) continue;
      // aim mostly upward with a spread
      const ang = -Math.PI / 2 + (Math.random() - 0.5) * 0.9;
      const sp = s * (0.55 + Math.random() * 0.55);
      p.x = e.x + (Math.random() - 0.5) * 6;
      p.y = e.y + (Math.random() - 0.5) * 6;
      p.vx = Math.cos(ang) * sp;
      p.vy = Math.sin(ang) * sp;
      p.age = 0;
      p.life = L * (0.7 + Math.random() * 0.6);
      p.active = true;
      made++;
    }
  };

  const draw = (dt: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    const g = gravRef.current;
    const pool = poolRef.current;

    // spawn
    accRef.current += rateRef.current * dt;
    const toSpawn = Math.floor(accRef.current);
    if (toSpawn > 0) { spawn(toSpawn); accRef.current -= toSpawn; }

    ctx.clearRect(0, 0, w, h);

    // glowing additive blend for a sparky look
    ctx.globalCompositeOperation = 'lighter';
    let count = 0;
    for (let i = 0; i < pool.length; i++) {
      const p = pool[i];
      if (!p.active) continue;
      p.vy += g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.age += dt;
      if (p.age >= p.life || p.y > h + 12) { p.active = false; continue; }
      count++;
      const t = p.age / p.life;        // 0 -> 1 over lifetime
      const alpha = 1 - t;             // linear fade
      // warm spark gradient: white-gold -> orange -> red
      const r = 255;
      const gc = Math.round(220 - 150 * t);
      const b = Math.round(90 - 90 * t);
      const rad = 3.2 * (1 - 0.5 * t);
      ctx.fillStyle = `rgba(${r},${gc},${b},${alpha})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, rad, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';

    // emitter handle
    const e = emitRef.current;
    ctx.beginPath();
    ctx.arc(e.x, e.y, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#4f46e5';
    ctx.stroke();

    // throttle the live-count readout
    frameRef.current++;
    if (frameRef.current % 6 === 0) setLive(count);
  };

  // animation loop
  useEffect(() => {
    const step = (ts: number) => {
      if (!lastRef.current) lastRef.current = ts;
      const dt = Math.min(0.05, (ts - lastRef.current) / 1000);
      lastRef.current = ts;
      draw(dt);
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); lastRef.current = 0; };
  }, []);

  // responsive sizing
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
      sizeRef.current = { w, h };
      emitRef.current = { x: w / 2, y: h * 0.82 };
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // pointer dragging of the emitter
  const pointer = (e: PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { px: e.clientX - rect.left, py: e.clientY - rect.top };
  };
  const onDown = (e: PointerEvent) => {
    const { px, py } = pointer(e);
    // grab anywhere; snap the emitter to the pointer
    dragRef.current = true;
    emitRef.current = { x: px, y: py };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
  };
  const onMove = (e: PointerEvent) => {
    if (!dragRef.current) return;
    const { px, py } = pointer(e);
    emitRef.current = { x: px, y: py };
  };
  const onUp = () => { dragRef.current = false; };

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <canvas
        ref={canvasRef}
        class="touch-none w-full rounded-xl bg-surface-2"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      />

      <p class="mt-3 text-sm text-muted">
        Drag inside the canvas to move the emitter and paint a trail of sparks. Each particle is born with a
        random velocity, falls under gravity, and fades as it ages.
      </p>

      <div class="mt-3 grid gap-4 sm:grid-cols-2">
        <label class="block text-sm">
          <span class="mb-1 block text-muted">spawn rate = {rate}/s</span>
          <input type="range" min={20} max={500} step={10} value={rate}
            onInput={(e) => setRate(parseInt((e.target as HTMLInputElement).value))}
            class="w-full accent-[#4f46e5]" />
        </label>
        <label class="block text-sm">
          <span class="mb-1 block text-muted">launch speed = {speed}</span>
          <input type="range" min={40} max={420} step={10} value={speed}
            onInput={(e) => setSpeed(parseInt((e.target as HTMLInputElement).value))}
            class="w-full accent-[#0ea5e9]" />
        </label>
        <label class="block text-sm">
          <span class="mb-1 block text-muted">gravity = {gravity}</span>
          <input type="range" min={0} max={900} step={20} value={gravity}
            onInput={(e) => setGravity(parseInt((e.target as HTMLInputElement).value))}
            class="w-full accent-[#10b981]" />
        </label>
        <label class="block text-sm">
          <span class="mb-1 block text-muted">lifetime = {lifetime.toFixed(2)} s</span>
          <input type="range" min={0.3} max={2.5} step={0.1} value={lifetime}
            onInput={(e) => setLifetime(parseFloat((e.target as HTMLInputElement).value))}
            class="w-full accent-[#10b981]" />
        </label>
      </div>

      <div class="mt-4 grid grid-cols-2 gap-2 text-sm">
        <Readout label="live particles" value={`${live}`} />
        <Readout label="pool size" value={`${POOL}`} />
      </div>
      <p class="mt-3 text-xs text-muted">
        Higher rate and longer lifetime mean more particles alive at once. When a particle dies its slot is
        reused, so the pool never grows.
      </p>
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
