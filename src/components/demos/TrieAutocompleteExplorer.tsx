import { useEffect, useMemo, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated trie autocomplete.
   - Edit the DICTIONARY (the stored words) and a PREFIX.
   - The demo first walks down to the prefix node (lighting the path),
     then depth-first explores the whole subtree, collecting every
     end-of-word it meets into a live suggestion list.
   - Transport: ▶ Play / ⏸ Pause / ⏭ Step / ⏮ Back / ↺ Reset + speed.
     Frames are precomputed and index-driven; autoplay uses
     requestAnimationFrame, cancelled on pause/unmount.
   ------------------------------------------------------------------ */

const AC_COLORS = {
  brand: '#4f46e5',
  sky: '#0ea5e9',
  green: '#10b981',
  red: '#ef4444',
  edge: 'rgba(128,128,128,0.45)',
  nodeFill: 'rgba(79,70,229,0.12)',
  dim: 'rgba(128,128,128,0.10)',
};

type AcNode = {
  id: number;
  char: string;
  parent: number;
  depth: number;
  children: Map<string, number>;
  isEnd: boolean;
  gx: number;
};

type AcFrame = {
  active: number;
  path: number[];
  explored: number[];
  suggestions: string[];
  caption: string;
  status?: 'none' | 'done';
};

type AcBuilt = { nodes: AcNode[]; root: number; leaves: number; maxDepth: number };

function acParseWords(s: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of s.split(/[\s,]+/)) {
    const w = raw.toLowerCase().replace(/[^a-z]/g, '').slice(0, 9);
    if (w && !seen.has(w)) { seen.add(w); out.push(w); }
    if (out.length >= 9) break;
  }
  return out;
}

function acPathTo(nodes: AcNode[], id: number): number[] {
  const out: number[] = [];
  let cur = id;
  while (cur !== -1) { out.unshift(cur); cur = nodes[cur].parent; }
  return out;
}

function acBuild(words: string[]): AcBuilt {
  const nodes: AcNode[] = [];
  const make = (char: string, parent: number, depth: number) => {
    const id = nodes.length;
    nodes.push({ id, char, parent, depth, children: new Map(), isEnd: false, gx: 0 });
    return id;
  };
  const root = make('', -1, 0);
  for (const word of words) {
    let cur = root;
    for (const ch of word) {
      let child = nodes[cur].children.get(ch);
      if (child === undefined) { child = make(ch, cur, nodes[cur].depth + 1); nodes[cur].children.set(ch, child); }
      cur = child;
    }
    nodes[cur].isEnd = true;
  }
  // layout
  let leaf = 0;
  let maxDepth = 0;
  const dfs = (id: number) => {
    maxDepth = Math.max(maxDepth, nodes[id].depth);
    const kids = [...nodes[id].children.values()].sort((a, b) => (nodes[a].char < nodes[b].char ? -1 : 1));
    if (kids.length === 0) { nodes[id].gx = leaf++; return; }
    let sum = 0;
    for (const k of kids) { dfs(k); sum += nodes[k].gx; }
    nodes[id].gx = sum / kids.length;
  };
  dfs(root);
  return { nodes, root, leaves: Math.max(1, leaf), maxDepth };
}

function acFrames(nodes: AcNode[], root: number, prefix: string): AcFrame[] {
  const frames: AcFrame[] = [];
  let cur = root;
  let path = [root];
  let built = '';
  frames.push({ active: root, path: [root], explored: [], suggestions: [], caption: `Autocomplete "${prefix}": first walk down to the prefix node.` });
  for (const ch of prefix) {
    built += ch;
    const child = nodes[cur].children.get(ch);
    if (child === undefined) {
      frames.push({ active: cur, path: [...path], explored: [], suggestions: [], caption: `No edge for '${ch}'. No word starts with "${prefix}".`, status: 'none' });
      return frames;
    }
    cur = child;
    path = [...path, cur];
    frames.push({ active: cur, path: [...path], explored: [], suggestions: [], caption: `Matched '${ch}' — now at prefix "${built}".` });
  }
  const prefixId = cur;
  const prefixPath = [...path];
  const suggestions: string[] = [];
  const explored: number[] = [];
  const explore = (id: number, word: string, here: number[]) => {
    explored.push(id);
    if (nodes[id].isEnd) {
      suggestions.push(word);
      frames.push({ active: id, path: [...here], explored: [...explored], suggestions: [...suggestions], caption: `End-of-word reached — add "${word}" to the suggestions.` });
    } else {
      frames.push({ active: id, path: [...here], explored: [...explored], suggestions: [...suggestions], caption: `Visiting "${word}" — not a word itself, so dive into its branches.` });
    }
    const kids = [...nodes[id].children.values()].sort((a, b) => (nodes[a].char < nodes[b].char ? -1 : 1));
    for (const k of kids) explore(k, word + nodes[k].char, [...here, k]);
  };
  explore(prefixId, prefix, prefixPath);
  frames.push({
    active: prefixId,
    path: [...prefixPath],
    explored: [...explored],
    suggestions: [...suggestions],
    caption: suggestions.length
      ? `Done — ${suggestions.length} completion(s) for "${prefix}": ${suggestions.join(', ')}.`
      : `"${prefix}" is a valid prefix but no stored word completes it.`,
    status: 'done',
  });
  return frames;
}

export default function TrieAutocompleteExplorer() {
  const [wordText, setWordText] = useState('cat, car, card, care, careful, cape, dog');
  const [words, setWords] = useState<string[]>(() => acParseWords('cat, car, card, care, careful, cape, dog'));
  const [prefixText, setPrefixText] = useState('car');
  const [prefix, setPrefix] = useState('car');
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ colW: 60, rowH: 70, padX: 24, padY: 30 });
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);
  idxRef.current = idx;

  const built = useMemo(() => acBuild(words), [words]);
  const frames = useMemo(() => acFrames(built.nodes, built.root, prefix), [built, prefix]);
  const framesRef = useRef(frames);
  framesRef.current = frames;
  const total = frames.length;

  const loadWords = () => {
    const parsed = acParseWords(wordText);
    if (parsed.length) { setWords(parsed); setIdx(0); setPlaying(false); }
  };
  const loadPrefix = () => {
    const p = prefixText.toLowerCase().replace(/[^a-z]/g, '').slice(0, 12);
    setPrefix(p); setIdx(0); setPlaying(false);
  };

  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 820 / speed;
    const tick = (t: number) => {
      if (!lastRef.current) lastRef.current = t;
      if (t - lastRef.current >= interval) {
        lastRef.current = t;
        const next = idxRef.current + 1;
        if (next >= total + 1) { setIdx(total); setPlaying(false); return; }
        setIdx(next);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
  }, [playing, speed, total]);

  const reset = () => { setPlaying(false); setIdx(0); lastRef.current = 0; };
  const stepF = () => { setPlaying(false); setIdx((v) => Math.min(total, v + 1)); };
  const stepB = () => { setPlaying(false); setIdx((v) => Math.max(0, v - 1)); };
  const play = () => { if (idx >= total) setIdx(0); lastRef.current = 0; setPlaying((p) => !p); };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { colW, rowH, padX, padY } = sizeRef.current;
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

    const { nodes, root } = built;
    const frame = idx > 0 ? framesRef.current[idx - 1] : null;
    const activeId = frame ? frame.active : root;
    const pathSet = new Set(frame ? frame.path : [root]);
    const exploredSet = new Set(frame ? frame.explored : []);
    const r = 17;
    const xy = (n: AcNode) => ({ x: padX + (n.gx + 0.5) * colW, y: padY + n.depth * rowH });

    for (const n of nodes) {
      if (n.parent === -1) continue;
      const a = xy(nodes[n.parent]);
      const b = xy(n);
      const onPath = pathSet.has(n.id) && pathSet.has(n.parent);
      const onExplore = exploredSet.has(n.id) && exploredSet.has(n.parent);
      ctx.strokeStyle = onPath ? AC_COLORS.brand : onExplore ? AC_COLORS.sky : AC_COLORS.edge;
      ctx.lineWidth = onPath || onExplore ? 3 : 1.5;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    for (const n of nodes) {
      const { x, y } = xy(n);
      const isActive = n.id === activeId;
      const onPath = pathSet.has(n.id);
      const onExplore = exploredSet.has(n.id);

      if (n.isEnd) {
        ctx.beginPath();
        ctx.arc(x, y, r + 3.5, 0, Math.PI * 2);
        ctx.strokeStyle = AC_COLORS.green;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      let fill = AC_COLORS.dim;
      let textColor = '#94a3b8';
      if (isActive && n.isEnd) { fill = AC_COLORS.green; textColor = '#fff'; }
      else if (isActive) { fill = AC_COLORS.brand; textColor = '#fff'; }
      else if (onPath) { fill = AC_COLORS.nodeFill; textColor = AC_COLORS.brand; }
      else if (onExplore) { fill = 'rgba(14,165,233,0.20)'; textColor = AC_COLORS.sky; }
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = isActive ? '#fff' : 'rgba(128,128,128,0.5)';
      ctx.lineWidth = isActive ? 2.5 : 1.5;
      ctx.stroke();

      ctx.fillStyle = textColor;
      ctx.font = `${n.parent === -1 ? 12 : 15}px ui-monospace, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(n.parent === -1 ? '•' : n.char, x, y + 1);
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 560);
      const colW = Math.max(34, Math.min(70, w / built.leaves));
      const rowH = 70;
      const padX = 24;
      const padY = 30;
      const gw = Math.max(w, padX * 2 + built.leaves * colW);
      const gh = padY * 2 + built.maxDepth * rowH;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = gw * dpr;
      canvas.height = gh * dpr;
      canvas.style.width = `${gw}px`;
      canvas.style.height = `${gh}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { colW, rowH, padX, padY };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [built]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(draw, [idx, built, frames]);

  const frame = idx > 0 ? frames[idx - 1] : null;
  const caption = frame ? frame.caption : `Press Play to autocomplete "${prefix}".`;
  const suggestions = frame ? frame.suggestions : [];
  const done = idx >= total && frame?.status === 'done';

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 grid gap-2 sm:grid-cols-2">
        <div class="flex items-center gap-2">
          <input value={wordText} onInput={(e) => setWordText((e.target as HTMLInputElement).value)} class="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm" placeholder="dictionary words" />
          <button onClick={loadWords} class="shrink-0 rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Load</button>
        </div>
        <div class="flex items-center gap-2">
          <input value={prefixText} onInput={(e) => setPrefixText((e.target as HTMLInputElement).value)} class="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm" placeholder="prefix to complete" />
          <button onClick={loadPrefix} class="shrink-0 rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Complete</button>
        </div>
      </div>

      <div class="mb-2 flex items-center gap-2 text-xs text-muted">
        <span>Suggestions:</span>
        <div class="flex flex-1 flex-wrap gap-1.5">
          {suggestions.length === 0 && <span class="text-muted">—</span>}
          {suggestions.map((w, i) => (
            <span key={i} class="rounded-md bg-brand-soft px-2 py-0.5 font-mono text-text">{w}</span>
          ))}
        </div>
        <span class="ml-auto shrink-0">step {idx} / {total}</span>
      </div>

      <div class="overflow-x-auto rounded-xl bg-surface-2 p-2">
        <canvas ref={canvasRef} class="touch-none" />
      </div>

      <p class="mt-3 min-h-[2.75rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">{caption}</p>
      {done && suggestions.length > 0 && <p class="mt-2 rounded-lg bg-brand-soft px-3 py-2 text-sm font-semibold text-text">Walking to the prefix cost O(P); listing the {suggestions.length} completion(s) cost time proportional to the subtree explored.</p>}

      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={stepB} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏮ Back</button>
        <button onClick={play} class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90">{playing ? '⏸ Pause' : '▶ Play'}</button>
        <button onClick={stepF} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏭ Step</button>
        <button onClick={reset} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">↺ Reset</button>
        <label class="ml-auto flex items-center gap-2 text-xs text-muted">speed
          <input type="range" min={0.5} max={3} step={0.5} value={speed} onInput={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))} class="w-24 accent-[#4f46e5]" />
        </label>
      </div>
      <p class="mt-2 text-center text-xs text-muted">Indigo = the path to the prefix; sky = the subtree being explored; green ring = a complete word.</p>
    </div>
  );
}
