import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated segment–segment intersection via four orientation tests.
   - Drag the four endpoints. Segment 1 = P1→P2 (indigo), 2 = P3→P4 (sky).
   - Step 1 tests whether line P3P4 separates P1 and P2 (signs of d1,d2).
   - Step 2 tests whether line P1P2 separates P3 and P4 (d3,d4).
   - If BOTH straddle, the segments properly cross; we draw the point.
   - y is UP so the picture matches the math convention.
   ------------------------------------------------------------------ */

type Pt = { x: number; y: number };

const LW = 480, LH = 340;
const COL = { s1: '#4f46e5', s2: '#0ea5e9', hit: '#10b981', no: '#f43f5e', grid: 'rgba(128,128,128,0.16)' };

function cross(o: Pt, a: Pt, b: Pt): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}
function sgn(v: number): string { return v > 1 ? '+' : v < -1 ? '−' : '0'; }

export default function GeoSegmentIntersect() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pts, setPts] = useState<Pt[]>([{ x: 80, y: 90 }, { x: 400, y: 260 }, { x: 80, y: 260 }, { x: 400, y: 90 }]);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const stepRef = useRef(0);
  stepRef.current = step;
  const dragRef = useRef<number | null>(null);
  const sizeRef = useRef({ w: LW, h: LH, s: 1 });

  const maxStep = 3;
  const [P1, P2, P3, P4] = pts;
  const d1 = cross(P3, P4, P1), d2 = cross(P3, P4, P2), d3 = cross(P1, P2, P3), d4 = cross(P1, P2, P4);
  const straddleA = (d1 > 1 && d2 < -1) || (d1 < -1 && d2 > 1);
  const straddleB = (d3 > 1 && d4 < -1) || (d3 < -1 && d4 > 1);
  const crosses = straddleA && straddleB;

  // intersection point (if the infinite lines meet)
  let ip: Pt | null = null;
  const denom = (P2.x - P1.x) * (P4.y - P3.y) - (P2.y - P1.y) * (P4.x - P3.x);
  if (Math.abs(denom) > 1e-6) {
    const t = ((P3.x - P1.x) * (P4.y - P3.y) - (P3.y - P1.y) * (P4.x - P3.x)) / denom;
    ip = { x: P1.x + t * (P2.x - P1.x), y: P1.y + t * (P2.y - P1.y) };
  }

  const captions = [
    'Two segments. Drag any endpoint. We only need signs, never division.',
    `Line P3P4 vs P1,P2:  d1=${sgn(d1)}, d2=${sgn(d2)}  →  ${straddleA ? 'opposite signs, P1 and P2 straddle it.' : 'same side, no straddle.'}`,
    `Line P1P2 vs P3,P4:  d3=${sgn(d3)}, d4=${sgn(d4)}  →  ${straddleB ? 'opposite signs, P3 and P4 straddle it.' : 'same side, no straddle.'}`,
    crosses ? 'Both straddle → the segments PROPERLY cross. Intersection drawn.' : 'At least one side does not straddle → no crossing.',
  ];

  const toPx = (p: Pt) => { const { h, s } = sizeRef.current; return { x: p.x * s, y: h - p.y * s }; };

  const draw = () => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = COL.grid; ctx.lineWidth = 1;
    for (let gx = 0; gx <= w; gx += 40) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke(); }
    for (let gy = 0; gy <= h; gy += 40) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke(); }

    const q1 = toPx(P1), q2 = toPx(P2), q3 = toPx(P3), q4 = toPx(P4);

    // extend the line being tested this step (dashed)
    if (step === 1) dashedLine(ctx, q3, q4, 'rgba(14,165,233,0.5)');
    if (step === 2) dashedLine(ctx, q1, q2, 'rgba(79,70,229,0.5)');

    // segments
    seg(ctx, q1, q2, COL.s1, 3.5); seg(ctx, q3, q4, COL.s2, 3.5);

    // sign badges for the endpoints under test
    if (step === 1) { badge(ctx, q1, sgn(d1)); badge(ctx, q2, sgn(d2)); }
    if (step === 2) { badge(ctx, q3, sgn(d3)); badge(ctx, q4, sgn(d4)); }

    // intersection marker
    if (step >= 3 && crosses && ip) {
      const pi = toPx(ip);
      ctx.beginPath(); ctx.arc(pi.x, pi.y, 8, 0, Math.PI * 2); ctx.fillStyle = COL.hit; ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
    }

    handle(ctx, q1, COL.s1, 'P1'); handle(ctx, q2, COL.s1, 'P2');
    handle(ctx, q3, COL.s2, 'P3'); handle(ctx, q4, COL.s2, 'P4');
  };

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 560); const s = w / LW; const h = LH * s;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr; canvas.height = h * dpr; canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d'); if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w, h, s }; draw();
    };
    resize(); window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(draw, [pts, step]);

  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 950 / speed;
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

  const pointer = (e: PointerEvent) => { const r = canvasRef.current!.getBoundingClientRect(); return { px: e.clientX - r.left, py: e.clientY - r.top }; };
  const onDown = (e: PointerEvent) => {
    const { px, py } = pointer(e); let best = -1, bd = 20;
    pts.forEach((p, i) => { const q = toPx(p); const d = Math.hypot(q.x - px, q.y - py); if (d < bd) { bd = d; best = i; } });
    if (best >= 0) { dragRef.current = best; (e.target as HTMLElement).setPointerCapture(e.pointerId); e.preventDefault(); }
  };
  const onMove = (e: PointerEvent) => {
    if (dragRef.current == null) return; const { px, py } = pointer(e); const { h, s } = sizeRef.current;
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
          <p class="text-muted">Drag endpoints of the two segments and watch the four signs.</p>
          <div class="rounded-lg bg-surface-2 p-3 font-mono text-xs">
            <div class="flex justify-between"><span class="text-muted">d1,d2</span><strong>{sgn(d1)} {sgn(d2)} {straddleA ? '↔' : '='}</strong></div>
            <div class="flex justify-between"><span class="text-muted">d3,d4</span><strong>{sgn(d3)} {sgn(d4)} {straddleB ? '↔' : '='}</strong></div>
            <div class="mt-1 flex justify-between border-t border-border pt-1"><span class="text-muted">cross?</span><strong style={`color:${crosses ? COL.hit : COL.no}`}>{crosses ? 'YES' : 'no'}</strong></div>
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

function seg(ctx: CanvasRenderingContext2D, a: Pt, b: Pt, color: string, width: number) {
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
}
function dashedLine(ctx: CanvasRenderingContext2D, a: Pt, b: Pt, color: string) {
  const dx = b.x - a.x, dy = b.y - a.y; const L = Math.hypot(dx, dy) || 1; const ux = dx / L, uy = dy / L;
  ctx.save(); ctx.setLineDash([7, 6]); ctx.strokeStyle = color; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(a.x - ux * 500, a.y - uy * 500); ctx.lineTo(b.x + ux * 500, b.y + uy * 500); ctx.stroke(); ctx.restore();
}
function badge(ctx: CanvasRenderingContext2D, at: Pt, s: string) {
  ctx.font = '700 15px Inter, sans-serif'; ctx.fillStyle = s === '+' ? '#10b981' : s === '−' ? '#f43f5e' : '#64748b';
  ctx.fillText(s, at.x - 4, at.y - 12);
}
function handle(ctx: CanvasRenderingContext2D, at: Pt, color: string, label: string) {
  ctx.beginPath(); ctx.arc(at.x, at.y, 7, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = color; ctx.stroke();
  ctx.font = '600 11px Inter, sans-serif'; ctx.fillStyle = color; ctx.fillText(label, at.x + 9, at.y + 4);
}
