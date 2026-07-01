import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Euler's totient phi(n) by counting coprimes on a wheel.
   - Learner sets n (2..60). The numbers 1..n sit around a ring.
   - We step k = 1..n, testing gcd(k, n). Coprime (gcd = 1) turns
     emerald and increments the count; a shared factor turns grey.
   - The final count is phi(n); we also show the product formula
     phi(n) = n * prod(1 - 1/p) over the distinct prime factors p.
   - Transport: Play / Pause / Step / Back / Reset + speed.
   ------------------------------------------------------------------ */

const COPRIME = '#10b981';
const SHARED = 'rgba(128,128,128,0.30)';
const CUR = '#0ea5e9';
const BRAND = '#4f46e5';

function gcd(a: number, b: number): number { while (b) { [a, b] = [b, a % b]; } return a; }
function primeFactors(n: number): number[] {
  const f: number[] = [];
  let d = 2;
  while (d * d <= n) { if (n % d === 0) { f.push(d); while (n % d === 0) n /= d; } d++; }
  if (n > 1) f.push(n);
  return f;
}
function phiFormula(n: number, factors: number[]): number {
  let r = n;
  for (const p of factors) r -= r / p;
  return r;
}

export default function NTTotientWheel() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 320 });
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);

  const [nText, setNText] = useState('12');
  const [n, setN] = useState(12);
  const [idx, setIdx] = useState(0); // 0..n  (k = idx tested; 0 = nothing yet)
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1.5);
  idxRef.current = idx;

  const factors = primeFactors(n);
  // running count of coprimes among 1..idx
  const countUpTo = (upto: number) => {
    let c = 0;
    for (let k = 1; k <= upto; k++) if (gcd(k, n) === 1) c++;
    return c;
  };

  const load = () => {
    const v = parseInt(nText, 10);
    if (!Number.isFinite(v) || v < 2 || v > 60) return;
    setN(v);
    setIdx(0);
    setPlaying(false);
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = sizeRef.current.w;
    ctx.clearRect(0, 0, w, w);
    const ink = getComputedStyle(canvas).color;
    const cx = w / 2, cy = w / 2;
    const R = w / 2 - 26;
    const dot = Math.max(8, Math.min(R * 0.16, (2 * Math.PI * R) / n / 2.4));

    ctx.font = `${Math.max(9, Math.round(dot * 0.95))}px ui-monospace, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let k = 1; k <= n; k++) {
      const a = -Math.PI / 2 + (2 * Math.PI * (k - 1)) / n;
      const px = cx + Math.cos(a) * R;
      const py = cy + Math.sin(a) * R;
      const tested = k <= idx;
      const coprime = gcd(k, n) === 1;
      const isCur = k === idx;
      let fill = 'rgba(128,128,128,0.10)';
      if (tested) fill = coprime ? COPRIME : SHARED;
      if (isCur) fill = CUR;
      ctx.beginPath();
      ctx.arc(px, py, dot, 0, Math.PI * 2);
      ctx.fillStyle = fill;
      ctx.fill();
      const light = isCur || (tested && coprime);
      ctx.fillStyle = light ? '#fff' : ink;
      ctx.fillText(String(k), px, py + 1);
    }

    // center count
    ctx.fillStyle = BRAND;
    ctx.font = `bold ${Math.round(R * 0.30)}px ui-sans-serif, system-ui`;
    ctx.fillText(String(countUpTo(idx)), cx, cy - R * 0.06);
    ctx.fillStyle = ink;
    ctx.font = `${Math.round(R * 0.13)}px ui-sans-serif, system-ui`;
    ctx.fillText('coprimes', cx, cy + R * 0.18);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const size = Math.max(240, Math.min(parent.clientWidth, 360));
      const dpr = window.devicePixelRatio || 1;
      canvas.width = size * dpr;
      canvas.height = size * dpr;
      canvas.style.width = `${size}px`;
      canvas.style.height = `${size}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w: size };
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

  useEffect(draw, [idx, n]);

  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 520 / speed;
    const tick = (t: number) => {
      if (!lastRef.current) lastRef.current = t;
      if (t - lastRef.current >= interval) {
        lastRef.current = t;
        const next = idxRef.current + 1;
        if (next > n) { setIdx(n); setPlaying(false); return; }
        setIdx(next);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
  }, [playing, speed, n]);

  const reset = () => { setPlaying(false); setIdx(0); lastRef.current = 0; };
  const stepF = () => { setPlaying(false); setIdx((v) => Math.min(n, v + 1)); };
  const stepB = () => { setPlaying(false); setIdx((v) => Math.max(0, v - 1)); };
  const play = () => { if (idx >= n) setIdx(0); lastRef.current = 0; setPlaying((p) => !p); };

  const done = idx >= n;
  const phi = phiFormula(n, factors);
  const caption = idx === 0
    ? `Press Play to test each k = 1..${n} against n = ${n}.`
    : `k = ${idx}: gcd(${idx}, ${n}) = ${gcd(idx, n)} -> ${gcd(idx, n) === 1 ? 'coprime, count it.' : 'shares a factor, skip.'}`;
  const formulaStr = `${n}` + factors.map((p) => ` x (1 - 1/${p})`).join('');

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 text-text shadow-sm">
      <div class="mb-3 flex flex-wrap items-end gap-2">
        <label class="flex flex-col text-xs text-muted">n (2-60)
          <input value={nText} onInput={(e) => setNText((e.target as HTMLInputElement).value)} class="w-24 rounded-lg border border-border bg-surface-2 px-2 py-1 font-mono text-sm text-text" />
        </label>
        <button onClick={load} class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Load</button>
      </div>

      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />
        <div class="space-y-3 text-sm">
          <p class="min-h-[3rem] rounded-lg bg-surface-2 px-3 py-2">{caption}</p>
          <div class="rounded-lg bg-surface-2 px-3 py-2 font-mono text-sm">
            <div class="text-xs text-muted">distinct prime factors of {n}</div>
            <div>{factors.join(', ') || '(none)'}</div>
          </div>
          {done && (
            <p class="rounded-lg bg-brand-soft px-3 py-2 text-sm font-semibold">
              phi({n}) = {phi}. Formula check: {formulaStr} = {phi}.
            </p>
          )}
          <p class="text-xs text-muted">Counting one by one is O(n) work; the product formula gets the same answer from just the prime factors in O(sqrt n).</p>
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
      <p class="mt-2 text-center text-xs text-muted">Try a prime like 13 (every smaller number is coprime, so phi = 12), then 12 = 2^2 x 3.</p>
    </div>
  );
}
