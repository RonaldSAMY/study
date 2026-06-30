import { useEffect, useMemo, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated PageRank on a small directed "web".
   - A default 5-page network. Click one node then another to toggle a
     directed link between them; drag the damping slider to change how
     much rank teleports vs. flows.
   - Each STEP is one power-iteration. Node SIZE and COLOR encode the
     current rank; the highest-rank node is ringed; the most-changed
     node's out-links pulse to show rank "flowing" along edges.
   - Transport: Play / Pause / Step / Back / Reset + speed.
   ------------------------------------------------------------------ */

const LABELS = ['A', 'B', 'C', 'D', 'E'];
const POS = [
  { x: 0.5, y: 0.13 },
  { x: 0.86, y: 0.4 },
  { x: 0.72, y: 0.85 },
  { x: 0.28, y: 0.85 },
  { x: 0.14, y: 0.4 },
];
const COLORS = { lo: '#0ea5e9', hi: '#4f46e5', ring: '#10b981' };
const DEFAULT_EDGES = ['0-1', '0-2', '1-2', '2-0', '2-3', '3-4', '4-2', '4-0'];
const ITERS = 24;

type Frame = { ranks: number[]; changed: number; top: number; delta: number };

export default function NetPageRankFlow() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 460, h: 360 });
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);

  const [edges, setEdges] = useState<Set<string>>(() => new Set(DEFAULT_EDGES));
  const [damping, setDamping] = useState(0.85);
  const [sel, setSel] = useState<number | null>(null);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  idxRef.current = idx;

  // ---- precompute power-iteration frames ----
  const frames: Frame[] = useMemo(() => {
    const N = LABELS.length;
    const out: number[][] = LABELS.map(() => []);
    const inc: number[][] = LABELS.map(() => []);
    for (const e of edges) {
      const [f, t] = e.split('-').map(Number);
      out[f].push(t);
      inc[t].push(f);
    }
    let ranks = LABELS.map(() => 1 / N);
    const fr: Frame[] = [{ ranks: ranks.slice(), changed: -1, top: topOf(ranks), delta: 1 }];
    for (let it = 0; it < ITERS; it++) {
      let dangling = 0;
      for (let u = 0; u < N; u++) if (out[u].length === 0) dangling += ranks[u];
      const next = new Array(N).fill(0);
      for (let v = 0; v < N; v++) {
        let sum = 0;
        for (const u of inc[v]) sum += ranks[u] / out[u].length;
        next[v] = (1 - damping) / N + damping * (sum + dangling / N);
      }
      let changed = 0;
      let cmax = -1;
      let delta = 0;
      for (let v = 0; v < N; v++) {
        const d = Math.abs(next[v] - ranks[v]);
        delta += d;
        if (d > cmax) { cmax = d; changed = v; }
      }
      ranks = next;
      fr.push({ ranks: ranks.slice(), changed, top: topOf(ranks), delta });
    }
    return fr;

    function topOf(r: number[]) {
      let best = 0;
      for (let i = 1; i < r.length; i++) if (r[i] > r[best]) best = i;
      return best;
    }
  }, [edges, damping]);

  const maxIdx = frames.length - 1;
  if (idx > maxIdx) setIdx(maxIdx);

  // ---- drawing ----
  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);
    const f = frames[Math.min(idxRef.current, frames.length - 1)];
    const px = (i: number) => POS[i].x * w;
    const py = (i: number) => POS[i].y * h;
    const rMax = Math.max(...f.ranks);
    const rMin = Math.min(...f.ranks);
    const radius = (i: number) => {
      const t = rMax > rMin ? (f.ranks[i] - rMin) / (rMax - rMin) : 0.5;
      return 14 + t * 22;
    };

    // edges (arrows)
    for (const e of edges) {
      const [a, b] = e.split('-').map(Number);
      const hot = f.changed === a;
      drawArrow(ctx, px(a), py(a), px(b), py(b), radius(b), hot);
    }

    // nodes
    for (let i = 0; i < LABELS.length; i++) {
      const t = rMax > rMin ? (f.ranks[i] - rMin) / (rMax - rMin) : 0.5;
      ctx.beginPath();
      ctx.arc(px(i), py(i), radius(i), 0, Math.PI * 2);
      ctx.fillStyle = lerpColor(COLORS.lo, COLORS.hi, t);
      ctx.fill();
      if (i === f.top) {
        ctx.lineWidth = 4;
        ctx.strokeStyle = COLORS.ring;
        ctx.stroke();
      }
      if (i === sel) {
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#fff';
        ctx.stroke();
      }
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 15px ui-sans-serif, system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(LABELS[i], px(i), py(i) - 1);
      ctx.font = '11px ui-monospace, monospace';
      ctx.fillText(f.ranks[i].toFixed(2), px(i), py(i) + radius(i) + 11);
    }

    function drawArrow(c: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, rB: number, hot: boolean) {
      const ang = Math.atan2(y2 - y1, x2 - x1);
      const ex = x2 - Math.cos(ang) * (rB + 3);
      const ey = y2 - Math.sin(ang) * (rB + 3);
      c.beginPath();
      c.moveTo(x1, y1);
      c.lineTo(ex, ey);
      c.strokeStyle = hot ? COLORS.ring : 'rgba(128,128,128,0.45)';
      c.lineWidth = hot ? 3 : 1.5;
      c.stroke();
      c.beginPath();
      c.moveTo(ex, ey);
      c.lineTo(ex - Math.cos(ang - 0.4) * 9, ey - Math.sin(ang - 0.4) * 9);
      c.lineTo(ex - Math.cos(ang + 0.4) * 9, ey - Math.sin(ang + 0.4) * 9);
      c.closePath();
      c.fillStyle = hot ? COLORS.ring : 'rgba(128,128,128,0.5)';
      c.fill();
    }
  };

  function lerpColor(a: string, b: string, t: number) {
    const pa = [parseInt(a.slice(1, 3), 16), parseInt(a.slice(3, 5), 16), parseInt(a.slice(5, 7), 16)];
    const pb = [parseInt(b.slice(1, 3), 16), parseInt(b.slice(3, 5), 16), parseInt(b.slice(5, 7), 16)];
    const m = pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
    return `rgb(${m[0]},${m[1]},${m[2]})`;
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 480);
      const h = Math.round(w * 0.78);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w, h };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(draw, [idx, frames, sel, edges]);

  useEffect(() => {
    if (!playing) {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      return;
    }
    const interval = 760 / speed;
    const tick = (t: number) => {
      if (!lastRef.current) lastRef.current = t;
      if (t - lastRef.current >= interval) {
        lastRef.current = t;
        const next = idxRef.current + 1;
        if (next > maxIdx) { setPlaying(false); return; }
        setIdx(next);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
  }, [playing, speed, maxIdx]);

  const reset = () => { setPlaying(false); setIdx(0); lastRef.current = 0; };
  const stepF = () => { setPlaying(false); setIdx((v) => Math.min(maxIdx, v + 1)); };
  const stepB = () => { setPlaying(false); setIdx((v) => Math.max(0, v - 1)); };
  const play = () => { if (idx >= maxIdx) { setIdx(0); } lastRef.current = 0; setPlaying((p) => !p); };

  const onClick = (e: MouseEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const { w, h } = sizeRef.current;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    let hit = -1;
    for (let i = 0; i < LABELS.length; i++) {
      const dx = mx - POS[i].x * w;
      const dy = my - POS[i].y * h;
      if (dx * dx + dy * dy < 30 * 30) { hit = i; break; }
    }
    if (hit < 0) { setSel(null); return; }
    if (sel === null) { setSel(hit); return; }
    if (sel === hit) { setSel(null); return; }
    const k = `${sel}-${hit}`;
    setEdges((prev) => {
      const n = new Set(prev);
      if (n.has(k)) n.delete(k); else n.add(k);
      return n;
    });
    setSel(null);
    setIdx(0);
    setPlaying(false);
  };

  const f = frames[Math.min(idx, maxIdx)];
  const caption = idx === 0
    ? 'Every page starts with equal rank 1/N. Press Play to run power iterations.'
    : `iteration ${idx}: rank flows along out-links; ${LABELS[f.changed]} moved most. Top page: ${LABELS[f.top]} (${f.ranks[f.top].toFixed(3)}). Total change ${f.delta.toFixed(4)}.`;
  const converged = idx > 0 && f.delta < 1e-3;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" onClick={onClick} />
        <div class="space-y-3 text-sm">
          <p class="text-muted">
            Click one node then another to toggle a directed link. Node size and color show the current
            rank; the emerald ring marks the leader. Slide damping to feel the random-surfer teleport.
          </p>
          <label class="flex items-center gap-2 text-xs text-muted">
            damping d = {damping.toFixed(2)}
            <input type="range" min={0.5} max={0.95} step={0.05} value={damping}
              onInput={(e) => { setDamping(parseFloat((e.target as HTMLInputElement).value)); setIdx(0); setPlaying(false); }}
              class="flex-1 accent-[#4f46e5]" />
          </label>
          <div class="rounded-lg bg-surface-2 px-3 py-2 text-xs">
            iteration <span class="font-mono font-semibold">{idx}</span> / {maxIdx}
            {converged && <span class="ml-2 font-semibold text-[#10b981]">converged</span>}
          </div>
          <button onClick={() => { setEdges(new Set(DEFAULT_EDGES)); setSel(null); reset(); }}
            class="rounded-lg bg-surface-2 px-3 py-1.5 text-xs font-semibold text-muted hover:text-text">
            Restore default web
          </button>
        </div>
      </div>

      <p class="mt-3 min-h-[2.75rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">{caption}</p>

      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={stepB} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏮ Back</button>
        <button onClick={play} class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90">{playing ? '⏸ Pause' : '▶ Play'}</button>
        <button onClick={stepF} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏭ Step</button>
        <button onClick={reset} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">↺ Reset</button>
        <label class="ml-auto flex items-center gap-2 text-xs text-muted">speed
          <input type="range" min={0.5} max={3} step={0.5} value={speed} onInput={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))} class="w-24 accent-[#4f46e5]" />
        </label>
      </div>
    </div>
  );
}
