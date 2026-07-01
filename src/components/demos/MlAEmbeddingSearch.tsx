import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Embeddings + nearest-neighbor search by cosine similarity.
   - Items are 2D vectors from the origin (direction = "meaning").
   - Drag the query vector; press Play to rank items by cosine similarity
     (the angle between query and item), revealing them best-first.
   - The top-k nearest get highlighted and linked to the query.
   - Transport: Play / Pause / Step / Back / Reset + speed.
   ------------------------------------------------------------------ */

const COLORS = { item: 'rgba(100,116,139,0.85)', query: '#4f46e5', hit: '#10b981', line: 'rgba(16,185,129,0.5)' };
const ITEMS: { label: string; x: number; y: number }[] = [
  { label: 'dog', x: 0.9, y: 0.5 }, { label: 'puppy', x: 0.8, y: 0.62 }, { label: 'cat', x: 0.7, y: 0.75 },
  { label: 'kitten', x: 0.6, y: 0.85 }, { label: 'car', x: -0.7, y: 0.6 }, { label: 'truck', x: -0.85, y: 0.45 },
  { label: 'banana', x: -0.3, y: -0.9 }, { label: 'apple', x: -0.1, y: -0.95 }, { label: 'jazz', x: 0.95, y: -0.4 }, { label: 'blues', x: 0.85, y: -0.6 },
];
const cosSim = (ax: number, ay: number, bx: number, by: number) => (ax * bx + ay * by) / (Math.hypot(ax, ay) * Math.hypot(bx, by) + 1e-9);

export default function MlAEmbeddingSearch() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ s: 360 });
  const rafRef = useRef<number | null>(null);
  const draggingRef = useRef(false);

  const [q, setQ] = useState<[number, number]>([0.75, 0.68]);
  const [k, setK] = useState(3);
  const [step, setStep] = useState(0); // 0..ITEMS.length ranked reveal
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const lastRef = useRef(0);
  const stepRef = useRef(0);
  stepRef.current = step;

  const ranked = ITEMS.map((it, i) => ({ ...it, i, sim: cosSim(q[0], q[1], it.x, it.y) })).sort((a, b) => b.sim - a.sim);
  const rankedRef = useRef(ranked);
  rankedRef.current = ranked;
  const qRef = useRef(q); qRef.current = q;
  const kRef = useRef(k); kRef.current = k;

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const s = sizeRef.current.s;
    ctx.clearRect(0, 0, s, s);
    const cx = s / 2, cy = s / 2, R = s * 0.42;
    const toPx = (x: number, y: number) => [cx + x * R, cy - y * R];
    // axes
    ctx.strokeStyle = 'rgba(128,128,128,0.25)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(s, cy); ctx.moveTo(cx, 0); ctx.lineTo(cx, s); ctx.stroke();

    const rev = Math.min(stepRef.current, ITEMS.length);
    const topSet = new Set(rankedRef.current.slice(0, kRef.current).map((r) => r.i));
    const revealedTop = new Set(rankedRef.current.slice(0, Math.min(rev, kRef.current)).map((r) => r.i));

    // lines to revealed top-k
    rankedRef.current.slice(0, Math.min(rev, kRef.current)).forEach((r) => {
      const [qx, qy] = toPx(qRef.current[0], qRef.current[1]);
      const [ix, iy] = toPx(r.x, r.y);
      ctx.strokeStyle = COLORS.line; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(qx, qy); ctx.lineTo(ix, iy); ctx.stroke();
    });

    // items
    ITEMS.forEach((it, i) => {
      const [ix, iy] = toPx(it.x, it.y);
      const isTop = revealedTop.has(i);
      const rankPos = rankedRef.current.findIndex((r) => r.i === i);
      const revealed = rankPos < rev;
      ctx.beginPath(); ctx.arc(ix, iy, isTop ? 7 : 5, 0, Math.PI * 2);
      ctx.fillStyle = isTop ? COLORS.hit : revealed ? 'rgba(14,165,233,0.7)' : COLORS.item;
      ctx.fill();
      ctx.fillStyle = isTop ? '#10b981' : '#94a3b8';
      ctx.font = `${isTop ? '600 ' : ''}11px ui-sans-serif, system-ui`;
      ctx.textAlign = ix > cx ? 'left' : 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(it.label, ix + (ix > cx ? 9 : -9), iy);
    });

    // query vector
    const [qx, qy] = toPx(qRef.current[0], qRef.current[1]);
    ctx.strokeStyle = COLORS.query; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(qx, qy); ctx.stroke();
    ctx.beginPath(); ctx.arc(qx, qy, 8, 0, Math.PI * 2); ctx.fillStyle = COLORS.query; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = '600 10px ui-sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('q', qx, qy);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const s = Math.min(parent.clientWidth, 380);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = s * dpr; canvas.height = s * dpr;
      canvas.style.width = `${s}px`; canvas.style.height = `${s}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { s };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => { window.removeEventListener('resize', resize); if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(draw, [q, k, step]);

  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 520 / speed;
    const tick = (tm: number) => {
      if (!lastRef.current) lastRef.current = tm;
      if (tm - lastRef.current >= interval) {
        lastRef.current = tm;
        const next = stepRef.current + 1;
        if (next > ITEMS.length) { setStep(ITEMS.length); setPlaying(false); return; }
        setStep(next);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
  }, [playing, speed]);

  const posFromEvent = (e: PointerEvent): [number, number] => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const s = sizeRef.current.s, R = s * 0.42;
    const x = ((e.clientX - rect.left) - s / 2) / R;
    const y = -((e.clientY - rect.top) - s / 2) / R;
    return [x, y];
  };
  const onDown = (e: PointerEvent) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); draggingRef.current = true; setQ(posFromEvent(e)); setStep(0); setPlaying(false); };
  const onMove = (e: PointerEvent) => { if (draggingRef.current) { setQ(posFromEvent(e)); } };
  const onUp = () => { draggingRef.current = false; };

  const reset = () => { setPlaying(false); setStep(0); lastRef.current = 0; };
  const stepF = () => { setPlaying(false); setStep((v) => Math.min(ITEMS.length, v + 1)); };
  const stepB = () => { setPlaying(false); setStep((v) => Math.max(0, v - 1)); };
  const play = () => { if (step >= ITEMS.length) setStep(0); lastRef.current = 0; setPlaying((p) => !p); };

  const caption = step === 0
    ? 'Drag the query vector q anywhere, then Play to rank every item by cosine similarity.'
    : step <= k
      ? `#${step} nearest: "${ranked[step - 1].label}" (cosine ${ranked[step - 1].sim.toFixed(3)}) — small angle to q, so it is highly relevant.`
      : `Ranked ${Math.min(step, ITEMS.length)}/${ITEMS.length} items. The top-${k} (green) are the search results returned for this query.`;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} />
        <div class="space-y-2 text-sm">
          <p class="text-muted">Direction encodes meaning: items pointing the same way as <span class="font-semibold" style={`color:${COLORS.query}`}>q</span> are "similar". Cosine ignores length, only angle matters.</p>
          <label class="block text-xs text-muted">top-k = {k}
            <input type="range" min={1} max={5} step={1} value={k} onInput={(e) => { setK(parseInt((e.target as HTMLInputElement).value)); }} class="mt-1 w-full accent-[#4f46e5]" />
          </label>
          <ol class="space-y-1">
            {ranked.slice(0, Math.min(step, k)).map((r, i) => (
              <li key={r.i} class="flex items-center gap-2 rounded-md bg-surface-2 px-2 py-1">
                <span class="inline-block h-2.5 w-2.5 rounded-full" style={`background:${COLORS.hit}`}></span>
                <span class="w-6 font-mono text-xs text-muted">#{i + 1}</span>
                <span class="flex-1 font-semibold">{r.label}</span>
                <span class="font-mono text-xs text-muted">{r.sim.toFixed(3)}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
      <p class="mt-3 min-h-[3rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">{caption}</p>
      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={stepB} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏮ Back</button>
        <button onClick={play} class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90">{playing ? '⏸ Pause' : '▶ Play'}</button>
        <button onClick={stepF} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏭ Step</button>
        <button onClick={reset} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">↺ Reset</button>
        <label class="ml-auto flex items-center gap-2 text-xs text-muted">speed
          <input type="range" min={0.5} max={3} step={0.5} value={speed} onInput={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))} class="w-24 accent-[#4f46e5]" />
        </label>
      </div>
      <p class="mt-2 text-center text-xs text-muted">Green = a returned neighbor, blue = already scored. This brute-force scan is O(N); real systems use an index (see LSH).</p>
    </div>
  );
}
