import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated token-bucket rate limiter (a request pipeline).
   - Tokens refill at a constant rate each tick, up to a capacity.
   - Requests arrive per tick; each consumes a token if one is free
     (ALLOWED), otherwise it is rejected with 429.
   - Edit capacity, refill rate, and the per-tick arrival pattern, then
     step through time to watch the bucket fill and drain, absorbing
     bursts up to its capacity.
   Canvas conventions: devicePixelRatio scaling, resize handler,
   touch-none, redraw via useEffect. rAF autoplay cancelled on
   pause / unmount. Helpers live inside the island.
   ------------------------------------------------------------------ */

const OK = '#10b981';
const REJ = '#f43f5e';
const TOKEN = '#4f46e5';

type Frame = { tokensStart: number; tokensEnd: number; results: ('ok' | 'rej')[] };

function simulate(capacity: number, refillRate: number, arrivals: number[]): Frame[] {
  let tokens = capacity;
  const frames: Frame[] = [];
  for (let t = 0; t < arrivals.length; t++) {
    tokens = Math.min(capacity, tokens + refillRate); // refill (lazy, per tick)
    const tokensStart = tokens;
    const results: ('ok' | 'rej')[] = [];
    for (let k = 0; k < arrivals[t]; k++) {
      if (tokens >= 1) { tokens -= 1; results.push('ok'); }
      else results.push('rej');
    }
    frames.push({ tokensStart, tokensEnd: tokens, results });
  }
  return frames;
}

export default function SysTokenBucket() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 560, h: 240 });
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);

  const [capacity, setCapacity] = useState(6);
  const [refillRate, setRefillRate] = useState(2);
  const [arrivalsText, setArrivalsText] = useState('1, 1, 8, 6, 0, 0, 1, 5, 0, 3');
  const [arrivals, setArrivals] = useState<number[]>(() => [1, 1, 8, 6, 0, 0, 1, 5, 0, 3]);
  const [idx, setIdx] = useState(0); // 0..frames.length
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  const frames = simulate(capacity, refillRate, arrivals);
  idxRef.current = idx;
  const capRef = useRef(capacity); capRef.current = capacity;
  const framesRef = useRef(frames); framesRef.current = frames;

  const commit = () => {
    const parsed = arrivalsText.split(',').map((s) => parseInt(s.trim(), 10)).filter((x) => Number.isFinite(x) && x >= 0);
    if (parsed.length) { setArrivals(parsed); setIdx(0); setPlaying(false); }
  };

  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 950 / speed;
    const tick = (t: number) => {
      if (!lastRef.current) lastRef.current = t;
      if (t - lastRef.current >= interval) {
        lastRef.current = t;
        const next = idxRef.current + 1;
        if (next >= frames.length + 1) { setIdx(frames.length); setPlaying(false); return; }
        setIdx(next);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
  }, [playing, speed, arrivals, capacity, refillRate]);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const cap = capRef.current;
    const fr = framesRef.current;
    const i = idxRef.current;
    const cur = i >= 1 ? fr[i - 1] : null;
    const tokens = cur ? cur.tokensEnd : cap;

    // --- bucket (left) ---
    const bx = 30, bw = 90, bTop = 30, bBot = h - 40, bh = bBot - bTop;
    // refill arrow
    ctx.fillStyle = 'rgba(79,70,229,0.8)';
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`+${refillRate}/tick`, bx + bw / 2, bTop - 14);
    ctx.strokeStyle = 'rgba(79,70,229,0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(bx + bw / 2, bTop - 6); ctx.lineTo(bx + bw / 2, bTop + 2); ctx.stroke();
    // bucket outline
    ctx.strokeStyle = 'rgba(128,128,128,0.5)';
    ctx.lineWidth = 2;
    ctx.strokeRect(bx, bTop, bw, bh);
    // fill
    const fillFrac = cap > 0 ? tokens / cap : 0;
    const fillH = bh * fillFrac;
    ctx.fillStyle = TOKEN;
    ctx.globalAlpha = 0.85;
    ctx.fillRect(bx, bBot - fillH, bw, fillH);
    ctx.globalAlpha = 1;
    // token count
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px ui-monospace, monospace';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${Math.floor(tokens)}`, bx + bw / 2, bBot - Math.max(fillH / 2, 14));
    ctx.fillStyle = 'rgba(128,128,128,0.75)';
    ctx.font = '11px system-ui, sans-serif';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(`tokens / ${cap}`, bx + bw / 2, bBot + 18);

    // --- current tick's requests (right) ---
    const rx = bx + bw + 40;
    ctx.fillStyle = 'rgba(128,128,128,0.85)';
    ctx.font = '12px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(cur ? `tick ${i} — ${cur.results.length} request(s) arrive:` : 'Press Play to send requests through the limiter.', rx, bTop + 4);
    if (cur) {
      const per = 30;
      cur.results.forEach((res, k) => {
        const col = k % 8;
        const row = Math.floor(k / 8);
        const cxp = rx + 14 + col * per;
        const cyp = bTop + 34 + row * per;
        ctx.beginPath();
        ctx.arc(cxp, cyp, 11, 0, Math.PI * 2);
        ctx.fillStyle = res === 'ok' ? OK : REJ;
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 10px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(res === 'ok' ? '✓' : '✕', cxp, cyp + 1);
      });
      ctx.textBaseline = 'alphabetic';
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 600);
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

  useEffect(draw, [idx, arrivals, capacity, refillRate]);

  const reset = () => { setPlaying(false); setIdx(0); lastRef.current = 0; };
  const stepF = () => { setPlaying(false); setIdx((v) => Math.min(frames.length, v + 1)); };
  const stepB = () => { setPlaying(false); setIdx((v) => Math.max(0, v - 1)); };
  const play = () => { if (idx >= frames.length) setIdx(0); lastRef.current = 0; setPlaying((p) => !p); };

  // cumulative counters up to idx
  let allowed = 0, rejected = 0;
  for (let k = 0; k < idx; k++) frames[k].results.forEach((r) => (r === 'ok' ? allowed++ : rejected++));
  const cur = idx >= 1 ? frames[idx - 1] : null;
  const caption = !cur
    ? `Bucket starts full (${capacity} tokens), refilling ${refillRate}/tick.`
    : `Refilled to ${Math.floor(cur.tokensStart)} tokens, then ${cur.results.length} arrived: ${cur.results.filter((r) => r === 'ok').length} allowed, ${cur.results.filter((r) => r === 'rej').length} rejected. ${Math.floor(cur.tokensEnd)} tokens left.`;
  const done = idx >= frames.length;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <label class="flex items-center gap-1 text-muted">capacity
          <input type="number" min={1} max={20} value={capacity} onInput={(e) => { setCapacity(Math.max(1, parseInt((e.target as HTMLInputElement).value, 10) || 1)); setIdx(0); setPlaying(false); }} class="w-16 rounded-lg border border-border bg-surface-2 px-2 py-1" />
        </label>
        <label class="flex items-center gap-1 text-muted">refill/tick
          <input type="number" min={0} max={20} value={refillRate} onInput={(e) => { setRefillRate(Math.max(0, parseInt((e.target as HTMLInputElement).value, 10) || 0)); setIdx(0); setPlaying(false); }} class="w-16 rounded-lg border border-border bg-surface-2 px-2 py-1" />
        </label>
        <input value={arrivalsText} onInput={(e) => setArrivalsText((e.target as HTMLInputElement).value)} class="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-1 font-mono text-xs" placeholder="arrivals per tick, e.g. 1,1,8,6" />
        <button onClick={commit} class="rounded-lg bg-brand px-3 py-1 text-sm font-semibold text-white hover:opacity-90">Load</button>
      </div>

      <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

      <div class="mt-3 flex gap-2 text-sm">
        <span class="rounded-lg px-3 py-1 font-semibold text-white" style="background:#10b981">allowed {allowed}</span>
        <span class="rounded-lg px-3 py-1 font-semibold text-white" style="background:#f43f5e">rejected {rejected}</span>
      </div>

      <p class="mt-3 min-h-[2.5rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">{caption}</p>
      {done && (
        <p class="mt-2 rounded-lg bg-brand-soft px-3 py-2 text-sm font-semibold text-text">
          The bucket absorbed bursts up to its capacity, then throttled the rest to the {refillRate}/tick average. Capacity = burst size; refill rate = sustained rate.
        </p>
      )}

      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={stepB} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏮ Back</button>
        <button onClick={play} class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90">{playing ? '⏸ Pause' : '▶ Play'}</button>
        <button onClick={stepF} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏭ Step</button>
        <button onClick={reset} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">↺ Reset</button>
        <label class="ml-auto flex items-center gap-2 text-xs text-muted">speed
          <input type="range" min={0.5} max={3} step={0.5} value={speed} onInput={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))} class="w-24 accent-[#4f46e5]" />
        </label>
      </div>
      <p class="mt-2 text-center text-xs text-muted">Tip: raise capacity to tolerate bigger bursts; raise refill/tick to lift the sustained rate. A burst of 8 into a 6-token bucket rejects 2.</p>
    </div>
  );
}
