import { useEffect, useMemo, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated label propagation community detection.
   - A default network of two dense groups + a couple of bridges. Click
     one node then another to toggle an edge.
   - Every node starts with its OWN label (its own COLOR). Each STEP a
     node adopts the most common label among its neighbours (ties broken
     at random, with a fixed seed so the replay is stable — real LPA
     breaks ties randomly). Labels spread by local majority until the
     colours stabilise into communities.
   - Transport: Play / Pause / Step / Back / Reset + speed.
   ------------------------------------------------------------------ */

const LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const POS = [
  { x: 0.18, y: 0.22 }, { x: 0.36, y: 0.18 }, { x: 0.18, y: 0.62 }, { x: 0.4, y: 0.6 },
  { x: 0.6, y: 0.4 }, { x: 0.82, y: 0.22 }, { x: 0.84, y: 0.66 }, { x: 0.62, y: 0.82 },
];
const DEFAULT_EDGES = ['0-1', '0-2', '1-2', '1-3', '2-3', '4-5', '4-6', '5-6', '5-7', '6-7', '3-4'];
const PALETTE = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6', '#ef4444'];

type Frame = { labels: number[]; changed: number; pass: number };

export default function NetLabelPropagation() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 460, h: 360 });
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);

  const [edges, setEdges] = useState<Set<string>>(() => new Set(DEFAULT_EDGES));
  const [sel, setSel] = useState<number | null>(null);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  idxRef.current = idx;

  const frames: Frame[] = useMemo(() => {
    const N = LABELS.length;
    const adj: Set<number>[] = LABELS.map(() => new Set<number>());
    for (const e of edges) { const [a, b] = e.split('-').map(Number); adj[a].add(b); adj[b].add(a); }

    // Seeded RNG (mulberry32) so ties break "randomly" but the replay is stable.
    let s = 7;
    const rnd = () => {
      s |= 0; s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };

    const labels = LABELS.map((_, i) => i);
    const fr: Frame[] = [{ labels: labels.slice(), changed: -1, pass: 0 }];
    let changedAny = true;
    let pass = 0;
    let guard = 0;
    while (changedAny && guard++ < 60) {
      changedAny = false;
      pass++;
      for (let node = 0; node < N; node++) {
        const counts = new Map<number, number>();
        for (const nb of adj[node]) counts.set(labels[nb], (counts.get(labels[nb]) || 0) + 1);
        if (counts.size === 0) continue;
        let max = -1;
        for (const c of counts.values()) if (c > max) max = c;
        const top: number[] = [];
        for (const [lab, ct] of counts) if (ct === max) top.push(lab);
        const pick = top[Math.floor(rnd() * top.length)];
        if (pick !== labels[node]) {
          labels[node] = pick;
          changedAny = true;
          fr.push({ labels: labels.slice(), changed: node, pass });
        }
      }
    }
    return fr;
  }, [edges]);

  const maxIdx = frames.length - 1;
  if (idx > maxIdx) setIdx(maxIdx);

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

    for (const e of edges) {
      const [a, b] = e.split('-').map(Number);
      const same = f.labels[a] === f.labels[b];
      ctx.beginPath();
      ctx.moveTo(px(a), py(a));
      ctx.lineTo(px(b), py(b));
      ctx.strokeStyle = same ? PALETTE[f.labels[a] % PALETTE.length] : 'rgba(128,128,128,0.35)';
      ctx.lineWidth = same ? 2.5 : 1.2;
      ctx.stroke();
    }

    for (let i = 0; i < LABELS.length; i++) {
      const r = i === f.changed ? 20 : 16;
      ctx.beginPath();
      ctx.arc(px(i), py(i), r, 0, Math.PI * 2);
      ctx.fillStyle = PALETTE[f.labels[i] % PALETTE.length];
      ctx.fill();
      if (i === f.changed) { ctx.lineWidth = 4; ctx.strokeStyle = '#fff'; ctx.stroke(); }
      if (i === sel) { ctx.lineWidth = 3; ctx.strokeStyle = '#111827'; ctx.stroke(); }
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px ui-sans-serif, system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(LABELS[i], px(i), py(i));
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 480);
      const h = Math.round(w * 0.72);
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
    const interval = 800 / speed;
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
  const play = () => { if (idx >= maxIdx) setIdx(0); lastRef.current = 0; setPlaying((p) => !p); };

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
      if (dx * dx + dy * dy < 22 * 22) { hit = i; break; }
    }
    if (hit < 0) { setSel(null); return; }
    if (sel === null) { setSel(hit); return; }
    if (sel === hit) { setSel(null); return; }
    const k = sel < hit ? `${sel}-${hit}` : `${hit}-${sel}`;
    setEdges((prev) => { const n = new Set(prev); if (n.has(k)) n.delete(k); else n.add(k); return n; });
    setSel(null);
    setIdx(0);
    setPlaying(false);
  };

  const f = frames[Math.min(idx, maxIdx)];
  const nComm = new Set(f.labels).size;
  const caption = idx === 0
    ? 'Every node starts with its own unique label. Press Play to let labels spread by local majority.'
    : `pass ${f.pass}: node ${LABELS[f.changed]} switched to the majority label of its neighbours. ${nComm} distinct labels remain.`;
  const stable = idx === maxIdx && idx > 0;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" onClick={onClick} />
        <div class="space-y-3 text-sm">
          <p class="text-muted">
            Click one node then another to toggle an edge. Each node copies the colour most common among
            its neighbours; same-colour nodes form a community. No score to optimise — just local voting.
          </p>
          <div class="grid grid-cols-2 gap-2 text-xs">
            <div class="rounded-lg bg-surface-2 px-3 py-2">distinct labels<div class="font-mono font-semibold text-text">{nComm}</div></div>
            <div class="rounded-lg bg-surface-2 px-3 py-2">status<div class="font-mono font-semibold text-text">{stable ? 'stable' : 'spreading'}</div></div>
          </div>
          <button onClick={() => { setEdges(new Set(DEFAULT_EDGES)); setSel(null); reset(); }}
            class="rounded-lg bg-surface-2 px-3 py-1.5 text-xs font-semibold text-muted hover:text-text">
            Restore default network
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
