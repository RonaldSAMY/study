import { useEffect, useMemo, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated trie (prefix tree) builder + search.
   - Edit the WORD LIST: the demo inserts every word character by
     character, creating a node along the path for each new letter and
     re-using nodes that already exist. End-of-word nodes get a ring.
   - Edit the SEARCH box: the demo walks the path letter by letter,
     lighting it up, and reports hit / prefix-only / miss.
   - Transport: ▶ Play / ⏸ Pause / ⏭ Step / ⏮ Back / ↺ Reset + speed.
     Frames are precomputed and index-driven; autoplay uses
     requestAnimationFrame and is cancelled on pause/unmount.
   ------------------------------------------------------------------ */

const COLORS = {
  brand: '#4f46e5', // active node
  sky: '#0ea5e9',   // path
  green: '#10b981', // hit / end-of-word
  red: '#ef4444',   // miss
  edge: 'rgba(128,128,128,0.45)',
  nodeFill: 'rgba(79,70,229,0.12)',
};

type Node = {
  id: number;
  char: string;
  parent: number; // -1 for root
  depth: number;
  children: Map<string, number>;
  isEnd: boolean;
  gx: number;        // grid column (set during layout)
  createStep: number; // build-step at which this node is created (-1 = root)
  endStep: number;    // build-step at which it becomes end-of-word (-1 = never)
};

type Frame = {
  active: number;
  created: boolean;
  path: number[];
  caption: string;
  status?: 'hit' | 'prefix' | 'miss';
};

type Built = { nodes: Node[]; root: number; insertFrames: Frame[]; leaves: number; maxDepth: number };

function parseWords(s: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of s.split(/[\s,]+/)) {
    const w = raw.toLowerCase().replace(/[^a-z]/g, '').slice(0, 8);
    if (w && !seen.has(w)) { seen.add(w); out.push(w); }
    if (out.length >= 8) break;
  }
  return out;
}

function pathTo(nodes: Node[], id: number): number[] {
  const out: number[] = [];
  let cur = id;
  while (cur !== -1) { out.unshift(cur); cur = nodes[cur].parent; }
  return out;
}

function layout(nodes: Node[], root: number): { leaves: number; maxDepth: number } {
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
  return { leaves: Math.max(1, leaf), maxDepth };
}

function buildTrie(words: string[]): Built {
  const nodes: Node[] = [];
  const make = (char: string, parent: number, depth: number) => {
    const id = nodes.length;
    nodes.push({ id, char, parent, depth, children: new Map(), isEnd: false, gx: 0, createStep: -1, endStep: -1 });
    return id;
  };
  const root = make('', -1, 0);
  const insertFrames: Frame[] = [];
  let step = 0;
  for (const word of words) {
    let cur = root;
    let prefix = '';
    for (const ch of word) {
      prefix += ch;
      let created = false;
      let child = nodes[cur].children.get(ch);
      if (child === undefined) {
        child = make(ch, cur, nodes[cur].depth + 1);
        nodes[cur].children.set(ch, child);
        nodes[child].createStep = step;
        created = true;
      }
      insertFrames.push({
        active: child,
        created,
        path: pathTo(nodes, child),
        caption: created
          ? `Insert "${word}": no edge for '${ch}' yet, so create a new node.`
          : `Insert "${word}": an edge for '${ch}' already exists, so re-use it.`,
      });
      cur = child;
      step++;
    }
    if (!nodes[cur].isEnd) { nodes[cur].isEnd = true; nodes[cur].endStep = step - 1; }
    const last = insertFrames[insertFrames.length - 1];
    if (last) last.caption += ` "${word}" finished — mark this node as end-of-word.`;
  }
  const { leaves, maxDepth } = layout(nodes, root);
  return { nodes, root, insertFrames, leaves, maxDepth };
}

function searchFrames(nodes: Node[], root: number, query: string): Frame[] {
  const frames: Frame[] = [];
  let cur = root;
  let path = [root];
  frames.push({ active: root, created: false, path: [...path], caption: `Start at the root and walk "${query}" one letter at a time.` });
  let prefix = '';
  let broke = false;
  for (const ch of query) {
    prefix += ch;
    const child = nodes[cur].children.get(ch);
    if (child === undefined) {
      frames.push({ active: cur, created: false, path: [...path], caption: `No edge for '${ch}'. The trie has no "${query}" — miss.`, status: 'miss' });
      broke = true;
      break;
    }
    cur = child;
    path = [...path, cur];
    frames.push({ active: cur, created: false, path: [...path], caption: `Matched '${ch}'. Prefix "${prefix}" exists — keep walking.` });
  }
  if (!broke) {
    const isWord = nodes[cur].isEnd;
    frames.push({
      active: cur,
      created: false,
      path: [...path],
      caption: isWord
        ? `Reached the last letter and this node is marked end-of-word — "${query}" is a stored word. Hit!`
        : `Reached the last letter, but this node is not end-of-word — "${query}" exists only as a prefix.`,
      status: isWord ? 'hit' : 'prefix',
    });
  }
  return frames;
}

export default function TrieWordBuilder() {
  const [wordText, setWordText] = useState('cat, car, card, care, dog');
  const [words, setWords] = useState<string[]>(() => parseWords('cat, car, card, care, dog'));
  const [queryText, setQueryText] = useState('care');
  const [query, setQuery] = useState('care');
  const [mode, setMode] = useState<'build' | 'search'>('build');
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ colW: 60, rowH: 70, padX: 24, padY: 30 });
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);
  idxRef.current = idx;

  const built = useMemo(() => buildTrie(words), [words]);
  const frames = useMemo(
    () => (mode === 'search' ? searchFrames(built.nodes, built.root, query) : built.insertFrames),
    [mode, built, query]
  );
  const framesRef = useRef(frames);
  framesRef.current = frames;
  const total = frames.length;

  const loadWords = () => {
    const parsed = parseWords(wordText);
    if (parsed.length) { setWords(parsed); setMode('build'); setIdx(0); setPlaying(false); }
  };
  const runSearch = () => {
    const q = queryText.toLowerCase().replace(/[^a-z]/g, '').slice(0, 12);
    setQuery(q); setMode('search'); setIdx(0); setPlaying(false);
  };
  const animateInsert = () => { setMode('build'); setIdx(0); setPlaying(false); };

  // autoplay
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
    const r = 17;

    const visible = (n: Node) => mode === 'search' ? true : n.createStep < idx; // root createStep = -1
    const endVisible = (n: Node) => mode === 'search' ? n.isEnd : n.endStep >= 0 && n.endStep < idx;
    const xy = (n: Node) => ({ x: padX + (n.gx + 0.5) * colW, y: padY + n.depth * rowH });

    // edges
    for (const n of nodes) {
      if (n.parent === -1 || !visible(n) || !visible(nodes[n.parent])) continue;
      const a = xy(nodes[n.parent]);
      const b = xy(n);
      const onPath = pathSet.has(n.id) && pathSet.has(n.parent);
      ctx.strokeStyle = onPath ? COLORS.sky : COLORS.edge;
      ctx.lineWidth = onPath ? 3 : 1.5;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    // nodes
    for (const n of nodes) {
      if (!visible(n)) continue;
      const { x, y } = xy(n);
      const isActive = n.id === activeId;
      const onPath = pathSet.has(n.id);
      const status = frame?.status;

      // end-of-word ring
      if (endVisible(n)) {
        ctx.beginPath();
        ctx.arc(x, y, r + 3.5, 0, Math.PI * 2);
        ctx.strokeStyle = COLORS.green;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      let fill = COLORS.nodeFill;
      let textColor = COLORS.brand;
      if (isActive && status === 'miss') { fill = COLORS.red; textColor = '#fff'; }
      else if (isActive && status === 'hit') { fill = COLORS.green; textColor = '#fff'; }
      else if (isActive) { fill = COLORS.brand; textColor = '#fff'; }
      else if (onPath) { fill = 'rgba(14,165,233,0.20)'; textColor = COLORS.sky; }
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = isActive ? '#fff' : 'rgba(128,128,128,0.55)';
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
  useEffect(draw, [idx, mode, built, frames]);

  const frame = idx > 0 ? frames[idx - 1] : null;
  const caption = frame
    ? frame.caption
    : mode === 'build'
      ? 'Press Play to insert every word into the trie, one letter at a time.'
      : `Press Play to walk the path for "${query}".`;
  const status = idx >= total ? frame?.status : undefined;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 grid gap-2 sm:grid-cols-2">
        <div class="flex items-center gap-2">
          <input value={wordText} onInput={(e) => setWordText((e.target as HTMLInputElement).value)} class="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm" placeholder="words, comma separated" />
          <button onClick={loadWords} class="shrink-0 rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Build</button>
        </div>
        <div class="flex items-center gap-2">
          <input value={queryText} onInput={(e) => setQueryText((e.target as HTMLInputElement).value)} class="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm" placeholder="search a word" />
          <button onClick={runSearch} class="shrink-0 rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Search</button>
        </div>
      </div>

      <div class="mb-2 flex items-center gap-2 text-xs">
        <button onClick={animateInsert} class={`rounded-lg px-3 py-1 font-semibold transition ${mode === 'build' ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'}`}>Insert mode</button>
        <button onClick={runSearch} class={`rounded-lg px-3 py-1 font-semibold transition ${mode === 'search' ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'}`}>Search mode</button>
        <span class="ml-auto text-muted">step {idx} / {total}</span>
      </div>

      <div class="overflow-x-auto rounded-xl bg-surface-2 p-2">
        <canvas ref={canvasRef} class="touch-none" />
      </div>

      <p class="mt-3 min-h-[2.75rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">{caption}</p>
      {status === 'hit' && <p class="mt-2 rounded-lg bg-brand-soft px-3 py-2 text-sm font-semibold text-text">"{query}" is a stored word. Every step cost one letter — O(L).</p>}
      {status === 'prefix' && <p class="mt-2 rounded-lg bg-surface-2 px-3 py-2 text-sm font-semibold text-text">"{query}" is a valid prefix but not a complete word — startsWith is true, search is false.</p>}
      {status === 'miss' && <p class="mt-2 rounded-lg bg-surface-2 px-3 py-2 text-sm font-semibold text-text">The walk fell off the trie — "{query}" is not present.</p>}

      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={stepB} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏮ Back</button>
        <button onClick={play} class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90">{playing ? '⏸ Pause' : '▶ Play'}</button>
        <button onClick={stepF} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏭ Step</button>
        <button onClick={reset} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">↺ Reset</button>
        <label class="ml-auto flex items-center gap-2 text-xs text-muted">speed
          <input type="range" min={0.5} max={3} step={0.5} value={speed} onInput={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))} class="w-24 accent-[#4f46e5]" />
        </label>
      </div>
      <p class="mt-2 text-center text-xs text-muted">A green ring marks an end-of-word node. Letters only; up to 8 words.</p>
    </div>
  );
}
