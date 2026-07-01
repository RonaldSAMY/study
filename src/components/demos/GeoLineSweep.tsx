import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated line sweep for segment intersection.
   - Drag any segment endpoint. Play to sweep a vertical line left→right.
   - START event: the segment joins the active set and is tested only
     against segments already active. END event: it leaves the set.
   - Found intersections are marked; we never test all pairs blindly.
   - Precomputed frames; y is UP.
   ------------------------------------------------------------------ */

type Pt = { x: number; y: number };
type Found = { i: number; j: number; pt: Pt };
type Frame = { x: number; active: number[]; hi: number | null; found: Found[]; caption: string };

const LW = 480, LH = 340;
const COL = { seg: '#94a3b8', active: '#4f46e5', sweep: '#f59e0b', hit: '#10b981', grid: 'rgba(128,128,128,0.16)' };

function cross(o: Pt, a: Pt, b: Pt) { return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x); }
function properCross(s1: Pt[], s2: Pt[]): Pt | null {
  const [a, b] = s1, [c, d] = s2;
  const d1 = cross(c, d, a), d2 = cross(c, d, b), d3 = cross(a, b, c), d4 = cross(a, b, d);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    const den = (b.x - a.x) * (d.y - c.y) - (b.y - a.y) * (d.x - c.x);
    const t = ((c.x - a.x) * (d.y - c.y) - (c.y - a.y) * (d.x - c.x)) / den;
    return { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
  }
  return null;
}

function buildFrames(segs: Pt[][]): Frame[] {
  type Ev = { x: number; type: 0 | 1; id: number }; // 0 = start, 1 = end
  const events: Ev[] = [];
  segs.forEach((s, i) => { const lx = Math.min(s[0].x, s[1].x), rx = Math.max(s[0].x, s[1].x); events.push({ x: lx, type: 0, id: i }); events.push({ x: rx, type: 1, id: i }); });
  events.sort((a, b) => a.x - b.x || a.type - b.type);
  const frames: Frame[] = [{ x: 0, active: [], hi: null, found: [], caption: 'A vertical sweep line moves left→right, stopping at each endpoint (an event).' }];
  let active: number[] = []; const found: Found[] = [];
  for (const ev of events) {
    if (ev.type === 0) {
      let note = '';
      for (const j of active) { const pt = properCross(segs[ev.id], segs[j]); if (pt) { found.push({ i: Math.min(ev.id, j), j: Math.max(ev.id, j), pt }); note += ` crosses segment ${j};`; } }
      active = [...active, ev.id];
      frames.push({ x: ev.x, active: [...active], hi: ev.id, found: [...found], caption: `Segment ${ev.id} enters the active set.${note ? note + ' Intersection marked.' : ' No crossing with active neighbours.'}` });
    } else {
      active = active.filter((k) => k !== ev.id);
      frames.push({ x: ev.x, active: [...active], hi: ev.id, found: [...found], caption: `Segment ${ev.id} ends — drop it from the active set.` });
    }
  }
  frames.push({ x: LW, active: [], hi: null, found: [...found], caption: `Sweep complete: ${found.length} intersection(s), and we never tested every pair blindly.` });
  return frames;
}

export default function GeoLineSweep() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [segs, setSegs] = useState<Pt[][]>([
    [{ x: 55, y: 95 }, { x: 430, y: 250 }],
    [{ x: 55, y: 250 }, { x: 430, y: 95 }],
    [{ x: 250, y: 60 }, { x: 250, y: 300 }],
    [{ x: 130, y: 300 }, { x: 400, y: 310 }],
  ]);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1.5);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const stepRef = useRef(0);
  stepRef.current = step;
  const dragRef = useRef<{ s: number; e: number } | null>(null);
  const sizeRef = useRef({ w: LW, h: LH, s: 1 });

  const frames = buildFrames(segs);
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

    // sweep line
    const sx = fr.x * sc;
    ctx.strokeStyle = COL.sweep; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, h); ctx.stroke();

    // segments
    segs.forEach((seg, i) => {
      const a = toPx(seg[0]), b = toPx(seg[1]);
      const activeNow = fr.active.includes(i);
      ctx.strokeStyle = i === fr.hi ? COL.hit : activeNow ? COL.active : COL.seg;
      ctx.lineWidth = activeNow || i === fr.hi ? 3.5 : 2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      // endpoints
      [a, b].forEach((q) => { ctx.beginPath(); ctx.arc(q.x, q.y, 5, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = ctx.strokeStyle; ctx.lineWidth = 2; ctx.stroke(); });
      // label
      ctx.font = '600 12px Inter, sans-serif'; ctx.fillStyle = COL.seg; ctx.fillText(`${i}`, (a.x + b.x) / 2 + 4, (a.y + b.y) / 2 - 4);
    });

    // found intersections
    for (const f of fr.found) { const q = toPx(f.pt); ctx.beginPath(); ctx.arc(q.x, q.y, 7, 0, Math.PI * 2); ctx.fillStyle = COL.hit; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); }
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

  useEffect(draw, [segs, step]);

  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 850 / speed;
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
    const { px, py } = pointer(e); let best: { s: number; e: number } | null = null, bd = 18;
    segs.forEach((seg, si) => seg.forEach((p, ei) => { const q = toPx(p); const d = Math.hypot(q.x - px, q.y - py); if (d < bd) { bd = d; best = { s: si, e: ei }; } }));
    if (best) { dragRef.current = best; (e.target as HTMLElement).setPointerCapture(e.pointerId); e.preventDefault(); }
  };
  const onMove = (e: PointerEvent) => {
    if (!dragRef.current) return; const { px, py } = pointer(e); const { h, s: sc } = sizeRef.current;
    const nx = Math.max(0, Math.min(LW, px / sc)); const ny = Math.max(0, Math.min(LH, (h - py) / sc));
    const { s: si, e: ei } = dragRef.current;
    setSegs((old) => old.map((seg, i) => (i === si ? seg.map((p, j) => (j === ei ? { x: nx, y: ny } : p)) : seg))); setStep(0); setPlaying(false);
  };
  const onUp = () => { dragRef.current = null; };
  const play = () => { if (step >= maxStep) setStep(0); lastRef.current = 0; setPlaying((p) => !p); };

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} />
        <div class="space-y-3 text-sm">
          <p class="text-muted">Drag segment endpoints. <span style={`color:${COL.active}`}>active</span> segments, <span style={`color:${COL.sweep}`}>sweep line</span>, <span style={`color:${COL.hit}`}>intersections</span>.</p>
          <div class="rounded-lg bg-surface-2 p-3 font-mono text-xs">
            <div class="flex justify-between"><span class="text-muted">active</span><strong>{fr.active.length ? `{${fr.active.join(', ')}}` : '∅'}</strong></div>
            <div class="flex justify-between"><span class="text-muted">found</span><strong style={`color:${COL.hit}`}>{fr.found.length}</strong></div>
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
