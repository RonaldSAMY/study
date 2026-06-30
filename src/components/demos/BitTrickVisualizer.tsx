import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated "essential bit tricks" visualizer.
   - Type a number n (0-255, shown as 8 toggleable bit cells) and pick a
     trick. Each trick builds a MASK (a second operand) and combines it
     with n one COLUMN AT A TIME.
   - The active column is highlighted, a caption narrates it, and a
     verdict line interprets the finished result (e.g. "all zero -> n is a
     power of two").
   - Transport: Play / Pause / Step / Step-back / Reset + speed.
   ------------------------------------------------------------------ */

const WIDTH = 8;
const COLORS = { n: '#4f46e5', mask: '#0ea5e9', result: '#10b981' };

type Trick = 'get' | 'set' | 'clear' | 'toggle' | 'lowest' | 'power2';

const toBits = (n: number): number[] => {
  const out: number[] = [];
  for (let p = WIDTH - 1; p >= 0; p--) out.push((n >> p) & 1);
  return out;
};
const val = (bits: (number | null)[]): number => bits.reduce((a: number, b, i) => a | (((b ?? 0) as number) << (WIDTH - 1 - i)), 0);

type Plan = { maskLabel: string; mask: number[]; opLabel: string; apply: (x: number, m: number) => number; verdict: (n: number, r: number) => string };

function planFor(trick: Trick, n: number, i: number): Plan {
  const oneShiftI = toBits(1 << i);
  if (trick === 'get') return { maskLabel: `1<<${i}`, mask: oneShiftI, opLabel: 'AND', apply: (x, m) => x & m, verdict: (nn) => `result is ${(nn >> i) & 1 ? 'non-zero' : 'zero'} -> bit ${i} of n is ${(nn >> i) & 1}` };
  if (trick === 'set') return { maskLabel: `1<<${i}`, mask: oneShiftI, opLabel: 'OR', apply: (x, m) => x | m, verdict: () => `bit ${i} is now forced to 1 (other bits untouched)` };
  if (trick === 'clear') return { maskLabel: `~(1<<${i})`, mask: toBits(~(1 << i) & 0xff), opLabel: 'AND', apply: (x, m) => x & m, verdict: () => `bit ${i} is now forced to 0 (other bits untouched)` };
  if (trick === 'toggle') return { maskLabel: `1<<${i}`, mask: oneShiftI, opLabel: 'XOR', apply: (x, m) => x ^ m, verdict: () => `bit ${i} flipped to its opposite` };
  if (trick === 'lowest') return { maskLabel: `-n (two's compl.)`, mask: toBits((256 - n) & 0xff), opLabel: 'AND', apply: (x, m) => x & m, verdict: (nn, r) => nn === 0 ? 'n is 0 -> no set bit to isolate' : `isolates the lowest set bit -> ${r}` };
  return { maskLabel: 'n - 1', mask: toBits((n - 1 + 256) & 0xff), opLabel: 'AND', apply: (x, m) => x & m, verdict: (nn, r) => nn > 0 && r === 0 ? `all zero -> ${nn} IS a power of two` : `${nn} is NOT a power of two` };
}

type Frame = { col: number; result: (number | null)[]; caption: string };

function buildFrames(nBits: number[], plan: Plan): Frame[] {
  const frames: Frame[] = [];
  const res: (number | null)[] = new Array(WIDTH).fill(null);
  for (let k = 0; k < WIDTH; k++) {
    const idx = WIDTH - 1 - k;
    const nb = nBits[idx];
    const mb = plan.mask[idx];
    const r = plan.apply(nb, mb);
    res[idx] = r;
    frames.push({ col: idx, result: [...res], caption: `bit ${k}: ${nb} ${plan.opLabel} ${mb} -> ${r}` });
  }
  return frames;
}

export default function BitTrickVisualizer() {
  const [nBits, setNBits] = useState<number[]>(toBits(12)); // 1100
  const [trick, setTrick] = useState<Trick>('lowest');
  const [i, setI] = useState(2);
  const n = val(nBits);
  const plan = planFor(trick, n, i);
  const [frames, setFrames] = useState<Frame[]>(() => buildFrames(nBits, plan));
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);
  idxRef.current = idx;

  const usesPos = trick === 'get' || trick === 'set' || trick === 'clear' || trick === 'toggle';

  useEffect(() => { setFrames(buildFrames(nBits, plan)); setIdx(0); setPlaying(false); }, [nBits, trick, i]);

  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 760 / speed;
    const tick = (t: number) => {
      if (!lastRef.current) lastRef.current = t;
      if (t - lastRef.current >= interval) {
        lastRef.current = t;
        const next = idxRef.current + 1;
        if (next >= frames.length) { setIdx(frames.length); setPlaying(false); return; }
        setIdx(next);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
  }, [playing, speed, frames]);

  const reset = () => { setPlaying(false); setIdx(0); lastRef.current = 0; };
  const stepF = () => { setPlaying(false); setIdx((v) => Math.min(frames.length, v + 1)); };
  const stepB = () => { setPlaying(false); setIdx((v) => Math.max(0, v - 1)); };
  const play = () => { if (idx >= frames.length) setIdx(0); lastRef.current = 0; setPlaying((p) => !p); };

  const flip = (k: number) => { const c = [...nBits]; c[k] ^= 1; setNBits(c); };

  const activeCol = idx > 0 && idx <= frames.length ? frames[idx - 1].col : -1;
  const resultBits = idx === 0 ? new Array(WIDTH).fill(null) : frames[Math.min(idx, frames.length) - 1].result;
  const done = idx >= frames.length;
  const resultVal = val(resultBits);
  const caption = idx === 0 ? 'Pick a trick, then Play to combine n with its mask.' : frames[Math.min(idx, frames.length) - 1].caption;

  const labels: Record<Trick, string> = { get: 'get bit i', set: 'set bit i', clear: 'clear bit i', toggle: 'toggle bit i', lowest: 'lowest set bit', power2: 'power of two?' };

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        {(Object.keys(labels) as Trick[]).map((t) => (
          <button key={t} onClick={() => setTrick(t)} class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${trick === t ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'}`}>{labels[t]}</button>
        ))}
      </div>

      {usesPos && (
        <label class="mb-3 flex items-center gap-3 text-sm text-muted">
          position i = <strong class="text-text">{i}</strong>
          <input type="range" min={0} max={WIDTH - 1} step={1} value={i} onInput={(e) => setI(parseInt((e.target as HTMLInputElement).value))} class="w-40 accent-[#0ea5e9]" />
        </label>
      )}

      <div class="space-y-2 font-mono text-sm">
        <BitRow label="n" color={COLORS.n} bits={nBits} active={-1} editable onFlip={flip} />
        <BitRow label="m" color={COLORS.mask} bits={plan.mask} active={-1} sub={plan.maskLabel} />
        <div class="my-1 h-px bg-border" />
        <BitRow label="=" color={COLORS.result} bits={resultBits} active={activeCol} />
      </div>

      <p class="mt-3 min-h-[2.5rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">{caption}</p>
      {done && <p class="mt-2 rounded-lg bg-brand-soft px-3 py-2 text-sm font-semibold text-text">{plan.verdict(n, resultVal)}</p>}

      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={stepB} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏮ Back</button>
        <button onClick={play} class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90">{playing ? '⏸ Pause' : '▶ Play'}</button>
        <button onClick={stepF} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏭ Step</button>
        <button onClick={reset} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">↺ Reset</button>
        <label class="ml-auto flex items-center gap-2 text-xs text-muted">speed
          <input type="range" min={0.5} max={3} step={0.5} value={speed} onInput={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))} class="w-24 accent-[#4f46e5]" />
        </label>
      </div>

      <div class="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
        <Readout label="n" value={`${n}`} />
        <Readout label="mask" value={`${val(plan.mask)}`} />
        <Readout label="result" value={done ? `${resultVal}` : '…'} />
      </div>
      <p class="mt-2 text-center text-xs text-muted">Tip: click n's bit cells to change it — the mask rebuilds automatically.</p>
    </div>
  );
}

function BitRow({ label, color, bits, active, editable, onFlip, sub }: { label: string; color: string; bits: (number | null)[]; active: number; editable?: boolean; onFlip?: (i: number) => void; sub?: string }) {
  return (
    <div class="flex items-center gap-2">
      <span class="w-5 shrink-0 font-bold" style={`color:${color}`}>{label}</span>
      <div class="flex gap-1">
        {bits.map((bit, i) => {
          const filled = bit === 1;
          const style = bit === null ? 'border-dashed border-border text-muted' : filled ? 'border-transparent text-white' : 'border-border bg-surface-2 text-muted';
          return (
            <button key={i} disabled={!editable} onClick={() => editable && onFlip && onFlip(i)}
              class={`flex h-9 w-9 items-center justify-center rounded-md border text-base font-bold transition ${style} ${i === active ? 'ring-2 ring-offset-1 ring-[#10b981] scale-110' : ''} ${editable ? 'cursor-pointer hover:brightness-110' : 'cursor-default'}`}
              style={filled && bit !== null ? `background:${color}` : ''}>{bit === null ? '·' : bit}</button>
          );
        })}
      </div>
      {sub && <span class="ml-2 text-xs text-muted">= {sub}</span>}
    </div>
  );
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div class="rounded-lg bg-surface-2 px-2 py-2">
      <div class="text-xs text-muted">{label}</div>
      <div class="font-mono font-semibold">{value}</div>
    </div>
  );
}
