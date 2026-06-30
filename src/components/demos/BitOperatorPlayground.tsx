import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated bitwise-operator playground.
   - Two 8-bit numbers shown as ROWS OF TOGGLEABLE BIT CELLS (click a
     cell to flip it).
   - Pick an operator (AND / OR / XOR / NOT / << / >>). The operation is
     animated COLUMN BY COLUMN: the active column is highlighted, a live
     caption explains it ("bit 3: 1 AND 0 -> 0"), and the result row
     fills in one bit at a time.
   - Full transport: Play, Pause, Step, Step-back, Reset + speed slider.
   ------------------------------------------------------------------ */

const WIDTH = 8; // 8-bit demo for readability
const COLORS = { a: '#4f46e5', b: '#0ea5e9', result: '#10b981' };

type Op = 'AND' | 'OR' | 'XOR' | 'NOT' | 'SHL' | 'SHR';

// positions are MSB..LSB, i.e. index 0 is bit 7 (leftmost), index 7 is bit 0
const toBits = (n: number): number[] => {
  const out: number[] = [];
  for (let p = WIDTH - 1; p >= 0; p--) out.push((n >> p) & 1);
  return out;
};
const fromBits = (bits: number[]): number => bits.reduce((acc, b, i) => acc | (b << (WIDTH - 1 - i)), 0);

type Frame = { col: number; result: (number | null)[]; caption: string };

function buildFrames(a: number[], b: number[], op: Op): Frame[] {
  const frames: Frame[] = [];
  const res: (number | null)[] = new Array(WIDTH).fill(null);
  // we animate LSB -> MSB so the highlight moves right-to-left like arithmetic
  for (let k = 0; k < WIDTH; k++) {
    const idx = WIDTH - 1 - k; // array index of the bit at position k
    const pos = k; // bit position value (0 = ones place)
    const ab = a[idx];
    const bb = b[idx];
    let r = 0;
    let caption = '';
    if (op === 'AND') { r = ab & bb; caption = `bit ${pos}: ${ab} AND ${bb} -> ${r}  (1 only if BOTH are 1)`; }
    else if (op === 'OR') { r = ab | bb; caption = `bit ${pos}: ${ab} OR ${bb} -> ${r}  (1 if EITHER is 1)`; }
    else if (op === 'XOR') { r = ab ^ bb; caption = `bit ${pos}: ${ab} XOR ${bb} -> ${r}  (1 if they DIFFER)`; }
    else if (op === 'NOT') { r = ab ^ 1; caption = `bit ${pos}: NOT ${ab} -> ${r}  (every bit flips)`; }
    else if (op === 'SHL') { const src = a[idx + 1] ?? 0; r = pos === 0 ? 0 : src; caption = pos === 0 ? `bit 0 <- 0  (a 0 slides in on the right)` : `bit ${pos} <- old bit ${pos - 1} = ${r}  (everything moves up one)`; }
    else { const src = a[idx - 1] ?? 0; r = pos === WIDTH - 1 ? 0 : src; caption = pos === WIDTH - 1 ? `bit ${pos} <- 0  (0 fills the top)` : `bit ${pos} <- old bit ${pos + 1} = ${r}  (everything moves down one)`; }
    res[idx] = r;
    frames.push({ col: idx, result: [...res], caption });
  }
  return frames;
}

export default function BitOperatorPlayground() {
  const [a, setA] = useState<number[]>(toBits(0b00001101)); // 13
  const [b, setB] = useState<number[]>(toBits(0b00001011)); // 11
  const [op, setOp] = useState<Op>('AND');
  const [frames, setFrames] = useState<Frame[]>(() => buildFrames(toBits(13), toBits(11), 'AND'));
  const [idx, setIdx] = useState(0); // 0..frames.length (0 = nothing revealed)
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);
  idxRef.current = idx;

  const single = op === 'NOT' || op === 'SHL' || op === 'SHR';

  // rebuild frames whenever inputs / op change
  useEffect(() => {
    setFrames(buildFrames(a, b, op));
    setIdx(0);
    setPlaying(false);
  }, [a, b, op]);

  // autoplay loop (raf, always cancelled on cleanup/pause)
  useEffect(() => {
    if (!playing) {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      return;
    }
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
  const stepF = () => { setPlaying(false); setIdx((i) => Math.min(frames.length, i + 1)); };
  const stepB = () => { setPlaying(false); setIdx((i) => Math.max(0, i - 1)); };
  const play = () => { if (idx >= frames.length) setIdx(0); lastRef.current = 0; setPlaying((p) => !p); };

  const flip = (which: 'a' | 'b', i: number) => {
    const set = which === 'a' ? setA : setB;
    const arr = which === 'a' ? a : b;
    const copy = [...arr];
    copy[i] = copy[i] ^ 1;
    set(copy);
  };

  const revealed = idx; // number of result bits shown
  const activeCol = idx > 0 && idx <= frames.length ? frames[idx - 1].col : -1;
  const resultBits = idx === 0 ? new Array(WIDTH).fill(null) : frames[Math.min(idx, frames.length) - 1].result;
  const caption = idx === 0 ? 'Press Play (or Step) to apply the operator bit by bit.' : frames[Math.min(idx, frames.length) - 1].caption;
  const aVal = fromBits(a);
  const bVal = fromBits(b);
  const finalVal = idx >= frames.length ? fromBits(resultBits.map((x) => x ?? 0)) : null;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        {(['AND', 'OR', 'XOR', 'NOT', 'SHL', 'SHR'] as Op[]).map((o) => (
          <button
            key={o}
            onClick={() => setOp(o)}
            class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${op === o ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'}`}
          >
            {o === 'SHL' ? 'a << 1' : o === 'SHR' ? 'a >> 1' : o === 'NOT' ? '~a' : `a ${o} b`}
          </button>
        ))}
      </div>

      <div class="space-y-2 font-mono text-sm">
        <BitRow label="a" color={COLORS.a} bits={a} active={-1} editable onFlip={(i) => flip('a', i)} />
        {!single && <BitRow label="b" color={COLORS.b} bits={b} active={-1} editable onFlip={(i) => flip('b', i)} />}
        <div class="my-1 h-px bg-border" />
        <BitRow label="=" color={COLORS.result} bits={resultBits} active={activeCol} />
      </div>

      <p class="mt-3 min-h-[2.5rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">{caption}</p>

      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={stepB} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏮ Back</button>
        <button onClick={play} class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90">{playing ? '⏸ Pause' : '▶ Play'}</button>
        <button onClick={stepF} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏭ Step</button>
        <button onClick={reset} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">↺ Reset</button>
        <label class="ml-auto flex items-center gap-2 text-xs text-muted">
          speed
          <input type="range" min={0.5} max={3} step={0.5} value={speed} onInput={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))} class="w-24 accent-[#4f46e5]" />
        </label>
      </div>

      <div class="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
        <Readout label="a" value={`${aVal}`} />
        {!single ? <Readout label="b" value={`${bVal}`} /> : <Readout label="op" value={op === 'NOT' ? '~a (8-bit)' : op === 'SHL' ? 'a<<1' : 'a>>1'} />}
        <Readout label="result" value={finalVal != null ? `${finalVal}` : '…'} />
      </div>
      <p class="mt-2 text-center text-xs text-muted">Tip: click any bit cell in the <span style={`color:${COLORS.a}`}>a</span>{!single && <> or <span style={`color:${COLORS.b}`}>b</span></>} row to flip it, then replay.</p>
    </div>
  );
}

function BitRow({ label, color, bits, active, editable, onFlip }: { label: string; color: string; bits: (number | null)[]; active: number; editable?: boolean; onFlip?: (i: number) => void }) {
  return (
    <div class="flex items-center gap-2">
      <span class="w-5 shrink-0 font-bold" style={`color:${color}`}>{label}</span>
      <div class="flex gap-1">
        {bits.map((bit, i) => {
          const isActive = i === active;
          const base = 'flex h-9 w-9 items-center justify-center rounded-md border text-base font-bold transition';
          const filled = bit === 1;
          const style = bit === null
            ? 'border-dashed border-border text-muted'
            : filled
              ? 'border-transparent text-white'
              : 'border-border bg-surface-2 text-muted';
          return (
            <button
              key={i}
              disabled={!editable}
              onClick={() => editable && onFlip && onFlip(i)}
              class={`${base} ${style} ${isActive ? 'ring-2 ring-offset-1 ring-[#10b981] scale-110' : ''} ${editable ? 'cursor-pointer hover:brightness-110' : 'cursor-default'}`}
              style={filled && bit !== null ? `background:${color}` : ''}
            >
              {bit === null ? '·' : bit}
            </button>
          );
        })}
      </div>
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
