import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated entropy + run-length view of a string.
   - Edit the text. The demo scans it left to right, grouping runs of
     the SAME character (run-length encoding). Each run becomes one
     token (char, count), so long runs collapse to 2 bytes.
   - A live readout compares the RLE size against the ENTROPY FLOOR:
     the theoretical minimum bits per symbol H = -sum p log2 p.
   - Transport: Play / Pause / Step / Back / Reset + speed.
   ------------------------------------------------------------------ */

const COLORS = { run: '#0ea5e9', done: '#10b981', floor: '#4f46e5' };

type Run = { ch: string; count: number; start: number };

// group consecutive equal characters into runs
function toRuns(s: string): Run[] {
  const runs: Run[] = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    let j = i;
    while (j < s.length && s[j] === ch) j++;
    runs.push({ ch, count: j - i, start: i });
    i = j;
  }
  return runs;
}

// Shannon entropy in bits/symbol and the ideal compressed size in bytes
function entropy(s: string): { bits: number; idealBytes: number; freq: Map<string, number> } {
  const freq = new Map<string, number>();
  for (const ch of s) freq.set(ch, (freq.get(ch) ?? 0) + 1);
  const n = s.length || 1;
  let bits = 0;
  for (const c of freq.values()) {
    const p = c / n;
    bits -= p * Math.log2(p);
  }
  return { bits, idealBytes: Math.ceil((n * bits) / 8), freq };
}

export default function CompEntropyExplorer() {
  const [text, setText] = useState('aaaaaaaabbbbccccccccddddd');
  const [runs, setRuns] = useState<Run[]>(() => toRuns('aaaaaaaabbbbccccccccddddd'));
  const [idx, setIdx] = useState(0); // 0..runs.length (# runs revealed)
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);
  idxRef.current = idx;

  const chars = [...runs.flatMap((r) => Array.from({ length: r.count }, () => r.ch))];
  const original = chars.length;
  const info = entropy(chars.join(''));

  const commit = () => {
    const t = text.slice(0, 60);
    if (t.length) { setRuns(toRuns(t)); setIdx(0); setPlaying(false); }
  };

  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 780 / speed;
    const tick = (t: number) => {
      if (!lastRef.current) lastRef.current = t;
      if (t - lastRef.current >= interval) {
        lastRef.current = t;
        const next = idxRef.current + 1;
        if (next > runs.length) { setIdx(runs.length); setPlaying(false); return; }
        setIdx(next);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
  }, [playing, speed, runs]);

  const reset = () => { setPlaying(false); setIdx(0); lastRef.current = 0; };
  const stepF = () => { setPlaying(false); setIdx((v) => Math.min(runs.length, v + 1)); };
  const stepB = () => { setPlaying(false); setIdx((v) => Math.max(0, v - 1)); };
  const play = () => { if (idx >= runs.length) setIdx(0); lastRef.current = 0; setPlaying((p) => !p); };

  const activeRun = idx - 1;
  const coveredChars = runs.slice(0, idx).reduce((a, r) => a + r.count, 0);
  const rleBytes = idx * 2; // each revealed run = (char, count) = 2 bytes
  const rleRatio = coveredChars ? rleBytes / coveredChars : 1;

  const caption = idx === 0
    ? 'Press Play. The scanner groups equal characters into runs; each run becomes one (char, count) token.'
    : `Run ${idx}: '${runs[activeRun].ch}' repeated ${runs[activeRun].count}x -> token (${runs[activeRun].ch}, ${runs[activeRun].count}) = 2 bytes, replacing ${runs[activeRun].count} bytes.`;

  const done = idx >= runs.length && runs.length > 0;
  const maxFreq = Math.max(1, ...info.freq.values());

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <input value={text} onInput={(e) => setText((e.target as HTMLInputElement).value)} class="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm" placeholder="type text with repeats" />
        <button onClick={commit} class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Load</button>
      </div>

      {/* character strip */}
      <div class="flex flex-wrap gap-1 font-mono text-sm">
        {chars.map((ch, i) => {
          const inActive = activeRun >= 0 && i >= runs[activeRun].start && i < runs[activeRun].start + runs[activeRun].count;
          const covered = i < coveredChars && !inActive;
          return (
            <span key={i} class={`flex h-8 w-6 items-center justify-center rounded border transition ${inActive ? 'scale-110 border-transparent text-white' : covered ? 'border-transparent text-white' : 'border-border bg-surface-2 text-text'}`} style={inActive ? `background:${COLORS.run}` : covered ? `background:${COLORS.done}` : ''}>{ch === ' ' ? '␣' : ch}</span>
          );
        })}
      </div>

      {/* emitted tokens */}
      <div class="mt-3 flex flex-wrap gap-1.5 font-mono text-xs">
        {runs.slice(0, idx).map((r, i) => (
          <span key={i} class="rounded-md border border-border bg-surface-2 px-2 py-1 text-text">({r.ch === ' ' ? '␣' : r.ch},{r.count})</span>
        ))}
      </div>

      <p class="mt-3 min-h-[2.75rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">{caption}</p>

      {/* live readouts */}
      <div class="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 text-sm">
        <Stat label="original" value={`${coveredChars} B`} />
        <Stat label="RLE size" value={`${rleBytes} B`} color={COLORS.done} />
        <Stat label="RLE ratio" value={rleRatio.toFixed(2)} />
        <Stat label="entropy floor" value={`${info.bits.toFixed(2)} b/sym`} color={COLORS.floor} />
      </div>

      {done && (
        <p class="mt-2 rounded-lg bg-brand-soft px-3 py-2 text-sm text-text">
          RLE squeezed {original} bytes into {rleBytes} bytes. The entropy floor says no lossless coder can beat about {info.idealBytes} bytes for this text — that is the fundamental limit redundancy lets us reach.
        </p>
      )}

      {/* frequency bars */}
      <div class="mt-3 rounded-lg bg-surface-2 p-3">
        <div class="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">symbol frequencies</div>
        <div class="space-y-1">
          {[...info.freq.entries()].sort((a, b) => b[1] - a[1]).map(([ch, c]) => (
            <div key={ch} class="flex items-center gap-2 font-mono text-xs">
              <span class="w-4 text-muted">{ch === ' ' ? '␣' : ch}</span>
              <div class="h-3 rounded" style={`width:${(c / maxFreq) * 70 + 4}%;background:${COLORS.floor}`} />
              <span class="text-muted">{c}</span>
            </div>
          ))}
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
      <p class="mt-2 text-center text-xs text-muted">Tip: long runs (aaaaaa) shrink well; try random text and watch RLE grow past the original — runs alone aren't enough.</p>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div class="rounded-lg bg-surface-2 px-3 py-2">
      <div class="text-xs text-muted">{label}</div>
      <div class="font-mono font-semibold" style={color ? `color:${color}` : ''}>{value}</div>
    </div>
  );
}
