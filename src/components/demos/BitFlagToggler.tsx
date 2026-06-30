import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated bit-flags / bitmask panel (a permission set packed into one
   integer).
   - Eight NAMED flags live in one number. Click a flag cell to flip it
     directly, or run an operation (grant / revoke / toggle / check)
     against a chosen flag and watch the mask combine column by column.
   - grant = OR mask, revoke = AND ~mask, toggle = XOR mask, check = AND.
     grant/revoke/toggle COMMIT the result back into the stored value;
     check just reports whether the bit is set.
   - Transport: Play / Pause / Step / Step-back / Reset + speed.
   ------------------------------------------------------------------ */

const FLAGS = ['READ', 'WRITE', 'EXEC', 'DELETE', 'SHARE', 'ADMIN', 'AUDIT', 'SYNC'];
const WIDTH = FLAGS.length; // 8, position 0 = READ (rightmost)
const COLORS = { v: '#4f46e5', mask: '#0ea5e9', result: '#10b981' };

const toBits = (n: number): number[] => { const o: number[] = []; for (let p = WIDTH - 1; p >= 0; p--) o.push((n >> p) & 1); return o; };
const val = (bits: (number | null)[]): number => bits.reduce((a: number, b, i) => a | (((b ?? 0) as number) << (WIDTH - 1 - i)), 0);
const posToIdx = (p: number) => WIDTH - 1 - p;

type Op = 'grant' | 'revoke' | 'toggle' | 'check';

export default function BitFlagToggler() {
  const [value, setValue] = useState(0b00000101); // READ + EXEC
  const [op, setOp] = useState<Op>('grant');
  const [target, setTarget] = useState(1); // WRITE
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [committedNote, setCommittedNote] = useState('');
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);
  idxRef.current = idx;

  const maskVal = op === 'revoke' ? (~(1 << target) & 0xff) : (1 << target);
  const opLabel = op === 'grant' ? 'OR' : op === 'toggle' ? 'XOR' : 'AND';
  const apply = (x: number, m: number): number => (op === 'grant' ? x | m : op === 'toggle' ? x ^ m : x & m);
  const maskLabel = op === 'revoke' ? `~(1<<${target})` : `1<<${target}`;

  const vBits = toBits(value);
  const mBits = toBits(maskVal);

  // frames: column by column AND/OR/XOR of value & mask
  const frames = (() => {
    const res: (number | null)[] = new Array(WIDTH).fill(null);
    const list: { col: number; result: (number | null)[]; caption: string }[] = [];
    for (let k = 0; k < WIDTH; k++) {
      const ix = WIDTH - 1 - k;
      const r = apply(vBits[ix], mBits[ix]) & 1;
      res[ix] = r;
      list.push({ col: ix, result: [...res], caption: `${FLAGS[k]} (bit ${k}): ${vBits[ix]} ${opLabel} ${mBits[ix]} -> ${r}` });
    }
    return list;
  })();

  useEffect(() => { setIdx(0); setPlaying(false); }, [value, op, target]);

  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 720 / speed;
    const tick = (t: number) => {
      if (!lastRef.current) lastRef.current = t;
      if (t - lastRef.current >= interval) {
        lastRef.current = t;
        const next = idxRef.current + 1;
        if (next >= frames.length) { setIdx(frames.length); setPlaying(false); commit(); return; }
        setIdx(next);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
  }, [playing, speed, frames]);

  const resultVal = val(frames[frames.length - 1].result);
  const commit = () => {
    if (op === 'check') { setCommittedNote(`${FLAGS[target]} is ${(value >> target) & 1 ? 'ENABLED' : 'disabled'} (AND result ${(value & (1 << target)) !== 0 ? 'non-zero' : 'zero'}).`); return; }
    setCommittedNote(`${op === 'grant' ? 'Granted' : op === 'revoke' ? 'Revoked' : 'Toggled'} ${FLAGS[target]} — stored value is now ${resultVal}.`);
    setValue(resultVal);
  };

  const reset = () => { setPlaying(false); setIdx(0); lastRef.current = 0; setCommittedNote(''); };
  const stepF = () => { setPlaying(false); setIdx((v) => { const nv = Math.min(frames.length, v + 1); if (nv === frames.length) commit(); return nv; }); };
  const stepB = () => { setPlaying(false); setCommittedNote(''); setIdx((v) => Math.max(0, v - 1)); };
  const play = () => { if (idx >= frames.length) { setIdx(0); setCommittedNote(''); } lastRef.current = 0; setPlaying((p) => !p); };

  const activeCol = idx > 0 && idx <= frames.length ? frames[idx - 1].col : -1;
  const resultBits = idx === 0 ? new Array(WIDTH).fill(null) : frames[Math.min(idx, frames.length) - 1].result;
  const caption = idx === 0 ? 'Choose an operation and a flag, then Play to combine the value with the mask.' : frames[Math.min(idx, frames.length) - 1].caption;

  const flipFlag = (k: number) => { setValue((v) => v ^ (1 << (WIDTH - 1 - k))); };

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        {(['grant', 'revoke', 'toggle', 'check'] as Op[]).map((o) => (
          <button key={o} onClick={() => setOp(o)} class={`rounded-lg px-3 py-1.5 text-sm font-semibold capitalize transition ${op === o ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'}`}>{o}</button>
        ))}
        <select value={target} onInput={(e) => setTarget(parseInt((e.target as HTMLSelectElement).value))} class="ml-auto rounded-lg border border-border bg-surface-2 px-2 py-1.5 text-sm">
          {FLAGS.map((f, p) => <option key={p} value={p}>{f}</option>)}
        </select>
      </div>

      {/* flag names */}
      <div class="flex items-center gap-2 font-mono text-[10px] text-muted">
        <span class="w-5 shrink-0" />
        <div class="flex gap-1">{Array.from({ length: WIDTH }, (_, k) => FLAGS[WIDTH - 1 - k]).map((f, k) => <span key={k} class="w-9 text-center">{f.slice(0, 4)}</span>)}</div>
      </div>

      <div class="mt-1 space-y-2 font-mono text-sm">
        <Row label="v" color={COLORS.v} bits={vBits} active={-1} editable onFlip={flipFlag} />
        <Row label="m" color={COLORS.mask} bits={mBits} active={-1} sub={maskLabel} />
        <div class="my-1 h-px bg-border" />
        <Row label="=" color={COLORS.result} bits={resultBits} active={activeCol} />
      </div>

      <p class="mt-3 min-h-[2.5rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">{caption}</p>
      {committedNote && <p class="mt-2 rounded-lg bg-brand-soft px-3 py-2 text-sm font-semibold text-text">{committedNote}</p>}

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
        <Readout label="value" value={`${value}`} />
        <Readout label="binary" value={value.toString(2).padStart(WIDTH, '0')} />
        <Readout label="enabled" value={`${FLAGS.filter((_, p) => (value >> p) & 1).length}`} />
      </div>
      <p class="mt-2 text-center text-xs text-muted">Tip: one integer stores all eight flags — click a cell to flip a flag directly.</p>
    </div>
  );
}

function Row({ label, color, bits, active, editable, onFlip, sub }: { label: string; color: string; bits: (number | null)[]; active: number; editable?: boolean; onFlip?: (i: number) => void; sub?: string }) {
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
      {sub && <span class="ml-2 text-xs text-muted">{sub}</span>}
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
