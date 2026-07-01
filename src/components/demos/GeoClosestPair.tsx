import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated closest pair — one level of divide & conquer.
   - Drag points around. Play to: split at the median x, find the best
     pair in each half, take δ = min, then scan the vertical STRIP of
     width 2δ where a cross-divide pair could still win.
   - Precomputed frames; y is UP. (Real recursion goes deeper; this
     shows the crucial combine step.)
   ------------------------------------------------------------------ */

type Pt = { x: number; y: number };
type Frame = { split: number | null; left: Pt[]; right: Pt[]; pair: [Pt, Pt] | null; delta: number | null; strip: boolean; test: [Pt, Pt] | null; caption: string };

const LW = 480, LH = 340;
const COL = { l: '#4f46e5', r: '#0ea5e9', pt: '#94a3b8', best: '#10b981', test: '#f59e0b', grid: 'rgba(128,128,128,0.16)' };

function dist(a: Pt, b: Pt) { return Math.hypot(a.x - b.x, a.y - b.y); }
function brute(arr: Pt[]): { d: number; pair: [Pt, Pt] | null } {
  let d = Infinity, pair: [Pt, Pt] | null = null;
  for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++) { const e = dist(arr[i], arr[j]); if (e < d) { d = e; pair = [arr[i], arr[j]]; } }
  return { d, pair };
}

function buildFrames(input: Pt[]): Frame[] {
  const P = [...input].sort((a, b) => a.x - b.x);
  const n = P.length; const frames: Frame[] = [];
  frames.push({ split: null, left: [], right: [], pair: null, delta: null, strip: false, test: null, caption: `${n} points, sorted by x. Find the closest pair.` });
  if (n < 2) return frames;
  const mid = Math.floor(n / 2); const midX = P[mid].x;
  const left = P.slice(0, mid), right = P.slice(mid);
  frames.push({ split: midX, left, right, pair: null, delta: null, strip: false, test: null, caption: 'Divide at the median x into a left half and a right half.' });
  const lb = brute(left), rb = brute(right);
  frames.push({ split: midX, left, right, pair: lb.pair, delta: null, strip: false, test: null, caption: `Best pair on the LEFT: distance ${isFinite(lb.d) ? lb.d.toFixed(1) : '∞'}.` });
  frames.push({ split: midX, left, right, pair: rb.pair, delta: null, strip: false, test: null, caption: `Best pair on the RIGHT: distance ${isFinite(rb.d) ? rb.d.toFixed(1) : '∞'}.` });
  let best = lb.d <= rb.d ? lb : rb;
  const delta = best.d;
  frames.push({ split: midX, left, right, pair: best.pair, delta, strip: true, test: null, caption: `δ = min = ${delta.toFixed(1)}. Only the strip within δ of the divide can beat it.` });
  const strip = P.filter((p) => Math.abs(p.x - midX) < delta).sort((a, b) => a.y - b.y);
  for (let i = 0; i < strip.length; i++) {
    for (let j = i + 1; j < strip.length && strip[j].y - strip[i].y < best.d; j++) {
      const e = dist(strip[i], strip[j]);
      const improved = e < best.d;
      if (improved) best = { d: e, pair: [strip[i], strip[j]] };
      frames.push({ split: midX, left, right, pair: best.pair, delta: best.d, strip: true, test: [strip[i], strip[j]], caption: improved ? `Strip pair distance ${e.toFixed(1)} < δ — new best!` : `Strip pair ${e.toFixed(1)} ≥ δ. Keep the current best.` });
    }
  }
  frames.push({ split: null, left: [], right: [], pair: best.pair, delta: null, strip: false, test: null, caption: `Closest pair overall: distance ${best.d.toFixed(2)}.` });
  return frames;
}

export default function GeoClosestPair() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pts, setPts] = useState<Pt[]>([
    { x: 60, y: 90 }, { x: 130, y: 240 }, { x: 190, y: 130 }, { x: 235, y: 260 },
    { x: 270, y: 120 }, { x: 300, y: 200 }, { x: 360, y: 90 }, { x: 420, y: 210 }, { x: 210, y: 190 },
  ]);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1.5);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const stepRef = useRef(0);
  stepRef.current = step;
  const dragRef = useRef<number | null>(null);
  const sizeRef = useRef({ w: LW, h: LH, s: 1 });

  const frames = buildFrames(pts);
  const maxStep = frames.length - 1;
  const s = Math.min(step, maxStep);
  const fr = frames[s];

  const toPx = (p: Pt) => { const { h, s: sc } = sizeRef.current; return { x: p.x * sc, y: h - p.y * sc }; };

  const draw = () => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const { w, h, s: sc } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = COL.grid; ctx.lineWidth = 1;
    for (let gx = 0; gx <= w; gx += 40) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke(); }
    for (let gy = 0; gy <= h; gy += 40) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke(); }

    // strip band
    if (fr.strip && fr.split != null && fr.delta != null) {
      const cx = fr.split * sc, dw = fr.delta * sc;
      ctx.fillStyle = 'rgba(245,158,11,0.10)'; ctx.fillRect(cx - dw, 0, dw * 2, h);
    }
    // divide line
    if (fr.split != null) { const cx = fr.split * sc; ctx.strokeStyle = 'rgba(128,128,128,0.6)'; ctx.setLineDash([6, 5]); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, h); ctx.stroke(); ctx.setLineDash([]); }

    // test pair
    if (fr.test) { const a = toPx(fr.test[0]), b = toPx(fr.test[1]); ctx.strokeStyle = COL.test; ctx.lineWidth = 2; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.setLineDash([]); }
    // best pair
    if (fr.pair) { const a = toPx(fr.pair[0]), b = toPx(fr.pair[1]); ctx.strokeStyle = COL.best; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ring(ctx, a, COL.best); ring(ctx, b, COL.best); }

    // points
    for (const p of pts) {
      const u = toPx(p);
      let c = COL.pt;
      if (fr.left.includes(p)) c = COL.l; else if (fr.right.includes(p)) c = COL.r;
      ctx.beginPath(); ctx.arc(u.x, u.y, 5, 0, Math.PI * 2); ctx.fillStyle = c; ctx.fill();
    }
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
    const interval = 800 / speed;
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
    pts.forEach((p, i) => { const u = toPx(p); const d = Math.hypot(u.x - px, u.y - py); if (d < bd) { bd = d; best = i; } });
    if (best >= 0) { dragRef.current = best; (e.target as HTMLElement).setPointerCapture(e.pointerId); e.preventDefault(); }
  };
  const onMove = (e: PointerEvent) => {
    if (dragRef.current == null) return; const { px, py } = pointer(e); const { h, s: sc } = sizeRef.current;
    const nx = Math.max(0, Math.min(LW, px / sc)); const ny = Math.max(0, Math.min(LH, (h - py) / sc));
    setPts((old) => old.map((p, i) => (i === dragRef.current ? { x: nx, y: ny } : p))); setStep(0); setPlaying(false);
  };
  const onUp = () => { dragRef.current = null; };
  const play = () => { if (step >= maxStep) setStep(0); lastRef.current = 0; setPlaying((p) => !p); };

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} />
        <div class="space-y-3 text-sm">
          <p class="text-muted">Drag points across the divide. <span style={`color:${COL.l}`}>left</span> / <span style={`color:${COL.r}`}>right</span> halves, <span style={`color:${COL.test}`}>strip</span> band.</p>
          <div class="rounded-lg bg-surface-2 p-3 font-mono text-xs">
            <div class="flex justify-between"><span class="text-muted">δ (best)</span><strong>{fr.delta != null ? fr.delta.toFixed(1) : '—'}</strong></div>
            <div class="flex justify-between"><span class="text-muted">frame</span><strong>{s} / {maxStep}</strong></div>
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

function ring(ctx: CanvasRenderingContext2D, at: Pt, color: string) {
  ctx.beginPath(); ctx.arc(at.x, at.y, 9, 0, Math.PI * 2); ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.stroke();
}
