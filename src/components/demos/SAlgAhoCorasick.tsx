import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated Aho-Corasick automaton.
   - Edit the dictionary (comma-separated patterns) and the text. The demo
     builds a trie of the patterns with dashed FAILURE LINKS, then walks
     the text one character at a time. On a mismatch the current state
     jumps along a failure link instead of restarting.
   - Each frame highlights the active node, the root->state path, and any
     patterns that just matched, with a caption.
   - Transport: Play / Pause / Step / Back / Reset + speed.
   ------------------------------------------------------------------ */

const COLORS = { cur: '#0ea5e9', out: '#10b981', fail: '#4f46e5' };

type Node = { children: Map<string, number>; fail: number; output: string[]; depth: number; label: string; parent: number };
type Match = { pos: number; pat: string };
type Frame = { pos: number; state: number; matches: Match[]; note: string };

function build(patterns: string[]) {
  const nodes: Node[] = [{ children: new Map(), fail: 0, output: [], depth: 0, label: '·', parent: -1 }];
  for (const pat of patterns) {
    let cur = 0;
    for (const ch of pat) {
      if (!nodes[cur].children.has(ch)) {
        nodes.push({ children: new Map(), fail: 0, output: [], depth: nodes[cur].depth + 1, label: ch, parent: cur });
        nodes[cur].children.set(ch, nodes.length - 1);
      }
      cur = nodes[cur].children.get(ch)!;
    }
    nodes[cur].output.push(pat);
  }
  // BFS failure links
  const q: number[] = [];
  for (const [, c] of nodes[0].children) { nodes[c].fail = 0; q.push(c); }
  while (q.length) {
    const u = q.shift()!;
    for (const [ch, c] of nodes[u].children) {
      q.push(c);
      let f = nodes[u].fail;
      while (f !== 0 && !nodes[f].children.has(ch)) f = nodes[f].fail;
      nodes[c].fail = nodes[f].children.has(ch) && nodes[f].children.get(ch) !== c ? nodes[f].children.get(ch)! : 0;
    }
  }
  return nodes;
}

function layout(nodes: Node[]) {
  const pos: { x: number; y: number }[] = new Array(nodes.length);
  let row = 0;
  const dfs = (u: number) => {
    pos[u] = { x: nodes[u].depth, y: row++ };
    for (const [, c] of nodes[u].children) dfs(c);
  };
  dfs(0);
  return pos;
}

function frames(nodes: Node[], text: string): Frame[] {
  const fr: Frame[] = [{ pos: -1, state: 0, matches: [], note: 'Automaton built. Start at the root and read the text left to right.' }];
  let state = 0;
  const all: Match[] = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    let jumped = false;
    while (state !== 0 && !nodes[state].children.has(ch)) { state = nodes[state].fail; jumped = true; }
    if (nodes[state].children.has(ch)) state = nodes[state].children.get(ch)!;
    const newMatches: Match[] = [];
    let t = state;
    while (t !== 0) { for (const pat of nodes[t].output) newMatches.push({ pos: i - pat.length + 1, pat }); t = nodes[t].fail; }
    all.push(...newMatches);
    const note = `Read '${ch}'. ${jumped ? 'No child — follow failure links, then step. ' : ''}${newMatches.length ? `Matched: ${newMatches.map((m) => `"${m.pat}"@${m.pos}`).join(', ')}.` : 'No pattern ends here.'}`;
    fr.push({ pos: i, state, matches: [...all], note });
  }
  return fr;
}

const cleanPats = (s: string) => s.split(',').map((x) => x.replace(/[^a-zA-Z]/g, '').toLowerCase()).filter((x) => x.length).slice(0, 6);
const cleanText = (s: string) => s.replace(/[^a-zA-Z]/g, '').toLowerCase().slice(0, 24);

export default function SAlgAhoCorasick() {
  const [patIn, setPatIn] = useState('he, she, his, hers');
  const [textIn, setTextIn] = useState('ushers');
  const [patterns, setPatterns] = useState<string[]>(() => cleanPats('he, she, his, hers'));
  const [text, setText] = useState('ushers');
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);
  idxRef.current = idx;

  const nodes = build(patterns);
  const pos = layout(nodes);
  const frs = frames(nodes, text);
  const maxDepth = Math.max(...nodes.map((n) => n.depth));
  const colGap = 74, rowGap = 42, pad = 28;
  const w = maxDepth * colGap + pad * 2 + 20;
  const h = nodes.length * rowGap + pad;
  const X = (u: number) => pad + pos[u].x * colGap + 12;
  const Y = (u: number) => pad + pos[u].y * rowGap;

  const commit = () => { const p = cleanPats(patIn), t = cleanText(textIn); if (p.length && t.length) { setPatterns(p); setText(t); setIdx(0); setPlaying(false); } };

  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 950 / speed;
    const tick = (ts: number) => {
      if (!lastRef.current) lastRef.current = ts;
      if (ts - lastRef.current >= interval) {
        lastRef.current = ts;
        const next = idxRef.current + 1;
        if (next >= frs.length) { setIdx(frs.length - 1); setPlaying(false); return; }
        setIdx(next);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
  }, [playing, speed, patterns, text]);

  const reset = () => { setPlaying(false); setIdx(0); lastRef.current = 0; };
  const stepF = () => { setPlaying(false); setIdx((v) => Math.min(frs.length - 1, v + 1)); };
  const stepB = () => { setPlaying(false); setIdx((v) => Math.max(0, v - 1)); };
  const play = () => { if (idx >= frs.length - 1) setIdx(0); lastRef.current = 0; setPlaying((p) => !p); };

  const f = frs[Math.min(idx, frs.length - 1)];
  const done = idx >= frs.length - 1;
  // path root -> state
  const path = new Set<number>();
  { let u = f.state; while (u !== -1) { path.add(u); u = nodes[u].parent; } }

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <input value={patIn} onInput={(e) => setPatIn((e.target as HTMLInputElement).value)} class="min-w-[10rem] flex-1 rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm" placeholder="patterns, comma-separated" />
        <input value={textIn} onInput={(e) => setTextIn((e.target as HTMLInputElement).value)} class="w-32 rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm" placeholder="text" />
        <button onClick={commit} class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Load</button>
      </div>

      {/* text ribbon */}
      <div class="mb-3 flex flex-wrap gap-1 font-mono text-sm">
        {text.split('').map((ch, j) => (
          <div key={j} class={`flex h-8 w-7 items-center justify-center rounded-md border font-bold transition ${j === f.pos ? 'border-transparent text-white' : j < f.pos ? 'border-border bg-surface-2 text-muted' : 'border-border bg-surface-2 text-text'}`} style={j === f.pos ? `background:${COLORS.cur}` : ''}>{ch}</div>
        ))}
      </div>

      <div class="overflow-auto rounded-xl bg-surface-2">
        <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} class="touch-none" style="max-width:100%;height:auto">
          <defs>
            <marker id="acfail" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill={COLORS.fail} /></marker>
          </defs>
          {/* trie edges */}
          {nodes.map((n, u) => n.parent >= 0 && (
            <line key={`e${u}`} x1={X(n.parent)} y1={Y(n.parent)} x2={X(u)} y2={Y(u)} stroke={path.has(u) && path.has(n.parent) ? COLORS.cur : 'rgba(128,128,128,0.35)'} stroke-width={path.has(u) && path.has(n.parent) ? 2.5 : 1.4} />
          ))}
          {/* failure links (skip fail==0 to reduce clutter) */}
          {nodes.map((n, u) => u !== 0 && n.fail !== 0 && (
            <line key={`f${u}`} x1={X(u)} y1={Y(u)} x2={X(n.fail)} y2={Y(n.fail)} stroke={COLORS.fail} stroke-width={1.2} stroke-dasharray="4 3" opacity={0.55} marker-end="url(#acfail)" />
          ))}
          {/* nodes */}
          {nodes.map((n, u) => {
            const isCur = u === f.state && f.pos >= 0;
            const isOut = n.output.length > 0;
            const fill = isCur ? COLORS.cur : path.has(u) ? 'rgba(14,165,233,0.18)' : 'var(--surface, #fff)';
            return (
              <g key={`n${u}`}>
                <circle cx={X(u)} cy={Y(u)} r={14} fill={fill} stroke={isOut ? COLORS.out : 'rgba(128,128,128,0.5)'} stroke-width={isOut ? 2.5 : 1.4} />
                <text x={X(u)} y={Y(u) + 4} text-anchor="middle" font-size="12" font-family="monospace" font-weight="bold" fill={isCur ? '#fff' : 'currentColor'}>{n.label}</text>
              </g>
            );
          })}
        </svg>
      </div>

      <p class="mt-3 min-h-[2.5rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">{f.note}</p>
      {done && <p class="mt-2 rounded-lg bg-brand-soft px-3 py-2 text-sm font-semibold text-text">All matches: {f.matches.length ? f.matches.map((m) => `"${m.pat}"@${m.pos}`).join(', ') : '(none)'}. One pass over the text found every pattern at once.</p>}

      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={stepB} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏮ Back</button>
        <button onClick={play} class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90">{playing ? '⏸ Pause' : '▶ Play'}</button>
        <button onClick={stepF} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏭ Step</button>
        <button onClick={reset} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">↺ Reset</button>
        <label class="ml-auto flex items-center gap-2 text-xs text-muted">speed
          <input type="range" min={0.5} max={3} step={0.5} value={speed} onInput={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))} class="w-24 accent-[#4f46e5]" />
        </label>
      </div>
      <p class="mt-2 text-center text-xs text-muted">Solid = trie edges, dashed indigo = failure links, emerald ring = a node where a pattern ends.</p>
    </div>
  );
}
