import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Two-qubit circuit simulator.
   - State is a real 4-vector over basis {|00>,|01>,|10>,|11>}.
   - Build a circuit from single-qubit gates (H, X, Z on q0/q1) and a
     CNOT. Each op becomes one frame; bars show probability per basis
     state, with signed amplitude labels. Watch H then CNOT build the
     entangled Bell state (|00>+|11>)/sqrt2.
   - Transport: Back / Play / Step / Reset + speed. Live caption.
   Qubit 0 is the LOW bit: basis index i has qubit q = (i >> q) & 1.
   ------------------------------------------------------------------ */

type Op = { g: 'H' | 'X' | 'Z'; q: number } | { g: 'CNOT'; c: number; t: number };
type Frame = { amps: number[]; caption: string; entangled: boolean };

const COLORS = { bar: '#4f46e5', ent: '#0ea5e9', measured: '#10b981', axis: 'rgba(128,128,128,0.35)' };
const SQRT2 = Math.sqrt(2);
const LABELS = ['|00⟩', '|01⟩', '|10⟩', '|11⟩'];

const applyH = (a: number[], q: number): number[] => {
  const out = a.slice();
  for (let i = 0; i < 4; i++) {
    if ((i >> q) & 1) continue;
    const j = i | (1 << q);
    const x = a[i], y = a[j];
    out[i] = (x + y) / SQRT2;
    out[j] = (x - y) / SQRT2;
  }
  return out;
};
const applyX = (a: number[], q: number): number[] => {
  const out = a.slice();
  for (let i = 0; i < 4; i++) if (!((i >> q) & 1)) { const j = i | (1 << q); out[i] = a[j]; out[j] = a[i]; }
  return out;
};
const applyZ = (a: number[], q: number): number[] => a.map((v, i) => ((i >> q) & 1 ? -v : v));
const applyCNOT = (a: number[], c: number, t: number): number[] => {
  const out = a.slice();
  for (let i = 0; i < 4; i++) if (((i >> c) & 1) && !((i >> t) & 1)) { const j = i | (1 << t); out[i] = a[j]; out[j] = a[i]; }
  return out;
};
const fmt = (x: number) => (Math.abs(x) < 1e-9 ? '0' : x.toFixed(2).replace(/\.00$/, ''));
const isEntangled = (a: number[]): boolean => {
  // product state iff a00*a11 - a01*a10 == 0 (2x2 determinant of the coefficient matrix)
  return Math.abs(a[0] * a[3] - a[1] * a[2]) > 1e-6;
};
const opLabel = (o: Op) => (o.g === 'CNOT' ? `CNOT(${o.c}→${o.t})` : `${o.g}${o.q}`);

function buildFrames(ops: Op[]): Frame[] {
  const frames: Frame[] = [];
  let a = [1, 0, 0, 0];
  frames.push({ amps: a, caption: 'Both qubits start at |00⟩ — one certain basis state.', entangled: false });
  for (const o of ops) {
    a = o.g === 'H' ? applyH(a, o.q) : o.g === 'X' ? applyX(a, o.q) : o.g === 'Z' ? applyZ(a, o.q) : applyCNOT(a, o.c, o.t);
    const ent = isEntangled(a);
    const active = a.map((v, i) => (Math.abs(v) > 1e-6 ? LABELS[i] : null)).filter(Boolean).join(', ');
    const why =
      o.g === 'H' ? `H on q${o.q} splits the amplitude — now the live states are ${active}.`
        : o.g === 'CNOT' ? `CNOT flips q${o.t} wherever q${o.c} is 1.${ent ? ' The qubits are now ENTANGLED — this state can no longer be written as (q0)⊗(q1).' : ''} Live: ${active}.`
          : o.g === 'X' ? `X flips q${o.q}. Live: ${active}.`
            : `Z adds a minus sign wherever q${o.q}=1. Probabilities unchanged; the phase waits to interfere. Live: ${active}.`;
    frames.push({ amps: a, caption: why, entangled: ent });
  }
  return frames;
}

const BELL: Op[] = [{ g: 'H', q: 0 }, { g: 'CNOT', c: 0, t: 1 }];

export default function QbitCircuitSimulator() {
  const [ops, setOps] = useState<Op[]>(BELL);
  const [frames, setFrames] = useState<Frame[]>(() => buildFrames(BELL));
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

  const rebuild = (next: Op[]) => { setOps(next); setFrames(buildFrames(next)); setIdx(0); setPlaying(false); };
  const add = (o: Op) => rebuild([...ops, o]);
  const clear = () => rebuild([]);
  const loadBell = () => rebuild(BELL);

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
    const topY = 24;
    const usable = baseY - topY;
    const n = 4;
    const slot = (w - 2 * 14) / n;
    const bw = Math.min(64, slot * 0.62);

    ctx.strokeStyle = COLORS.axis;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(14, baseY); ctx.lineTo(w - 14, baseY); ctx.stroke();

    for (let s = 0; s < n; s++) {
      const amp = f.amps[s];
      const prob = amp * amp;
      const cx = 14 + slot * s + slot / 2;
      const x = cx - bw / 2;
      const bh = Math.max(2, prob * usable);
      const lit = prob > 1e-6;
      ctx.fillStyle = lit ? (f.entangled ? COLORS.ent : COLORS.bar) : 'rgba(128,128,128,0.18)';
      ctx.fillRect(x, baseY - bh, bw, bh);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px ui-sans-serif, system-ui';
      ctx.textAlign = 'center';
      if (bh > 18) ctx.fillText(`${(prob * 100).toFixed(0)}%`, cx, baseY - bh + 15);
      ctx.fillStyle = 'rgba(148,163,184,0.95)';
      ctx.font = '13px ui-sans-serif, system-ui';
      ctx.fillText(LABELS[s], cx, baseY + 18);
      ctx.font = '10px ui-monospace, monospace';
      ctx.fillStyle = amp < -1e-6 ? '#f43f5e' : 'rgba(148,163,184,0.75)';
      ctx.fillText(fmt(amp), cx, topY - 8);
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const cw = Math.min(parent.clientWidth, 500);
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

  const menu: Op[] = [
    { g: 'H', q: 0 }, { g: 'H', q: 1 }, { g: 'X', q: 0 }, { g: 'X', q: 1 },
    { g: 'Z', q: 0 }, { g: 'Z', q: 1 }, { g: 'CNOT', c: 0, t: 1 }, { g: 'CNOT', c: 1, t: 0 },
  ];

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <span class="text-xs font-semibold text-muted">Add:</span>
        {menu.map((o, i) => (
          <button key={i} onClick={() => add(o)} class="rounded-lg bg-brand px-2.5 py-1.5 text-xs font-mono font-bold text-white hover:opacity-90">{opLabel(o)}</button>
        ))}
        <button onClick={loadBell} class="rounded-lg bg-surface-2 px-2.5 py-1.5 text-xs font-semibold text-muted hover:text-text">Bell preset</button>
        <button onClick={clear} class="rounded-lg bg-surface-2 px-2.5 py-1.5 text-xs font-semibold text-muted hover:text-text">Clear</button>
      </div>

      <div class="mb-3 flex flex-wrap items-center gap-1.5 font-mono text-sm">
        <span class="text-muted">|00⟩ →</span>
        {ops.length === 0 && <span class="text-muted">(empty circuit)</span>}
        {ops.map((o, i) => (
          <span key={i} class={`rounded-md border px-2 py-1 text-xs font-bold ${i === idx - 1 ? 'border-transparent bg-brand text-white' : 'border-border bg-surface-2 text-text'}`}>{opLabel(o)}</span>
        ))}
      </div>

      <div class="flex justify-center">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />
      </div>

      <p class="mt-3 min-h-[3.5rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">{f.caption}</p>
      {f.entangled && <p class="mt-2 rounded-lg bg-brand-soft px-3 py-2 text-sm font-semibold text-text">Entangled: measuring one qubit instantly fixes the other. Sky bars mark a state that no single-qubit description can reproduce.</p>}

      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={stepB} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏮ Back</button>
        <button onClick={play} class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90">{playing ? '⏸ Pause' : '▶ Play'}</button>
        <button onClick={stepF} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏭ Step</button>
        <button onClick={reset} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">↺ Reset</button>
        <label class="ml-auto flex items-center gap-2 text-xs text-muted">speed
          <input type="range" min={0.5} max={3} step={0.5} value={speed} onInput={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))} class="w-24 accent-[#4f46e5]" />
        </label>
      </div>
      <p class="mt-2 text-center text-xs text-muted">Tip: H0 then CNOT(0→1) is the Bell circuit. Red amplitude labels are negative — proof that phase is real even when the bars look the same.</p>
    </div>
  );
}
