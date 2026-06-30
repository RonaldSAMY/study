import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated anagram check via a single signed tally.
   - Edit two strings. The demo walks index i across BOTH at once:
     count[s[i]]++ and count[t[i]]--. If the strings are anagrams every
     bucket returns to zero; any leftover nonzero bucket proves they are
     not. (LeetCode 242, the O(n) / O(1) array method.)
   - Each frame is a precomputed snapshot of the tally + the two active
     characters, so stepping back/forward is exact.
   - Transport: Play / Pause / Step / Step-back / Reset + speed.
   ------------------------------------------------------------------ */

const COLORS = { plus: '#4f46e5', minus: '#0ea5e9', zero: '#10b981', bad: '#ef4444' };

type Frame = { i: number; counts: Record<string, number>; sc: string; tc: string };

function clean(s: string): string[] {
  return [...s.toLowerCase().replace(/[^a-z]/g, '')].slice(0, 16);
}

function buildFrames(s: string[], t: string[]): { frames: Frame[]; sameLen: boolean } {
  const sameLen = s.length === t.length;
  const frames: Frame[] = [{ i: -1, counts: {}, sc: '', tc: '' }];
  if (!sameLen) return { frames, sameLen };
  const counts: Record<string, number> = {};
  for (let i = 0; i < s.length; i++) {
    counts[s[i]] = (counts[s[i]] || 0) + 1;
    counts[t[i]] = (counts[t[i]] || 0) - 1;
    frames.push({ i, counts: { ...counts }, sc: s[i], tc: t[i] });
  }
  return { frames, sameLen };
}

export default function StrAnagramTally() {
  const [sText, setSText] = useState('listen');
  const [tText, setTText] = useState('silent');
  const [s, setS] = useState<string[]>(() => clean('listen'));
  const [t, setT] = useState<string[]>(() => clean('silent'));
  const [{ frames, sameLen }, setBuilt] = useState(() => buildFrames(clean('listen'), clean('silent')));
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);
  idxRef.current = idx;

  const commit = () => {
    const ns = clean(sText);
    const nt = clean(tText);
    if (ns.length && nt.length) { setS(ns); setT(nt); setBuilt(buildFrames(ns, nt)); setIdx(0); setPlaying(false); }
  };

  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 820 / speed;
    const tick = (ts: number) => {
      if (!lastRef.current) lastRef.current = ts;
      if (ts - lastRef.current >= interval) {
        lastRef.current = ts;
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

  const f = frames[idx];
  const done = sameLen && idx >= frames.length - 1;
  const allZero = done && Object.values(f.counts).every((v) => v === 0);
  const letters = Object.keys(f.counts).sort();

  const renderRow = (arr: string[], who: 's' | 't') => (
    <div class="flex flex-wrap gap-1.5 font-mono text-sm">
      <span class="flex h-9 w-9 items-center justify-center text-xs font-bold text-muted">{who}</span>
      {arr.map((c, i) => {
        const active = i === f.i;
        return <span key={i} class={`flex h-9 w-9 items-center justify-center rounded-md border text-base font-bold transition ${active ? 'scale-110 border-transparent text-white' : i < f.i ? 'border-border bg-surface-2 text-muted' : 'border-border bg-surface-2 text-text'}`} style={active ? `background:${who === 's' ? COLORS.plus : COLORS.minus}` : ''}>{c}</span>;
      })}
    </div>
  );

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 grid gap-2 sm:grid-cols-2">
        <input value={sText} onInput={(e) => setSText((e.target as HTMLInputElement).value)} class="rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm" placeholder="string s" />
        <input value={tText} onInput={(e) => setTText((e.target as HTMLInputElement).value)} class="rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm" placeholder="string t" />
      </div>
      <button onClick={commit} class="mb-3 rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Load</button>

      {!sameLen ? (
        <p class="rounded-lg px-3 py-2 text-sm font-semibold text-text" style="background:rgba(239,68,68,.15)">Different lengths ({s.length} vs {t.length}) — they cannot be anagrams. Equal length is the cheapest first test.</p>
      ) : (
        <>
          <div class="space-y-1.5">{renderRow(s, 's')}{renderRow(t, 't')}</div>

          <div class="mt-4 text-xs font-semibold uppercase tracking-wide text-muted">Signed tally (s adds, t subtracts)</div>
          <div class="mt-1.5 flex flex-wrap gap-1.5 font-mono text-sm">
            {letters.length === 0 && <span class="text-muted">(all zero)</span>}
            {letters.map((c) => {
              const n = f.counts[c];
              const active = c === f.sc || c === f.tc;
              const col = n > 0 ? COLORS.plus : n < 0 ? COLORS.minus : COLORS.zero;
              return <span key={c} class={`rounded-md border px-2 py-1 ${active ? 'scale-110' : ''}`} style={`border-color:${col};color:${col};font-weight:700`}>{c}:{n > 0 ? `+${n}` : n}</span>;
            })}
          </div>

          <p class="mt-3 min-h-[2.5rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">
            {f.i < 0
              ? 'Walk one index across both strings: add the s-letter, subtract the t-letter. Press Play.'
              : `index ${f.i}: s adds '${f.sc}' (now ${f.counts[f.sc] > 0 ? '+' : ''}${f.counts[f.sc]}), t subtracts '${f.tc}' (now ${f.counts[f.tc] > 0 ? '+' : ''}${f.counts[f.tc]}).`}
          </p>
          {done && (
            <p class="mt-2 rounded-lg px-3 py-2 text-sm font-semibold text-text" style={`background:${allZero ? 'rgba(16,185,129,.15)' : 'rgba(239,68,68,.15)'}`}>
              {allZero ? '✓ Every bucket is back to 0 — the strings are anagrams.' : '✗ Some bucket is nonzero — not anagrams.'}
            </p>
          )}
        </>
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
      <p class="mt-2 text-center text-xs text-muted">Letters only, lowercased. Try "listen"/"silent" (yes) or "rat"/"car" (no).</p>
    </div>
  );
}
