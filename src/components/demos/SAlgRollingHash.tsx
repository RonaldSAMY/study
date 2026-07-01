import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated Rabin-Karp rolling hash.
   - Edit text + pattern. A window of length m slides across the text.
   - Each frame shows the window's rolling hash, the roll operation that
     produced it (drop the left char, add the right char), and whether
     the hash equals the pattern hash. On a hash hit we VERIFY the chars.
   - Small base/mod keep the numbers readable.
   - Transport: Play / Pause / Step / Back / Reset + speed.
   ------------------------------------------------------------------ */

const BASE = 31;
const MOD = 1009;
const COLORS = { win: '#0ea5e9', match: '#10b981', bad: '#e11d48' };

const hashOf = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * BASE + s.charCodeAt(i)) % MOD; return h; };
const modPow = (b: number, e: number, m: number) => { let r = 1; b %= m; while (e > 0) { if (e & 1) r = (r * b) % m; e = Math.floor(e / 2); b = (b * b) % m; } return r; };

type Frame = { i: number; wh: number; kind: 'none' | 'spurious' | 'match'; roll: { left: string; right: string } | null };

function computeFrames(text: string, pattern: string): { frames: Frame[]; ph: number } {
  const n = text.length, m = pattern.length;
  const ph = hashOf(pattern);
  const frames: Frame[] = [];
  if (m === 0 || m > n) return { frames, ph };
  let wh = hashOf(text.slice(0, m));
  const high = modPow(BASE, m - 1, MOD);
  for (let i = 0; i <= n - m; i++) {
    const hashEq = wh === ph;
    const strEq = text.slice(i, i + m) === pattern;
    frames.push({ i, wh, kind: hashEq ? (strEq ? 'match' : 'spurious') : 'none', roll: i > 0 ? { left: text[i - 1], right: text[i + m - 1] } : null });
    if (i < n - m) {
      const l = text.charCodeAt(i), r = text.charCodeAt(i + m);
      wh = wh - (l * high) % MOD;
      wh = ((wh % MOD) + MOD) % MOD;
      wh = (wh * BASE + r) % MOD;
    }
  }
  return { frames, ph };
}

const clean = (s: string) => s.replace(/\s+/g, '').slice(0, 28);

export default function SAlgRollingHash() {
  const [textIn, setTextIn] = useState('abracadabra');
  const [patIn, setPatIn] = useState('abra');
  const [text, setText] = useState('abracadabra');
  const [pattern, setPattern] = useState('abra');
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);
  idxRef.current = idx;

  const { frames, ph } = computeFrames(text, pattern);
  const m = pattern.length;
  const commit = () => { const t = clean(textIn), p = clean(patIn); if (t.length && p.length && p.length <= t.length) { setText(t); setPattern(p); setIdx(0); setPlaying(false); } };

  useEffect(() => {
    if (!playing || frames.length === 0) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 950 / speed;
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
  }, [playing, speed, text, pattern]);

  const reset = () => { setPlaying(false); setIdx(0); lastRef.current = 0; };
  const stepF = () => { setPlaying(false); setIdx((v) => Math.min(frames.length - 1, v + 1)); };
  const stepB = () => { setPlaying(false); setIdx((v) => Math.max(0, v - 1)); };
  const play = () => { if (idx >= frames.length - 1) setIdx(0); lastRef.current = 0; setPlaying((p) => !p); };

  const f = frames.length ? frames[Math.min(idx, frames.length - 1)] : null;
  const done = idx >= frames.length - 1;
  const matches = frames.filter((fr) => fr.kind === 'match').map((fr) => fr.i);

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <input value={textIn} onInput={(e) => setTextIn((e.target as HTMLInputElement).value)} class="min-w-[10rem] flex-1 rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm" placeholder="text" />
        <input value={patIn} onInput={(e) => setPatIn((e.target as HTMLInputElement).value)} class="w-28 rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm" placeholder="pattern" />
        <button onClick={commit} class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Load</button>
      </div>

      <div class="mb-1 text-xs text-muted">pattern hash = <span class="font-mono font-bold text-text">{ph}</span></div>
      {/* text row with sliding window */}
      <div class="flex flex-wrap gap-1 font-mono text-sm">
        {text.split('').map((ch, j) => {
          const inWin = f != null && j >= f.i && j < f.i + m;
          const bg = inWin ? (f!.kind === 'match' ? COLORS.match : f!.kind === 'spurious' ? COLORS.bad : COLORS.win) : '';
          return <div key={j} class={`flex h-9 w-8 items-center justify-center rounded-md border font-bold transition ${inWin ? 'border-transparent text-white' : 'border-border bg-surface-2 text-text'}`} style={bg ? `background:${bg}` : ''}>{ch}</div>;
        })}
      </div>

      {f && (
        <div class="mt-3 flex flex-wrap items-center gap-3 font-mono text-sm">
          <span class="rounded-lg bg-surface-2 px-3 py-1.5">window hash = <span class="font-bold" style={`color:${COLORS.win}`}>{f.wh}</span></span>
          <span class={`rounded-lg px-3 py-1.5 font-semibold ${f.kind === 'match' ? 'bg-brand-soft text-text' : 'bg-surface-2 text-muted'}`}>
            {f.wh === ph ? `hash hit → verify → ${f.kind === 'match' ? 'MATCH' : 'spurious (chars differ)'}` : 'no hash hit → skip'}
          </span>
        </div>
      )}

      <p class="mt-3 min-h-[2.5rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">
        {f == null ? 'Pattern is empty or longer than the text.' : f.roll == null
          ? `Window 0: hash the first ${m} characters directly.`
          : `Roll: drop '${f.roll.left}', add '${f.roll.right}' — one O(1) update turns the old hash into the new one.`}
      </p>
      {done && frames.length > 0 && <p class="mt-2 rounded-lg bg-brand-soft px-3 py-2 text-sm font-semibold text-text">Done. Matches at {matches.length ? matches.join(', ') : '(none)'}. Every hash hit was re-checked character by character.</p>}

      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={stepB} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏮ Back</button>
        <button onClick={play} class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90">{playing ? '⏸ Pause' : '▶ Play'}</button>
        <button onClick={stepF} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏭ Step</button>
        <button onClick={reset} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">↺ Reset</button>
        <label class="ml-auto flex items-center gap-2 text-xs text-muted">speed
          <input type="range" min={0.5} max={3} step={0.5} value={speed} onInput={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))} class="w-24 accent-[#4f46e5]" />
        </label>
      </div>
      <p class="mt-2 text-center text-xs text-muted">Blue = hash miss, red = spurious hit (hashes agree but strings differ), emerald = verified match. Base {BASE}, mod {MOD}.</p>
    </div>
  );
}
