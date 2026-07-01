import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated convex hull — Andrew's monotone chain.
   - Click empty space to ADD a point; drag a point to move it.
   - Play to watch the lower chain build left→right, then the upper
     chain right→left. Each frame highlights the turn under test:
     cross(A,B,C) <= 0 is a right turn / collinear -> pop B.
   - Precomputed, index-driven frames; y is UP.
   ------------------------------------------------------------------ */

type Pt = { x: number; y: number };
type Frame = { lower: Pt[]; upper: Pt[]; cur: Pt | null; turn: [Pt, Pt, Pt] | null; cr: number; pop: boolean; phase: 'lower' | 'upper' | 'done'; caption: string };

const LW = 480, LH = 340;
const COL = { pt: '#94a3b8', low: '#4f46e5', up: '#0ea5e9', cur: '#10b981', pop: '#f43f5e', grid: 'rgba(128,128,128,0.16)' };

function cross(o: Pt, a: Pt, b: Pt): number { return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x); }

function buildFrames(input: Pt[]): Frame[] {
  const P = [...input].sort((a, b) => a.x - b.x || a.y - b.y);
  const frames: Frame[] = [];
  if (P.length < 3) { frames.push({ lower: [...P], upper: [], cur: null, turn: null, cr: 0, pop: false, phase: 'done', caption: 'Add at least 3 points to build a hull.' }); return frames; }

  const lower: Pt[] = [];
  frames.push({ lower: [], upper: [], cur: null, turn: null, cr: 0, pop: false, phase: 'lower', caption: 'Sort points left→right, then build the LOWER chain.' });
  for (let i = 0; i < P.length; i++) {
    const p = P[i];
    frames.push({ lower: [...lower], upper: [], cur: p, turn: null, cr: 0, pop: false, phase: 'lower', caption: `Consider the next point. Can it extend the lower chain with a left turn?` });
    while (lower.length >= 2) {
      const a = lower[lower.length - 2], b = lower[lower.length - 1];
      const cr = cross(a, b, p);
      if (cr > 0) break;
      frames.push({ lower: [...lower], upper: [], cur: p, turn: [a, b, p], cr, pop: true, phase: 'lower', caption: `cross(A,B,C) = ${cr.toFixed(0)} ≤ 0 → right turn / collinear. Pop B.` });
      lower.pop();
    }
    lower.push(p);
    frames.push({ lower: [...lower], upper: [], cur: p, turn: null, cr: 0, pop: false, phase: 'lower', caption: `Left turn — push the point onto the lower chain.` });
  }
  const lowerFinal = [...lower];

  const upper: Pt[] = [];
  frames.push({ lower: lowerFinal, upper: [], cur: null, turn: null, cr: 0, pop: false, phase: 'upper', caption: 'Lower chain complete. Now the UPPER chain, sweeping right→left.' });
  for (let i = P.length - 1; i >= 0; i--) {
    const p = P[i];
    frames.push({ lower: lowerFinal, upper: [...upper], cur: p, turn: null, cr: 0, pop: false, phase: 'upper', caption: `Consider the next point for the upper chain.` });
    while (upper.length >= 2) {
      const a = upper[upper.length - 2], b = upper[upper.length - 1];
      const cr = cross(a, b, p);
      if (cr > 0) break;
      frames.push({ lower: lowerFinal, upper: [...upper], cur: p, turn: [a, b, p], cr, pop: true, phase: 'upper', caption: `cross = ${cr.toFixed(0)} ≤ 0 → pop from the upper chain.` });
      upper.pop();
    }
    upper.push(p);
    frames.push({ lower: lowerFinal, upper: [...upper], cur: p, turn: null, cr: 0, pop: false, phase: 'upper', caption: `Push onto the upper chain.` });
  }

  const hull = [...lowerFinal.slice(0, -1), ...upper.slice(0, -1)];
  frames.push({ lower: hull, upper: [], cur: null, turn: null, cr: 0, pop: false, phase: 'done', caption: `Done. The convex hull has ${hull.length} vertices — the tightest rubber band.` });
  return frames;
}

export default function GeoConvexHull() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pts, setPts] = useState<Pt[]>([
    { x: 70, y: 80 }, { x: 200, y: 60 }, { x: 400, y: 110 }, { x: 430, y: 250 },
    { x: 300, y: 300 }, { x: 120, y: 270 }, { x: 240, y: 180 }, { x: 330, y: 200 },
  ]);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1.5);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const stepRef = useRef(0);
  stepRef.current = step;
  const dragRef = useRef<number | null>(null);
  const movedRef = useRef(false);
  const sizeRef = useRef({ w: LW, h: LH, s: 1 });

  const frames = buildFrames(pts);
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

    // all points
    for (const p of pts) { const q = toPx(p); ctx.beginPath(); ctx.arc(q.x, q.y, 4, 0, Math.PI * 2); ctx.fillStyle = COL.pt; ctx.fill(); }

    if (fr.phase === 'done') {
      // filled hull polygon
      if (fr.lower.length >= 3) {
        ctx.beginPath(); fr.lower.forEach((p, i) => { const q = toPx(p); i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); }); ctx.closePath();
        ctx.fillStyle = 'rgba(16,185,129,0.14)'; ctx.fill(); ctx.strokeStyle = COL.cur; ctx.lineWidth = 3; ctx.stroke();
        for (const p of fr.lower) { const q = toPx(p); ring(ctx, q, COL.cur); }
      }
    } else {
      chain(ctx, fr.lower.map(toPx), COL.low);
      if (fr.phase === 'upper') chain(ctx, fr.upper.map(toPx), COL.up);
    }

    // turn under test
    if (fr.turn) {
      const [a, b, c] = fr.turn.map(toPx);
      ctx.strokeStyle = COL.pop; ctx.lineWidth = 2; ctx.setLineDash([5, 4]);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.stroke(); ctx.setLineDash([]);
      ring(ctx, b, COL.pop);
    }
    if (fr.cur) { const q = toPx(fr.cur); ring(ctx, q, COL.cur); }
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

  useEffect(draw, [pts, step]);

  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 620 / speed;
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
    const { px, py } = pointer(e); let best = -1, bd = 16;
    pts.forEach((p, i) => { const q = toPx(p); const d = Math.hypot(q.x - px, q.y - py); if (d < bd) { bd = d; best = i; } });
    movedRef.current = false;
    if (best >= 0) { dragRef.current = best; (e.target as HTMLElement).setPointerCapture(e.pointerId); e.preventDefault(); }
  };
  const onMove = (e: PointerEvent) => {
    if (dragRef.current == null) return; movedRef.current = true;
    const { px, py } = pointer(e); const { h, s: sc } = sizeRef.current;
    const nx = Math.max(0, Math.min(LW, px / sc)); const ny = Math.max(0, Math.min(LH, (h - py) / sc));
    setPts((old) => old.map((p, i) => (i === dragRef.current ? { x: nx, y: ny } : p))); setStep(0); setPlaying(false);
  };
  const onUp = (e: PointerEvent) => {
    if (dragRef.current == null && !movedRef.current) {
      const { px, py } = pointer(e); const { h, s: sc } = sizeRef.current;
      const nx = Math.max(0, Math.min(LW, px / sc)); const ny = Math.max(0, Math.min(LH, (h - py) / sc));
      setPts((old) => [...old, { x: nx, y: ny }]); setStep(0); setPlaying(false);
    }
    dragRef.current = null;
  };
  const play = () => { if (step >= maxStep) setStep(0); lastRef.current = 0; setPlaying((p) => !p); };

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} />
        <div class="space-y-3 text-sm">
          <p class="text-muted">Click empty space to add a point; drag a dot to move it. <span style={`color:${COL.low}`}>Lower</span> / <span style={`color:${COL.up}`}>upper</span> chains, <span style={`color:${COL.pop}`}>popped</span> turns.</p>
          <div class="rounded-lg bg-surface-2 p-3 font-mono text-xs">
            <div class="flex justify-between"><span class="text-muted">phase</span><strong>{fr.phase}</strong></div>
            <div class="flex justify-between"><span class="text-muted">frame</span><strong>{s} / {maxStep}</strong></div>
            {fr.turn && <div class="flex justify-between"><span class="text-muted">cross</span><strong style={`color:${COL.pop}`}>{fr.cr.toFixed(0)}</strong></div>}
          </div>
          <p class="min-h-[3.5rem] rounded-lg bg-brand-soft px-3 py-2 text-text">{fr.caption}</p>
          <button onClick={() => { setPts([{ x: 70, y: 80 }, { x: 200, y: 60 }, { x: 400, y: 110 }, { x: 430, y: 250 }, { x: 300, y: 300 }, { x: 120, y: 270 }, { x: 240, y: 180 }, { x: 330, y: 200 }]); setStep(0); setPlaying(false); }} class="rounded-lg bg-surface-2 px-3 py-1 text-xs font-semibold text-muted hover:text-text">reset points</button>
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

function chain(ctx: CanvasRenderingContext2D, pts: Pt[], color: string) {
  if (pts.length === 0) return;
  ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke();
  for (const p of pts) { ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); }
}
function ring(ctx: CanvasRenderingContext2D, at: Pt, color: string) {
  ctx.beginPath(); ctx.arc(at.x, at.y, 9, 0, Math.PI * 2); ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.stroke();
}
