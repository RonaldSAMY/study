import { useEffect, useMemo, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated HITS: hubs & authorities by mutual reinforcement.
   - A default directed citation graph. Click a node then another to
     toggle a directed link.
   - Each STEP is one half-update that ALTERNATES: authorities pull from
     hubs (a = A^T h), then hubs pull from authorities (h = A a), then
     normalize. AUTHORITY score = node SIZE/blue fill; HUB score = the
     emerald ring thickness. The active node pulses.
   - Transport: Play / Pause / Step / Back / Reset + speed.
   ------------------------------------------------------------------ */

const LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];
const POS = [
  { x: 0.16, y: 0.25 },
  { x: 0.16, y: 0.75 },
  { x: 0.45, y: 0.5 },
  { x: 0.72, y: 0.22 },
  { x: 0.72, y: 0.78 },
  { x: 0.92, y: 0.5 },
];
const DEFAULT_EDGES = ['0-2', '0-3', '1-2', '1-4', '2-3', '2-4', '3-5', '4-5'];
const ITERS = 9;
const COLORS = { auth: '#0ea5e9', hub: '#10b981', authHi: '#4f46e5' };

type Frame = { hub: number[]; auth: number[]; phase: 'auth' | 'hub' | 'init'; iter: number };

export default function NetHitsHubAuthority() {
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
    const out: number[][] = LABELS.map(() => []);
    const inc: number[][] = LABELS.map(() => []);
    for (const e of edges) {
      const [f, t] = e.split('-').map(Number);
      out[f].push(t);
      inc[t].push(f);
    }
    let hub = LABELS.map(() => 1);
    let auth = LABELS.map(() => 1);
    const norm = (v: number[]) => {
      const s = Math.sqrt(v.reduce((a, x) => a + x * x, 0)) || 1;
      return v.map((x) => x / s);
    };
    hub = norm(hub);
    auth = norm(auth);
    const fr: Frame[] = [{ hub: hub.slice(), auth: auth.slice(), phase: 'init', iter: 0 }];
    for (let it = 0; it < ITERS; it++) {
      // authorities from hubs
      auth = norm(LABELS.map((_, v) => inc[v].reduce((a, u) => a + hub[u], 0)));
      fr.push({ hub: hub.slice(), auth: auth.slice(), phase: 'auth', iter: it + 1 });
      // hubs from authorities
      hub = norm(LABELS.map((_, v) => out[v].reduce((a, w) => a + auth[w], 0)));
      fr.push({ hub: hub.slice(), auth: auth.slice(), phase: 'hub', iter: it + 1 });
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
    const aMax = Math.max(...f.auth, 1e-9);
    const radius = (i: number) => 12 + (f.auth[i] / aMax) * 22;

    for (const e of edges) {
      const [a, b] = e.split('-').map(Number);
      const ang = Math.atan2(py(b) - py(a), px(b) - px(a));
      const ex = px(b) - Math.cos(ang) * (radius(b) + 4);
      const ey = py(b) - Math.sin(ang) * (radius(b) + 4);
      ctx.beginPath();
      ctx.moveTo(px(a), py(a));
      ctx.lineTo(ex, ey);
      ctx.strokeStyle = 'rgba(128,128,128,0.4)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex - Math.cos(ang - 0.4) * 8, ey - Math.sin(ang - 0.4) * 8);
      ctx.lineTo(ex - Math.cos(ang + 0.4) * 8, ey - Math.sin(ang + 0.4) * 8);
      ctx.closePath();
      ctx.fillStyle = 'rgba(128,128,128,0.5)';
      ctx.fill();
    }

    const hMax = Math.max(...f.hub, 1e-9);
    for (let i = 0; i < LABELS.length; i++) {
      const r = radius(i);
      ctx.beginPath();
      ctx.arc(px(i), py(i), r, 0, Math.PI * 2);
      ctx.fillStyle = f.phase === 'auth' ? COLORS.authHi : COLORS.auth;
      ctx.globalAlpha = 0.55 + 0.45 * (f.auth[i] / aMax);
      ctx.fill();
      ctx.globalAlpha = 1;
      // hub ring thickness
      ctx.beginPath();
      ctx.arc(px(i), py(i), r + 4, 0, Math.PI * 2);
      ctx.strokeStyle = COLORS.hub;
      ctx.lineWidth = 1 + (f.hub[i] / hMax) * 6;
      ctx.stroke();
      if (i === sel) {
        ctx.beginPath();
        ctx.arc(px(i), py(i), r + 9, 0, Math.PI * 2);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
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
      const h = Math.round(w * 0.74);
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
    const interval = 820 / speed;
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
      if (dx * dx + dy * dy < 28 * 28) { hit = i; break; }
    }
    if (hit < 0) { setSel(null); return; }
    if (sel === null) { setSel(hit); return; }
    if (sel === hit) { setSel(null); return; }
    const k = `${sel}-${hit}`;
    setEdges((prev) => { const n = new Set(prev); if (n.has(k)) n.delete(k); else n.add(k); return n; });
    setSel(null);
    setIdx(0);
    setPlaying(false);
  };

  const f = frames[Math.min(idx, maxIdx)];
  const topAuth = f.auth.indexOf(Math.max(...f.auth));
  const topHub = f.hub.indexOf(Math.max(...f.hub));
  const caption = f.phase === 'init'
    ? 'All hub and authority scores start at 1 (normalized). Press Play to alternate updates.'
    : f.phase === 'auth'
      ? `iteration ${f.iter}: authorities update — each node sums the HUB scores pointing at it. ${LABELS[topAuth]} is the strongest authority.`
      : `iteration ${f.iter}: hubs update — each node sums the AUTHORITY scores it points to. ${LABELS[topHub]} is the strongest hub.`;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" onClick={onClick} />
        <div class="space-y-3 text-sm">
          <p class="text-muted">
            Click one node then another to toggle a link. <span style={`color:${COLORS.auth}`} class="font-semibold">Blue fill = authority</span>
            {' '}(who is pointed at); <span style={`color:${COLORS.hub}`} class="font-semibold">emerald ring = hub</span> (who points to good
            authorities). They reinforce each other.
          </p>
          <div class="grid grid-cols-2 gap-2 text-xs">
            <div class="rounded-lg bg-surface-2 px-3 py-2">top authority<div class="font-mono font-semibold text-text">{LABELS[topAuth]} · {f.auth[topAuth].toFixed(2)}</div></div>
            <div class="rounded-lg bg-surface-2 px-3 py-2">top hub<div class="font-mono font-semibold text-text">{LABELS[topHub]} · {f.hub[topHub].toFixed(2)}</div></div>
          </div>
          <button onClick={() => { setEdges(new Set(DEFAULT_EDGES)); setSel(null); reset(); }}
            class="rounded-lg bg-surface-2 px-3 py-1.5 text-xs font-semibold text-muted hover:text-text">
            Restore default graph
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
