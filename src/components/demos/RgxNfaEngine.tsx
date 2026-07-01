import { useEffect, useMemo, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   RgxNfaEngine — compile a pattern to an NFA and run it.
   Part A: Thompson construction turns a small pattern (literals, ., []
   classes, concatenation, |, and * + ?) into a graph of states with
   epsilon edges. The simulator tracks a SET of active states at once
   and steps through the input — no backtracking, O(n·m).
   Part B: a live counter shows how a backtracking engine explodes on
   the classic (a+)+ pattern while the NFA stays linear.
   ------------------------------------------------------------------ */

const C = { start: '#4f46e5', accept: '#10b981', active: '#0ea5e9', edge: 'rgba(120,120,135,0.5)', eps: 'rgba(245,158,11,0.75)' };

const isD = (c: string) => c >= '0' && c <= '9';
const isW = (c: string) => (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || isD(c) || c === '_';
const isS = (c: string) => c === ' ' || c === '\t' || c === '\n' || c === '\r';
function escTest(nx: string) {
  switch (nx) {
    case 'd': return { test: isD, label: '\\d' }; case 'D': return { test: (c: string) => !isD(c), label: '\\D' };
    case 'w': return { test: isW, label: '\\w' }; case 'W': return { test: (c: string) => !isW(c), label: '\\W' };
    case 's': return { test: isS, label: '\\s' }; case 'S': return { test: (c: string) => !isS(c), label: '\\S' };
    default: return { test: (c: string) => c === nx, label: nx };
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
  return { test: neg ? (c: string) => !base(c) : base, end, src: p.slice(i, end) };
}

type Node = any;
function parseNFA(p: string): Node {
  let i = 0;
  function alt(): Node { const opts = [seq()]; while (p[i] === '|') { i++; opts.push(seq()); } return opts.length === 1 ? opts[0] : { t: 'alt', options: opts }; }
  function seq(): Node { const items: Node[] = []; while (i < p.length && p[i] !== ')' && p[i] !== '|') items.push(quant()); return { t: 'seq', items }; }
  function quant(): Node {
    const a = atom();
    if (p[i] === '*') { i++; return { t: 'rep', min: 0, max: Infinity, child: a }; }
    if (p[i] === '+') { i++; return { t: 'rep', min: 1, max: Infinity, child: a }; }
    if (p[i] === '?') { i++; return { t: 'rep', min: 0, max: 1, child: a }; }
    return a;
  }
  function atom(): Node {
    const ch = p[i];
    if (ch === '(') { i++; const b = alt(); if (p[i] === ')') i++; return b; }
    if (ch === '\\' && i + 1 < p.length) { const e = escTest(p[i + 1]); i += 2; return { t: 'char', test: e.test, label: e.label }; }
    if (ch === '[') { const c = parseClass(p, i); i = c.end; return { t: 'char', test: c.test, label: c.src }; }
    if (ch === '.') { i++; return { t: 'char', test: (c: string) => c !== '\n', label: '.' }; }
    const cc = ch; i++; return { t: 'char', test: (c: string) => c === cc, label: cc };
  }
  return alt();
}

type State = { id: number; eps: number[]; trans: { test: (c: string) => boolean; label: string; to: number }[] };
type NFA = { states: State[]; start: number; accept: number };

function buildNFA(pattern: string): NFA | null {
  let ast: Node;
  try { ast = parseNFA(pattern); } catch { return null; }
  const states: State[] = [];
  const mk = () => { const s: State = { id: states.length, eps: [], trans: [] }; states.push(s); return s.id; };
  function compile(node: Node): [number, number] {
    switch (node.t) {
      case 'char': { const s = mk(), a = mk(); states[s].trans.push({ test: node.test, label: node.label, to: a }); return [s, a]; }
      case 'seq': {
        if (!node.items.length) { const s = mk(); return [s, s]; }
        let [start, acc] = compile(node.items[0]);
        for (let k = 1; k < node.items.length; k++) { const [s2, a2] = compile(node.items[k]); states[acc].eps.push(s2); acc = a2; }
        return [start, acc];
      }
      case 'alt': { const s = mk(), a = mk(); for (const o of node.options) { const [os, oa] = compile(o); states[s].eps.push(os); states[oa].eps.push(a); } return [s, a]; }
      case 'rep': {
        const [cs, ca] = compile(node.child);
        if (node.min === 1 && node.max === Infinity) { const a = mk(); states[ca].eps.push(cs); states[ca].eps.push(a); return [cs, a]; }
        if (node.min === 0 && node.max === 1) { const s = mk(), a = mk(); states[s].eps.push(cs); states[s].eps.push(a); states[ca].eps.push(a); return [s, a]; }
        const s = mk(), a = mk(); states[s].eps.push(cs); states[s].eps.push(a); states[ca].eps.push(cs); states[ca].eps.push(a); return [s, a];
      }
    }
    const s = mk(); return [s, s];
  }
  const [start, accept] = compile(ast);
  return { states, start, accept };
}

type SimFrame = { active: number[]; pos: number; char: string | null; done?: boolean; caption: string };
function simulate(nfa: NFA, text: string): { frames: SimFrame[]; accepted: boolean } {
  const { states, start, accept } = nfa;
  const closure = (seed: number[]) => { const seen = new Set(seed); const st = [...seed]; while (st.length) { const s = st.pop()!; for (const e of states[s].eps) if (!seen.has(e)) { seen.add(e); st.push(e); } } return seen; };
  const frames: SimFrame[] = [];
  let cur = closure([start]);
  frames.push({ active: [...cur].sort((a, b) => a - b), pos: 0, char: null, caption: `Start: take the ε-closure of state ${start}. ${cur.size} states are active at once.` });
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const moved = new Set<number>();
    for (const s of cur) for (const t of states[s].trans) if (t.test(ch)) moved.add(t.to);
    cur = closure([...moved]);
    frames.push({ active: [...cur].sort((a, b) => a - b), pos: i + 1, char: ch, caption: cur.size ? `Read '${ch === ' ' ? '␣' : ch}' at ${i}: follow character edges, then ε-closure → ${cur.size} active state(s).` : `Read '${ch === ' ' ? '␣' : ch}' at ${i}: no edge survives — active set is empty. Dead.` });
    if (cur.size === 0) break;
  }
  const last = frames[frames.length - 1];
  const accepted = last.active.includes(accept) && last.pos === text.length;
  frames.push({ active: last.active, pos: last.pos, char: null, done: true, caption: accepted ? `Accept state ${accept} is in the active set and all input was read — MATCH.` : `Accept state ${accept} is not active at the end — NO match.` });
  return { frames, accepted };
}

function layout(nfa: NFA) {
  const n = nfa.states.length;
  const layer = new Array(n).fill(0);
  for (let it = 0; it < n; it++) for (let u = 0; u < n; u++) { const outs = [...nfa.states[u].eps, ...nfa.states[u].trans.map((t) => t.to)]; for (const v of outs) if (v > u && layer[v] < layer[u] + 1) layer[v] = layer[u] + 1; }
  const byLayer: Record<number, number[]> = {};
  for (let s = 0; s < n; s++) (byLayer[layer[s]] ||= []).push(s);
  const pos: Record<number, { x: number; y: number }> = {};
  const DX = 118, DY = 62; let maxL = 0, maxR = 0;
  for (const L in byLayer) { const arr = byLayer[L]; arr.forEach((s, r) => { pos[s] = { x: 46 + Number(L) * DX, y: 42 + r * DY }; }); maxL = Math.max(maxL, Number(L)); maxR = Math.max(maxR, arr.length - 1); }
  return { pos, width: 92 + maxL * DX, height: 84 + maxR * DY };
}

// generic backtracking matcher over the parsed AST, counting steps.
function backtrackCount(pattern: string, text: string): { steps: number; capped: boolean; ok: boolean } {
  let ast: Node; try { ast = parseNFA(pattern); } catch { return { steps: 0, capped: false, ok: false }; }
  const CAP = 2_000_000; let steps = 0; let capped = false; const n = text.length;
  function m(node: Node, pos: number, k: (p: number) => boolean): boolean {
    if (capped) return false;
    if (++steps > CAP) { capped = true; return false; }
    switch (node.t) {
      case 'char': return pos < n && node.test(text[pos]) ? k(pos + 1) : false;
      case 'seq': { const items = node.items as Node[]; const go = (i: number, p: number): boolean => i === items.length ? k(p) : m(items[i], p, (p2) => go(i + 1, p2)); return go(0, pos); }
      case 'alt': { for (const o of node.options) if (m(o, pos, k)) return true; return false; }
      case 'rep': {
        const { min, max, child } = node;
        const step = (p: number, count: number): boolean => {
          const more = () => count < max ? m(child, p, (p2) => (p2 > p ? step(p2, count + 1) : false)) : false;
          const stop = () => count >= min ? k(p) : false;
          if (more()) return true; return stop();
        };
        return step(pos, 0);
      }
    }
    return false;
  }
  const ok = m(ast, 0, (p) => p === n);
  return { steps, capped, ok };
}

export default function RgxNfaEngine() {
  // ---- Part A: NFA simulation ----
  const [patText, setPatText] = useState('(a|b)*c');
  const [strText, setStrText] = useState('abbac');
  const [pattern, setPattern] = useState('(a|b)*c');
  const [text, setText] = useState('abbac');

  const nfa = useMemo(() => buildNFA(pattern), [pattern]);
  const sim = useMemo(() => (nfa ? simulate(nfa, text) : null), [nfa, text]);
  const lay = useMemo(() => (nfa ? layout(nfa) : null), [nfa]);
  const frames = sim ? sim.frames : [];

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
    const interval = 900 / speed;
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

  const f = frames[Math.min(idx, frames.length - 1)] as SimFrame | undefined;
  const activeSet = new Set(f ? f.active : []);

  // ---- Part B: backtracking blow-up ----
  const [n, setN] = useState(12);
  const blow = useMemo(() => {
    const input = 'a'.repeat(n) + '!';
    const bt = backtrackCount('(a+)+', input);
    const nfa2 = buildNFA('(a+)+');
    const sim2 = nfa2 ? simulate(nfa2, input) : null;
    const nfaSteps = sim2 ? (nfa2!.states.length) * (input.length) : 0;
    return { bt, nfaSteps, len: input.length };
  }, [n]);

  return (
    <div class="not-prose space-y-5 rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div>
        <div class="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Part A — NFA simulation (a set of states at once)</div>
        <div class="mb-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <label class="flex items-center gap-2 text-xs text-muted">pattern
            <input value={patText} onInput={(e) => setPatText((e.target as HTMLInputElement).value)} class="w-full rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm text-text" />
          </label>
          <label class="flex items-center gap-2 text-xs text-muted">text
            <input value={strText} onInput={(e) => setStrText((e.target as HTMLInputElement).value)} class="w-full rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm text-text" />
          </label>
          <button onClick={commit} class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Build</button>
        </div>
        <p class="mb-2 text-[11px] text-muted">Supports literals, ., [classes], concatenation, | and the quantifiers * + ? (the Thompson-constructible subset).</p>

        {/* input cells */}
        <div class="flex flex-wrap gap-1 font-mono text-sm">
          {text.split('').map((c, i) => {
            const read = f && i < f.pos;
            const cur = f && i === f.pos && !f.done;
            const bg = cur ? C.active : read ? C.accept : '';
            return <div key={i} class={`flex h-8 w-7 items-center justify-center rounded-md border ${bg ? 'border-transparent text-white' : 'border-border bg-surface-2 text-text'}`} style={bg ? `background:${bg}` : ''}>{c === ' ' ? '␣' : c}</div>;
          })}
        </div>

        {/* NFA graph */}
        {nfa && lay ? (
          <div class="mt-3 overflow-x-auto rounded-lg border border-border bg-surface-2 p-2">
            <svg width={lay.width} height={lay.height} viewBox={`0 0 ${lay.width} ${lay.height}`} class="min-w-full">
              <defs>
                <marker id="rgxarrow" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="rgba(120,120,135,0.7)" /></marker>
              </defs>
              {nfa.states.map((st) => {
                const from = lay.pos[st.id];
                return [
                  ...st.eps.map((to, ei) => { const p2 = lay.pos[to]; const back = to <= st.id; const my = (from.y + p2.y) / 2 + (back ? -26 : 0); return <path key={`e${st.id}-${ei}`} d={`M${from.x + 14},${from.y} Q${(from.x + p2.x) / 2},${my} ${p2.x - 14},${p2.y}`} fill="none" stroke={C.eps} stroke-width="1.5" stroke-dasharray="4 3" marker-end="url(#rgxarrow)" />; }),
                  ...st.trans.map((t, ti) => { const p2 = lay.pos[t.to]; const mx = (from.x + p2.x) / 2, myy = (from.y + p2.y) / 2; return <g key={`t${st.id}-${ti}`}><line x1={from.x + 14} y1={from.y} x2={p2.x - 14} y2={p2.y} stroke={C.edge} stroke-width="1.8" marker-end="url(#rgxarrow)" /><text x={mx} y={myy - 4} font-size="12" font-family="monospace" fill="currentColor" text-anchor="middle" class="text-text">{t.label}</text></g>; }),
                ];
              })}
              {nfa.states.map((st) => {
                const p = lay.pos[st.id]; const on = activeSet.has(st.id);
                return (
                  <g key={`s${st.id}`}>
                    {st.id === nfa.accept && <circle cx={p.x} cy={p.y} r="15" fill="none" stroke={on ? C.accept : 'rgba(120,120,135,0.6)'} stroke-width="1.5" />}
                    <circle cx={p.x} cy={p.y} r="12" fill={on ? C.active : 'rgba(120,120,135,0.14)'} stroke={st.id === nfa.start ? C.start : st.id === nfa.accept ? C.accept : 'rgba(120,120,135,0.7)'} stroke-width={st.id === nfa.start ? 2.5 : 1.5} />
                    <text x={p.x} y={p.y + 4} font-size="11" font-family="monospace" text-anchor="middle" fill={on ? '#ffffff' : 'currentColor'} class="text-text">{st.id}</text>
                  </g>
                );
              })}
            </svg>
          </div>
        ) : (
          <div class="mt-3 rounded-lg border border-border bg-surface-2 p-3 text-sm text-rose-500">Could not build an NFA from that pattern (use only literals, ., [ ], |, ( ) and * + ?).</div>
        )}

        <p class="mt-3 min-h-[2.5rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">{f ? f.caption : 'Build an NFA and press Play.'}</p>
        {f && f.done && sim && <p class="mt-2 rounded-lg bg-brand-soft px-3 py-2 text-sm font-semibold text-text">{sim.accepted ? 'Matched — and every character was visited exactly once.' : 'No match — but notice the engine never backtracked.'}</p>}

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
        <div class="mt-2 flex flex-wrap gap-3 text-[11px] text-muted">
          <span class="flex items-center gap-1"><span class="inline-block h-3 w-3 rounded-full" style={`background:${C.active}`} /> active state</span>
          <span class="flex items-center gap-1"><span class="inline-block h-3 w-3 rounded-full border-2" style={`border-color:${C.start}`} /> start</span>
          <span class="flex items-center gap-1"><span class="inline-block h-3 w-3 rounded-full border-2" style={`border-color:${C.accept}`} /> accept</span>
          <span class="flex items-center gap-1"><span class="inline-block h-0.5 w-4" style={`background:${C.eps}`} /> ε-edge</span>
        </div>
      </div>

      {/* Part B */}
      <div class="rounded-lg border border-border bg-surface-2 p-3">
        <div class="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Part B — catastrophic backtracking on (a+)+</div>
        <label class="flex items-center gap-2 text-xs text-muted">a's in the input: {n}
          <input type="range" min={1} max={26} step={1} value={n} onInput={(e) => setN(parseInt((e.target as HTMLInputElement).value, 10))} class="w-40 accent-[#4f46e5]" />
        </label>
        <p class="mt-1 text-xs text-muted">Input is <code class="font-mono">{'a'.repeat(Math.min(n, 26))}!</code> — the trailing "!" forces failure, so a backtracking engine tries every way to split the a's.</p>
        <div class="mt-2 grid gap-2 sm:grid-cols-2">
          <div class="rounded-lg bg-surface p-3">
            <div class="text-xs text-muted">Backtracking steps</div>
            <div class="font-mono text-lg font-bold" style={`color:${blow.bt.capped ? '#ef4444' : C.start}`}>{blow.bt.capped ? '2,000,000+ 💥' : blow.bt.steps.toLocaleString()}</div>
          </div>
          <div class="rounded-lg bg-surface p-3">
            <div class="text-xs text-muted">NFA simulation steps (≈ states × length)</div>
            <div class="font-mono text-lg font-bold" style={`color:${C.accept}`}>{blow.nfaSteps.toLocaleString()}</div>
          </div>
        </div>
        <p class="mt-2 text-xs text-muted">Slide right: the backtracking count roughly doubles per extra "a" (exponential) while the NFA count grows by a constant each time (linear). That gap is a ReDoS vulnerability.</p>
      </div>
    </div>
  );
}
