import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated TERNARY SEARCH for the peak of a UNIMODAL function.
   - Learner drags a slider to move the hidden peak. Each step probes
     two points m1, m2 that split [lo, hi] into thirds, then DISCARDS
     the outer third that cannot hold the maximum.
   - The curve is drawn on canvas; the eliminated regions grey out and
     a live caption compares f(m1) vs f(m2).
   - Transport: Back / Play / Pause / Step / Reset + speed slider.
   - Canvas conventions: dpr scaling, resize, touch-none, helpers inside.
   ------------------------------------------------------------------ */

const COLORS = { curve: '#0ea5e9', m1: '#4f46e5', m2: '#10b981', peak: '#10b981' };
const LO0 = 0, HI0 = 100;
type Frame = { lo: number; hi: number; m1: number; m2: number; fm1: number; fm2: number; goRight: boolean; done: boolean };

export default function SearchTernaryUnimodal() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 560, h: 240 });
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);

  const [peak, setPeak] = useState(64);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  idxRef.current = idx;

  // Unimodal: a single hump that rises then falls, maximum at `peak`.
  const f = (x: number) => -Math.pow((x - peak) / 10, 2);

  // Precompute ternary-search frames (split into thirds each step).
  const frames: Frame[] = (() => {
    const out: Frame[] = [];
    let lo = LO0, hi = HI0;
    for (let k = 0; k < 13 && hi - lo > 0.4; k++) {
      const m1 = lo + (hi - lo) / 3;
      const m2 = hi - (hi - lo) / 3;
      const fm1 = f(m1), fm2 = f(m2);
      const goRight = fm1 < fm2; // peak is to the right of m1 → drop [lo, m1]
      out.push({ lo, hi, m1, m2, fm1, fm2, goRight, done: false });
      if (goRight) lo = m1; else hi = m2;
    }
    out.push({ lo, hi, m1: (lo + hi) / 2, m2: (lo + hi) / 2, fm1: f((lo + hi) / 2), fm2: f((lo + hi) / 2), goRight: false, done: true });
    return out;
  })();
  const maxIdx = frames.length - 1;

  function textCss() {
    if (typeof window === 'undefined') return '#0f172a';
    const v = getComputedStyle(document.documentElement).getPropertyValue('--color-text');
    return v?.trim() || '#0f172a';
  }

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);
    const padL = 10, padR = 10, padT = 14, padB = 22;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;
    const fr = frames[Math.min(idxRef.current, maxIdx)];

    // y-range across the whole domain
    let ymin = Infinity, ymax = -Infinity;
    for (let i = 0; i <= 200; i++) { const x = LO0 + (HI0 - LO0) * (i / 200); const v = f(x); if (v < ymin) ymin = v; if (v > ymax) ymax = v; }
    const X = (x: number) => padL + plotW * ((x - LO0) / (HI0 - LO0));
    const Y = (v: number) => padT + plotH * (1 - (v - ymin) / (ymax - ymin || 1));

    // shade eliminated regions (outside current [lo, hi])
    ctx.fillStyle = 'rgba(128,128,128,0.10)';
    ctx.fillRect(padL, padT, X(fr.lo) - padL, plotH);
    ctx.fillRect(X(fr.hi), padT, padL + plotW - X(fr.hi), plotH);

    // curve
    ctx.strokeStyle = COLORS.curve;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i <= 200; i++) { const x = LO0 + (HI0 - LO0) * (i / 200); const px = X(x), py = Y(f(x)); if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); }
    ctx.stroke();

    const vline = (x: number, color: string, label: string) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(X(x), padT);
      ctx.lineTo(X(x), padT + plotH);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(X(x), Y(f(x)), 4.5, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.fillStyle = color;
      ctx.font = '700 11px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(label, X(x), padT - 3);
    };

    if (fr.done) {
      vline(fr.m1, COLORS.peak, 'peak');
    } else {
      vline(fr.m1, COLORS.m1, 'm1');
      vline(fr.m2, COLORS.m2, 'm2');
    }

    // lo / hi ticks
    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 10px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`lo=${fr.lo.toFixed(1)}`, X(fr.lo) + 2, padT + plotH + 14);
    ctx.textAlign = 'right';
    ctx.fillText(`hi=${fr.hi.toFixed(1)}`, X(fr.hi) - 2, padT + plotH + 14);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 560);
      const h = 240;
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
  useEffect(draw, [peak, idx]);

  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 1050 / speed;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, speed, peak]);

  const reset = () => { setPlaying(false); setIdx(0); lastRef.current = 0; };
  const stepF = () => { setPlaying(false); setIdx((v) => Math.min(maxIdx, v + 1)); };
  const stepB = () => { setPlaying(false); setIdx((v) => Math.max(0, v - 1)); };
  const play = () => { if (idx >= maxIdx) { setIdx(0); } lastRef.current = 0; setPlaying((p) => !p); };
  const setPeakReset = (p: number) => { setPeak(p); setIdx(0); setPlaying(false); lastRef.current = 0; };

  const fr = frames[Math.min(idx, maxIdx)];
  const caption = fr.done
    ? `Window shrank to width ${(fr.hi - fr.lo).toFixed(2)}. The peak is at x ≈ ${((fr.lo + fr.hi) / 2).toFixed(1)} (true peak ${peak}).`
    : `f(m1) = ${fr.fm1.toFixed(2)} ${fr.goRight ? '<' : '≥'} f(m2) = ${fr.fm2.toFixed(2)} → the maximum lies ${fr.goRight ? 'to the RIGHT of m1, so drop the left third (lo = m1)' : 'to the LEFT of m2, so drop the right third (hi = m2)'}.`;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-3">
        <label class="flex items-center gap-2 text-xs text-muted">peak position
          <input type="range" min={12} max={88} step={1} value={peak} onInput={(e) => setPeakReset(parseInt((e.target as HTMLInputElement).value, 10))} class="w-40 accent-[#4f46e5]" />
          <span class="font-mono text-text">{peak}</span>
        </label>
      </div>

      <div class="flex justify-center">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />
      </div>

      <p class="mt-3 min-h-[2.5rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">{caption}</p>
      <p class="mt-2 text-xs text-muted">Search window width: <span class="font-mono font-semibold text-text">{(fr.hi - fr.lo).toFixed(2)}</span> — each step keeps just two-thirds of it.</p>

      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={stepB} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏮ Back</button>
        <button onClick={play} class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90">{playing ? '⏸ Pause' : '▶ Play'}</button>
        <button onClick={stepF} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏭ Step</button>
        <button onClick={reset} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">↺ Reset</button>
        <label class="ml-auto flex items-center gap-2 text-xs text-muted">speed
          <input type="range" min={0.5} max={3} step={0.5} value={speed} onInput={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))} class="w-24 accent-[#4f46e5]" />
        </label>
      </div>
      <p class="mt-2 text-center text-xs text-muted">Tip: ternary search needs a single hump. It compares two interior points — never the endpoints — so it works even where the curve has no derivative.</p>
    </div>
  );
}
