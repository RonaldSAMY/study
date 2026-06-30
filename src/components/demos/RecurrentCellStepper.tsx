import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Recurrent cell stepper — walk a sequence through a recurrent unit
   one time step at a time and watch the hidden state update.
   Vanilla RNN:  h_t = tanh(W_x x_t + W_h h_{t-1} + b)
   GRU-style gate adds an update gate z that decides how much of the
   past to keep — which keeps gradients alive over long sequences.
   ------------------------------------------------------------------ */

type Cell = 'rnn' | 'gru';
const COLORS = { brand: '#4f46e5', sky: '#0ea5e9', emerald: '#10b981', warn: '#ef4444' };

const HID = 4;
const SEQ = [0.6, -0.4, 0.9, -0.8, 0.3, 0.7, -0.5, 1.0]; // input scalars over time

// fixed seeded weights
const seeded = (() => { let s = 5; return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff * 2 - 1; }; })();
const Wx = Array.from({ length: HID }, () => seeded() * 0.9);
const Wh = Array.from({ length: HID }, () => Array.from({ length: HID }, () => seeded() * 0.7));
const b = Array.from({ length: HID }, () => seeded() * 0.2);
const Wz = Array.from({ length: HID }, () => seeded() * 0.8);
const bz = Array.from({ length: HID }, () => seeded() * 0.2 + 0.2);

const tanh = Math.tanh;
const sig = (x: number) => 1 / (1 + Math.exp(-x));

function stepRNN(h: number[], x: number): number[] {
  return h.map((_, i) => tanh(Wx[i] * x + Wh[i].reduce((s, w, j) => s + w * h[j], 0) + b[i]));
}
function stepGRU(h: number[], x: number): { h: number[]; z: number[] } {
  const z = h.map((_, i) => sig(Wz[i] * x + bz[i]));
  const cand = h.map((_, i) => tanh(Wx[i] * x + Wh[i].reduce((s, w, j) => s + w * h[j], 0) + b[i]));
  const nh = h.map((hp, i) => (1 - z[i]) * hp + z[i] * cand[i]);
  return { h: nh, z };
}

export default function RecurrentCellStepper() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cell, setCell] = useState<Cell>('rnn');
  const [t, setT] = useState(0); // number of steps taken (0 = initial h=0)
  const sizeRef = useRef({ w: 480, h: 300 });

  // recompute full history up to current t
  const history: number[][] = [new Array(HID).fill(0)];
  let lastZ: number[] | null = null;
  for (let k = 0; k < t; k++) {
    if (cell === 'rnn') history.push(stepRNN(history[k], SEQ[k]));
    else { const r = stepGRU(history[k], SEQ[k]); history.push(r.h); lastZ = r.z; }
  }
  const hNow = history[history.length - 1];

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);

    // top: input sequence boxes
    const pad = 10;
    const bw = (w - pad * 2) / SEQ.length;
    for (let i = 0; i < SEQ.length; i++) {
      const x = pad + i * bw;
      const active = i < t;
      const cur = i === t - 1;
      ctx.fillStyle = cur ? COLORS.brand : active ? 'rgba(79,70,229,0.25)' : 'rgba(128,128,128,0.12)';
      ctx.fillRect(x + 2, 12, bw - 4, 30);
      ctx.fillStyle = active ? '#fff' : 'rgba(128,128,128,0.8)';
      ctx.font = '600 11px Inter, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(SEQ[i].toFixed(1), x + bw / 2, 31);
    }
    ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(128,128,128,0.9)'; ctx.font = '11px Inter, sans-serif';
    ctx.fillText('input x_t over time →', pad, 58);

    // middle: current hidden state bars
    const baseY = 78, bandH = 70;
    const mid = baseY + bandH / 2;
    ctx.strokeStyle = 'rgba(128,128,128,0.4)'; ctx.beginPath(); ctx.moveTo(pad, mid); ctx.lineTo(w - pad, mid); ctx.stroke();
    const hbw = (w - pad * 2) / HID;
    for (let i = 0; i < HID; i++) {
      const x = pad + i * hbw + hbw * 0.2;
      const v = hNow[i];
      const bh = (Math.abs(v) / 1) * (bandH / 2);
      ctx.fillStyle = v >= 0 ? COLORS.emerald : COLORS.warn;
      ctx.fillRect(x, v >= 0 ? mid - bh : mid, hbw * 0.6, bh);
    }
    ctx.fillStyle = 'rgba(128,128,128,0.9)'; ctx.fillText(`hidden state h (dim ${HID}) at t = ${t}`, pad, baseY - 4);

    // bottom: per-unit history lines
    const hy0 = 168, hh = h - hy0 - 14;
    ctx.strokeStyle = 'rgba(128,128,128,0.4)'; ctx.beginPath();
    ctx.moveTo(pad, hy0 + hh / 2); ctx.lineTo(w - pad, hy0 + hh / 2); ctx.stroke();
    const cols = [COLORS.brand, COLORS.sky, COLORS.emerald, '#f59e0b'];
    const xx = (k: number) => pad + (SEQ.length ? (k / SEQ.length) * (w - pad * 2) : 0);
    const yy = (v: number) => hy0 + hh / 2 - v * (hh / 2);
    for (let i = 0; i < HID; i++) {
      ctx.strokeStyle = cols[i]; ctx.lineWidth = 2; ctx.beginPath();
      for (let k = 0; k < history.length; k++) { const X = xx(k), Y = yy(history[k][i]); k ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(128,128,128,0.9)'; ctx.fillText('each hidden unit over time', pad, hy0 - 4);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const wv = Math.min(parent.clientWidth, 560);
      const hv = Math.round(wv * 0.62);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = wv * dpr; canvas.height = hv * dpr;
      canvas.style.width = `${wv}px`; canvas.style.height = `${hv}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w: wv, h: hv };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(draw, [cell, t]);

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap gap-2">
        {([['rnn', 'Vanilla RNN'], ['gru', 'GRU (gated)']] as [Cell, string][]).map(([c, lbl]) => (
          <button key={c} onClick={() => { setCell(c); setT(0); }}
            class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              cell === c ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
            }`}>{lbl}</button>
        ))}
      </div>

      <div class="grid gap-4 md:grid-cols-[1fr,auto] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

        <div class="space-y-3 text-sm md:w-48">
          <div class="flex gap-2">
            <button onClick={() => setT((v) => Math.min(SEQ.length, v + 1))} disabled={t >= SEQ.length}
              class="flex-1 rounded-lg bg-brand px-3 py-1.5 font-semibold text-white disabled:opacity-40">Step ▶</button>
            <button onClick={() => setT(0)}
              class="flex-1 rounded-lg bg-surface-2 px-3 py-1.5 font-semibold text-muted hover:text-text">Reset</button>
          </div>
          <Readout label="time step" value={`${t} / ${SEQ.length}`} />
          <Readout label="input x_t" value={t > 0 ? SEQ[t - 1].toFixed(2) : '—'} />
          <Readout label="‖h‖" value={Math.hypot(...hNow).toFixed(3)} />
          {cell === 'gru' && lastZ && (
            <Readout label="update gate z̄" value={(lastZ.reduce((s, v) => s + v, 0) / HID).toFixed(2)} />
          )}
          <p class="rounded-lg bg-surface-2 p-3 text-xs text-muted">
            {cell === 'rnn'
              ? 'h_t = tanh(W_x x_t + W_h h_{t-1} + b). Repeated tanh shrinks gradients over long sequences.'
              : 'The gate z mixes old and new: h_t = (1−z)·h_{t-1} + z·h̃. Keeping memory keeps gradients alive.'}
          </p>
        </div>
      </div>
    </div>
  );
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div class="rounded-lg bg-surface-2 px-3 py-2">
      <span class="text-muted">{label}</span>
      <div class="font-mono font-semibold">{value}</div>
    </div>
  );
}
