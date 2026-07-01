import { useEffect, useMemo, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   RgxQuantifierGreed — greedy vs lazy repetition, with backtracking.
   A hand-rolled backtracking engine matches atoms carrying a
   quantifier (*, +, ?, {n,m}, and their lazy ? variants). Watch a
   GREEDY quantifier grab as many characters as it can (sky), then
   RELEASE them one at a time (amber) when the rest of the pattern
   can't match — that is backtracking. Lazy quantifiers start small
   and take more only when forced.
   ------------------------------------------------------------------ */

const C = { grab: '#0ea5e9', back: '#f59e0b', ok: '#10b981', bad: '#ef4444', brand: '#4f46e5' };

const isD = (c: string) => c >= '0' && c <= '9';
const isW = (c: string) => (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || isD(c) || c === '_';
const isS = (c: string) => c === ' ' || c === '\t' || c === '\n' || c === '\r';

function escTest(nx: string) {
  switch (nx) {
    case 'd': return { test: isD, label: '\\d' };
    case 'D': return { test: (c: string) => !isD(c), label: '\\D' };
    case 'w': return { test: isW, label: '\\w' };
    case 'W': return { test: (c: string) => !isW(c), label: '\\W' };
    case 's': return { test: isS, label: '\\s' };
    case 'S': return { test: (c: string) => !isS(c), label: '\\S' };
    default: return { test: (c: string) => c === nx, label: `'${nx}'` };
  }
}

function parseClass(p: string, i: number) {
  let j = i + 1; let neg = false;
  if (p[j] === '^') { neg = true; j++; }
  const ts: ((c: string) => boolean)[] = [];
  while (j < p.length && p[j] !== ']') {
    if (p[j] === '\\' && j + 1 < p.length) { ts.push(escTest(p[j + 1]).test); j += 2; continue; }
    if (p[j + 1] === '-' && j + 2 < p.length && p[j + 2] !== ']') { const a = p[j], b = p[j + 2]; ts.push((c) => c >= a && c <= b); j += 3; continue; }
    const ch = p[j]; ts.push((c) => c === ch); j++;
  }
  const end = j < p.length && p[j] === ']' ? j + 1 : j;
  const base = (c: string) => ts.some((t) => t(c));
  return { test: neg ? (c: string) => !base(c) : base, end };
}

type Node =
  | { type: 'anchorStart'; src: string }
  | { type: 'anchorEnd'; src: string }
  | { type: 'wordB'; neg: boolean; src: string }
  | { type: 'atom'; test: (c: string) => boolean; min: number; max: number; lazy: boolean; src: string };

function parse(p: string): Node[] {
  const nodes: Node[] = []; let i = 0;
  while (i < p.length) {
    const ch = p[i];
    if (ch === '^') { nodes.push({ type: 'anchorStart', src: '^' }); i++; continue; }
    if (ch === '$') { nodes.push({ type: 'anchorEnd', src: '$' }); i++; continue; }
    if (ch === '\\' && (p[i + 1] === 'b' || p[i + 1] === 'B')) { nodes.push({ type: 'wordB', neg: p[i + 1] === 'B', src: '\\' + p[i + 1] }); i += 2; continue; }
    let test: (c: string) => boolean; let src: string;
    if (ch === '.') { test = (c) => c !== '\n'; src = '.'; i++; }
    else if (ch === '\\' && i + 1 < p.length) { const e = escTest(p[i + 1]); test = e.test; src = '\\' + p[i + 1]; i += 2; }
    else if (ch === '[') { const c = parseClass(p, i); test = c.test; src = p.slice(i, c.end); i = c.end; }
    else { const cc = ch; test = (c) => c === cc; src = cc; i++; }
    let min = 1, max = 1, q = '';
    if (p[i] === '*') { min = 0; max = Infinity; q = '*'; i++; }
    else if (p[i] === '+') { min = 1; max = Infinity; q = '+'; i++; }
    else if (p[i] === '?') { min = 0; max = 1; q = '?'; i++; }
    else if (p[i] === '{') { const m = /^\{(\d+)(,(\d*))?\}/.exec(p.slice(i)); if (m) { min = +m[1]; max = m[2] === undefined ? min : (m[3] === '' ? Infinity : +m[3]); q = m[0]; i += m[0].length; } }
    let lazy = false;
    if (q && p[i] === '?') { lazy = true; q += '?'; i++; }
    nodes.push({ type: 'atom', test, min, max, lazy, src: src + q });
  }
  return nodes;
}

type Frame = { status: string; pos: number; node: number; mStart: number; mEnd: number; caption: string };

function buildFrames(pattern: string, text: string): Frame[] {
  const nodes = parse(pattern);
  const n = text.length;
  const frames: Frame[] = [];
  const MAX = 3500;
  let mStart = 0; let found = false;
  const emit = (o: Omit<Frame, 'mStart'>) => { if (frames.length < MAX) frames.push({ mStart, ...o }); };

  const finalK = (pos: number) => { found = true; emit({ status: 'found', pos, node: nodes.length, mEnd: pos, caption: `Full match "${text.slice(mStart, pos) || '(empty)'}" at [${mStart}, ${pos}).` }); return true; };

  function matchNode(ti: number, pos: number, k: (p: number) => boolean): boolean {
    if (frames.length >= MAX) return false;
    if (ti === nodes.length) return k(pos);
    const nd = nodes[ti];
    if (nd.type === 'anchorStart') {
      if (pos === 0) { emit({ status: 'assert', pos, node: ti, mEnd: pos, caption: `^ holds at ${pos} (start of string).` }); return matchNode(ti + 1, pos, k); }
      emit({ status: 'mismatch', pos, node: ti, mEnd: pos, caption: `^ fails at ${pos}.` }); return false;
    }
    if (nd.type === 'anchorEnd') {
      if (pos === n) { emit({ status: 'assert', pos, node: ti, mEnd: pos, caption: `$ holds at ${pos} (end of string).` }); return matchNode(ti + 1, pos, k); }
      emit({ status: 'mismatch', pos, node: ti, mEnd: pos, caption: `$ fails at ${pos}: characters remain.` }); return false;
    }
    if (nd.type === 'wordB') {
      const before = pos > 0 && isW(text[pos - 1]); const after = pos < n && isW(text[pos]);
      const atB = before !== after; const pass = nd.neg ? !atB : atB;
      if (pass) { emit({ status: 'assert', pos, node: ti, mEnd: pos, caption: `${nd.src} holds at ${pos} (zero-width word boundary).` }); return matchNode(ti + 1, pos, k); }
      emit({ status: 'mismatch', pos, node: ti, mEnd: pos, caption: `${nd.src} fails at ${pos}.` }); return false;
    }
    return repeat(ti, pos, 0, k);
  }

  function repeat(ti: number, pos: number, count: number, k: (p: number) => boolean): boolean {
    if (frames.length >= MAX) return false;
    const nd = nodes[ti] as Extract<Node, { type: 'atom' }>;
    const canMore = count < nd.max && pos < n && nd.test(text[pos]);
    if (nd.lazy) {
      if (count >= nd.min) { emit({ status: 'back', pos, node: ti, mEnd: pos, caption: `Lazy ${nd.src}: stop at ${count} and let the rest try from ${pos}.` }); if (matchNode(ti + 1, pos, k)) return true; }
      if (canMore) { emit({ status: 'grab', pos, node: ti, mEnd: pos + 1, caption: `Lazy ${nd.src}: rest failed, so take one more — '${text[pos]}' at ${pos} (now ${count + 1}).` }); if (repeat(ti, pos + 1, count + 1, k)) return true; }
      else if (count < nd.min) emit({ status: 'mismatch', pos, node: ti, mEnd: pos, caption: `${nd.src} needs ${nd.min}, only ${count} available. Fail.` });
      return false;
    }
    if (canMore) { emit({ status: 'grab', pos, node: ti, mEnd: pos + 1, caption: `Greedy ${nd.src}: grab '${text[pos]}' at ${pos} (now ${count + 1}).` }); if (repeat(ti, pos + 1, count + 1, k)) return true; }
    if (count >= nd.min) { emit({ status: 'back', pos, node: ti, mEnd: pos, caption: `${nd.src} keeps ${count} and releases position ${pos} to the rest (backtracks here if that fails).` }); if (matchNode(ti + 1, pos, k)) return true; }
    else emit({ status: 'mismatch', pos, node: ti, mEnd: pos, caption: `${nd.src} needs at least ${nd.min}, only ${count}. Fail.` });
    return false;
  }

  for (let s = 0; s <= n && !found; s++) {
    mStart = s;
    emit({ status: 'start', pos: s, node: -1, mEnd: s, caption: `Begin an attempt at position ${s}.` });
    if (matchNode(0, s, finalK)) break;
  }
  if (!found) emit({ status: 'fail', pos: n, node: -1, mEnd: n, caption: 'No starting position produced a match.' });
  return frames;
}

export default function RgxQuantifierGreed() {
  const [patText, setPatText] = useState('a.*c');
  const [strText, setStrText] = useState('xabcayc!');
  const [pattern, setPattern] = useState('a.*c');
  const [text, setText] = useState('xabcayc!');

  const frames = useMemo(() => buildFrames(pattern, text), [pattern, text]);
  const nodes = useMemo(() => parse(pattern), [pattern]);

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
    const interval = 720 / speed;
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
  const curColor = (s: string) => s === 'grab' ? C.grab : s === 'back' ? C.back : s === 'mismatch' ? C.bad : s === 'assert' ? C.brand : C.grab;

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
        {nodes.map((nd, i) => (
          <span key={i} class={`rounded-md border px-2 py-1 ${f && f.node === i ? 'border-transparent text-white' : 'border-border bg-surface-2 text-text'}`} style={f && f.node === i ? `background:${curColor(f.status)}` : ''}>{nd.src}</span>
        ))}
        {!nodes.length && <span class="text-muted">(empty)</span>}
      </div>

      <div class="flex flex-wrap gap-1 font-mono text-sm">
        {text.split('').map((c, i) => {
          const inMatch = f && i >= f.mStart && i < f.mEnd;
          const isCur = f && i === f.pos && (f.status === 'grab' || f.status === 'mismatch' || f.status === 'back');
          const bg = isCur ? curColor(f!.status) : inMatch ? C.ok : '';
          return (
            <div key={i} class={`flex h-9 w-7 items-center justify-center rounded-md border ${bg ? 'border-transparent text-white' : 'border-border bg-surface-2 text-text'}`} style={bg ? `background:${bg}` : ''}>{c === ' ' ? '␣' : c}</div>
          );
        })}
      </div>
      <div class="mt-1 flex flex-wrap gap-1 font-mono text-[10px] text-muted">
        {text.split('').map((_, i) => (<div key={i} class="w-7 text-center">{i}</div>))}
      </div>

      <div class="mt-2 flex flex-wrap gap-3 text-[11px] text-muted">
        <span class="flex items-center gap-1"><span class="inline-block h-3 w-3 rounded" style={`background:${C.grab}`} /> grab (consume)</span>
        <span class="flex items-center gap-1"><span class="inline-block h-3 w-3 rounded" style={`background:${C.back}`} /> release / backtrack</span>
        <span class="flex items-center gap-1"><span class="inline-block h-3 w-3 rounded" style={`background:${C.ok}`} /> matched so far</span>
        <span class="flex items-center gap-1"><span class="inline-block h-3 w-3 rounded" style={`background:${C.bad}`} /> fail</span>
      </div>

      <p class="mt-3 min-h-[2.5rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">{f ? f.caption : 'Compare a.*c (greedy) with a.*?c (lazy) on the same text.'}</p>
      {f && f.status === 'found' && <p class="mt-2 rounded-lg bg-brand-soft px-3 py-2 text-sm font-semibold text-text">Greedy first grabs everything then gives characters back until the rest fits; lazy takes the fewest it can.</p>}

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
