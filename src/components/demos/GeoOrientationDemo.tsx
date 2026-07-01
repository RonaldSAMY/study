import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated orientation test (the 2-D cross product).
   - Drag A (indigo), B (sky) or C (emerald).
   - Step through: draw AB, draw AC, shade the signed parallelogram,
     then read off the verdict (left turn / right turn / collinear).
   - Coordinates are y-UP so the picture matches the math convention:
     cross(A,B,C) > 0  ->  C is left of ray A->B  (counter-clockwise).
   - Transport: Play / Pause / Step / Back / Reset + speed.
   ------------------------------------------------------------------ */

type Pt = { x: number; y: number };

const LW = 480, LH = 340;
const COL = { a: '#4f46e5', b: '#0ea5e9', c: '#10b981', pos: '#10b981', neg: '#f43f5e', grid: 'rgba(128,128,128,0.16)', axis: 'rgba(128,128,128,0.45)' };

// signed area of the parallelogram spanned by AB and AC (2-D cross product)
function cross(o: Pt, a: Pt, b: Pt): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

export default function GeoOrientationDemo() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pts, setPts] = useState<Pt[]>([{ x: 90, y: 110 }, { x: 380, y: 110 }, { x: 240, y: 260 }]);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const stepRef = useRef(0);
  stepRef.current = step;
  const dragRef = useRef<number | null>(null);
  const sizeRef = useRef({ w: LW, h: LH, s: 1 });

  const maxStep = 4;
  const [A, B, Cc] = pts;
  const cr = cross(A, B, Cc);
  const verdict = cr > 1 ? 'left turn (counter-clockwise)' : cr < -1 ? 'right turn (clockwise)' : 'collinear';
  const captions = [
    'Three points A, B, C. Drag any of them, then step through the test.',
    'Vector AB = B − A gives the direction we are heading from A.',
    'Vector AC = C − A points from A toward the third point.',
    `Cross product = ABx·ACy − ABy·ACx = ${cr.toFixed(0)} — the signed parallelogram area.`,
    `Sign of ${cr.toFixed(0)} → C is a ${verdict} relative to ray A→B.`,
  ];

  const toPx = (p: Pt) => { const { h, s } = sizeRef.current; return { x: p.x * s, y: h - p.y * s }; };

  const draw = () => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);
    // grid
    ctx.strokeStyle = COL.grid; ctx.lineWidth = 1;
    for (let gx = 0; gx <= w; gx += 40) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke(); }
    for (let gy = 0; gy <= h; gy += 40) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke(); }

    const pa = toPx(A), pb = toPx(B), pc = toPx(Cc);
    const s = step;

    // shaded triangle (signed area) at step >= 3
    if (s >= 3) {
      ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.lineTo(pc.x, pc.y); ctx.closePath();
      ctx.fillStyle = (cr >= 0 ? 'rgba(16,185,129,0.16)' : 'rgba(244,63,94,0.16)');
      ctx.fill();
    }
    // AB arrow
    if (s >= 1) arrow(ctx, pa, pb, COL.a, 3);
    // AC arrow
    if (s >= 2) arrow(ctx, pa, pc, COL.c, 3);
    // verdict text
    if (s >= 4) {
      ctx.font = '700 15px Inter, sans-serif';
      ctx.fillStyle = cr > 1 ? COL.pos : cr < -1 ? COL.neg : '#64748b';
      ctx.fillText(verdict, (pa.x + pb.x + pc.x) / 3 - 40, (pa.y + pb.y + pc.y) / 3);
    }

    handle(ctx, pa, COL.a, 'A'); handle(ctx, pb, COL.b, 'B'); handle(ctx, pc, COL.c, 'C');
  };

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 560);
      const s = w / LW; const h = LH * s;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr; canvas.height = h * dpr;
      canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d'); if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w, h, s };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(draw, [pts, step]);

  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 900 / speed;
    const tick = (t: number) => {
      if (!lastRef.current) lastRef.current = t;
      if (t - lastRef.current >= interval) {
        lastRef.current = t;
        const next = stepRef.current + 1;
        if (next > maxStep) { setStep(maxStep); setPlaying(false); return; }
        setStep(next);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
  }, [playing, speed]);

  const pointer = (e: PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { px: e.clientX - rect.left, py: e.clientY - rect.top };
  };
  const onDown = (e: PointerEvent) => {
    const { px, py } = pointer(e);
    let best = -1, bd = 20;
    pts.forEach((p, i) => { const q = toPx(p); const d = Math.hypot(q.x - px, q.y - py); if (d < bd) { bd = d; best = i; } });
    if (best >= 0) { dragRef.current = best; (e.target as HTMLElement).setPointerCapture(e.pointerId); e.preventDefault(); }
  };
  const onMove = (e: PointerEvent) => {
    if (dragRef.current == null) return;
    const { px, py } = pointer(e); const { h, s } = sizeRef.current;
    const nx = Math.max(0, Math.min(LW, px / s)); const ny = Math.max(0, Math.min(LH, (h - py) / s));
    setPts((old) => old.map((p, i) => (i === dragRef.current ? { x: nx, y: ny } : p)));
  };
  const onUp = () => { dragRef.current = null; };

  const play = () => { if (step >= maxStep) setStep(0); lastRef.current = 0; setPlaying((p) => !p); };

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} />
        <div class="space-y-3 text-sm">
          <p class="text-muted">Drag <span style={`color:${COL.a}`}>A</span>, <span style={`color:${COL.b}`}>B</span> or <span style={`color:${COL.c}`}>C</span>. Move C across the line to flip the sign.</p>
          <div class="rounded-lg bg-surface-2 p-3 font-mono">
            <div class="flex justify-between"><span class="text-muted">cross(A,B,C)</span><strong style={`color:${cr > 1 ? COL.pos : cr < -1 ? COL.neg : '#64748b'}`}>{cr.toFixed(0)}</strong></div>
            <div class="flex justify-between"><span class="text-muted">verdict</span><strong>{verdict.split(' ')[0]}</strong></div>
          </div>
          <p class="min-h-[3.5rem] rounded-lg bg-brand-soft px-3 py-2 text-text">{captions[step]}</p>
        </div>
      </div>
      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={() => { setPlaying(false); setStep((v) => Math.max(0, v - 1)); }} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏮ Back</button>
        <button onClick={play} class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90">{playing ? '⏸ Pause' : '▶ Play'}</button>
        <button onClick={() => { setPlaying(false); setStep((v) => Math.min(maxStep, v + 1)); }} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏭ Step</button>
        <button onClick={() => { setPlaying(false); setStep(0); }} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">↺ Reset</button>
        <label class="ml-auto flex items-center gap-2 text-xs text-muted">speed
          <input type="range" min={0.5} max={3} step={0.5} value={speed} onInput={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))} class="w-24 accent-[#4f46e5]" />
        </label>
      </div>
    </div>
  );
}

function arrow(ctx: CanvasRenderingContext2D, from: Pt, to: Pt, color: string, width: number) {
  const ang = Math.atan2(to.y - from.y, to.x - from.x); const head = 11;
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(to.x, to.y);
  ctx.lineTo(to.x - head * Math.cos(ang - 0.4), to.y - head * Math.sin(ang - 0.4));
  ctx.lineTo(to.x - head * Math.cos(ang + 0.4), to.y - head * Math.sin(ang + 0.4));
  ctx.closePath(); ctx.fill();
}
function handle(ctx: CanvasRenderingContext2D, at: Pt, color: string, label: string) {
  ctx.beginPath(); ctx.arc(at.x, at.y, 8, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = color; ctx.stroke();
  ctx.font = '700 13px Inter, sans-serif'; ctx.fillStyle = color; ctx.fillText(label, at.x + 11, at.y - 10);
}
