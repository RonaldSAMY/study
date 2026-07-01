import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Sieve of Eratosthenes on a number grid.
   - Learner sets n (up to 150). Numbers 1..n are laid out 10 per row.
   - We precompute the event stream of the classic sieve: announce each
     prime p, then cross out p*p, p*p+p, ... The FIRST prime to cross a
     cell is its smallest prime factor (spf) - the key fact behind the
     linear sieve - so a toggle recolors composites by their spf.
   - The active cell is highlighted and a live caption narrates it.
   - Transport: Play / Pause / Step / Back / Reset + speed.
   ------------------------------------------------------------------ */

const COLS = 10;
const PRIME = '#4f46e5';
const CUR = '#0ea5e9';
const NEWPRIME = '#10b981';
const SPF_PALETTE = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6', '#ef4444'];

type Ev = { type: 'prime' | 'cross'; val: number; by: number; note: string };

function build(n: number) {
  const isComposite = new Array(n + 1).fill(false);
  const spf = new Array(n + 1).fill(0);
  const crossFrame = new Array(n + 1).fill(Infinity);
  const primeFrame = new Array(n + 1).fill(Infinity);
  const events: Ev[] = [];
  const primeColor = new Map<number, string>();
  let colorIdx = 0;

  for (let i = 2; i <= n; i++) {
    if (!isComposite[i]) {
      primeColor.set(i, SPF_PALETTE[colorIdx % SPF_PALETTE.length]);
      colorIdx++;
      primeFrame[i] = events.length;
      events.push({ type: 'prime', val: i, by: i, note: `${i} was never crossed out -> it is prime. Cross out its multiples from ${i}x${i} = ${i * i}.` });
      for (let j = i * i; j <= n; j += i) {
        if (!isComposite[j]) { isComposite[j] = true; spf[j] = i; crossFrame[j] = events.length; }
        events.push({ type: 'cross', val: j, by: i, note: `${j} = ${i} x ${j / i} is a multiple of ${i}, so it is composite.${spf[j] === i ? ` Its smallest prime factor is ${i}.` : ''}` });
      }
    }
  }
  events.push({ type: 'prime', val: -1, by: -1, note: `Every number past sqrt(${n}) that survived is prime. Sieve complete.` });
  return { events, isComposite, spf, crossFrame, primeFrame, primeColor };
}

export default function NTSieveGrid() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 400, cell: 38 });
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);

  const [nText, setNText] = useState('60');
  const [n, setN] = useState(60);
  const [data, setData] = useState(() => build(60));
  const [idx, setIdx] = useState(0);
  const [spfMode, setSpfMode] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1.5);
  idxRef.current = idx;

  const load = () => {
    const v = parseInt(nText, 10);
    if (!Number.isFinite(v) || v < 10 || v > 150) return;
    setN(v);
    setData(build(v));
    setIdx(0);
    setPlaying(false);
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { cell } = sizeRef.current;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const ink = getComputedStyle(canvas).color;
    const rows = Math.ceil(n / COLS);
    const ev = data.events[Math.min(idx, data.events.length - 1)];
    const curVal = ev.val;

    ctx.font = `${Math.round(cell * 0.38)}px ui-monospace, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let k = 1; k <= n; k++) {
      const r = Math.floor((k - 1) / COLS);
      const c = (k - 1) % COLS;
      const x = c * cell;
      const y = r * cell;
      const crossed = data.crossFrame[k] <= idx;
      const isPrime = k >= 2 && !data.isComposite[k];
      const primeShown = isPrime && (data.primeFrame[k] <= idx || idx >= data.events.length - 1);
      const isCur = k === curVal;

      let fill = 'rgba(128,128,128,0.08)';
      if (k === 1) fill = 'rgba(128,128,128,0.18)';
      else if (crossed) {
        fill = spfMode ? (data.primeColor.get(data.spf[k]) || 'rgba(128,128,128,0.35)') : 'rgba(128,128,128,0.22)';
      } else if (primeShown) fill = PRIME;
      if (isCur) fill = ev.type === 'prime' ? NEWPRIME : CUR;

      ctx.fillStyle = fill;
      ctx.fillRect(x + 2, y + 2, cell - 4, cell - 4);
      const light = (crossed && !spfMode) || (k === 1) || fill.startsWith('rgba(128');
      ctx.fillStyle = light ? ink : '#fff';
      ctx.fillText(String(k), x + cell / 2, y + cell / 2 + 1);
      if (crossed && !isCur) {
        ctx.strokeStyle = 'rgba(120,120,120,0.7)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x + 6, y + cell - 6);
        ctx.lineTo(x + cell - 6, y + 6);
        ctx.stroke();
      }
    }
    void rows;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.max(280, Math.min(parent.clientWidth, 440));
      const cell = Math.floor(w / COLS);
      const rows = Math.ceil(n / COLS);
      const gw = cell * COLS;
      const gh = cell * rows;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = gw * dpr;
      canvas.height = gh * dpr;
      canvas.style.width = `${gw}px`;
      canvas.style.height = `${gh}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w: gw, cell };
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

  useEffect(draw, [idx, data, n, spfMode]);

  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 520 / speed;
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

  const reset = () => { setPlaying(false); setIdx(0); lastRef.current = 0; };
  const stepF = () => { setPlaying(false); setIdx((v) => Math.min(data.events.length - 1, v + 1)); };
  const stepB = () => { setPlaying(false); setIdx((v) => Math.max(0, v - 1)); };
  const play = () => { if (idx >= data.events.length - 1) setIdx(0); lastRef.current = 0; setPlaying((p) => !p); };

  const ev = data.events[Math.min(idx, data.events.length - 1)];
  const done = idx >= data.events.length - 1;
  const primeCount = data.isComposite.reduce((acc, comp, k) => acc + (k >= 2 && !comp ? 1 : 0), 0);

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 text-text shadow-sm">
      <div class="mb-3 flex flex-wrap items-end gap-2">
        <label class="flex flex-col text-xs text-muted">n (10-150)
          <input value={nText} onInput={(e) => setNText((e.target as HTMLInputElement).value)} class="w-24 rounded-lg border border-border bg-surface-2 px-2 py-1 font-mono text-sm text-text" />
        </label>
        <button onClick={load} class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Load</button>
        <label class="ml-1 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={spfMode} onInput={(e) => setSpfMode((e.target as HTMLInputElement).checked)} class="h-4 w-4 accent-[#4f46e5]" />
          <span>Color by smallest prime factor</span>
        </label>
      </div>

      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />
        <div class="space-y-3 text-sm">
          <p class="min-h-[3.5rem] rounded-lg bg-surface-2 px-3 py-2">{ev.note}</p>
          {done && <p class="rounded-lg bg-brand-soft px-3 py-2 font-semibold">Found {primeCount} primes up to {n}. Indigo (or colored) cells that were never crossed are the primes.</p>}
          <p class="text-xs text-muted">Toggle the checkbox: each composite is colored by the <em>first</em> prime that reached it — its smallest prime factor. That single-owner idea is what makes the linear sieve O(n).</p>
        </div>
      </div>

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
