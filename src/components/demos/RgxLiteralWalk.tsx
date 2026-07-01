import { useEffect, useMemo, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   RgxLiteralWalk — animated literal + dot matcher.
   A tiny hand-rolled engine walks the text one start position at a
   time, comparing each pattern token (a literal char or the dot) to
   the character under the cursor. Matches turn emerald, a mismatch
   turns red and the whole attempt slides one place to the right.
   Transport: Play / Pause / Step / Back / Reset + speed.
   A separate panel shows the REAL RegExp matches for the same inputs.
   ------------------------------------------------------------------ */

const C = { cur: '#0ea5e9', ok: '#10b981', bad: '#ef4444', brand: '#4f46e5' };

type Tok = { kind: 'lit' | 'dot'; ch?: string; label: string };
type Frame = {
  status: 'start' | 'match' | 'mismatch' | 'found' | 'fail';
  textPos: number;
  tok: number;
  mStart: number;
  mEnd: number;
  caption: string;
};

function tokenize(p: string): Tok[] {
  const t: Tok[] = [];
  for (let i = 0; i < p.length; i++) {
    if (p[i] === '\\' && i + 1 < p.length) { t.push({ kind: 'lit', ch: p[i + 1], label: `literal '${p[i + 1]}'` }); i++; }
    else if (p[i] === '.') t.push({ kind: 'dot', label: 'dot . (any char)' });
    else t.push({ kind: 'lit', ch: p[i], label: `literal '${p[i]}'` });
  }
  return t;
}

function buildFrames(pattern: string, text: string): Frame[] {
  const toks = tokenize(pattern);
  const frames: Frame[] = [];
  const n = text.length;
  if (!toks.length) return frames;
  for (let s = 0; s <= n; s++) {
    frames.push({ status: 'start', textPos: s, tok: -1, mStart: s, mEnd: s, caption: `Anchor a fresh attempt at position ${s}.` });
    let ok = true;
    for (let j = 0; j < toks.length; j++) {
      const tp = s + j;
      const tk = toks[j];
      if (tp >= n) { frames.push({ status: 'mismatch', textPos: tp, tok: j, mStart: s, mEnd: s + j, caption: `No character at position ${tp} — ran past the end. Slide the start to ${s + 1}.` }); ok = false; break; }
      const c = text[tp];
      const hit = tk.kind === 'dot' ? c !== '\n' : c === tk.ch;
      if (hit) frames.push({ status: 'match', textPos: tp, tok: j, mStart: s, mEnd: tp + 1, caption: `${tk.label} matches '${c}' at ${tp} — advance.` });
      else { frames.push({ status: 'mismatch', textPos: tp, tok: j, mStart: s, mEnd: s + j, caption: `${tk.label} ≠ '${c}' at ${tp}. This start fails; slide to ${s + 1}.` }); ok = false; break; }
    }
    if (ok) { frames.push({ status: 'found', textPos: s + toks.length, tok: toks.length, mStart: s, mEnd: s + toks.length, caption: `Matched "${text.slice(s, s + toks.length)}" at [${s}, ${s + toks.length}). Done.` }); return frames; }
  }
  frames.push({ status: 'fail', textPos: n, tok: -1, mStart: n, mEnd: n, caption: 'No starting position matched — the pattern is not present.' });
  return frames;
}

function realMatches(pattern: string, text: string): { ranges: [number, number][]; err: string | null } {
  if (!pattern) return { ranges: [], err: null };
  try {
    const re = new RegExp(pattern, 'g');
    const ranges: [number, number][] = [];
    let m: RegExpExecArray | null; let guard = 0;
    while ((m = re.exec(text)) && guard++ < 2000) {
      if (m[0] === '') { re.lastIndex++; continue; }
      ranges.push([m.index, m.index + m[0].length]);
    }
    return { ranges, err: null };
  } catch (e) { return { ranges: [], err: e instanceof Error ? e.message : String(e) }; }
}

export default function RgxLiteralWalk() {
  const [patText, setPatText] = useState('a.c');
  const [strText, setStrText] = useState('the abc cab a-c');
  const [pattern, setPattern] = useState('a.c');
  const [text, setText] = useState('the abc cab a-c');

  const frames = useMemo(() => buildFrames(pattern, text), [pattern, text]);
  const real = useMemo(() => realMatches(pattern, text), [pattern, text]);

  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);
  idxRef.current = idx;

  useEffect(() => { setIdx(0); setPlaying(false); }, [pattern, text]);

  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 780 / speed;
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

  const commit = () => { setPattern(patText); setText(strText); };
  const reset = () => { setPlaying(false); setIdx(0); lastRef.current = 0; };
  const stepF = () => { setPlaying(false); setIdx((v) => Math.min(frames.length - 1, v + 1)); };
  const stepB = () => { setPlaying(false); setIdx((v) => Math.max(0, v - 1)); };
  const play = () => { if (idx >= frames.length - 1) setIdx(0); lastRef.current = 0; setPlaying((p) => !p); };

  const f = frames[Math.min(idx, frames.length - 1)] as Frame | undefined;
  const toks = tokenize(pattern);

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <label class="flex items-center gap-2 text-xs text-muted">pattern
          <input value={patText} onInput={(e) => setPatText((e.target as HTMLInputElement).value)} class="w-full rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm text-text" />
        </label>
        <label class="flex items-center gap-2 text-xs text-muted">text
          <input value={strText} onInput={(e) => setStrText((e.target as HTMLInputElement).value)} class="w-full rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm text-text" />
        </label>
        <button onClick={commit} class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Load</button>
      </div>

      {/* pattern tokens */}
      <div class="mb-2 flex flex-wrap items-center gap-1 font-mono text-sm">
        <span class="mr-1 text-xs text-muted">pattern</span>
        {toks.map((tk, i) => (
          <span key={i} class={`rounded-md border px-2 py-1 ${f && f.tok === i ? 'border-transparent text-white' : 'border-border bg-surface-2 text-text'}`} style={f && f.tok === i ? `background:${f.status === 'mismatch' ? C.bad : C.brand}` : ''}>{tk.kind === 'dot' ? '.' : tk.ch}</span>
        ))}
        {!toks.length && <span class="text-muted">(empty)</span>}
      </div>

      {/* text cells */}
      <div class="flex flex-wrap gap-1 font-mono text-sm">
        {text.split('').map((c, i) => {
          const inMatch = f && i >= f.mStart && i < f.mEnd;
          const isCur = f && i === f.textPos && (f.status === 'match' || f.status === 'mismatch');
          const bg = isCur ? (f!.status === 'mismatch' ? C.bad : C.cur) : inMatch ? C.ok : '';
          return (
            <div key={i} class={`flex h-9 w-7 flex-col items-center justify-center rounded-md border ${bg ? 'border-transparent text-white' : 'border-border bg-surface-2 text-text'}`} style={bg ? `background:${bg}` : ''}>
              <span>{c === ' ' ? '␣' : c}</span>
            </div>
          );
        })}
      </div>
      <div class="mt-1 flex flex-wrap gap-1 font-mono text-[10px] text-muted">
        {text.split('').map((_, i) => (<div key={i} class="w-7 text-center">{i}</div>))}
      </div>

      <p class="mt-3 min-h-[2.5rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">{f ? f.caption : 'Type a pattern (literals and the dot) and a test string, then press Play.'}</p>
      {f && f.status === 'found' && <p class="mt-2 rounded-lg bg-brand-soft px-3 py-2 text-sm font-semibold text-text">The engine slides left-to-right and stops at the first place every token lines up.</p>}

      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={stepB} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏮ Back</button>
        <button onClick={play} class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90">{playing ? '⏸ Pause' : '▶ Play'}</button>
        <button onClick={stepF} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏭ Step</button>
        <button onClick={reset} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">↺ Reset</button>
        <span class="ml-2 text-xs text-muted">step {Math.min(idx + 1, frames.length)}/{frames.length}</span>
        <label class="ml-auto flex items-center gap-2 text-xs text-muted">speed
          <input type="range" min={0.5} max={3} step={0.5} value={speed} onInput={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))} class="w-24 accent-[#4f46e5]" />
        </label>
      </div>

      {/* real-regex highlighter */}
      <div class="mt-4 rounded-lg border border-border bg-surface-2 p-3">
        <div class="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Real JS RegExp — /{pattern}/g</div>
        {real.err ? (
          <div class="font-mono text-xs text-rose-500">Invalid pattern: {real.err}</div>
        ) : (
          <div class="flex flex-wrap gap-0.5 font-mono text-sm">
            {text.split('').map((c, i) => {
              const hit = real.ranges.some(([a, b]) => i >= a && i < b);
              return <span key={i} class={`rounded px-0.5 ${hit ? 'text-white' : 'text-muted'}`} style={hit ? `background:${C.ok}` : ''}>{c === ' ' ? '␣' : c}</span>;
            })}
            {real.ranges.length === 0 && <span class="ml-2 text-xs text-muted">(no matches)</span>}
          </div>
        )}
      </div>
    </div>
  );
}
