import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Huffman tree construction.
   - Type any text. The demo counts character frequencies and builds the
     optimal prefix tree by REPEATEDLY MERGING the two lowest-frequency
     roots in a priority queue, until one tree remains.
   - The greedy choice each step: merge the two rarest subtrees. Rarer
     symbols sink deeper and earn longer codes; frequent ones stay near
     the root with short codes.
   - The priority queue is shown as chips; the growing forest is drawn on
     a canvas (devicePixelRatio scaling + resize). Codes appear at the end.
   - Transport: Play / Pause / Step / Step-back / Reset + speed.
   ------------------------------------------------------------------ */

const COLORS = { leaf: '#4f46e5', internal: '#0ea5e9', next: '#0ea5e9', merged: '#10b981', edge: 'rgba(128,128,128,0.55)' };

type Node = { id: number; char: string | null; freq: number; left: number | null; right: number | null };
type State = { roots: number[]; justMerged: [number, number] | null; newRoot: number | null };

const showChar = (c: string) => (c === ' ' ? '␣' : c === '\n' ? '⏎' : c);

function buildStates(text: string): { nodes: Map<number, Node>; states: State[] } {
  const freq = new Map<string, number>();
  for (const ch of text) freq.set(ch, (freq.get(ch) || 0) + 1);

  const nodes = new Map<number, Node>();
  let nextId = 0;
  let queue: number[] = [];
  for (const [char, f] of Array.from(freq.entries()).sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))) {
    const id = nextId++;
    nodes.set(id, { id, char, freq: f, left: null, right: null });
    queue.push(id);
  }

  const states: State[] = [{ roots: [...queue], justMerged: null, newRoot: null }];
  const byFreq = (a: number, b: number) => nodes.get(a)!.freq - nodes.get(b)!.freq || a - b;

  while (queue.length > 1) {
    queue.sort(byFreq);
    const a = queue.shift()!;
    const b = queue.shift()!;
    const id = nextId++;
    nodes.set(id, { id, char: null, freq: nodes.get(a)!.freq + nodes.get(b)!.freq, left: a, right: b });
    queue.push(id);
    states.push({ roots: [...queue], justMerged: [a, b], newRoot: id });
  }
  return { nodes, states };
}

function genCodes(nodes: Map<number, Node>, root: number | undefined): Map<string, string> {
  const codes = new Map<string, string>();
  if (root == null) return codes;
  const walk = (id: number, code: string) => {
    const n = nodes.get(id)!;
    if (n.char !== null) { codes.set(n.char, code || '0'); return; }
    if (n.left != null) walk(n.left, code + '0');
    if (n.right != null) walk(n.right, code + '1');
  };
  walk(root, '');
  return codes;
}

export default function GreedyHuffmanTree() {
  const [text, setText] = useState('AAAAABBBBCCCDDE');
  const [committed, setCommitted] = useState('AAAAABBBBCCCDDE');

  const { nodes, states } = buildStates(committed);
  const codes = states.length ? genCodes(nodes, states[states.length - 1].roots[0]) : new Map<string, string>();

  const [idx, setIdx] = useState(0); // 0..states.length-1
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 560, h: 280 });
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);
  idxRef.current = idx;
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  const statesRef = useRef(states);
  statesRef.current = states;

  // depth of the final tree, used to size the canvas height
  const finalDepth = (() => {
    if (!states.length) return 0;
    const root = states[states.length - 1].roots[0];
    const d = (id: number | null | undefined): number => {
      if (id == null) return -1;
      const n = nodes.get(id)!;
      if (n.char !== null) return 0;
      return 1 + Math.max(d(n.left), d(n.right));
    };
    return d(root);
  })();

  // pixel layout for the current forest
  function layout(rootIds: number[], nm: Map<number, Node>) {
    const pos = new Map<number, { x: number; depth: number }>();
    let leafX = 0;
    const dfs = (id: number, depth: number): [number, number] => {
      const n = nm.get(id)!;
      if (n.char === null && (n.left != null || n.right != null)) {
        let mn = Infinity, mx = -Infinity;
        for (const c of [n.left, n.right]) {
          if (c == null) continue;
          const [a, b] = dfs(c, depth + 1);
          mn = Math.min(mn, a); mx = Math.max(mx, b);
        }
        pos.set(id, { x: (mn + mx) / 2, depth });
        return [mn, mx];
      }
      const x = leafX++;
      pos.set(id, { x, depth });
      return [x, x];
    };
    for (const r of rootIds) dfs(r, 0);
    return { pos, leaves: Math.max(1, leafX) };
  }

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);
    const st = statesRef.current;
    const nm = nodesRef.current;
    const i = idxRef.current;
    if (!st.length) return;
    const state = st[Math.min(i, st.length - 1)];
    const { pos, leaves } = layout(state.roots, nm);

    const padX = 26, padTop = 26, padBot = 16;
    const plotW = w - padX * 2;
    const levelH = Math.min(64, (h - padTop - padBot) / Math.max(1, finalDepth));
    const xPix = (x: number) => padX + (leaves <= 1 ? plotW / 2 : (x / (leaves - 1)) * plotW);
    const yPix = (d: number) => padTop + d * levelH;
    const R = Math.max(13, Math.min(20, plotW / (leaves * 2.4)));

    // determine highlight set: two smallest roots about to merge
    const sorted = [...state.roots].sort((a, b) => nm.get(a)!.freq - nm.get(b)!.freq || a - b);
    const nextPair = state.roots.length > 1 ? [sorted[0], sorted[1]] : [];

    // edges
    ctx.strokeStyle = COLORS.edge;
    ctx.lineWidth = 1.5;
    const drawEdges = (id: number) => {
      const n = nm.get(id)!;
      const p = pos.get(id)!;
      for (const c of [n.left, n.right]) {
        if (c == null) continue;
        const cp = pos.get(c)!;
        ctx.beginPath();
        ctx.moveTo(xPix(p.x), yPix(p.depth));
        ctx.lineTo(xPix(cp.x), yPix(cp.depth));
        ctx.stroke();
        // bit label
        ctx.fillStyle = 'rgba(128,128,128,0.85)';
        ctx.font = '10px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(c === n.left ? '0' : '1', (xPix(p.x) + xPix(cp.x)) / 2, (yPix(p.depth) + yPix(cp.depth)) / 2 - 2);
        drawEdges(c);
      }
    };
    for (const r of state.roots) drawEdges(r);

    // nodes
    const drawNode = (id: number) => {
      const n = nm.get(id)!;
      const p = pos.get(id)!;
      const x = xPix(p.x), y = yPix(p.depth);
      let fill = n.char !== null ? COLORS.leaf : COLORS.internal;
      if (state.newRoot === id) fill = COLORS.merged;
      ctx.beginPath();
      ctx.arc(x, y, R, 0, Math.PI * 2);
      ctx.fillStyle = fill;
      ctx.fill();
      if (nextPair.includes(id)) {
        ctx.lineWidth = 3.5;
        ctx.strokeStyle = COLORS.next;
        ctx.stroke();
      }
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.round(R * 0.7)}px ui-sans-serif, system-ui`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(n.char !== null ? showChar(n.char) : String(n.freq), x, y);
      if (n.char !== null) {
        ctx.fillStyle = 'rgba(128,128,128,0.95)';
        ctx.font = '10px ui-monospace, monospace';
        ctx.fillText(String(n.freq), x, y + R + 9);
      }
      for (const c of [n.left, n.right]) if (c != null) drawNode(c);
    };
    for (const r of state.roots) drawNode(r);
    ctx.textBaseline = 'alphabetic';
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 600);
      const h = 50 + Math.max(1, finalDepth) * 60;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w, h };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [committed]);

  useEffect(draw, [idx, committed]);

  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 1100 / speed;
    const tick = (t: number) => {
      if (!lastRef.current) lastRef.current = t;
      if (t - lastRef.current >= interval) {
        lastRef.current = t;
        const next = idxRef.current + 1;
        if (next >= states.length) { setIdx(states.length - 1); setPlaying(false); return; }
        setIdx(next);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
  }, [playing, speed, committed]);

  const commit = () => { if (text.trim().length >= 2) { setCommitted(text); setIdx(0); setPlaying(false); } };
  const reset = () => { setPlaying(false); setIdx(0); lastRef.current = 0; };
  const stepF = () => { setPlaying(false); setIdx((v) => Math.min(states.length - 1, v + 1)); };
  const stepB = () => { setPlaying(false); setIdx((v) => Math.max(0, v - 1)); };
  const play = () => { if (idx >= states.length - 1) setIdx(0); lastRef.current = 0; setPlaying((p) => !p); };

  const state = states[Math.min(idx, states.length - 1)];
  const sortedRoots = [...state.roots].sort((a, b) => nodes.get(a)!.freq - nodes.get(b)!.freq || a - b);
  const done = idx >= states.length - 1;

  const caption = idx === 0
    ? 'Start: every character is its own one-node tree, ordered by frequency in the queue. Repeatedly merge the two rarest.'
    : (() => {
        const [a, b] = state.justMerged!;
        const na = nodes.get(a)!, nb = nodes.get(b)!;
        return `Merged the two smallest — ${na.char !== null ? showChar(na.char) : 'node'}(${na.freq}) and ${nb.char !== null ? showChar(nb.char) : 'node'}(${nb.freq}) — into a node of ${na.freq + nb.freq}. Rarer symbols sink deeper, so their codes grow longer.`;
      })();

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <input value={text} onInput={(e) => setText((e.target as HTMLInputElement).value)} class="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm" placeholder="type some text" />
        <button onClick={commit} class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Load</button>
      </div>

      {/* priority queue chips */}
      <div class="mb-2 flex flex-wrap items-center gap-1.5 text-xs font-mono">
        <span class="text-muted">queue:</span>
        {sortedRoots.map((id, i) => {
          const n = nodes.get(id)!;
          const isNext = state.roots.length > 1 && i < 2;
          return (
            <span key={id} class={`rounded-md border px-2 py-1 transition ${isNext ? 'scale-110 border-transparent text-white' : 'border-border bg-surface-2 text-text'}`} style={isNext ? `background:${COLORS.next}` : ''}>
              {n.char !== null ? showChar(n.char) : '•'}<span class="text-muted">{n.char !== null ? '' : ''}{n.freq}</span>
            </span>
          );
        })}
      </div>

      <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

      <p class="mt-3 min-h-[2.75rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">{caption}</p>

      {done && (
        <div class="mt-2 rounded-lg bg-brand-soft px-3 py-2 text-sm text-text">
          <span class="font-semibold">Done — optimal prefix codes:</span>
          <div class="mt-1 flex flex-wrap gap-2 font-mono text-xs">
            {Array.from(codes.entries()).sort((a, b) => a[1].length - b[1].length).map(([c, code]) => (
              <span key={c} class="rounded bg-surface px-2 py-1 text-text">{showChar(c)} = {code}</span>
            ))}
          </div>
        </div>
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
      <p class="mt-2 text-center text-xs text-muted">Indigo = leaf (a character), sky = internal merge node, ringed = the two about to merge. Edge labels show the 0/1 bits.</p>
    </div>
  );
}
