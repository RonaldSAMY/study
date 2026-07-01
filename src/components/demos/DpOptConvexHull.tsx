import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Convex Hull Trick — build the lower envelope of lines.
   - Edit the lines as "m,c" pairs (slope, intercept), separated by ;.
   - Lines are sorted by DECREASING slope and added one at a time.
     When a new line makes the previous one never-minimal, that line is
     popped (flashes red). The surviving lines form the lower hull.
   - The emerald curve is min over all lines = the DP we want to query.
   - Drag the x-slider: the winning line and min value are shown.
   - Transport: Play / Pause / Step / Back / Reset + speed.
   ------------------------------------------------------------------ */

const COLORS = { faint: 'rgba(128,128,128,0.35)', hull: '#4f46e5', env: '#10b981', add: '#0ea5e9', pop: '#ef4444' };

type Line = { m: number; c: number };
type Frame = { hull: Line[]; added: Line; popped: Line[] };

function parseLines(s: string): Line[] {
  const out: Line[] = [];
  for (const part of s.split(/[;\n]/)) {
    const m = part.trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
    if (m) out.push({ m: parseFloat(m[1]), c: parseFloat(m[2]) });
  }
  return out;
}

export default function DpOptConvexHull() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 520, h: 320 });
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);

  const [text, setText] = useState('3,2; 2,3; 1,5; 0,8; -1,12; -2,18');
  const [lines, setLines] = useState<Line[]>(() => parseLines('3,2; 2,3; 1,5; 0,8; -1,12; -2,18'));
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1.5);
  const [qx, setQx] = useState(0.5); // normalized query x
  idxRef.current = idx;

  const xMin = 0, xMax = 12;

  const built = (() => {
    const sorted = [...lines].sort((a, b) => b.m - a.m); // decreasing slope
    const bad = (a: Line, b: Line, cc: Line) => (cc.c - a.c) * (a.m - b.m) <= (b.c - a.c) * (a.m - cc.m);
    const frames: Frame[] = [];
    const hull: Line[] = [];
    for (const line of sorted) {
      const popped: Line[] = [];
      while (hull.length >= 2 && bad(hull[hull.length - 2], hull[hull.length - 1], line)) popped.push(hull.pop()!);
      hull.push(line);
      frames.push({ hull: [...hull], added: line, popped });
    }
    // y range from sampling
    let yLo = Infinity, yHi = -Infinity;
    for (const l of lines) for (const x of [xMin, xMax]) { const y = l.m * x + l.c; yLo = Math.min(yLo, y); yHi = Math.max(yHi, y); }
    if (!isFinite(yLo)) { yLo = 0; yHi = 1; }
    const pad = (yHi - yLo) * 0.1 || 1;
    return { sorted, frames, yLo: yLo - pad, yHi: yHi + pad };
  })();

  const { frames, yLo, yHi } = built;
  const total = frames.length;
  const cur = total ? frames[Math.min(idx, total - 1)] : null;
  const hull = cur ? cur.hull : [];

  const commit = () => { const p = parseLines(text); if (p.length) { setLines(p); setIdx(0); setPlaying(false); } };

  const queryX = xMin + qx * (xMax - xMin);
  const envAt = (x: number) => {
    if (!hull.length) return { v: Infinity, line: null as Line | null };
    let best = Infinity, bl: Line | null = null;
    for (const l of hull) { const v = l.m * x + l.c; if (v < best) { best = v; bl = l; } }
    return { v: best, line: bl };
  };
  const q = envAt(queryX);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);
    const pad = 30;
    const X = (x: number) => pad + ((x - xMin) / (xMax - xMin)) * (w - 2 * pad);
    const Y = (y: number) => h - pad - ((y - yLo) / (yHi - yLo)) * (h - 2 * pad);

    // axes
    ctx.strokeStyle = 'rgba(128,128,128,0.25)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pad, Y(yLo)); ctx.lineTo(w - pad, Y(yLo)); ctx.stroke();

    // all input lines faint
    for (const l of lines) {
      ctx.strokeStyle = COLORS.faint; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(X(xMin), Y(l.m * xMin + l.c)); ctx.lineTo(X(xMax), Y(l.m * xMax + l.c)); ctx.stroke();
    }
    // popped lines (dashed red) for current step
    if (cur) for (const l of cur.popped) {
      ctx.strokeStyle = COLORS.pop; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]);
      ctx.beginPath(); ctx.moveTo(X(xMin), Y(l.m * xMin + l.c)); ctx.lineTo(X(xMax), Y(l.m * xMax + l.c)); ctx.stroke();
      ctx.setLineDash([]);
    }
    // hull lines
    for (const l of hull) {
      const isAdded = cur && l === cur.added;
      ctx.strokeStyle = isAdded ? COLORS.add : COLORS.hull; ctx.lineWidth = isAdded ? 3 : 1.6;
      ctx.beginPath(); ctx.moveTo(X(xMin), Y(l.m * xMin + l.c)); ctx.lineTo(X(xMax), Y(l.m * xMax + l.c)); ctx.stroke();
    }
    // lower envelope
    if (hull.length) {
      ctx.strokeStyle = COLORS.env; ctx.lineWidth = 3.5; ctx.lineJoin = 'round';
      ctx.beginPath();
      const N = 120;
      for (let i = 0; i <= N; i++) { const x = xMin + (i / N) * (xMax - xMin); const v = envAt(x).v; if (i === 0) ctx.moveTo(X(x), Y(v)); else ctx.lineTo(X(x), Y(v)); }
      ctx.stroke();
    }
    // query marker
    if (hull.length && isFinite(q.v)) {
      ctx.strokeStyle = 'rgba(15,23,42,0.4)'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(X(queryX), pad); ctx.lineTo(X(queryX), h - pad); ctx.stroke(); ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(X(queryX), Y(q.v), 6, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.env; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 560);
      const h = Math.round(w * 0.6);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr; canvas.height = h * dpr;
      canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w, h };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => { window.removeEventListener('resize', resize); if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(draw, [idx, lines, qx]);

  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 950 / speed;
    const tick = (t: number) => {
      if (!lastRef.current) lastRef.current = t;
      if (t - lastRef.current >= interval) {
        lastRef.current = t;
        const next = idxRef.current + 1;
        if (next >= total) { setIdx(total - 1); setPlaying(false); return; }
        setIdx(next);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
  }, [playing, speed, lines, total]);

  const reset = () => { setPlaying(false); setIdx(0); lastRef.current = 0; };
  const stepF = () => { setPlaying(false); setIdx((v) => Math.min(total - 1, v + 1)); };
  const stepB = () => { setPlaying(false); setIdx((v) => Math.max(0, v - 1)); };
  const play = () => { if (idx >= total - 1) setIdx(0); lastRef.current = 0; setPlaying((p) => !p); };

  const fmt = (x: number) => (Number.isInteger(x) ? String(x) : x.toFixed(2));

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <input value={text} onInput={(e) => setText((e.target as HTMLInputElement).value)} class="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm" placeholder="m,c ; m,c ; ..." />
        <button onClick={commit} class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Load</button>
      </div>

      <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

      <p class="mt-3 min-h-[2.5rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">
        {cur
          ? `Added line y = ${fmt(cur.added.m)}x + ${fmt(cur.added.c)} (slope ${fmt(cur.added.m)}). ${cur.popped.length ? `Popped ${cur.popped.length} dominated line(s).` : 'No pops — it joins the hull.'} Hull size: ${hull.length}.`
          : 'Press Play to add lines by decreasing slope and watch dominated ones get popped.'}
      </p>

      <div class="mt-3 flex items-center gap-3 text-sm">
        <span class="text-muted">query x = <span class="font-mono text-text">{fmt(queryX)}</span></span>
        <input type="range" min={0} max={1} step={0.01} value={qx} onInput={(e) => setQx(parseFloat((e.target as HTMLInputElement).value))} class="flex-1 accent-[#10b981]" />
        <span class="font-mono" style={`color:${COLORS.env}`}>min = {isFinite(q.v) ? fmt(q.v) : '—'}</span>
      </div>
      {q.line && <p class="mt-1 text-xs text-muted">winning line: y = {fmt(q.line.m)}x + {fmt(q.line.c)}</p>}

      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={stepB} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏮ Back</button>
        <button onClick={play} class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90">{playing ? '⏸ Pause' : '▶ Play'}</button>
        <button onClick={stepF} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏭ Step</button>
        <button onClick={reset} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">↺ Reset</button>
        <span class="ml-auto font-mono text-xs text-muted">{Math.min(idx + 1, total)}/{total}</span>
        <label class="flex items-center gap-2 text-xs text-muted">speed
          <input type="range" min={0.5} max={3} step={0.5} value={speed} onInput={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))} class="w-20 accent-[#4f46e5]" />
        </label>
      </div>
      <p class="mt-2 text-center text-xs text-muted"><span style={`color:${COLORS.hull}`}>■</span> hull line &nbsp; <span style={`color:${COLORS.pop}`}>■</span> popped &nbsp; <span style={`color:${COLORS.env}`}>■</span> min envelope (the DP value at each x).</p>
    </div>
  );
}
