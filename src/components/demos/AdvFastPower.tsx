import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated "fast math building blocks".
   - "Fast power": compute base^exp mod m by binary exponentiation. Each
     step consumes one bit of exp: if the bit is 1 we fold base into the
     result; either way we square base and halve exp. The exponent's bits
     light up as they are read, with a running result.
   - "GCD (Euclid)": run the Euclidean algorithm, each step replacing
     (a, b) with (b, a mod b) until b hits 0.
   - Transport: Play / Pause / Step / Back / Reset + speed.
   ------------------------------------------------------------------ */

type Mode = 'pow' | 'gcd';
const COLORS = { hit: '#10b981', cur: '#0ea5e9', acc: '#4f46e5' };
const clampInt = (s: string, lo: number, hi: number, dflt: number): number => {
  const v = parseInt(s.trim(), 10);
  return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : dflt;
};

type PowStep = { bit: number; resultBefore: number; baseBefore: number; expBefore: number; resultAfter: number; baseAfter: number };
function powFrames(base0: number, exp0: number, m: number): PowStep[] {
  const out: PowStep[] = [];
  let result = 1 % m, base = base0 % m, exp = exp0;
  while (exp > 0) {
    const bit = exp & 1;
    const rb = result, bb = base, eb = exp;
    if (bit === 1) result = (result * base) % m;
    base = (base * base) % m;
    exp = Math.floor(exp / 2);
    out.push({ bit, resultBefore: rb, baseBefore: bb, expBefore: eb, resultAfter: result, baseAfter: base });
  }
  return out;
}

type GcdStep = { a: number; b: number; q: number; r: number };
function gcdFrames(a0: number, b0: number): GcdStep[] {
  const out: GcdStep[] = [];
  let a = Math.abs(a0), b = Math.abs(b0);
  while (b !== 0) {
    const q = Math.floor(a / b), r = a % b;
    out.push({ a, b, q, r });
    a = b; b = r;
  }
  return out;
}

export default function AdvFastPower() {
  const [mode, setMode] = useState<Mode>('pow');
  const [baseT, setBaseT] = useState('3');
  const [expT, setExpT] = useState('13');
  const [modT, setModT] = useState('7');
  const [aT, setAT] = useState('48');
  const [bT, setBT] = useState('18');
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);
  idxRef.current = idx;

  const base = clampInt(baseT, 0, 999, 3);
  const exp = clampInt(expT, 0, 4095, 13);
  const m = Math.max(2, clampInt(modT, 2, 100000, 7));
  const a = clampInt(aT, 1, 100000, 48);
  const b = clampInt(bT, 1, 100000, 18);

  const pf = powFrames(base, exp, m);
  const gf = gcdFrames(a, b);
  const frames = mode === 'pow' ? pf.length : gf.length;

  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 950 / speed;
    const tick = (t: number) => {
      if (!lastRef.current) lastRef.current = t;
      if (t - lastRef.current >= interval) {
        lastRef.current = t;
        const next = idxRef.current + 1;
        if (next > frames) { setIdx(frames); setPlaying(false); return; }
        setIdx(next);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
  }, [playing, speed, frames]);

  const reset = () => { setPlaying(false); setIdx(0); lastRef.current = 0; };
  const stepF = () => { setPlaying(false); setIdx((v) => Math.min(frames, v + 1)); };
  const stepB = () => { setPlaying(false); setIdx((v) => Math.max(0, v - 1)); };
  const play = () => { if (idx >= frames) setIdx(0); lastRef.current = 0; setPlaying((p) => !p); };
  const switchMode = (mm: Mode) => { setMode(mm); setIdx(0); setPlaying(false); };

  // ---- POW rendering ----
  const expBits = exp.toString(2).split('').map(Number); // MSB..LSB
  const nbits = expBits.length;
  // bit position consumed at step k (0-based) is the LSB-first index k
  const result = idx === 0 ? 1 % m : pf[idx - 1].resultAfter;
  const powCaption = idx === 0
    ? `${base}^${exp} mod ${m}. Read ${exp} in binary (${exp.toString(2)}) from the right. Press Play.`
    : (() => {
        const s = pf[idx - 1];
        const lsbIndex = idx - 1; // which bit from the right
        return s.bit === 1
          ? `bit ${lsbIndex} is 1 -> fold this power in: result ${s.resultBefore} * ${s.baseBefore} = ${s.resultAfter} (mod ${m}). Then square base -> ${s.baseAfter}.`
          : `bit ${lsbIndex} is 0 -> skip the multiply. Just square base ${s.baseBefore} -> ${s.baseAfter} (mod ${m}).`;
      })();

  // ---- GCD rendering ----
  const gcdResult = gf.length ? gf[gf.length - 1].b : Math.max(a, b);
  const gcdCaption = idx === 0
    ? `gcd(${a}, ${b}). Repeatedly replace (a, b) with (b, a mod b) until b = 0. Press Play.`
    : (() => {
        const s = gf[idx - 1];
        return `${s.a} = ${s.b} × ${s.q} + ${s.r}  ->  gcd(${s.a}, ${s.b}) = gcd(${s.b}, ${s.r}).${s.r === 0 ? ` Remainder 0, so the answer is ${s.b}.` : ''}`;
      })();

  const done = idx >= frames && frames > 0;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex gap-1">
        {(['pow', 'gcd'] as Mode[]).map((mm) => (
          <button key={mm} onClick={() => switchMode(mm)} class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${mode === mm ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'}`}>
            {mm === 'pow' ? 'Fast power (modPow)' : 'GCD (Euclid)'}
          </button>
        ))}
      </div>

      {mode === 'pow' ? (
        <div class="mb-3 flex flex-wrap items-center gap-2 text-sm">
          <NumberBox label="base" value={baseT} onInput={(v) => { setBaseT(v); setIdx(0); setPlaying(false); }} />
          <NumberBox label="exp" value={expT} onInput={(v) => { setExpT(v); setIdx(0); setPlaying(false); }} />
          <NumberBox label="mod" value={modT} onInput={(v) => { setModT(v); setIdx(0); setPlaying(false); }} />
        </div>
      ) : (
        <div class="mb-3 flex flex-wrap items-center gap-2 text-sm">
          <NumberBox label="a" value={aT} onInput={(v) => { setAT(v); setIdx(0); setPlaying(false); }} />
          <NumberBox label="b" value={bT} onInput={(v) => { setBT(v); setIdx(0); setPlaying(false); }} />
        </div>
      )}

      {mode === 'pow' ? (
        <div class="space-y-3">
          {/* exponent bits, LSB on the right; bits consumed so far are dimmed/marked */}
          <div class="flex items-center gap-2 font-mono text-sm">
            <span class="w-12 shrink-0 text-muted">exp</span>
            <div class="flex gap-1">
              {expBits.map((bit, i) => {
                const lsbIndex = nbits - 1 - i; // from the right
                const consumed = lsbIndex < idx;
                const isCur = lsbIndex === idx - 1;
                return (
                  <div key={i} class={`flex h-9 w-9 items-center justify-center rounded-md border text-base font-bold ${isCur ? 'border-transparent text-white' : consumed ? 'border-transparent text-white' : 'border-border bg-surface-2 text-muted'}`} style={isCur ? `background:${COLORS.cur}` : consumed ? (bit ? `background:${COLORS.hit}` : 'background:rgba(148,163,184,0.5)') : ''}>{bit}</div>
                );
              })}
            </div>
          </div>
          <div class="flex flex-wrap gap-2 font-mono text-sm">
            <Stat label="result" value={result} color={COLORS.acc} />
            <Stat label="base (mod)" value={idx === 0 ? base % m : pf[idx - 1].baseAfter} color={COLORS.hit} />
            <Stat label="steps" value={`${idx} / ${pf.length}`} />
          </div>
          <p class="min-h-[3rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">{powCaption}</p>
          {done && <p class="rounded-lg bg-brand-soft px-3 py-2 text-sm font-semibold text-text">{base}^{exp} mod {m} = {result}, in just {pf.length} step{pf.length === 1 ? '' : 's'} — about log₂({exp}) instead of {exp} multiplications.</p>}
        </div>
      ) : (
        <div class="space-y-3">
          <div class="flex flex-wrap gap-2 font-mono text-sm">
            <Stat label="current a" value={idx === 0 ? a : (idx > gf.length ? gf[gf.length - 1].b : gf[Math.min(idx, gf.length) - 1].a)} color={COLORS.acc} />
            <Stat label="current b" value={idx === 0 ? b : gf[Math.min(idx, gf.length) - 1].b} color={COLORS.cur} />
            <Stat label="steps" value={`${idx} / ${gf.length}`} />
          </div>
          <div class="overflow-hidden rounded-lg border border-border font-mono text-xs">
            {gf.map((s, i) => (
              <div key={i} class={`flex gap-3 px-3 py-1.5 ${i < idx ? 'bg-surface-2 text-text' : 'text-muted'} ${i === idx - 1 ? 'font-bold' : ''}`} style={i === idx - 1 ? `box-shadow: inset 3px 0 0 ${COLORS.cur}` : ''}>
                <span>{s.a} = {s.b} × {s.q} + {s.r}</span>
              </div>
            ))}
          </div>
          <p class="min-h-[3rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">{gcdCaption}</p>
          {done && <p class="rounded-lg bg-brand-soft px-3 py-2 text-sm font-semibold text-text">gcd({a}, {b}) = {gcdResult}. Each step shrinks the numbers fast — Euclid runs in O(log min(a, b)).</p>}
        </div>
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
    </div>
  );
}

function NumberBox({ label, value, onInput }: { label: string; value: string; onInput: (v: string) => void }) {
  return (
    <label class="flex items-center gap-1.5 text-muted">
      {label}
      <input value={value} onInput={(e) => onInput((e.target as HTMLInputElement).value)} class="w-20 rounded-lg border border-border bg-surface-2 px-2 py-1 font-mono text-text" inputMode="numeric" />
    </label>
  );
}

function Stat({ label, value, color }: { label: string; value: number | string; color?: string }) {
  return (
    <div class="rounded-lg bg-surface-2 px-3 py-2">
      <div class="text-[11px] text-muted">{label}</div>
      <div class="font-bold" style={color ? `color:${color}` : ''}>{value}</div>
    </div>
  );
}
