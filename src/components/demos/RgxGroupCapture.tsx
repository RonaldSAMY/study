import { useEffect, useMemo, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   RgxGroupCapture — groups, alternation and backreferences.
   A recursive backtracking engine parses ( ) capturing groups,
   (?: ) non-capturing groups, alternation |, quantifiers on groups,
   and backreferences \1, \2, \k<name>. Each capture lights up in its
   own colour; a backreference must re-match the exact text its group
   captured. The live panel shows every group's current capture.
   ------------------------------------------------------------------ */

const C = { cur: '#0ea5e9', ok: '#10b981', bad: '#ef4444', brand: '#4f46e5' };
const GROUP = ['#6366f1', '#0ea5e9', '#a855f7', '#14b8a6', '#f97316', '#ec4899'];

const isD = (c: string) => c >= '0' && c <= '9';
const isW = (c: string) => (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || isD(c) || c === '_';
const isS = (c: string) => c === ' ' || c === '\t' || c === '\n' || c === '\r';
function escTest(nx: string) {
  switch (nx) {
    case 'd': return { test: isD }; case 'D': return { test: (c: string) => !isD(c) };
    case 'w': return { test: isW }; case 'W': return { test: (c: string) => !isW(c) };
    case 's': return { test: isS }; case 'S': return { test: (c: string) => !isS(c) };
    default: return { test: (c: string) => c === nx };
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

type Node = any;

function parse(p: string): { ast: Node; capCount: number; nameMap: Record<string, number> } {
  let i = 0; let capCount = 0; const nameMap: Record<string, number> = {};
  function alt(): Node { const opts = [seq()]; while (p[i] === '|') { i++; opts.push(seq()); } return opts.length === 1 ? opts[0] : { t: 'alt', options: opts }; }
  function seq(): Node { const items: Node[] = []; while (i < p.length && p[i] !== ')' && p[i] !== '|') items.push(quant()); return { t: 'seq', items }; }
  function quant(): Node {
    const start = i; const a = atom();
    let min = 1, max = 1, has = false;
    if (p[i] === '*') { min = 0; max = Infinity; has = true; i++; }
    else if (p[i] === '+') { min = 1; max = Infinity; has = true; i++; }
    else if (p[i] === '?') { min = 0; max = 1; has = true; i++; }
    else if (p[i] === '{') { const m = /^\{(\d+)(,(\d*))?\}/.exec(p.slice(i)); if (m) { min = +m[1]; max = m[2] === undefined ? min : (m[3] === '' ? Infinity : +m[3]); has = true; i += m[0].length; } }
    if (has) { let lazy = false; if (p[i] === '?') { lazy = true; i++; } const node = { t: 'rep', min, max, lazy, child: a, sp: [start, i] }; return node; }
    a.sp = [start, i]; return a;
  }
  function atom(): Node {
    const ch = p[i];
    if (ch === '(') {
      i++; let capIndex: number | null = null; let name: string | null = null;
      if (p[i] === '?' && p[i + 1] === ':') { i += 2; }
      else if (p[i] === '?' && p[i + 1] === '<' && p[i + 2] !== '=' && p[i + 2] !== '!') { i += 2; let nm = ''; while (i < p.length && p[i] !== '>') { nm += p[i]; i++; } i++; name = nm; capIndex = ++capCount; nameMap[nm] = capIndex; }
      else { capIndex = ++capCount; }
      const body = alt();
      if (p[i] === ')') i++;
      return { t: 'group', capIndex, name, body };
    }
    if (ch === '\\' && i + 1 < p.length) {
      const nx = p[i + 1];
      if (nx >= '1' && nx <= '9') { i += 2; return { t: 'backref', ref: +nx }; }
      if (nx === 'k' && p[i + 2] === '<') { let j = i + 3, nm = ''; while (j < p.length && p[j] !== '>') { nm += p[j]; j++; } i = j + 1; return { t: 'backref', ref: nm }; }
      if (nx === 'b') { i += 2; return { t: 'wordB', neg: false }; }
      if (nx === 'B') { i += 2; return { t: 'wordB', neg: true }; }
      const e = escTest(nx); i += 2; return { t: 'char', test: e.test };
    }
    if (ch === '[') { const c = parseClass(p, i); i = c.end; return { t: 'char', test: c.test }; }
    if (ch === '.') { i++; return { t: 'char', test: (c: string) => c !== '\n' }; }
    if (ch === '^') { i++; return { t: 'anchorStart' }; }
    if (ch === '$') { i++; return { t: 'anchorEnd' }; }
    const cc = ch; i++; return { t: 'char', test: (c: string) => c === cc };
  }
  const ast = alt();
  return { ast, capCount, nameMap };
}

type Frame = { status: string; pos: number; sp: number[] | null; mStart: number; mEnd: number; capS: (number | null)[]; capE: (number | null)[]; active: number; caption: string };

function buildFrames(pattern: string, text: string): Frame[] {
  let parsed: ReturnType<typeof parse>;
  try { parsed = parse(pattern); } catch { return [{ status: 'fail', pos: 0, sp: null, mStart: 0, mEnd: 0, capS: [], capE: [], active: -1, caption: 'Could not parse the pattern.' }]; }
  const { ast, capCount, nameMap } = parsed;
  const n = text.length;
  const capS: (number | null)[] = Array(capCount + 1).fill(null);
  const capE: (number | null)[] = Array(capCount + 1).fill(null);
  const frames: Frame[] = [];
  const MAX = 3500;
  let mStart = 0; let found = false;
  const emit = (o: Partial<Frame> & { status: string; pos: number; caption: string; mEnd: number }) =>
    { if (frames.length < MAX) frames.push({ sp: null, active: -1, ...o, mStart, capS: [...capS], capE: [...capE] } as Frame); };

  function match(node: Node, pos: number, k: (p: number) => boolean): boolean {
    if (frames.length >= MAX) return false;
    switch (node.t) {
      case 'seq': {
        const items = node.items as Node[];
        const go = (i: number, p: number): boolean => i === items.length ? k(p) : match(items[i], p, (p2) => go(i + 1, p2));
        return go(0, pos);
      }
      case 'alt': {
        for (let oi = 0; oi < node.options.length; oi++) { if (match(node.options[oi], pos, k)) return true; }
        return false;
      }
      case 'anchorStart':
        if (pos === 0) { emit({ status: 'assert', pos, sp: node.sp, mEnd: pos, caption: `^ holds at ${pos}.` }); return k(pos); }
        emit({ status: 'mismatch', pos, sp: node.sp, mEnd: pos, caption: `^ fails at ${pos}.` }); return false;
      case 'anchorEnd':
        if (pos === n) { emit({ status: 'assert', pos, sp: node.sp, mEnd: pos, caption: `$ holds at ${pos}.` }); return k(pos); }
        emit({ status: 'mismatch', pos, sp: node.sp, mEnd: pos, caption: `$ fails at ${pos}.` }); return false;
      case 'wordB': {
        const before = pos > 0 && isW(text[pos - 1]); const after = pos < n && isW(text[pos]);
        const atB = before !== after; const pass = node.neg ? !atB : atB;
        if (pass) { emit({ status: 'assert', pos, sp: node.sp, mEnd: pos, caption: `${node.neg ? '\\B' : '\\b'} holds at ${pos} (word ${node.neg ? 'non-boundary' : 'boundary'}, zero width).` }); return k(pos); }
        emit({ status: 'mismatch', pos, sp: node.sp, mEnd: pos, caption: `${node.neg ? '\\B' : '\\b'} fails at ${pos}.` }); return false;
      }
      case 'char': {
        if (pos < n && node.test(text[pos])) { emit({ status: 'match', pos, sp: node.sp, mEnd: pos + 1, caption: `Token matches '${text[pos] === ' ' ? '␣' : text[pos]}' at ${pos} — advance.` }); return k(pos + 1); }
        emit({ status: 'mismatch', pos, sp: node.sp, mEnd: pos, caption: `Token fails at ${pos}${pos < n ? " on '" + (text[pos] === ' ' ? '␣' : text[pos]) + "'" : ' (end of text)'}.` }); return false;
      }
      case 'backref': {
        const idx = typeof node.ref === 'number' ? node.ref : nameMap[node.ref];
        const s = idx != null ? capS[idx] : null; const e = idx != null ? capE[idx] : null;
        const sub = s != null && e != null ? text.slice(s, e) : '';
        const refName = typeof node.ref === 'number' ? '\\' + node.ref : '\\k<' + node.ref + '>';
        if (text.startsWith(sub, pos)) { emit({ status: 'backref', pos, sp: node.sp, active: idx, mEnd: pos + sub.length, caption: `Backreference ${refName} must re-match "${sub || '(empty)'}" — found it at ${pos}.` }); return k(pos + sub.length); }
        emit({ status: 'mismatch', pos, sp: node.sp, active: idx, mEnd: pos, caption: `Backreference ${refName} expected "${sub}" at ${pos} — mismatch.` }); return false;
      }
      case 'group': {
        const idx = node.capIndex as number | null;
        if (idx == null) return match(node.body, pos, k);
        const ps = capS[idx], pe = capE[idx];
        capS[idx] = pos;
        emit({ status: 'open', pos, sp: node.sp, active: idx, mEnd: pos, caption: `Open group ${idx} at ${pos}.` });
        const r = match(node.body, pos, (p2) => {
          const savedE = capE[idx]; capE[idx] = p2;
          emit({ status: 'capture', pos: p2, sp: node.sp, active: idx, mEnd: p2, caption: `Group ${idx} captures "${text.slice(pos, p2) || '(empty)'}".` });
          if (k(p2)) return true;
          capE[idx] = savedE; return false;
        });
        if (!r) { capS[idx] = ps; capE[idx] = pe; }
        return r;
      }
      case 'rep': {
        const { min, max, lazy, child } = node;
        const step = (p: number, count: number): boolean => {
          const more = () => count < max ? match(child, p, (p2) => (p2 > p ? step(p2, count + 1) : false)) : false;
          const stop = () => count >= min ? k(p) : false;
          if (lazy) { if (stop()) return true; return more(); }
          if (more()) return true; return stop();
        };
        return step(pos, 0);
      }
    }
    return false;
  }

  const finalK = (pos: number) => { found = true; emit({ status: 'found', pos, sp: null, mEnd: pos, caption: `Full match "${text.slice(mStart, pos) || '(empty)'}" at [${mStart}, ${pos}).` }); return true; };

  for (let s = 0; s <= n && !found; s++) {
    mStart = s;
    for (let g = 0; g <= capCount; g++) { capS[g] = null; capE[g] = null; }
    emit({ status: 'start', pos: s, sp: null, mEnd: s, caption: `Begin an attempt at position ${s}.` });
    if (match(ast, s, finalK)) break;
  }
  if (!found) emit({ status: 'fail', pos: n, sp: null, mEnd: n, caption: 'No match found.' });
  return frames;
}

export default function RgxGroupCapture() {
  const [patText, setPatText] = useState('(\\w+) \\1');
  const [strText, setStrText] = useState('the the cat');
  const [pattern, setPattern] = useState('(\\w+) \\1');
  const [text, setText] = useState('the the cat');

  const frames = useMemo(() => buildFrames(pattern, text), [pattern, text]);

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
  const capColorOf = (i: number) => {
    if (!f) return '';
    for (let g = 1; g < f.capS.length; g++) { const s = f.capS[g], e = f.capE[g]; if (s != null && e != null && i >= s && i < e) return GROUP[(g - 1) % GROUP.length]; }
    return '';
  };

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

      {/* pattern with active-span highlight */}
      <div class="mb-2 font-mono text-sm">
        <span class="mr-1 text-xs text-muted">pattern </span>
        {pattern.split('').map((c, i) => {
          const on = f && f.sp && i >= f.sp[0] && i < f.sp[1];
          return <span key={i} class={`rounded px-0.5 ${on ? 'text-white' : 'text-text'}`} style={on ? `background:${f!.status === 'mismatch' ? C.bad : C.brand}` : ''}>{c}</span>;
        })}
      </div>

      <div class="flex flex-wrap gap-1 font-mono text-sm">
        {text.split('').map((c, i) => {
          const cap = capColorOf(i);
          const inMatch = f && i >= f.mStart && i < f.mEnd;
          const isCur = f && i === f.pos && (f.status === 'match' || f.status === 'mismatch' || f.status === 'backref');
          const bg = isCur ? (f!.status === 'mismatch' ? C.bad : C.cur) : cap ? cap : inMatch ? C.ok : '';
          return (
            <div key={i} class={`flex h-9 w-7 items-center justify-center rounded-md border ${bg ? 'border-transparent text-white' : 'border-border bg-surface-2 text-text'}`} style={bg ? `background:${bg}` : ''}>{c === ' ' ? '␣' : c}</div>
          );
        })}
      </div>
      <div class="mt-1 flex flex-wrap gap-1 font-mono text-[10px] text-muted">
        {text.split('').map((_, i) => (<div key={i} class="w-7 text-center">{i}</div>))}
      </div>

      {/* live capture table */}
      {f && f.capS.length > 1 && (
        <div class="mt-3 flex flex-wrap gap-2 text-xs">
          {f.capS.slice(1).map((s, gi) => {
            const e = f.capE[gi + 1];
            const val = s != null && e != null ? text.slice(s, e) : '—';
            return (
              <span key={gi} class="rounded-md px-2 py-1 font-mono text-white" style={`background:${GROUP[gi % GROUP.length]}`}>
                group {gi + 1}: {val === '' ? '(empty)' : val}
              </span>
            );
          })}
        </div>
      )}

      <p class="mt-3 min-h-[2.5rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">{f ? f.caption : 'Try (\\w+) \\1 for repeated words, or (a|b)(c|d) for alternation.'}</p>
      {f && f.status === 'found' && <p class="mt-2 rounded-lg bg-brand-soft px-3 py-2 text-sm font-semibold text-text">A backreference forces later text to equal an earlier capture — something plain pattern matching can't express.</p>}

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
