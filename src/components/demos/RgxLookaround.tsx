import { useEffect, useMemo, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   RgxLookaround — zero-width lookahead & lookbehind assertions.
   The engine matches literals, classes and quantifiers, plus the four
   lookarounds: (?=...) (?!...) (?<=...) (?<!...). A lookaround PEEKS at
   the text (amber window) to decide yes/no but consumes NOTHING — the
   cursor stays put. Watch the committed match (emerald) never include
   the peeked characters.
   ------------------------------------------------------------------ */

const C = { cur: '#0ea5e9', ok: '#10b981', bad: '#ef4444', brand: '#4f46e5', look: '#f59e0b' };

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

function parse(p: string): Node {
  let i = 0;
  function alt(): Node { const opts = [seq()]; while (p[i] === '|') { i++; opts.push(seq()); } return opts.length === 1 ? opts[0] : { t: 'alt', options: opts }; }
  function seq(): Node { const items: Node[] = []; while (i < p.length && p[i] !== ')' && p[i] !== '|') items.push(quant()); return { t: 'seq', items }; }
  function quant(): Node {
    const start = i; const a = atom();
    let min = 1, max = 1, has = false;
    if (p[i] === '*') { min = 0; max = Infinity; has = true; i++; }
    else if (p[i] === '+') { min = 1; max = Infinity; has = true; i++; }
    else if (p[i] === '?') { min = 0; max = 1; has = true; i++; }
    else if (p[i] === '{') { const m = /^\{(\d+)(,(\d*))?\}/.exec(p.slice(i)); if (m) { min = +m[1]; max = m[2] === undefined ? min : (m[3] === '' ? Infinity : +m[3]); has = true; i += m[0].length; } }
    if (has) { let lazy = false; if (p[i] === '?') { lazy = true; i++; } return { t: 'rep', min, max, lazy, child: a, sp: [start, i] }; }
    a.sp = [start, i]; return a;
  }
  function atom(): Node {
    const ch = p[i];
    if (ch === '(') {
      i++;
      if (p[i] === '?') {
        const two = p[i + 1];
        if (two === ':') { i += 2; const b = alt(); if (p[i] === ')') i++; return { t: 'group', body: b }; }
        if (two === '=') { i += 2; const b = alt(); if (p[i] === ')') i++; return { t: 'lookahead', neg: false, body: b }; }
        if (two === '!') { i += 2; const b = alt(); if (p[i] === ')') i++; return { t: 'lookahead', neg: true, body: b }; }
        if (two === '<' && p[i + 2] === '=') { i += 3; const b = alt(); if (p[i] === ')') i++; return { t: 'lookbehind', neg: false, body: b }; }
        if (two === '<' && p[i + 2] === '!') { i += 3; const b = alt(); if (p[i] === ')') i++; return { t: 'lookbehind', neg: true, body: b }; }
        if (two === '<') { i += 2; while (i < p.length && p[i] !== '>') i++; i++; const b = alt(); if (p[i] === ')') i++; return { t: 'group', body: b }; }
      }
      const b = alt(); if (p[i] === ')') i++; return { t: 'group', body: b };
    }
    if (ch === '\\' && i + 1 < p.length) {
      if (p[i + 1] === 'b') { i += 2; return { t: 'wordB', neg: false }; }
      if (p[i + 1] === 'B') { i += 2; return { t: 'wordB', neg: true }; }
      const e = escTest(p[i + 1]); i += 2; return { t: 'char', test: e.test };
    }
    if (ch === '[') { const c = parseClass(p, i); i = c.end; return { t: 'char', test: c.test }; }
    if (ch === '.') { i++; return { t: 'char', test: (c: string) => c !== '\n' }; }
    if (ch === '^') { i++; return { t: 'anchorStart' }; }
    if (ch === '$') { i++; return { t: 'anchorEnd' }; }
    const cc = ch; i++; return { t: 'char', test: (c: string) => c === cc };
  }
  return alt();
}

type Frame = { status: string; pos: number; sp: number[] | null; mStart: number; mEnd: number; look: number[] | null; caption: string };

function buildFrames(pattern: string, text: string): Frame[] {
  let ast: Node;
  try { ast = parse(pattern); } catch { return [{ status: 'fail', pos: 0, sp: null, mStart: 0, mEnd: 0, look: null, caption: 'Could not parse the pattern.' }]; }
  const n = text.length;
  const frames: Frame[] = [];
  const MAX = 3000;
  let mStart = 0; let found = false; let silent = 0;
  const emit = (o: Partial<Frame> & { status: string; pos: number; caption: string; mEnd: number }) =>
    { if (silent === 0 && frames.length < MAX) frames.push({ sp: null, look: null, ...o, mStart } as Frame); };

  function probeEnd(node: Node, pos: number): number {
    let end = -1; silent++; match(node, pos, (p2) => { end = p2; return true; }); silent--; return end;
  }
  function probeEndsAt(node: Node, from: number, target: number): boolean {
    silent++; const ok = match(node, from, (p2) => p2 === target); silent--; return ok;
  }

  function match(node: Node, pos: number, k: (p: number) => boolean): boolean {
    if (frames.length >= MAX && silent === 0) return false;
    switch (node.t) {
      case 'seq': { const items = node.items as Node[]; const go = (i: number, p: number): boolean => i === items.length ? k(p) : match(items[i], p, (p2) => go(i + 1, p2)); return go(0, pos); }
      case 'alt': { for (const o of node.options) if (match(o, pos, k)) return true; return false; }
      case 'group': return match(node.body, pos, k);
      case 'anchorStart': if (pos === 0) { emit({ status: 'assert', pos, sp: node.sp, mEnd: pos, caption: `^ holds at ${pos}.` }); return k(pos); } emit({ status: 'mismatch', pos, sp: node.sp, mEnd: pos, caption: `^ fails at ${pos}.` }); return false;
      case 'anchorEnd': if (pos === n) { emit({ status: 'assert', pos, sp: node.sp, mEnd: pos, caption: `$ holds at ${pos}.` }); return k(pos); } emit({ status: 'mismatch', pos, sp: node.sp, mEnd: pos, caption: `$ fails at ${pos}.` }); return false;
      case 'wordB': {
        const before = pos > 0 && isW(text[pos - 1]); const after = pos < n && isW(text[pos]);
        const atB = before !== after; const pass = node.neg ? !atB : atB;
        if (pass) { emit({ status: 'assert', pos, sp: node.sp, mEnd: pos, caption: `${node.neg ? '\\B' : '\\b'} holds at ${pos} (zero-width word ${node.neg ? 'non-boundary' : 'boundary'}).` }); return k(pos); }
        emit({ status: 'mismatch', pos, sp: node.sp, mEnd: pos, caption: `${node.neg ? '\\B' : '\\b'} fails at ${pos}.` }); return false;
      }
      case 'char': {
        if (pos < n && node.test(text[pos])) { emit({ status: 'match', pos, sp: node.sp, mEnd: pos + 1, caption: `Token matches '${text[pos] === ' ' ? '␣' : text[pos]}' at ${pos} — advance.` }); return k(pos + 1); }
        emit({ status: 'mismatch', pos, sp: node.sp, mEnd: pos, caption: `Token fails at ${pos}${pos < n ? " on '" + (text[pos] === ' ' ? '␣' : text[pos]) + "'" : ' (end)'}.` }); return false;
      }
      case 'lookahead': {
        const end = probeEnd(node.body, pos);
        const ok = end >= 0; const pass = node.neg ? !ok : ok;
        emit({ status: pass ? 'assert' : 'mismatch', pos, sp: node.sp, mEnd: pos, look: ok ? [pos, Math.max(pos, end)] : [pos, Math.min(n, pos + 1)], caption: `${node.neg ? 'Negative' : 'Positive'} lookahead at ${pos}: peeks ahead${ok ? ` and matches through ${end}` : ' and does not match'} → ${pass ? 'holds' : 'fails'}. Zero width: cursor stays at ${pos}.` });
        if (pass) return k(pos); return false;
      }
      case 'lookbehind': {
        let hit = false; let start = pos;
        for (let j = pos; j >= 0 && !hit; j--) { if (probeEndsAt(node.body, j, pos)) { hit = true; start = j; } }
        const pass = node.neg ? !hit : hit;
        emit({ status: pass ? 'assert' : 'mismatch', pos, sp: node.sp, mEnd: pos, look: [hit ? start : Math.max(0, pos - 1), pos], caption: `${node.neg ? 'Negative' : 'Positive'} lookbehind at ${pos}: looks back${hit ? ` and matches from ${start}` : ' and finds no match'} → ${pass ? 'holds' : 'fails'}. Zero width: cursor stays at ${pos}.` });
        if (pass) return k(pos); return false;
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

  for (let s = 0; s <= n && !found; s++) { mStart = s; emit({ status: 'start', pos: s, sp: null, mEnd: s, caption: `Begin an attempt at position ${s}.` }); if (match(ast, s, finalK)) break; }
  if (!found) emit({ status: 'fail', pos: n, sp: null, mEnd: n, caption: 'No match found.' });
  return frames;
}

export default function RgxLookaround() {
  const [patText, setPatText] = useState('\\d+(?=px)');
  const [strText, setStrText] = useState('10px 20em 30px');
  const [pattern, setPattern] = useState('\\d+(?=px)');
  const [text, setText] = useState('10px 20em 30px');

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

      <div class="mb-2 font-mono text-sm">
        <span class="mr-1 text-xs text-muted">pattern </span>
        {pattern.split('').map((c, i) => {
          const on = f && f.sp && i >= f.sp[0] && i < f.sp[1];
          return <span key={i} class={`rounded px-0.5 ${on ? 'text-white' : 'text-text'}`} style={on ? `background:${f!.status === 'mismatch' ? C.bad : C.brand}` : ''}>{c}</span>;
        })}
      </div>

      <div class="flex flex-wrap gap-1 font-mono text-sm">
        {text.split('').map((c, i) => {
          const inMatch = f && i >= f.mStart && i < f.mEnd;
          const inLook = f && f.look && i >= f.look[0] && i < f.look[1];
          const isCur = f && i === f.pos && (f.status === 'match' || f.status === 'mismatch');
          const bg = isCur ? (f!.status === 'mismatch' ? C.bad : C.cur) : inMatch ? C.ok : '';
          const ring = inLook && !bg ? `box-shadow: inset 0 0 0 2px ${C.look};` : '';
          return (
            <div key={i} class={`flex h-9 w-7 items-center justify-center rounded-md border ${bg ? 'border-transparent text-white' : 'border-border bg-surface-2 text-text'}`} style={`${bg ? `background:${bg};` : ''}${ring}`}>{c === ' ' ? '␣' : c}</div>
          );
        })}
      </div>
      <div class="mt-1 flex flex-wrap gap-1 font-mono text-[10px] text-muted">
        {text.split('').map((_, i) => (<div key={i} class="w-7 text-center">{i}</div>))}
      </div>

      <div class="mt-2 flex flex-wrap gap-3 text-[11px] text-muted">
        <span class="flex items-center gap-1"><span class="inline-block h-3 w-3 rounded" style={`background:${C.ok}`} /> consumed match</span>
        <span class="flex items-center gap-1"><span class="inline-block h-3 w-3 rounded" style={`box-shadow: inset 0 0 0 2px ${C.look}`} /> lookaround peek (not consumed)</span>
      </div>

      <p class="mt-3 min-h-[2.5rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">{f ? f.caption : 'Try \\d+(?=px), (?<=\\$)\\d+, or \\b(?!admin)\\w+.'}</p>
      {f && f.status === 'found' && <p class="mt-2 rounded-lg bg-brand-soft px-3 py-2 text-sm font-semibold text-text">The peeked (amber) characters are checked but never become part of the match — that's what "zero-width" means.</p>}

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
