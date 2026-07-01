import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Single-qubit playground: build a tiny gate sequence and watch the
   amplitude bar chart evolve, then measure to collapse it.
   - State is a 2-vector [a0, a1] of REAL amplitudes (H, X, Z stay real
     when you start from |0>). Bars show probability = amplitude^2.
   - Precompute one frame per gate (index-driven), plus an optional
     measurement frame that collapses to a sampled outcome.
   - Transport: Back / Play / Step / Reset + speed. Live caption.
   ------------------------------------------------------------------ */

type Gate = 'H' | 'X' | 'Z';
type Frame = { amps: [number, number]; caption: string; collapsed: number | null };

const COLORS = { bar: '#4f46e5', sup: '#0ea5e9', measured: '#10b981', axis: 'rgba(128,128,128,0.35)' };
const SQRT2 = Math.sqrt(2);

const applyGate = (a: [number, number], g: Gate): [number, number] => {
  if (g === 'H') return [(a[0] + a[1]) / SQRT2, (a[0] - a[1]) / SQRT2];
  if (g === 'X') return [a[1], a[0]];
  return [a[0], -a[1]]; // Z
};
const fmt = (x: number) => (Math.abs(x) < 1e-9 ? '0' : x.toFixed(3).replace(/0+$/, '').replace(/\.$/, ''));
const ket = (a: [number, number]): string => {
  const t: string[] = [];
  if (Math.abs(a[0]) > 1e-9) t.push(`${fmt(a[0])}|0⟩`);
  if (Math.abs(a[1]) > 1e-9) t.push(`${a[1] >= 0 && t.length ? '+ ' : ''}${fmt(a[1])}|1⟩`);
  return t.join(' ') || '0';
};

function buildFrames(gates: Gate[], measure: boolean): Frame[] {
  const frames: Frame[] = [];
  let a: [number, number] = [1, 0];
  frames.push({ amps: a, caption: `Start in |0⟩ — the amplitude vector is [1, 0], so measuring gives 0 with 100% certainty.`, collapsed: null });
  for (const g of gates) {
    a = applyGate(a, g);
    const p0 = (a[0] * a[0] * 100).toFixed(0);
    const p1 = (a[1] * a[1] * 100).toFixed(0);
    const why =
      g === 'H'
        ? `Hadamard spreads the amplitude evenly: |ψ⟩ = ${ket(a)}. Now ${p0}% / ${p1}% — a genuine superposition.`
        : g === 'X'
          ? `X (NOT) swaps the two amplitudes: |ψ⟩ = ${ket(a)}.`
          : `Z flips the sign of the |1⟩ amplitude: |ψ⟩ = ${ket(a)}. Probabilities are unchanged — phase is invisible until it interferes.`;
    frames.push({ amps: a, caption: why, collapsed: null });
  }
  if (measure) {
    const p0 = a[0] * a[0];
    const outcome = Math.random() < p0 ? 0 : 1;
    const collapsed: [number, number] = outcome === 0 ? [1, 0] : [0, 1];
    frames.push({
      amps: collapsed,
      caption: `Measurement collapses the superposition. This shot landed on |${outcome}⟩ (it had a ${(( outcome === 0 ? p0 : 1 - p0) * 100).toFixed(0)}% chance). The state is now definite — the superposition is gone.`,
      collapsed: outcome,
    });
  }
  return frames;
}

export default function QbitSuperposition() {
  const [gates, setGates] = useState<Gate[]>(['H']);
  const [measure, setMeasure] = useState(true);
  const [frames, setFrames] = useState<Frame[]>(() => buildFrames(['H'], true));
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);
  const framesRef = useRef(frames);
  idxRef.current = idx;
  framesRef.current = frames;

  const rebuild = (g: Gate[], m: boolean) => { const f = buildFrames(g, m); setFrames(f); setIdx(0); setPlaying(false); };
  const addGate = (g: Gate) => { const next = [...gates, g]; setGates(next); rebuild(next, measure); };
  const clearGates = () => { setGates([]); rebuild([], measure); };
  const toggleMeasure = () => { const m = !measure; setMeasure(m); rebuild(gates, m); };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width / (window.devicePixelRatio || 1);
    const h = canvas.height / (window.devicePixelRatio || 1);
    ctx.clearRect(0, 0, w, h);
    const f = framesRef.current[Math.min(idxRef.current, framesRef.current.length - 1)];
    const pad = 34;
    const baseY = h - pad;
    const topY = 22;
    const usable = baseY - topY;
    const labels = ['|0⟩', '|1⟩'];
    const bw = 78;
    const gap = 56;
    const totalW = bw * 2 + gap;
    const startX = (w - totalW) / 2;

    // baseline
    ctx.strokeStyle = COLORS.axis;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pad, baseY); ctx.lineTo(w - pad, baseY); ctx.stroke();

    for (let s = 0; s < 2; s++) {
      const prob = f.amps[s] * f.amps[s];
      const x = startX + s * (bw + gap);
      const bh = Math.max(2, prob * usable);
      const active = f.collapsed === s;
      const lit = prob > 1e-6;
      ctx.fillStyle = active ? COLORS.measured : lit ? COLORS.bar : 'rgba(128,128,128,0.18)';
      ctx.fillRect(x, baseY - bh, bw, bh);
      // amplitude sign chip
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 13px ui-sans-serif, system-ui';
      ctx.textAlign = 'center';
      if (bh > 20) ctx.fillText(`${(prob * 100).toFixed(0)}%`, x + bw / 2, baseY - bh + 16);
      // label
      ctx.fillStyle = 'rgba(148,163,184,0.95)';
      ctx.font = '15px ui-sans-serif, system-ui';
      ctx.fillText(labels[s], x + bw / 2, baseY + 20);
      // amplitude value
      ctx.font = '11px ui-monospace, monospace';
      ctx.fillStyle = 'rgba(148,163,184,0.75)';
      ctx.fillText(`amp ${fmt(f.amps[s])}`, x + bw / 2, topY - 6);
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const cw = Math.min(parent.clientWidth, 460);
      const ch = 220;
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
    const interval = 900 / speed;
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

  const caption = frames[Math.min(idx, frames.length - 1)].caption;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <span class="text-xs font-semibold text-muted">Add gate:</span>
        {(['H', 'X', 'Z'] as Gate[]).map((g) => (
          <button key={g} onClick={() => addGate(g)} class="rounded-lg bg-brand px-3 py-1.5 text-sm font-mono font-bold text-white hover:opacity-90">{g}</button>
        ))}
        <button onClick={clearGates} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">Clear</button>
        <label class="ml-auto flex items-center gap-2 text-xs text-muted">
          <input type="checkbox" checked={measure} onInput={toggleMeasure} class="h-4 w-4 accent-[#10b981]" /> measure at end
        </label>
      </div>

      <div class="mb-3 flex flex-wrap items-center gap-1.5 font-mono text-sm">
        <span class="text-muted">|0⟩ →</span>
        {gates.length === 0 && <span class="text-muted">(no gates)</span>}
        {gates.map((g, i) => (
          <span key={i} class={`rounded-md border px-2.5 py-1 font-bold ${i === idx - 1 ? 'border-transparent bg-brand text-white' : 'border-border bg-surface-2 text-text'}`}>{g}</span>
        ))}
        {measure && <span class={`rounded-md border px-2.5 py-1 ${idx === frames.length - 1 ? 'border-transparent bg-emerald-500 text-white' : 'border-border bg-surface-2 text-muted'}`}>☉ measure</span>}
      </div>

      <div class="flex justify-center">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />
      </div>

      <p class="mt-3 min-h-[3.5rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">{caption}</p>

      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={stepB} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏮ Back</button>
        <button onClick={play} class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90">{playing ? '⏸ Pause' : '▶ Play'}</button>
        <button onClick={stepF} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏭ Step</button>
        <button onClick={reset} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">↺ Reset</button>
        <label class="ml-auto flex items-center gap-2 text-xs text-muted">speed
          <input type="range" min={0.5} max={3} step={0.5} value={speed} onInput={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))} class="w-24 accent-[#4f46e5]" />
        </label>
      </div>
      <p class="mt-2 text-center text-xs text-muted">Tip: add H once for a 50/50 superposition, or H H to see the two halves interfere back to |0⟩.</p>
    </div>
  );
}
