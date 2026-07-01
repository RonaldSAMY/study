import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated point-in-polygon by RAY CASTING.
   - Drag the query point (emerald) or any polygon vertex.
   - Play to shoot a horizontal ray to the right and test each edge in
     turn. Every edge the ray crosses flips inside/outside; an ODD count
     means the point is inside.
   - Precomputed frames; y is UP.
   ------------------------------------------------------------------ */

type Pt = { x: number; y: number };
type Frame = { edge: number; count: number; marks: Pt[]; crossed: boolean; done: boolean; caption: string };

const LW = 480, LH = 340;
const COL = { poly: '#4f46e5', edge: '#f59e0b', q: '#10b981', ray: '#0ea5e9', in: '#10b981', out: '#f43f5e', grid: 'rgba(128,128,128,0.16)' };

function buildFrames(poly: Pt[], q: Pt): Frame[] {
  const n = poly.length; const frames: Frame[] = [];
  frames.push({ edge: -1, count: 0, marks: [], crossed: false, done: false, caption: 'Shoot a ray from the point straight to the right. Count edge crossings.' });
  let count = 0; let marks: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const p1 = poly[i], p2 = poly[(i + 1) % n];
    let crossed = false;
    if ((p1.y <= q.y && p2.y > q.y) || (p2.y <= q.y && p1.y > q.y)) {
      const xi = p1.x + ((q.y - p1.y) / (p2.y - p1.y)) * (p2.x - p1.x);
      if (q.x < xi) { count++; crossed = true; marks = [...marks, { x: xi, y: q.y }]; }
    }
    frames.push({ edge: i, count, marks: [...marks], crossed, done: false, caption: crossed ? `Edge ${i} straddles the ray height AND sits to the right → crossing #${count}.` : `Edge ${i}: ray does not cross it (wrong height or on the left).` });
  }
  const inside = count % 2 === 1;
  frames.push({ edge: -1, count, marks, crossed: false, done: true, caption: `${count} crossing(s) → ${inside ? 'ODD → the point is INSIDE.' : 'EVEN → the point is OUTSIDE.'}` });
  return frames;
}

export default function GeoPointInPolygon() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [poly, setPoly] = useState<Pt[]>([
    { x: 70, y: 80 }, { x: 240, y: 150 }, { x: 410, y: 80 }, { x: 360, y: 290 }, { x: 210, y: 210 }, { x: 100, y: 290 },
  ]);
  const [q, setQ] = useState<Pt>({ x: 235, y: 170 });
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1.5);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const stepRef = useRef(0);
  stepRef.current = step;
  const dragRef = useRef<{ kind: 'q' | 'v'; i: number } | null>(null);
  const sizeRef = useRef({ w: LW, h: LH, s: 1 });

  const frames = buildFrames(poly, q);
  const maxStep = frames.length - 1;
  const s = Math.min(step, maxStep);
  const fr = frames[s];

  const toPx = (p: Pt) => { const { h, s: sc } = sizeRef.current; return { x: p.x * sc, y: h - p.y * sc }; };

  const draw = () => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = COL.grid; ctx.lineWidth = 1;
    for (let gx = 0; gx <= w; gx += 40) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke(); }
    for (let gy = 0; gy <= h; gy += 40) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke(); }

    // polygon fill on final frame
    ctx.beginPath(); poly.forEach((p, i) => { const u = toPx(p); i ? ctx.lineTo(u.x, u.y) : ctx.moveTo(u.x, u.y); }); ctx.closePath();
    if (fr.done) { ctx.fillStyle = fr.count % 2 === 1 ? 'rgba(16,185,129,0.12)' : 'rgba(148,163,184,0.10)'; ctx.fill(); }
    ctx.strokeStyle = COL.poly; ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.stroke();

    // active edge
    if (fr.edge >= 0) {
      const a = toPx(poly[fr.edge]), b = toPx(poly[(fr.edge + 1) % poly.length]);
      ctx.strokeStyle = COL.edge; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }

    // ray to the right
    const qp = toPx(q);
    ctx.strokeStyle = COL.ray; ctx.lineWidth = 2; ctx.setLineDash([6, 5]);
    ctx.beginPath(); ctx.moveTo(qp.x, qp.y); ctx.lineTo(w, qp.y); ctx.stroke(); ctx.setLineDash([]);

    // crossing marks
    for (const m of fr.marks) { const u = toPx(m); ctx.beginPath(); ctx.arc(u.x, u.y, 5, 0, Math.PI * 2); ctx.fillStyle = COL.ray; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke(); }

    // vertices
    for (const p of poly) { const u = toPx(p); ring(ctx, u, COL.poly, 6); }
    // query point
    ctx.beginPath(); ctx.arc(qp.x, qp.y, 8, 0, Math.PI * 2); ctx.fillStyle = COL.q; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
  };

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 560); const sc = w / LW; const h = LH * sc;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr; canvas.height = h * dpr; canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d'); if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w, h, s: sc }; draw();
    };
    resize(); window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(draw, [poly, q, step]);

  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 750 / speed;
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
  }, [playing, speed, maxStep]);

  const pointer = (e: PointerEvent) => { const r = canvasRef.current!.getBoundingClientRect(); return { px: e.clientX - r.left, py: e.clientY - r.top }; };
  const onDown = (e: PointerEvent) => {
    const { px, py } = pointer(e);
    const qp = toPx(q); if (Math.hypot(qp.x - px, qp.y - py) < 18) { dragRef.current = { kind: 'q', i: 0 }; (e.target as HTMLElement).setPointerCapture(e.pointerId); e.preventDefault(); return; }
    let best = -1, bd = 16; poly.forEach((p, i) => { const u = toPx(p); const d = Math.hypot(u.x - px, u.y - py); if (d < bd) { bd = d; best = i; } });
    if (best >= 0) { dragRef.current = { kind: 'v', i: best }; (e.target as HTMLElement).setPointerCapture(e.pointerId); e.preventDefault(); }
  };
  const onMove = (e: PointerEvent) => {
    if (!dragRef.current) return; const { px, py } = pointer(e); const { h, s: sc } = sizeRef.current;
    const nx = Math.max(0, Math.min(LW, px / sc)); const ny = Math.max(0, Math.min(LH, (h - py) / sc));
    if (dragRef.current.kind === 'q') setQ({ x: nx, y: ny });
    else setPoly((old) => old.map((p, i) => (i === dragRef.current!.i ? { x: nx, y: ny } : p)));
    setStep(0); setPlaying(false);
  };
  const onUp = () => { dragRef.current = null; };
  const play = () => { if (step >= maxStep) setStep(0); lastRef.current = 0; setPlaying((p) => !p); };

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} />
        <div class="space-y-3 text-sm">
          <p class="text-muted">Drag the <span style={`color:${COL.q}`}>green point</span> in and out of the shape, or reshape it by dragging vertices.</p>
          <div class="rounded-lg bg-surface-2 p-3 font-mono text-xs">
            <div class="flex justify-between"><span class="text-muted">crossings</span><strong>{fr.count}</strong></div>
            <div class="flex justify-between"><span class="text-muted">verdict</span><strong style={`color:${fr.count % 2 === 1 ? COL.in : COL.out}`}>{fr.count % 2 === 1 ? 'inside' : 'outside'}</strong></div>
          </div>
          <p class="min-h-[3.5rem] rounded-lg bg-brand-soft px-3 py-2 text-text">{fr.caption}</p>
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

function ring(ctx: CanvasRenderingContext2D, at: Pt, color: string, r: number) {
  ctx.beginPath(); ctx.arc(at.x, at.y, r, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
  ctx.lineWidth = 2.5; ctx.strokeStyle = color; ctx.stroke();
}
