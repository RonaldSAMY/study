import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Fast modular exponentiation on a clock / number wheel.
   - Learner edits base, exponent and modulus m.
   - We precompute the frames of binary exponentiation:
        result = 1; b = base % m
        while e > 0:
          if e & 1: result = result*b % m   (multiply)
          b = b*b % m                        (square)
          e >>= 1
   - The wheel shows the m positions 0..m-1. The emerald marker is the
     running `result`, the sky marker is the running `b` (the repeatedly
     squared base). A live caption narrates each squaring / multiply.
   - Transport: Play / Pause / Step / Back / Reset + speed.
   ------------------------------------------------------------------ */

const COLORS = { result: '#10b981', base: '#0ea5e9', brand: '#4f46e5', ring: 'rgba(128,128,128,0.30)' };

type Frame = {
  result: number;
  b: number;
  e: number;
  action: 'init' | 'multiply' | 'skip' | 'square' | 'done';
  note: string;
};

function buildFrames(base: number, exp: number, m: number): Frame[] {
  const frames: Frame[] = [];
  let result = 1 % m;
  let b = ((base % m) + m) % m;
  let e = exp;
  frames.push({ result, b, e, action: 'init', note: `Start: result = 1, b = ${base} mod ${m} = ${b}.` });
  while (e > 0) {
    if (e & 1) {
      const prev = result;
      result = (result * b) % m;
      frames.push({ result, b, e, action: 'multiply', note: `Bit is 1 -> result = ${prev} x ${b} mod ${m} = ${result}.` });
    } else {
      frames.push({ result, b, e, action: 'skip', note: `Bit is 0 -> skip the multiply, result stays ${result}.` });
    }
    const prevB = b;
    b = (b * b) % m;
    e = Math.floor(e / 2);
    frames.push({ result, b, e, action: 'square', note: `Square the base: ${prevB}^2 mod ${m} = ${b}. Halve the exponent -> ${e}.` });
  }
  frames.push({ result, b, e: 0, action: 'done', note: `Done: ${base}^${exp} mod ${m} = ${result}.` });
  return frames;
}

export default function NTModularClock() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 320, h: 320 });
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);

  const [baseText, setBaseText] = useState('3');
  const [expText, setExpText] = useState('13');
  const [modText, setModText] = useState('12');
  const [params, setParams] = useState({ base: 3, exp: 13, m: 12 });
  const [frames, setFrames] = useState<Frame[]>(() => buildFrames(3, 13, 12));
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  idxRef.current = idx;

  const load = () => {
    const base = parseInt(baseText, 10);
    const exp = parseInt(expText, 10);
    const m = parseInt(modText, 10);
    if (!Number.isFinite(base) || !Number.isFinite(exp) || !Number.isFinite(m)) return;
    if (m < 2 || m > 60 || exp < 0 || exp > 100000 || base < 0) return;
    setParams({ base, exp, m });
    setFrames(buildFrames(base, exp, m));
    setIdx(0);
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
    const cx = w / 2;
    const cy = h / 2;
    const R = Math.min(w, h) / 2 - 30;
    const m = params.m;
    const f = frames[Math.min(idx, frames.length - 1)];

    // ring
    ctx.strokeStyle = COLORS.ring;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.stroke();

    // tick labels
    ctx.font = `${Math.max(10, Math.round(R * 0.14))}px ui-monospace, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const angleFor = (k: number) => -Math.PI / 2 + (2 * Math.PI * k) / m;
    for (let k = 0; k < m; k++) {
      const a = angleFor(k);
      const lx = cx + Math.cos(a) * R;
      const ly = cy + Math.sin(a) * R;
      const isResult = k === f.result;
      const isBase = k === f.b;
      ctx.beginPath();
      ctx.arc(lx, ly, R * 0.13, 0, Math.PI * 2);
      ctx.fillStyle = isResult ? COLORS.result : isBase ? COLORS.base : 'rgba(128,128,128,0.10)';
      ctx.fill();
      ctx.fillStyle = isResult || isBase ? '#fff' : ink;
      ctx.fillText(String(k), lx, ly + 1);
    }

    // hands: from center to result and base
    const hand = (val: number, color: string, frac: number) => {
      const a = angleFor(val);
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * R * frac, cy + Math.sin(a) * R * frac);
      ctx.stroke();
    };
    hand(f.b, COLORS.base, 0.66);
    hand(f.result, COLORS.result, 0.82);
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.brand;
    ctx.fill();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const size = Math.max(220, Math.min(parent.clientWidth, 360));
      const dpr = window.devicePixelRatio || 1;
      canvas.width = size * dpr;
      canvas.height = size * dpr;
      canvas.style.width = `${size}px`;
      canvas.style.height = `${size}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w: size, h: size };
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

  useEffect(draw, [idx, frames, params]);

  useEffect(() => {
    if (!playing) {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      return;
    }
    const interval = 900 / speed;
    const tick = (t: number) => {
      if (!lastRef.current) lastRef.current = t;
      if (t - lastRef.current >= interval) {
        lastRef.current = t;
        const next = idxRef.current + 1;
        if (next >= frames.length) { setIdx(frames.length - 1); setPlaying(false); return; }
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

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 text-text shadow-sm">
      <div class="mb-3 flex flex-wrap items-end gap-2">
        <label class="flex flex-col text-xs text-muted">base
          <input value={baseText} onInput={(e) => setBaseText((e.target as HTMLInputElement).value)} class="w-20 rounded-lg border border-border bg-surface-2 px-2 py-1 font-mono text-sm text-text" />
        </label>
        <label class="flex flex-col text-xs text-muted">exponent
          <input value={expText} onInput={(e) => setExpText((e.target as HTMLInputElement).value)} class="w-24 rounded-lg border border-border bg-surface-2 px-2 py-1 font-mono text-sm text-text" />
        </label>
        <label class="flex flex-col text-xs text-muted">modulus m (2-60)
          <input value={modText} onInput={(e) => setModText((e.target as HTMLInputElement).value)} class="w-24 rounded-lg border border-border bg-surface-2 px-2 py-1 font-mono text-sm text-text" />
        </label>
        <button onClick={load} class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Load</button>
      </div>

      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />
        <div class="space-y-3 text-sm">
          <div class="grid grid-cols-3 gap-2 font-mono">
            <div class="rounded-lg bg-surface-2 px-2 py-1.5"><span class="text-xs" style={`color:${COLORS.result}`}>result</span><div class="font-semibold">{f.result}</div></div>
            <div class="rounded-lg bg-surface-2 px-2 py-1.5"><span class="text-xs" style={`color:${COLORS.base}`}>b</span><div class="font-semibold">{f.b}</div></div>
            <div class="rounded-lg bg-surface-2 px-2 py-1.5"><span class="text-xs text-muted">exp left</span><div class="font-semibold">{f.e}</div></div>
          </div>
          <p class="min-h-[3rem] rounded-lg bg-surface-2 px-3 py-2 text-sm">{f.note}</p>
          {f.action === 'done' && (
            <p class="rounded-lg bg-brand-soft px-3 py-2 text-sm font-semibold">Only {Math.max(1, Math.ceil(Math.log2(params.exp + 1)))} or so squarings — never {params.exp} multiplications.</p>
          )}
          <p class="text-xs text-muted">Green hand = running result, blue hand = the repeatedly squared base. Watch how squaring hops around the wheel.</p>
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
