import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   FFT butterfly network - the divide-and-conquer of the Fast Fourier
   Transform, one butterfly at a time.
   - Learner types a small real signal; we pad it to n = 4 or 8.
   - Column 0 is the input in bit-reversed order. Each later column is
     one FFT stage: butterflies combine a top/bottom pair as
        top'    = top + w * bottom
        bottom' = top - w * bottom
     with twiddle w = e^(-2*pi*i*j/len). log2(n) stages -> O(n log n).
   - The active butterfly and its two lines are highlighted; a caption
     names the pair and twiddle. The last column is the spectrum.
   - Transport: Play / Pause / Step / Back / Reset + speed.
   ------------------------------------------------------------------ */

const BRAND = '#4f46e5';
const CUR = '#0ea5e9';
const READY = '#10b981';

type C = { re: number; im: number };
type Ev = { stage: number; rowTop: number; rowBot: number; len: number; j: number; wRe: number; wIm: number };

function fmt(x: number): string { const r = Math.round(x * 10) / 10; return Object.is(r, -0) ? '0' : String(r); }
function cstr(c: C): string {
  const re = fmt(c.re); const im = fmt(c.im);
  if (Math.abs(c.im) < 0.05) return re;
  return `${re}${c.im >= 0 ? '+' : '-'}${fmt(Math.abs(c.im))}i`;
}

function build(input: number[], n: number) {
  const a: C[] = input.slice(0, n).map((x) => ({ re: x, im: 0 }));
  while (a.length < n) a.push({ re: 0, im: 0 });

  // bit-reversal permutation
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    while (j & bit) { j ^= bit; bit >>= 1; }
    j ^= bit;
    if (i < j) { const t = a[i]; a[i] = a[j]; a[j] = t; }
  }

  const stages = Math.log2(n);
  const levels: C[][] = [a.map((c) => ({ ...c }))];
  const events: Ev[] = [];
  const cur = a.map((c) => ({ ...c }));
  let stage = 1;
  for (let len = 2; len <= n; len *= 2, stage++) {
    for (let i = 0; i < n; i += len) {
      for (let j = 0; j < len / 2; j++) {
        const ang = (-2 * Math.PI * j) / len;
        const wRe = Math.cos(ang), wIm = Math.sin(ang);
        const top = cur[i + j];
        const bot = cur[i + j + len / 2];
        const vRe = wRe * bot.re - wIm * bot.im;
        const vIm = wRe * bot.im + wIm * bot.re;
        cur[i + j] = { re: top.re + vRe, im: top.im + vIm };
        cur[i + j + len / 2] = { re: top.re - vRe, im: top.im - vIm };
        events.push({ stage, rowTop: i + j, rowBot: i + j + len / 2, len, j, wRe, wIm });
      }
    }
    levels.push(cur.map((c) => ({ ...c })));
  }

  // finalize[column][row] = global event index that writes it (col>=1)
  const finalize: number[][] = Array.from({ length: stages + 1 }, () => new Array(n).fill(-1));
  events.forEach((e, g) => { finalize[e.stage][e.rowTop] = g; finalize[e.stage][e.rowBot] = g; });

  return { levels, events, finalize, stages, n };
}

export default function NTFFTButterfly() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 480, h: 320 });
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);

  const [text, setText] = useState('1, 2, 3, 4');
  const [n, setN] = useState(4);
  const [data, setData] = useState(() => build([1, 2, 3, 4], 4));
  const [idx, setIdx] = useState(-1); // -1 = only inputs shown
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  idxRef.current = idx;

  const load = (size?: number) => {
    const sz = size ?? n;
    const parsed = text.split(',').map((x) => parseFloat(x.trim())).filter((x) => Number.isFinite(x));
    if (!parsed.length) return;
    setN(sz);
    setData(build(parsed, sz));
    setIdx(-1);
    setPlaying(false);
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);
    const ink = getComputedStyle(canvas).color;
    const cols = data.stages + 1;
    const marginX = 46, marginY = 26;
    const colX = (c: number) => marginX + (c * (w - 2 * marginX)) / (cols - 1);
    const rowY = (r: number) => marginY + (r * (h - 2 * marginY)) / (data.n - 1);
    const active = idx >= 0 ? data.events[idx] : null;

    // butterfly lines for processed + active events
    for (let g = 0; g <= idx && g < data.events.length; g++) {
      const e = data.events[g];
      const x0 = colX(e.stage - 1), x1 = colX(e.stage);
      const yt = rowY(e.rowTop), yb = rowY(e.rowBot);
      const isActive = g === idx;
      ctx.strokeStyle = isActive ? CUR : 'rgba(128,128,128,0.35)';
      ctx.lineWidth = isActive ? 2.5 : 1.2;
      ctx.beginPath();
      ctx.moveTo(x0, yt); ctx.lineTo(x1, yt);
      ctx.moveTo(x0, yb); ctx.lineTo(x1, yt);
      ctx.moveTo(x0, yt); ctx.lineTo(x1, yb);
      ctx.moveTo(x0, yb); ctx.lineTo(x1, yb);
      ctx.stroke();
    }

    // nodes
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '11px ui-monospace, monospace';
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < data.n; r++) {
        const ready = c === 0 || (data.finalize[c][r] !== -1 && data.finalize[c][r] <= idx);
        const isActive = active && c === active.stage && (r === active.rowTop || r === active.rowBot);
        const x = colX(c), y = rowY(r);
        ctx.beginPath();
        ctx.arc(x, y, 15, 0, Math.PI * 2);
        ctx.fillStyle = isActive ? CUR : ready ? (c === 0 ? BRAND : c === cols - 1 ? READY : 'rgba(79,70,229,0.55)') : 'rgba(128,128,128,0.15)';
        ctx.fill();
        ctx.fillStyle = ready || isActive ? '#fff' : 'rgba(128,128,128,0.6)';
        const val = ready ? cstr(data.levels[c][r]) : '·';
        ctx.fillText(val, x, y);
      }
    }

    // column labels
    ctx.fillStyle = ink;
    ctx.font = '10px ui-sans-serif, system-ui';
    ctx.fillText('input', colX(0), 10);
    ctx.fillText('spectrum', colX(cols - 1), 10);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.max(300, Math.min(parent.clientWidth, 560));
      const hh = n === 8 ? 340 : 220;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = hh * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${hh}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w, h: hh };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n]);

  useEffect(draw, [idx, data, n]);

  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 1000 / speed;
    const tick = (t: number) => {
      if (!lastRef.current) lastRef.current = t;
      if (t - lastRef.current >= interval) {
        lastRef.current = t;
        const next = idxRef.current + 1;
        if (next >= data.events.length) { setIdx(data.events.length - 1); setPlaying(false); return; }
        setIdx(next);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
  }, [playing, speed, data]);

  const reset = () => { setPlaying(false); setIdx(-1); lastRef.current = 0; };
  const stepF = () => { setPlaying(false); setIdx((v) => Math.min(data.events.length - 1, v + 1)); };
  const stepB = () => { setPlaying(false); setIdx((v) => Math.max(-1, v - 1)); };
  const play = () => { if (idx >= data.events.length - 1) setIdx(-1); lastRef.current = 0; setPlaying((p) => !p); };

  const active = idx >= 0 ? data.events[idx] : null;
  const done = idx >= data.events.length - 1;
  const caption = active
    ? `Stage ${active.stage} (len ${active.len}), twiddle w = e^(-2*pi*i*${active.j}/${active.len}) = ${cstr({ re: active.wRe, im: active.wIm })}. Combine rows ${active.rowTop} and ${active.rowBot}: top+w*bottom and top-w*bottom.`
    : `Column 0 is the input in bit-reversed order. Press Play to run the ${data.stages} butterfly stages.`;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 text-text shadow-sm">
      <div class="mb-3 flex flex-wrap items-end gap-2">
        <input value={text} onInput={(e) => setText((e.target as HTMLInputElement).value)} class="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm text-text" placeholder="comma-separated signal" />
        <button onClick={() => load()} class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Load</button>
        <div class="flex overflow-hidden rounded-lg border border-border">
          {[4, 8].map((sz) => (
            <button key={sz} onClick={() => load(sz)} class={`px-3 py-1.5 text-sm font-semibold ${n === sz ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'}`}>n={sz}</button>
          ))}
        </div>
      </div>

      <canvas ref={canvasRef} class="touch-none w-full rounded-xl bg-surface-2" />

      <p class="mt-3 min-h-[3.5rem] rounded-lg bg-surface-2 px-3 py-2 text-sm">{caption}</p>
      {done && <p class="mt-2 rounded-lg bg-brand-soft px-3 py-2 text-sm font-semibold">The last column is the DFT of your signal. Naive evaluation costs n^2 = {data.n * data.n}; these {data.events.length} butterflies cost n log n = {data.n * data.stages}.</p>}

      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={stepB} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏮ Back</button>
        <button onClick={play} class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90">{playing ? '⏸ Pause' : '▶ Play'}</button>
        <button onClick={stepF} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏭ Step</button>
        <button onClick={reset} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">↺ Reset</button>
        <label class="ml-auto flex items-center gap-2 text-xs text-muted">speed
          <input type="range" min={0.5} max={3} step={0.5} value={speed} onInput={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))} class="w-24 accent-[#4f46e5]" />
        </label>
      </div>
      <p class="mt-2 text-center text-xs text-muted">Each node shows its complex value. Notice the crossing "butterfly" wires — the same shape recurses at every stage.</p>
    </div>
  );
}
