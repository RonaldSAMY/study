import { useEffect, useMemo, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated Locality-Sensitive Hashing (random-projection / SimHash).
   - Points live in 2D. Each random hyperplane through the origin gives
     one bit: +1 side -> 1, other side -> 0. Stacking the bits forms a
     signature; points with the SAME signature share a bucket.
   - Step through the lines one at a time, watch the bits accumulate,
     then query: a point probes only its own bucket. A NEAR point
     collides (same bucket); a FAR point lands elsewhere and is skipped.
   - Drag the ◆ query point to see its bucket change live.
   - Controls: line-count slider, Randomize lines, transport + speed.
   ------------------------------------------------------------------ */

const COLORS = { bit1: '#0ea5e9', bit0: '#94a3b8', query: '#4f46e5', hit: '#10b981' };
const DEG = Math.PI / 180;

type Pt = { x: number; y: number; tag?: string };
type Frame = { linesShown: number; phase: 'intro' | 'hash' | 'bucket' | 'query'; activeLine?: number; caption: string };

// Fixed data points (a near-pair around the query, a far point, plus scatter).
const POINTS: Pt[] = [
  { x: 0.92, y: 0.48, tag: 'near' },
  { x: -0.6, y: 0.8, tag: 'far' },
  { x: 0.2, y: 0.95 },
  { x: -0.9, y: -0.3 },
  { x: 0.6, y: -0.7 },
  { x: -0.4, y: -0.85 },
  { x: 0.95, y: -0.1 },
];

// Deterministic default lines (angles 20°, 80°, 150°) so the first view
// always shows the near point colliding and the far point landing apart.
const DEFAULT_LINES: Pt[] = [20, 80, 150].map((d) => ({ x: Math.cos(d * DEG), y: Math.sin(d * DEG) }));

const dot = (p: Pt, n: Pt) => p.x * n.x + p.y * n.y;
const randUnit = (): Pt => { const a = Math.random() * Math.PI * 2; return { x: Math.cos(a), y: Math.sin(a) }; };
const sig = (p: Pt, lines: Pt[], count: number) => { let s = ''; for (let i = 0; i < count; i++) s += dot(p, lines[i]) >= 0 ? '1' : '0'; return s; };
const bucketHue = (s: string) => (s.length ? (parseInt(s, 2) * 47) % 360 : 0);

function genFrames(k: number): Frame[] {
  const frames: Frame[] = [{ linesShown: 0, phase: 'intro', caption: 'Seven points in 2D. We will hash each one by which side of a few random lines it falls on.' }];
  for (let i = 0; i < k; i++) {
    frames.push({ linesShown: i + 1, phase: 'hash', activeLine: i,
      caption: `Line ${i + 1}: every point gets bit 1 on the shaded (+normal) side, bit 0 on the other. Same side → same bit.` });
  }
  frames.push({ linesShown: k, phase: 'bucket',
    caption: 'Stack the bits into a signature. Points sharing a signature share a bucket — nearby points almost always match.' });
  frames.push({ linesShown: k, phase: 'query',
    caption: 'The ◆ query hashes to one bucket, and we compare only against that bucket: the NEAR point is a candidate, the FAR point is never touched.' });
  return frames;
}

export default function ModLshBuckets() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 420, cx: 210, cy: 210, scale: 160 });
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);
  const draggingRef = useRef(false);

  const [k, setK] = useState(3);
  const [lines, setLines] = useState<Pt[]>(DEFAULT_LINES);
  const [query, setQuery] = useState<Pt>({ x: 0.9, y: 0.5 });
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1.5);

  const frames = useMemo(() => genFrames(k), [k]);
  idxRef.current = idx;
  const frame = frames[Math.min(idx, frames.length - 1)];

  const setLineCount = (n: number) => { setK(n); setLines(Array.from({ length: n }, randUnit)); setIdx(0); setPlaying(false); };
  const randomize = () => { setLines(Array.from({ length: k }, randUnit)); setIdx(0); setPlaying(false); };

  // ---- autoplay ----
  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 1000 / speed;
    const tick = (t: number) => {
      if (!lastRef.current) lastRef.current = t;
      if (t - lastRef.current >= interval) {
        lastRef.current = t;
        const next = idxRef.current + 1;
        if (next >= frames.length) { setIdx(frames.length - 1); setPlaying(false); return; }
        setIdx(next);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
  }, [playing, speed, frames]);

  // ---- canvas sizing ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 420);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = w * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${w}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w, cx: w / 2, cy: w / 2, scale: w / 2 - 26 };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => { window.removeEventListener('resize', resize); if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(draw, [idx, frames, lines, query]);

  const toScreen = (p: Pt) => { const { cx, cy, scale } = sizeRef.current; return { sx: cx + p.x * scale, sy: cy - p.y * scale }; };

  function draw() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, cx, cy, scale } = sizeRef.current;
    const f = frames[Math.min(idxRef.current, frames.length - 1)];
    const big = w * 1.6;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const cssVar = (name: string, fb: string) => getComputedStyle(canvas).getPropertyValue(name).trim() || fb;
    const border = cssVar('--color-border', '#e2e8f0');
    const muted = cssVar('--color-muted', '#64748b');
    const textCol = cssVar('--color-text', '#0f172a');

    // axes
    ctx.strokeStyle = border; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx, 8); ctx.lineTo(cx, w - 8); ctx.moveTo(8, cy); ctx.lineTo(w - 8, cy); ctx.stroke();

    // shaded positive half-plane of the active line (hash phase)
    if (f.phase === 'hash' && f.activeLine != null) {
      const n = lines[f.activeLine];
      const ang = Math.atan2(-n.y, n.x);
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(ang);
      ctx.fillStyle = 'rgba(14,165,233,0.10)';
      ctx.fillRect(0, -big, big, 2 * big);
      ctx.restore();
    }

    // hyperplane lines (perpendicular to each normal)
    for (let i = 0; i < f.linesShown; i++) {
      const n = lines[i];
      const ang = Math.atan2(-n.y, n.x);
      const active = f.phase === 'hash' && f.activeLine === i;
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(ang);
      ctx.strokeStyle = active ? COLORS.bit1 : 'rgba(100,116,139,0.55)';
      ctx.lineWidth = active ? 2.5 : 1.4;
      ctx.beginPath(); ctx.moveTo(0, -big); ctx.lineTo(0, big); ctx.stroke();
      ctx.restore();
    }

    const showBuckets = f.phase === 'bucket' || f.phase === 'query';
    const qSig = sig(query, lines, f.linesShown);

    // points
    POINTS.forEach((p) => {
      const { sx, sy } = toScreen(p);
      let fill = '#cbd5e1';
      if (f.phase === 'hash' && f.activeLine != null) {
        fill = dot(p, lines[f.activeLine]) >= 0 ? COLORS.bit1 : COLORS.bit0;
      } else if (showBuckets) {
        fill = `hsl(${bucketHue(sig(p, lines, f.linesShown))} 65% 55%)`;
      }
      const isCand = f.phase === 'query' && sig(p, lines, f.linesShown) === qSig;
      ctx.beginPath(); ctx.arc(sx, sy, 8, 0, Math.PI * 2);
      ctx.fillStyle = f.phase === 'query' && !isCand ? 'rgba(148,163,184,0.45)' : fill;
      ctx.fill();
      ctx.lineWidth = isCand ? 3 : 1.5;
      ctx.strokeStyle = isCand ? COLORS.hit : '#ffffff';
      ctx.stroke();
      if (p.tag && (showBuckets || f.phase === 'intro')) {
        ctx.fillStyle = muted; ctx.font = '700 10px ui-sans-serif, system-ui';
        ctx.textAlign = 'center'; ctx.fillText(p.tag, sx, sy - 13);
      }
    });

    // query marker (diamond)
    const q = toScreen(query);
    ctx.save(); ctx.translate(q.sx, q.sy); ctx.rotate(Math.PI / 4);
    ctx.fillStyle = COLORS.query; ctx.fillRect(-8, -8, 16, 16);
    ctx.lineWidth = 2; ctx.strokeStyle = '#ffffff'; ctx.strokeRect(-8, -8, 16, 16);
    ctx.restore();

    // signature readout
    ctx.textAlign = 'left'; ctx.font = '700 12px ui-monospace, monospace'; ctx.fillStyle = textCol;
    ctx.fillText(`query bucket: ${qSig || '∅'}`, 12, w - 12);
    if (f.phase === 'query') {
      const cands = POINTS.filter((p) => sig(p, lines, f.linesShown) === qSig).length;
      ctx.fillStyle = COLORS.hit; ctx.textAlign = 'right';
      ctx.fillText(`${cands} candidate${cands === 1 ? '' : 's'} in bucket`, w - 12, w - 12);
    }
  }

  // ---- drag the query point ----
  const worldFromEvent = (e: PointerEvent): Pt => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const { cx, cy, scale } = sizeRef.current;
    return { x: (e.clientX - rect.left - cx) / scale, y: -(e.clientY - rect.top - cy) / scale };
  };
  const onDown = (e: PointerEvent) => {
    const wp = worldFromEvent(e);
    const d = Math.hypot(wp.x - query.x, wp.y - query.y);
    if (d < 0.18) { draggingRef.current = true; (e.target as HTMLElement).setPointerCapture(e.pointerId); }
  };
  const onMove = (e: PointerEvent) => {
    if (!draggingRef.current) return;
    const wp = worldFromEvent(e);
    setQuery({ x: Math.max(-1.15, Math.min(1.15, wp.x)), y: Math.max(-1.15, Math.min(1.15, wp.y)) });
  };
  const onUp = () => { draggingRef.current = false; };

  const reset = () => { setPlaying(false); setIdx(0); lastRef.current = 0; };
  const stepF = () => { setPlaying(false); setIdx((v) => Math.min(frames.length - 1, v + 1)); };
  const stepB = () => { setPlaying(false); setIdx((v) => Math.max(0, v - 1)); };
  const play = () => { if (idx >= frames.length - 1) setIdx(0); lastRef.current = 0; setPlaying((p) => !p); };

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-3">
        <label class="flex items-center gap-2 text-xs text-muted">lines (bits)
          <input type="range" min={1} max={4} step={1} value={k} onInput={(e) => setLineCount(parseInt((e.target as HTMLInputElement).value, 10))} class="w-24 accent-[#4f46e5]" />
          <span class="font-mono text-text">{k}</span>
        </label>
        <button onClick={randomize} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">Randomize lines</button>
      </div>

      <div class="grid gap-4 md:grid-cols-[auto_1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} />
        <div class="space-y-3 text-sm">
          <p class="text-muted">Drag the indigo ◆ <strong>query</strong> point. Each line adds one bit to its signature; only points in the <strong>same bucket</strong> are compared.</p>
          <p class="min-h-[3.5rem] rounded-lg bg-surface-2 px-3 py-2 text-text">{frame?.caption}</p>
          <div class="rounded-lg bg-surface-2 p-3 text-xs text-muted">
            More lines = longer signatures = smaller, purer buckets (fewer false collisions) but a higher chance a true neighbor just misses. That precision/recall dial is the whole game in LSH.
          </div>
        </div>
      </div>

      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={stepB} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏮ Back</button>
        <button onClick={play} class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90">{playing ? '⏸ Pause' : '▶ Play'}</button>
        <button onClick={stepF} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏭ Step</button>
        <button onClick={reset} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">↺ Reset</button>
        <span class="ml-2 text-xs text-muted">frame {Math.min(idx + 1, frames.length)}/{frames.length}</span>
        <label class="ml-auto flex items-center gap-2 text-xs text-muted">speed
          <input type="range" min={0.5} max={3} step={0.5} value={speed} onInput={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))} class="w-24 accent-[#4f46e5]" />
        </label>
      </div>
    </div>
  );
}
