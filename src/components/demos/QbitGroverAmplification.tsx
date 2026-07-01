import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Grover's amplitude amplification, visualised as a bar chart.
   - N equally-likely items start at amplitude 1/sqrt(N). Each Grover
     iteration is two half-steps: (1) the ORACLE flips the sign of the
     marked item, (2) DIFFUSION reflects every amplitude about the mean,
     which lifts the (now-negative) marked amplitude far above the rest.
   - Bars show SIGNED amplitude (baseline in the middle). The marked bar
     is highlighted; the caption reports its measurement probability.
   - Learner picks N and the marked index; frames are precomputed.
   - Transport: Back / Play / Step / Reset + speed. Live caption.
   ------------------------------------------------------------------ */

type Frame = { amps: number[]; caption: string; markProb: number; phase: 'init' | 'oracle' | 'diffuse'; iter: number };

const COLORS = { bar: '#4f46e5', mark: '#10b981', neg: '#f43f5e', axis: 'rgba(128,128,128,0.45)' };

function buildFrames(N: number, marked: number, iters: number): Frame[] {
  const frames: Frame[] = [];
  let a = new Array(N).fill(1 / Math.sqrt(N));
  const prob = (arr: number[]) => arr[marked] * arr[marked];
  frames.push({ amps: a.slice(), caption: `Start in a uniform superposition: every one of the ${N} items has amplitude 1/√${N} ≈ ${(1 / Math.sqrt(N)).toFixed(3)}, so each is equally likely (${(100 / N).toFixed(1)}%).`, markProb: prob(a), phase: 'init', iter: 0 });
  for (let k = 1; k <= iters; k++) {
    // Oracle: flip sign of marked
    a = a.slice();
    a[marked] = -a[marked];
    frames.push({ amps: a.slice(), caption: `Iteration ${k} — ORACLE: the marked item's amplitude flips negative. Its probability is unchanged, but it now sits below the average.`, markProb: prob(a), phase: 'oracle', iter: k });
    // Diffusion: reflect about mean
    const mean = a.reduce((s, v) => s + v, 0) / N;
    a = a.map((v) => 2 * mean - v);
    frames.push({ amps: a.slice(), caption: `Iteration ${k} — DIFFUSION (invert about the mean): the marked amplitude springs up while the rest sink. Marked probability is now ${(prob(a) * 100).toFixed(1)}%.`, markProb: prob(a), phase: 'diffuse', iter: k });
  }
  return frames;
}

export default function QbitGroverAmplification() {
  const [N, setN] = useState(8);
  const [marked, setMarked] = useState(5);
  const optimal = Math.max(1, Math.round((Math.PI / 4) * Math.sqrt(8)));
  const [iters, setIters] = useState(optimal);
  const [frames, setFrames] = useState<Frame[]>(() => buildFrames(8, 5, optimal));
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);
  const framesRef = useRef(frames);
  const markedRef = useRef(marked);
  idxRef.current = idx;
  framesRef.current = frames;
  markedRef.current = marked;

  const rebuild = (n: number, m: number, it: number) => { setFrames(buildFrames(n, m, it)); setIdx(0); setPlaying(false); };
  const changeN = (n: number) => { const m = Math.min(marked, n - 1); const opt = Math.max(1, Math.round((Math.PI / 4) * Math.sqrt(n))); setN(n); setMarked(m); setIters(opt); rebuild(n, m, opt); };
  const changeMarked = (m: number) => { setMarked(m); rebuild(N, m, iters); };
  const changeIters = (it: number) => { setIters(it); rebuild(N, marked, it); };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width / (window.devicePixelRatio || 1);
    const h = canvas.height / (window.devicePixelRatio || 1);
    ctx.clearRect(0, 0, w, h);
    const f = framesRef.current[Math.min(idxRef.current, framesRef.current.length - 1)];
    const m = markedRef.current;
    const pad = 20;
    const midY = h / 2 + 6;
    const half = h / 2 - pad;
    const n = f.amps.length;
    const slot = (w - 2 * 12) / n;
    const bw = Math.max(4, slot * 0.7);
    const scale = half / 1.02; // amplitudes are within [-1,1]

    // mean line
    const mean = f.amps.reduce((s, v) => s + v, 0) / n;
    // baseline
    ctx.strokeStyle = COLORS.axis;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(12, midY); ctx.lineTo(w - 12, midY); ctx.stroke();
    // mean dashed line
    ctx.strokeStyle = 'rgba(14,165,233,0.7)';
    ctx.setLineDash([5, 4]);
    ctx.beginPath(); ctx.moveTo(12, midY - mean * scale); ctx.lineTo(w - 12, midY - mean * scale); ctx.stroke();
    ctx.setLineDash([]);

    for (let s = 0; s < n; s++) {
      const amp = f.amps[s];
      const cx = 12 + slot * s + slot / 2;
      const x = cx - bw / 2;
      const bh = amp * scale;
      const isMark = s === m;
      ctx.fillStyle = isMark ? COLORS.mark : amp < 0 ? COLORS.neg : COLORS.bar;
      if (bh >= 0) ctx.fillRect(x, midY - bh, bw, bh);
      else ctx.fillRect(x, midY, bw, -bh);
      if (isMark) {
        ctx.fillStyle = COLORS.mark;
        ctx.font = 'bold 12px ui-sans-serif, system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('★', cx, midY - bh + (bh >= 0 ? -4 : 14));
      }
    }
    ctx.fillStyle = 'rgba(14,165,233,0.9)';
    ctx.font = '10px ui-sans-serif, system-ui';
    ctx.textAlign = 'left';
    ctx.fillText('mean', 14, midY - mean * scale - 4);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const cw = Math.min(parent.clientWidth, 540);
      const ch = 230;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = cw * dpr;
      canvas.height = ch * dpr;
      canvas.style.width = `${cw}px`;
      canvas.style.height = `${ch}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => { window.removeEventListener('resize', resize); if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(draw, [idx, frames]);

  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 950 / speed;
    const tick = (t: number) => {
      if (!lastRef.current) lastRef.current = t;
      if (t - lastRef.current >= interval) {
        lastRef.current = t;
        const next = idxRef.current + 1;
        if (next >= framesRef.current.length) { setIdx(framesRef.current.length - 1); setPlaying(false); return; }
        setIdx(next);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
  }, [playing, speed, frames]);

  const reset = () => { setPlaying(false); setIdx(0); lastRef.current = 0; };
  const stepF = () => { setPlaying(false); setIdx((v) => Math.min(frames.length - 1, v + 1)); };
  const stepB = () => { setPlaying(false); setIdx((v) => Math.max(0, v - 1)); };
  const play = () => { if (idx >= frames.length - 1) setIdx(0); lastRef.current = 0; setPlaying((p) => !p); };

  const f = frames[Math.min(idx, frames.length - 1)];
  const opt = Math.max(1, Math.round((Math.PI / 4) * Math.sqrt(N)));

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 grid gap-3 sm:grid-cols-3">
        <label class="flex flex-col gap-1 text-xs text-muted">items N = {N}
          <input type="range" min={4} max={16} step={1} value={N} onInput={(e) => changeN(parseInt((e.target as HTMLInputElement).value, 10))} class="accent-[#4f46e5]" />
        </label>
        <label class="flex flex-col gap-1 text-xs text-muted">marked ★ = {marked}
          <input type="range" min={0} max={N - 1} step={1} value={marked} onInput={(e) => changeMarked(parseInt((e.target as HTMLInputElement).value, 10))} class="accent-[#10b981]" />
        </label>
        <label class="flex flex-col gap-1 text-xs text-muted">iterations = {iters} <span class="text-[10px]">(optimal ≈ {opt})</span>
          <input type="range" min={1} max={Math.max(opt + 4, 8)} step={1} value={iters} onInput={(e) => changeIters(parseInt((e.target as HTMLInputElement).value, 10))} class="accent-[#0ea5e9]" />
        </label>
      </div>

      <div class="flex justify-center">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />
      </div>

      <div class="mt-2 flex items-center justify-center gap-4 text-xs text-muted">
        <span>{f.phase === 'init' ? 'start' : `iter ${f.iter} · ${f.phase}`}</span>
        <span>marked probability: <strong class="text-text">{(f.markProb * 100).toFixed(1)}%</strong></span>
      </div>

      <p class="mt-3 min-h-[3.5rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">{f.caption}</p>

      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={stepB} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏮ Back</button>
        <button onClick={play} class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90">{playing ? '⏸ Pause' : '▶ Play'}</button>
        <button onClick={stepF} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏭ Step</button>
        <button onClick={reset} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">↺ Reset</button>
        <label class="ml-auto flex items-center gap-2 text-xs text-muted">speed
          <input type="range" min={0.5} max={3} step={0.5} value={speed} onInput={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))} class="w-24 accent-[#4f46e5]" />
        </label>
      </div>
      <p class="mt-2 text-center text-xs text-muted">Tip: push iterations past the optimal ≈ (π/4)√N and watch the marked bar OVERSHOOT and fall back — more is not better.</p>
    </div>
  );
}
