import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated de Casteljau construction of a cubic curve.
   - Drag the 4 control points (indigo handles).
   - Toggle Bézier (pulled toward points) vs Catmull-Rom (passes through).
   - Transport sweeps the parameter t from 0 -> 1 with requestAnimationFrame.
     In Bézier mode each frame shows the repeated lerps: the control polygon,
     the first-level interpolated points, the second, and the final point
     (emerald) that traces out B(t). The traced portion of the curve is solid,
     the rest faint.
   All curve math (lerp, de Casteljau levels, Catmull-Rom) lives in this file.
   ------------------------------------------------------------------ */

type Pt = { x: number; y: number };
type Mode = 'bezier' | 'catmull';

const COLORS = {
  poly: '#4f46e5', // indigo — control polygon / handles
  level: '#0ea5e9', // sky — intermediate de Casteljau levels
  moving: '#10b981', // emerald — the moving point on the curve
  faint: 'rgba(128,128,128,0.35)',
};

// ---- curve math (all inside the island) ----
function lerp(a: Pt, b: Pt, t: number): Pt {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/** Every de Casteljau level: level 0 is the control points, then each round
 *  lerps neighbouring points by t until a single point (the curve point) is left. */
function deCasteljauLevels(pts: Pt[], t: number): Pt[][] {
  const levels: Pt[][] = [pts.map((p) => ({ ...p }))];
  let cur = levels[0];
  while (cur.length > 1) {
    const next: Pt[] = [];
    for (let i = 0; i < cur.length - 1; i++) next.push(lerp(cur[i], cur[i + 1], t));
    levels.push(next);
    cur = next;
  }
  return levels;
}

function bezierAt(pts: Pt[], t: number): Pt {
  const levels = deCasteljauLevels(pts, t);
  return levels[levels.length - 1][0];
}

/** One Catmull-Rom segment through p1->p2 using neighbours p0,p3. Passes through p1,p2. */
function catmullSeg(p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt {
  const t2 = t * t;
  const t3 = t2 * t;
  const calc = (a: number, b: number, c: number, d: number) =>
    0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
  return { x: calc(p0.x, p1.x, p2.x, p3.x), y: calc(p0.y, p1.y, p2.y, p3.y) };
}

/** Catmull-Rom through the 4 control points as waypoints (clamped ends). */
function catmullAt(pts: Pt[], u: number): Pt {
  const n = pts.length - 1;
  const scaled = Math.min(Math.max(u, 0), 1) * n;
  const seg = Math.min(Math.floor(scaled), n - 1);
  const lt = scaled - seg;
  const p0 = pts[Math.max(seg - 1, 0)];
  const p1 = pts[seg];
  const p2 = pts[seg + 1];
  const p3 = pts[Math.min(seg + 2, n)];
  return catmullSeg(p0, p1, p2, p3, lt);
}

function evalAt(pts: Pt[], mode: Mode, t: number): Pt {
  return mode === 'bezier' ? bezierAt(pts, t) : catmullAt(pts, t);
}

// control points live in logical [0,1] space; mapped to pixels with padding
const INITIAL: Pt[] = [
  { x: 0.08, y: 0.82 },
  { x: 0.30, y: 0.12 },
  { x: 0.70, y: 0.12 },
  { x: 0.92, y: 0.82 },
];

export default function G3dBezierCurve() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [points, setPoints] = useState<Pt[]>(() => INITIAL.map((p) => ({ ...p })));
  const [t, setT] = useState(0);
  const [mode, setMode] = useState<Mode>('bezier');
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  const dragRef = useRef<number | null>(null);
  const sizeRef = useRef({ w: 520, h: 380, pad: 34 });
  const rafRef = useRef<number | null>(null);
  const tRef = useRef(0);
  const lastRef = useRef(0);
  tRef.current = t;

  // ---- coordinate helpers (logical <-> pixels) ----
  const toPx = (p: Pt): Pt => {
    const { w, h, pad } = sizeRef.current;
    return { x: pad + p.x * (w - 2 * pad), y: pad + p.y * (h - 2 * pad) };
  };
  const toLogical = (px: number, py: number): Pt => {
    const { w, h, pad } = sizeRef.current;
    return {
      x: Math.min(1, Math.max(0, (px - pad) / (w - 2 * pad))),
      y: Math.min(1, Math.max(0, (py - pad) / (h - 2 * pad))),
    };
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);
    const cur = tRef.current;

    // ---- full curve, faint ----
    const N = 120;
    ctx.lineWidth = 2;
    ctx.strokeStyle = COLORS.faint;
    ctx.beginPath();
    for (let i = 0; i <= N; i++) {
      const q = toPx(evalAt(points, mode, i / N));
      i === 0 ? ctx.moveTo(q.x, q.y) : ctx.lineTo(q.x, q.y);
    }
    ctx.stroke();

    // ---- traced portion 0..t, solid emerald ----
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = COLORS.moving;
    ctx.lineCap = 'round';
    ctx.beginPath();
    const steps = Math.max(1, Math.round(N * cur));
    for (let i = 0; i <= steps; i++) {
      const q = toPx(evalAt(points, mode, (i / steps) * cur));
      i === 0 ? ctx.moveTo(q.x, q.y) : ctx.lineTo(q.x, q.y);
    }
    ctx.stroke();

    // ---- Bézier: animate the de Casteljau scaffolding ----
    if (mode === 'bezier') {
      const levels = deCasteljauLevels(points, cur);
      // intermediate levels (1..n-1) in sky, fading a touch per level
      for (let L = 1; L < levels.length - 1; L++) {
        const lvl = levels[L].map(toPx);
        ctx.strokeStyle = COLORS.level;
        ctx.globalAlpha = 0.85 - (L - 1) * 0.2;
        ctx.lineWidth = 2;
        ctx.beginPath();
        lvl.forEach((q, i) => (i === 0 ? ctx.moveTo(q.x, q.y) : ctx.lineTo(q.x, q.y)));
        ctx.stroke();
        ctx.fillStyle = COLORS.level;
        for (const q of lvl) {
          ctx.beginPath();
          ctx.arc(q.x, q.y, 4.5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
    }

    // ---- control polygon (indigo, dashed) ----
    const poly = points.map(toPx);
    ctx.strokeStyle = COLORS.poly;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    poly.forEach((q, i) => (i === 0 ? ctx.moveTo(q.x, q.y) : ctx.lineTo(q.x, q.y)));
    ctx.stroke();
    ctx.setLineDash([]);

    // ---- moving point on the curve (emerald) ----
    const bp = toPx(evalAt(points, mode, cur));
    ctx.fillStyle = COLORS.moving;
    ctx.beginPath();
    ctx.arc(bp.x, bp.y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // ---- control point handles + labels ----
    ctx.font = '600 12px Inter, sans-serif';
    poly.forEach((q, i) => {
      ctx.beginPath();
      ctx.arc(q.x, q.y, 7, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = COLORS.poly;
      ctx.stroke();
      ctx.fillStyle = COLORS.poly;
      ctx.fillText(`P${i}`, q.x + 10, q.y - 8);
    });
  };

  // ---- responsive sizing with devicePixelRatio ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 620);
      const h = Math.round(w * 0.7);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w, h, pad: 34 };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // redraw when anything visual changes
  useEffect(draw, [points, t, mode]);

  // ---- animation loop: sweep t 0 -> 1 ----
  useEffect(() => {
    if (!playing) {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      return;
    }
    lastRef.current = 0;
    const tick = (now: number) => {
      if (!lastRef.current) lastRef.current = now;
      const dt = (now - lastRef.current) / 1000;
      lastRef.current = now;
      let nt = tRef.current + dt * 0.35 * speed;
      if (nt >= 1) {
        setT(1);
        setPlaying(false);
        return;
      }
      setT(nt);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [playing, speed]);

  // ---- transport ----
  const play = () => {
    if (t >= 1) setT(0);
    setPlaying((p) => !p);
  };
  const step = () => {
    setPlaying(false);
    setT((v) => Math.min(1, +(v + 0.05).toFixed(4)));
  };
  const back = () => {
    setPlaying(false);
    setT((v) => Math.max(0, +(v - 0.05).toFixed(4)));
  };
  const reset = () => {
    setPlaying(false);
    setT(0);
  };

  // ---- pointer dragging of control points ----
  const pointer = (e: PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { px: e.clientX - rect.left, py: e.clientY - rect.top };
  };
  const onDown = (e: PointerEvent) => {
    const { px, py } = pointer(e);
    let best = -1;
    let bestD = 20;
    points.forEach((p, i) => {
      const q = toPx(p);
      const d = Math.hypot(q.x - px, q.y - py);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    if (best >= 0) {
      dragRef.current = best;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      e.preventDefault();
    }
  };
  const onMove = (e: PointerEvent) => {
    if (dragRef.current == null) return;
    const { px, py } = pointer(e);
    const m = toLogical(px, py);
    setPoints((prev) => prev.map((p, i) => (i === dragRef.current ? m : p)));
  };
  const onUp = () => {
    dragRef.current = null;
  };

  const bp = evalAt(points, mode, t);
  const caption =
    mode === 'bezier'
      ? `t = ${t.toFixed(2)} — lerp the 3 edges, then the 2, then the 1: the last point is B(t).`
      : `t = ${t.toFixed(2)} — Catmull-Rom threads every control point; the emerald dot is P(t).`;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        {(['bezier', 'catmull'] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              mode === m ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
            }`}
          >
            {m === 'bezier' ? 'Bézier' : 'Catmull-Rom'}
          </button>
        ))}
        <span class="ml-auto font-mono text-sm text-muted">t = {t.toFixed(2)}</span>
      </div>

      <div class="grid gap-4">
        <canvas
          ref={canvasRef}
          class="touch-none rounded-xl bg-surface-2"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        />

        <p class="min-h-[2.5rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">{caption}</p>

        <div class="flex flex-wrap items-center gap-2">
          <button onClick={back} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏮ Back</button>
          <button onClick={play} class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90">{playing ? '⏸ Pause' : '▶ Play'}</button>
          <button onClick={step} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏭ Step</button>
          <button onClick={reset} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">↺ Reset</button>
          <label class="ml-auto flex items-center gap-2 text-xs text-muted">speed
            <input type="range" min={0.5} max={3} step={0.5} value={speed} onInput={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))} class="w-24 accent-[#4f46e5]" />
          </label>
        </div>

        <p class="text-center text-xs text-muted">
          Drag the <span style={`color:${COLORS.poly}`}>indigo</span> control points. In Bézier mode the
          <span style={`color:${COLORS.level}`}> sky</span> segments are the intermediate lerps; the
          <span style={`color:${COLORS.moving}`}> emerald</span> dot traces B(t).
        </p>
      </div>
    </div>
  );
}
