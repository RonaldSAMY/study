import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Miller-Rabin witness check, one squaring at a time.
   - Learner edits n (odd, 5..5,000,000) and a witness a.
   - Write n-1 = 2^s * d with d odd. Then form the chain
        x0 = a^d mod n,  x1 = x0^2,  x2 = x1^2, ... (s terms)
     Miller-Rabin says: n passes for witness a iff x0 is 1 or n-1, OR
     some later square equals n-1 BEFORE a 1 appears. Otherwise a is a
     "witness" that n is composite.
   - Each frame reveals one chain value, highlights it, and narrates the
     verdict so far. Green = looks prime for this a, red = composite.
   - Transport: Play / Pause / Step / Back / Reset + speed.
   ------------------------------------------------------------------ */

const COLORS = { prime: '#10b981', composite: '#ef4444', cur: '#0ea5e9' };

type Cell = { label: string; val: number };
type Frame = { reveal: number; status: 'continue' | 'prime' | 'composite'; note: string };

function modMul(a: number, b: number, m: number): number { return (a * b) % m; }
function modPow(base: number, exp: number, m: number): number {
  let result = 1; base %= m;
  while (exp > 0) { if (exp & 1) result = modMul(result, base, m); base = modMul(base, base, m); exp = Math.floor(exp / 2); }
  return result;
}

function build(n: number, a: number): { cells: Cell[]; frames: Frame[]; s: number; d: number } {
  let s = 0, d = n - 1;
  while (d % 2 === 0) { d /= 2; s++; }
  const cells: Cell[] = [];
  const frames: Frame[] = [];
  frames.push({ reveal: -1, status: 'continue', note: `n - 1 = ${n - 1} = 2^${s} x ${d}. Witness a = ${a}. Now build the chain by repeated squaring.` });

  let x = modPow(a, d, n);
  cells.push({ label: 'a^d', val: x });
  if (x === 1 || x === n - 1) {
    frames.push({ reveal: 0, status: 'prime', note: `x0 = a^d mod n = ${x}. That is ${x === 1 ? '1' : 'n-1'} straight away -> n passes for this witness.` });
    return { cells, frames, s, d };
  }
  frames.push({ reveal: 0, status: 'continue', note: `x0 = a^d mod n = ${x}. Not 1 and not n-1 (=${n - 1}) yet, so keep squaring.` });

  for (let r = 1; r < s; r++) {
    x = modMul(x, x, n);
    cells.push({ label: `x${r}`, val: x });
    if (x === n - 1) {
      frames.push({ reveal: r, status: 'prime', note: `x${r} = ${x} = n-1 -> a square root of 1 that is -1. n passes for witness ${a}.` });
      return { cells, frames, s, d };
    }
    if (x === 1) {
      frames.push({ reveal: r, status: 'composite', note: `x${r} = 1 but the previous value was not n-1 -> a nontrivial square root of 1. ${a} is a WITNESS: n is composite.` });
      return { cells, frames, s, d };
    }
    frames.push({ reveal: r, status: 'continue', note: `x${r} = ${x}. Still not n-1, keep squaring.` });
  }
  frames.push({ reveal: cells.length - 1, status: 'composite', note: `Never hit n-1 across all ${s} squarings. ${a} is a WITNESS: n is composite.` });
  return { cells, frames, s, d };
}

export default function NTMillerRabinWitness() {
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);

  const [nText, setNText] = useState('561');
  const [aText, setAText] = useState('2');
  const [meta, setMeta] = useState({ n: 561, a: 2 });
  const [data, setData] = useState(() => build(561, 2));
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  idxRef.current = idx;

  const load = () => {
    let n = parseInt(nText, 10);
    const a = parseInt(aText, 10);
    if (!Number.isFinite(n) || !Number.isFinite(a)) return;
    if (n < 5 || n > 5000000 || n % 2 === 0) return;
    if (a < 2 || a >= n) return;
    setMeta({ n, a });
    setData(build(n, a));
    setIdx(0);
    setPlaying(false);
  };

  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 1000 / speed;
    const tick = (t: number) => {
      if (!lastRef.current) lastRef.current = t;
      if (t - lastRef.current >= interval) {
        lastRef.current = t;
        const next = idxRef.current + 1;
        if (next >= data.frames.length) { setIdx(data.frames.length - 1); setPlaying(false); return; }
        setIdx(next);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
  }, [playing, speed, data]);

  const reset = () => { setPlaying(false); setIdx(0); lastRef.current = 0; };
  const stepF = () => { setPlaying(false); setIdx((v) => Math.min(data.frames.length - 1, v + 1)); };
  const stepB = () => { setPlaying(false); setIdx((v) => Math.max(0, v - 1)); };
  const play = () => { if (idx >= data.frames.length - 1) setIdx(0); lastRef.current = 0; setPlaying((p) => !p); };

  const frame = data.frames[Math.min(idx, data.frames.length - 1)];
  const done = idx >= data.frames.length - 1;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 text-text shadow-sm">
      <div class="mb-3 flex flex-wrap items-end gap-2">
        <label class="flex flex-col text-xs text-muted">n (odd, 5-5,000,000)
          <input value={nText} onInput={(e) => setNText((e.target as HTMLInputElement).value)} class="w-32 rounded-lg border border-border bg-surface-2 px-2 py-1 font-mono text-sm text-text" />
        </label>
        <label class="flex flex-col text-xs text-muted">witness a
          <input value={aText} onInput={(e) => setAText((e.target as HTMLInputElement).value)} class="w-24 rounded-lg border border-border bg-surface-2 px-2 py-1 font-mono text-sm text-text" />
        </label>
        <button onClick={load} class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Load</button>
      </div>

      <div class="mb-2 flex flex-wrap gap-2 font-mono text-sm">
        <span class="rounded-md bg-surface-2 px-2 py-1">n = {meta.n}</span>
        <span class="rounded-md bg-surface-2 px-2 py-1">n-1 = 2^{data.s} x {data.d}</span>
        <span class="rounded-md bg-surface-2 px-2 py-1">target n-1 = {meta.n - 1}</span>
      </div>

      <div class="flex flex-wrap items-end gap-1.5 font-mono text-sm">
        {data.cells.map((c, i) => {
          const shown = i <= frame.reveal;
          const isCur = i === frame.reveal;
          const color = done && isCur ? (frame.status === 'prime' ? COLORS.prime : frame.status === 'composite' ? COLORS.composite : COLORS.cur) : isCur ? COLORS.cur : '';
          return (
            <div key={i} class="flex flex-col items-center">
              <span class="text-[10px] text-muted">{c.label}</span>
              <span class={`min-w-[3rem] rounded-md border px-2 py-1.5 text-center ${shown ? 'border-transparent text-white' : 'border-border bg-surface-2 text-muted opacity-40'}`} style={shown && color ? `background:${color}` : shown ? 'background:rgba(128,128,128,0.4)' : ''}>{shown ? c.val : '?'}</span>
            </div>
          );
        })}
      </div>

      <p class="mt-3 min-h-[3rem] rounded-lg bg-surface-2 px-3 py-2 text-sm">{frame.note}</p>
      {done && (
        <p class="mt-2 rounded-lg px-3 py-2 text-sm font-semibold text-white" style={`background:${frame.status === 'composite' ? COLORS.composite : COLORS.prime}`}>
          {frame.status === 'composite' ? `Verdict: ${meta.n} is COMPOSITE (a = ${meta.a} proved it).` : `Verdict: ${meta.n} is probably prime for witness ${meta.a}. Try more witnesses to raise confidence.`}
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
      <p class="mt-2 text-center text-xs text-muted">Try n = 561 with a = 2 (a Carmichael number that fools the Fermat test but not this one), then a = 5.</p>
    </div>
  );
}
