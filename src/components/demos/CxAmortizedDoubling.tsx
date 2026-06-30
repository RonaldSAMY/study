import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Amortized cost of a growable array.
   - Push items one at a time. When the backing array is full it is
     re-allocated and every element is copied across. Those copies are
     expensive — but they happen rarely, so the *average* cost per push
     stays tiny. That is amortized analysis.
   - Toggle the growth strategy: "double capacity" (amortized O(1)) vs
     "grow by 1" (O(n) per push). Watch the average-cost sparkline stay
     flat vs climb.
   - Frames = one push each. Transport controls (Play / Pause / Step /
     Reset + speed) move an index through the precomputed pushes.
   ------------------------------------------------------------------ */

type Frame = {
  push: number;
  cap: number;       // capacity AFTER this push
  capBefore: number; // capacity BEFORE this push
  size: number;      // = push
  copies: number;    // elements copied this push
  work: number;      // copies + 1 write
  cumWork: number;
  amort: number;     // cumWork / push
  resized: boolean;
};

function buildFrames(numPushes: number, doubling: boolean): Frame[] {
  const f: Frame[] = [];
  let cap = 0;
  let cumWork = 0;
  for (let i = 1; i <= numPushes; i++) {
    const sizeBefore = i - 1;
    const capBefore = cap;
    let copies = 0;
    let resized = false;
    if (sizeBefore >= cap) {
      resized = true;
      copies = sizeBefore;
      cap = doubling ? Math.max(1, cap * 2) : cap + 1;
    }
    const work = copies + 1;
    cumWork += work;
    f.push({ push: i, cap, capBefore, size: i, copies, work, cumWork, amort: cumWork / i, resized });
  }
  return f;
}

export default function CxAmortizedDoubling() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 480, h: 320 });

  const [numPushes, setNumPushes] = useState(24);
  const [doubling, setDoubling] = useState(true);
  const [frames, setFrames] = useState<Frame[]>(() => buildFrames(24, true));
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(4);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);

  const framesRef = useRef(frames); framesRef.current = frames;
  const idxRef = useRef(idx); idxRef.current = idx;

  useEffect(() => {
    setPlaying(false);
    setFrames(buildFrames(numPushes, doubling));
    setIdx(0);
  }, [numPushes, doubling]);

  useEffect(() => {
    if (!playing) return;
    const interval = 1000 / Math.max(1, speed);
    const loop = (t: number) => {
      if (!lastRef.current) lastRef.current = t;
      if (t - lastRef.current >= interval) {
        lastRef.current = t;
        setIdx((i) => {
          if (i >= framesRef.current.length - 1) { setPlaying(false); return i; }
          return i + 1;
        });
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      lastRef.current = 0;
    };
  }, [playing, speed]);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);
    const fr = framesRef.current;
    if (!fr.length) return;
    const cur = fr[Math.min(idxRef.current, fr.length - 1)];

    // ---- region A: capacity boxes ----
    const pad = 10;
    const topH = Math.round(h * 0.52);
    const maxCap = fr[fr.length - 1].cap;
    const perRow = Math.max(1, Math.min(maxCap, Math.floor((w - pad * 2) / 22)));
    const box = Math.min(24, (w - pad * 2) / perRow);
    const gap = box * 0.12;

    for (let s = 0; s < cur.cap; s++) {
      const row = Math.floor(s / perRow);
      const col = s % perRow;
      const x = pad + col * box;
      const y = pad + row * box;
      const filled = s < cur.size;
      const isNew = s === cur.size - 1;
      const isCopied = cur.resized && s < cur.size - 1;
      if (isNew) ctx.fillStyle = '#10b981';
      else if (isCopied) ctx.fillStyle = '#0ea5e9';
      else if (filled) ctx.fillStyle = '#4f46e5';
      else ctx.fillStyle = 'rgba(128,128,128,0.10)';
      ctx.fillRect(x + gap, y + gap, box - gap * 2, box - gap * 2);
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(128,128,128,0.35)';
      ctx.strokeRect(x + gap, y + gap, box - gap * 2, box - gap * 2);
    }

    // ---- region B: amortized sparkline ----
    const bx = pad + 30;
    const by = topH + 6;
    const bw = w - bx - pad;
    const bh = h - by - 22;
    let maxAmort = 1;
    for (const ff of fr) maxAmort = Math.max(maxAmort, ff.amort);

    // axes
    ctx.strokeStyle = 'rgba(128,128,128,0.45)';
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx, by + bh); ctx.lineTo(bx + bw, by + bh); ctx.stroke();
    ctx.fillStyle = 'rgba(128,128,128,0.9)';
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(maxAmort.toFixed(0), bx - 4, by + 8);
    ctx.fillText('0', bx - 4, by + bh);
    ctx.textAlign = 'center';
    ctx.fillText('avg cost per push  vs  push #', bx + bw / 2, h - 4);

    const xOf = (p: number) => bx + ((p - 1) / Math.max(1, fr.length - 1)) * bw;
    const yOf = (a: number) => by + bh - (a / maxAmort) * bh;

    // full faint curve (preview) + revealed bold curve
    ctx.strokeStyle = 'rgba(128,128,128,0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    fr.forEach((ff, i) => { const x = xOf(ff.push), y = yOf(ff.amort); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
    ctx.stroke();

    ctx.strokeStyle = '#4f46e5';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    for (let i = 0; i <= idxRef.current && i < fr.length; i++) {
      const x = xOf(fr[i].push), y = yOf(fr[i].amort);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    // head dot
    ctx.beginPath(); ctx.arc(xOf(cur.push), yOf(cur.amort), 4, 0, Math.PI * 2);
    ctx.fillStyle = '#10b981'; ctx.fill();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 560);
      const h = Math.round(Math.min(w * 0.72, 360));
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

  useEffect(draw, [idx, frames, numPushes, doubling]);

  const step = (d: number) => {
    setPlaying(false);
    setIdx((i) => Math.max(0, Math.min(frames.length - 1, i + d)));
  };

  const cur = frames[Math.min(idx, frames.length - 1)];
  const done = idx >= frames.length - 1;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setDoubling(true)}
          class={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${doubling ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'}`}
        >
          double capacity
        </button>
        <button
          onClick={() => setDoubling(false)}
          class={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${!doubling ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'}`}
        >
          grow by 1
        </button>
        <span class="ml-2 flex items-center gap-1 text-xs text-muted"><i class="inline-block h-3 w-3 rounded-sm" style="background:#10b981"></i>new</span>
        <span class="flex items-center gap-1 text-xs text-muted"><i class="inline-block h-3 w-3 rounded-sm" style="background:#0ea5e9"></i>copied</span>
        <span class="flex items-center gap-1 text-xs text-muted"><i class="inline-block h-3 w-3 rounded-sm" style="background:#4f46e5"></i>kept</span>
      </div>

      <canvas ref={canvasRef} class="touch-none w-full rounded-xl bg-surface-2" />

      <label class="mt-3 block text-sm">
        <span class="mb-1 block text-muted">number of pushes = {numPushes}</span>
        <input
          type="range" min={4} max={40} step={1} value={numPushes}
          onInput={(e) => setNumPushes(parseInt((e.target as HTMLInputElement).value))}
          class="w-full accent-[#4f46e5]"
        />
      </label>

      <div class="mt-2 grid grid-cols-3 gap-2 text-sm">
        <Readout label="total copies" value={`${cur ? cur.cumWork - cur.push : 0}`} />
        <Readout label="this push cost" value={`${cur ? cur.work : 0}`} />
        <Readout label="avg / push" value={cur ? cur.amort.toFixed(2) : '0'} />
      </div>

      {/* transport */}
      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={() => step(-1)} class="rounded-lg bg-surface-2 px-2.5 py-1.5 text-sm font-semibold text-muted hover:text-text" title="Step back">⏮</button>
        <button
          onClick={() => { if (done) setIdx(0); setPlaying((p) => !p); }}
          class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white transition hover:opacity-90"
        >
          {playing ? '⏸ Pause' : '▶ Play'}
        </button>
        <button onClick={() => step(1)} class="rounded-lg bg-surface-2 px-2.5 py-1.5 text-sm font-semibold text-muted hover:text-text" title="Step forward">⏭</button>
        <button onClick={() => { setPlaying(false); setIdx(0); }} class="rounded-lg bg-surface-2 px-2.5 py-1.5 text-sm font-semibold text-muted hover:text-text" title="Reset">↺</button>
        <label class="ml-auto flex items-center gap-2 text-xs text-muted">
          speed
          <input type="range" min={1} max={16} step={1} value={speed}
            onInput={(e) => setSpeed(parseInt((e.target as HTMLInputElement).value))}
            class="w-24 accent-[#10b981]" />
        </label>
      </div>

      {/* live caption */}
      <div class="mt-3 rounded-lg bg-surface-2 p-3 text-sm">
        {cur && cur.resized
          ? <span>push #{cur.push}: array <strong>full</strong> at capacity {cur.capBefore} → grow to <strong>{cur.cap}</strong>, copy {cur.copies} items (cost {cur.work}). Amortized so far: <strong>{cur.amort.toFixed(2)}</strong> ops/push.</span>
          : <span>push #{cur ? cur.push : 0}: free slot available, just write (cost 1). Amortized so far: <strong>{cur ? cur.amort.toFixed(2) : '0'}</strong> ops/push.</span>}
      </div>
    </div>
  );
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div class="rounded-lg bg-surface-2 px-3 py-2">
      <span class="text-xs text-muted">{label}</span>
      <div class="font-mono font-semibold">{value}</div>
    </div>
  );
}
