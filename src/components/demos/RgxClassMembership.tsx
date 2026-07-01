import { useEffect, useMemo, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   RgxClassMembership — animated character-class + anchor matcher.
   Each pattern token tests ONE character for MEMBERSHIP in a set:
   a literal, the dot, a shorthand (\d \w \s and negations), or a
   bracket class [a-z0-9]. Anchors ^ and $ are zero-width position
   checks. The engine walks each start position, lighting membership
   hits emerald and rejects red, and shows the token's accepted set.
   ------------------------------------------------------------------ */

const C = { cur: '#0ea5e9', ok: '#10b981', bad: '#ef4444', brand: '#4f46e5', anc: '#f59e0b' };

const isD = (c: string) => c >= '0' && c <= '9';
const isW = (c: string) => (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || isD(c) || c === '_';
const isS = (c: string) => c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === '\f' || c === '\v';

type Tok =
  | { kind: 'anchorStart'; src: string }
  | { kind: 'anchorEnd'; src: string }
  | { kind: 'wordB'; neg: boolean; src: string }
  | { kind: 'char'; test: (c: string) => boolean; label: string; src: string };

type Frame = {
  status: 'start' | 'match' | 'mismatch' | 'assertOk' | 'assertFail' | 'found' | 'fail';
  textPos: number; tok: number; mStart: number; mEnd: number; caption: string;
};

function escTest(nx: string): { test: (c: string) => boolean; label: string } {
  switch (nx) {
    case 'd': return { test: isD, label: '\\d digit [0-9]' };
    case 'D': return { test: (c) => !isD(c), label: '\\D non-digit' };
    case 'w': return { test: isW, label: '\\w word char' };
    case 'W': return { test: (c) => !isW(c), label: '\\W non-word' };
    case 's': return { test: isS, label: '\\s whitespace' };
    case 'S': return { test: (c) => !isS(c), label: '\\S non-space' };
    default: return { test: (c) => c === nx, label: `literal '${nx}'` };
  }
}

function parseClass(p: string, i: number) {
  let j = i + 1; let neg = false;
  if (p[j] === '^') { neg = true; j++; }
  const testers: ((c: string) => boolean)[] = [];
  while (j < p.length && p[j] !== ']') {
    if (p[j] === '\\' && j + 1 < p.length) { testers.push(escTest(p[j + 1]).test); j += 2; continue; }
    if (p[j + 1] === '-' && j + 2 < p.length && p[j + 2] !== ']') { const a = p[j], b = p[j + 2]; testers.push((c) => c >= a && c <= b); j += 3; continue; }
    const ch = p[j]; testers.push((c) => c === ch); j++;
  }
  const end = j < p.length && p[j] === ']' ? j + 1 : j;
  const base = (c: string) => testers.some((t) => t(c));
  const src = p.slice(i, end);
  return { test: neg ? (c: string) => !base(c) : base, label: `class ${src}${neg ? ' (negated)' : ''}`, end };
}

function parse(p: string): Tok[] {
  const toks: Tok[] = []; let i = 0;
  while (i < p.length) {
    const ch = p[i];
    if (ch === '^') { toks.push({ kind: 'anchorStart', src: '^' }); i++; continue; }
    if (ch === '$') { toks.push({ kind: 'anchorEnd', src: '$' }); i++; continue; }
    if (ch === '.') { toks.push({ kind: 'char', test: (c) => c !== '\n', label: '. any char', src: '.' }); i++; continue; }
    if (ch === '\\' && (p[i + 1] === 'b' || p[i + 1] === 'B')) { toks.push({ kind: 'wordB', neg: p[i + 1] === 'B', src: '\\' + p[i + 1] }); i += 2; continue; }
    if (ch === '\\' && i + 1 < p.length) { const t = escTest(p[i + 1]); toks.push({ kind: 'char', test: t.test, label: t.label, src: '\\' + p[i + 1] }); i += 2; continue; }
    if (ch === '[') { const c = parseClass(p, i); toks.push({ kind: 'char', test: c.test, label: c.label, src: c.src }); i = c.end; continue; }
    toks.push({ kind: 'char', test: (cc) => cc === ch, label: `literal '${ch}'`, src: ch }); i++;
  }
  return toks;
}

function buildFrames(pattern: string, text: string): Frame[] {
  const toks = parse(pattern);
  const frames: Frame[] = [];
  const n = text.length;
  if (!toks.length) return frames;
  for (let s = 0; s <= n; s++) {
    frames.push({ status: 'start', textPos: s, tok: -1, mStart: s, mEnd: s, caption: `Begin an attempt at position ${s}.` });
    let pos = s; let ok = true;
    for (let ti = 0; ti < toks.length; ti++) {
      const tk = toks[ti];
      if (tk.kind === 'anchorStart') {
        const good = pos === 0;
        frames.push({ status: good ? 'assertOk' : 'assertFail', textPos: pos, tok: ti, mStart: s, mEnd: pos, caption: `^ asserts start-of-string at ${pos}: ${good ? 'yes ✓ (zero width, no char consumed)' : 'no — position ' + pos + ' is not the start. Fail.'}` });
        if (!good) { ok = false; break; } else continue;
      }
      if (tk.kind === 'anchorEnd') {
        const good = pos === n;
        frames.push({ status: good ? 'assertOk' : 'assertFail', textPos: pos, tok: ti, mStart: s, mEnd: pos, caption: `$ asserts end-of-string at ${pos}: ${good ? 'yes ✓ (zero width)' : 'no — text still has characters. Fail.'}` });
        if (!good) { ok = false; break; } else continue;
      }
      if (tk.kind === 'wordB') {
        const before = pos > 0 && isW(text[pos - 1]); const after = pos < n && isW(text[pos]);
        const atB = before !== after; const good = tk.neg ? !atB : atB;
        frames.push({ status: good ? 'assertOk' : 'assertFail', textPos: pos, tok: ti, mStart: s, mEnd: pos, caption: `${tk.src} at ${pos}: ${good ? 'a word ' + (tk.neg ? 'non-boundary' : 'boundary') + ' ✓ (zero width)' : 'not satisfied. Fail.'}` });
        if (!good) { ok = false; break; } else continue;
      }
      if (pos >= n) { frames.push({ status: 'mismatch', textPos: pos, tok: ti, mStart: s, mEnd: pos, caption: `${tk.label} needs a character at ${pos}, but the text ended. Slide start to ${s + 1}.` }); ok = false; break; }
      const c = text[pos];
      const hit = tk.test(c);
      if (hit) { frames.push({ status: 'match', textPos: pos, tok: ti, mStart: s, mEnd: pos + 1, caption: `${tk.label} contains '${c === ' ' ? '␣' : c}' at ${pos} — advance.` }); pos++; }
      else { frames.push({ status: 'mismatch', textPos: pos, tok: ti, mStart: s, mEnd: pos, caption: `${tk.label} rejects '${c === ' ' ? '␣' : c}' at ${pos}. Slide start to ${s + 1}.` }); ok = false; break; }
    }
    if (ok) { frames.push({ status: 'found', textPos: pos, tok: toks.length, mStart: s, mEnd: pos, caption: `Match "${text.slice(s, pos)}" at [${s}, ${pos}).` }); return frames; }
  }
  frames.push({ status: 'fail', textPos: n, tok: -1, mStart: n, mEnd: n, caption: 'No start position satisfied every membership test.' });
  return frames;
}

export default function RgxClassMembership() {
  const [patText, setPatText] = useState('[a-f]\\d');
  const [strText, setStrText] = useState('go a3 f7 z9');
  const [pattern, setPattern] = useState('[a-f]\\d');
  const [text, setText] = useState('go a3 f7 z9');

  const frames = useMemo(() => buildFrames(pattern, text), [pattern, text]);
  const toks = useMemo(() => parse(pattern), [pattern]);

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

      <div class="mb-2 flex flex-wrap items-center gap-1 font-mono text-sm">
        <span class="mr-1 text-xs text-muted">pattern</span>
        {toks.map((tk, i) => (
          <span key={i} class={`rounded-md border px-2 py-1 ${f && f.tok === i ? 'border-transparent text-white' : 'border-border bg-surface-2 text-text'}`}
            style={f && f.tok === i ? `background:${f.status === 'mismatch' || f.status === 'assertFail' ? C.bad : tk.kind !== 'char' ? C.anc : C.brand}` : ''}>{tk.src}</span>
        ))}
        {!toks.length && <span class="text-muted">(empty)</span>}
      </div>

      <div class="flex flex-wrap gap-1 font-mono text-sm">
        {text.split('').map((c, i) => {
          const inMatch = f && i >= f.mStart && i < f.mEnd;
          const isCur = f && i === f.textPos && (f.status === 'match' || f.status === 'mismatch');
          const bg = isCur ? (f!.status === 'mismatch' ? C.bad : C.cur) : inMatch ? C.ok : '';
          return (
            <div key={i} class={`flex h-9 w-7 items-center justify-center rounded-md border ${bg ? 'border-transparent text-white' : 'border-border bg-surface-2 text-text'}`} style={bg ? `background:${bg}` : ''}>{c === ' ' ? '␣' : c}</div>
          );
        })}
      </div>
      <div class="mt-1 flex flex-wrap gap-1 font-mono text-[10px] text-muted">
        {text.split('').map((_, i) => (<div key={i} class="w-7 text-center">{i}</div>))}
      </div>

      <p class="mt-3 min-h-[2.5rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">{f ? f.caption : 'Try classes like [a-f], \\d, [^aeiou], with ^ / $ anchors.'}</p>
      {f && f.status === 'found' && <p class="mt-2 rounded-lg bg-brand-soft px-3 py-2 text-sm font-semibold text-text">A class matches exactly one character — the one that belongs to its set. Anchors match a position, consuming nothing.</p>}

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
    </div>
  );
}
