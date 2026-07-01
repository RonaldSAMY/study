import { useEffect, useMemo, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated rope SPLIT.
   - The string is stored as a balanced tree of small leaf chunks;
     each internal node stores the weight = length of its left subtree.
   - Splitting at index k walks ONE root-to-leaf path, comparing k to
     each weight to decide left/right, then cuts the final leaf. Only
     O(log n) nodes are touched — the bulk is shared, not copied.
   - Transport: Play / Pause / Step / Back / Reset + speed, highlighting
     the active node and narrating each decision.
   ------------------------------------------------------------------ */

const SKY = '#0ea5e9';
const EM = '#10b981';

type RNode = { id: number; leaf: boolean; data?: string; len: number; weight?: number; left?: RNode; right?: RNode; x?: number; depth?: number };
type Frame = { active: number; visited: number[]; caption: string; leftStr?: string; rightStr?: string; splitLeaf?: boolean };

function build(textRaw: string, index: number) {
  const LEAF = 4;
  let counter = 0;
  const bld = (s: string): RNode => {
    const id = counter++;
    if (s.length <= LEAF) return { id, leaf: true, data: s, len: s.length };
    const mid = Math.ceil(s.length / 2);
    const left = bld(s.slice(0, mid)), right = bld(s.slice(mid));
    return { id, leaf: false, len: s.length, weight: left.len, left, right };
  };
  const root = bld(textRaw);

  let leafCounter = 0, maxDepth = 0;
  const layout = (node: RNode, depth: number) => {
    node.depth = depth; maxDepth = Math.max(maxDepth, depth);
    if (node.leaf) { node.x = leafCounter++; return; }
    layout(node.left!, depth + 1); layout(node.right!, depth + 1);
    node.x = (node.left!.x! + node.right!.x!) / 2;
  };
  layout(root, 0);

  const frames: Frame[] = [];
  frames.push({ active: -1, visited: [], caption: `Rope for "${textRaw}" (length ${textRaw.length}). Split at index ${index}.` });
  const visited: number[] = [];
  let node = root, k = index;
  while (!node.leaf) {
    visited.push(node.id);
    if (k < node.weight!) {
      frames.push({ active: node.id, visited: [...visited], caption: `Node ${node.id}: k=${k} < weight=${node.weight}, go LEFT. The right child (length ${node.right!.len}) joins the right rope untouched.` });
      node = node.left!;
    } else {
      frames.push({ active: node.id, visited: [...visited], caption: `Node ${node.id}: k=${k} ≥ weight=${node.weight}, go RIGHT. Subtract: k = ${k} − ${node.weight} = ${k - node.weight!}. The left child joins the left rope.` });
      k -= node.weight!;
      node = node.right!;
    }
  }
  visited.push(node.id);
  const leftStr = textRaw.slice(0, index), rightStr = textRaw.slice(index);
  frames.push({ active: node.id, visited: [...visited], splitLeaf: true, leftStr, rightStr,
    caption: `Leaf "${node.data}": cut at offset ${k}. Left rope = "${leftStr}", right rope = "${rightStr}". Only ${visited.length} nodes were on the path.` });
  return { root, maxDepth, frames };
}

function collectNodes(root: RNode): RNode[] {
  const out: RNode[] = [];
  const walk = (n: RNode) => { out.push(n); if (!n.leaf) { walk(n.left!); walk(n.right!); } };
  walk(root);
  return out;
}

export default function AdvDsRopeSplit() {
  const [textIn, setTextIn] = useState('THE_QUICK_BROWN_FOX');
  const [text, setText] = useState('THE_QUICK_BROWN_FOX');
  const [index, setIndex] = useState(10);

  const { root, maxDepth, frames } = useMemo(() => {
    const idx = Math.max(0, Math.min(text.length, index));
    return build(text, idx);
  }, [text, index]);
  const nodes = useMemo(() => collectNodes(root), [root]);
  const leaves = nodes.filter((n) => n.leaf).length;

  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);
  idxRef.current = idx;

  useEffect(() => { setIdx(0); setPlaying(false); }, [frames]);

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

  const reset = () => { setPlaying(false); setIdx(0); lastRef.current = 0; };
  const stepF = () => { setPlaying(false); setIdx((v) => Math.min(frames.length - 1, v + 1)); };
  const stepB = () => { setPlaying(false); setIdx((v) => Math.max(0, v - 1)); };
  const play = () => { if (idx >= frames.length - 1) setIdx(0); lastRef.current = 0; setPlaying((p) => !p); };

  const commit = () => {
    const t = textIn.replace(/\s+/g, '_').slice(0, 40);
    if (t) setText(t);
  };

  const f = frames[idx];
  const W = Math.max(420, leaves * 70);
  const H = 70 + maxDepth * 64;
  const px = (n: RNode) => 40 + (n.x! * (W - 80)) / Math.max(1, leaves - 1);
  const py = (n: RNode) => 30 + n.depth! * 64;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <input value={textIn} onInput={(e) => setTextIn((e.target as HTMLInputElement).value)}
          class="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm" placeholder="text (use _ for spaces)" />
        <button onClick={commit} class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Load</button>
        <label class="flex items-center gap-1 text-xs text-muted">split @
          <input type="number" min={0} max={text.length} value={index} onInput={(e) => setIndex(parseInt((e.target as HTMLInputElement).value, 10) || 0)} class="w-16 rounded-lg border border-border bg-surface-2 px-2 py-1 font-mono text-sm" />
        </label>
      </div>

      <div class="overflow-x-auto rounded-xl bg-surface-2 p-2">
        <svg viewBox={`0 0 ${W} ${H}`} class="touch-none" style={`width:100%;min-width:${Math.min(W, 640)}px;height:auto`}>
          {nodes.filter((n) => !n.leaf).map((n) => (
            <g key={`e${n.id}`}>
              <line x1={px(n)} y1={py(n)} x2={px(n.left!)} y2={py(n.left!)} stroke="rgba(100,116,139,0.45)" stroke-width={2} />
              <line x1={px(n)} y1={py(n)} x2={px(n.right!)} y2={py(n.right!)} stroke="rgba(100,116,139,0.45)" stroke-width={2} />
            </g>
          ))}
          {nodes.map((n) => {
            const active = f.active === n.id;
            const onPath = f.visited.includes(n.id);
            const splitLeaf = active && f.splitLeaf;
            const fill = splitLeaf ? EM : active ? SKY : onPath ? 'rgba(14,165,233,0.25)' : '#0f172a';
            return (
              <g key={`n${n.id}`}>
                {n.leaf ? (
                  <g>
                    <rect x={px(n) - 22} y={py(n) - 13} width={44} height={26} rx={6}
                      fill={fill} stroke={active ? '#fff' : 'rgba(148,163,184,0.5)'} stroke-width={active ? 2 : 1.2} />
                    <text x={px(n)} y={py(n) + 4} text-anchor="middle" font-size="11" fill="#fff" font-weight="600">{n.data}</text>
                  </g>
                ) : (
                  <g>
                    <circle cx={px(n)} cy={py(n)} r={active ? 16 : 13}
                      fill={fill} stroke={active ? '#fff' : 'rgba(148,163,184,0.5)'} stroke-width={active ? 2 : 1.2} />
                    <text x={px(n)} y={py(n) + 4} text-anchor="middle" font-size="10" fill="#fff" font-weight="600">{n.weight}</text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {f.splitLeaf && (
        <div class="mt-2 grid grid-cols-2 gap-2 font-mono text-sm">
          <div class="rounded-lg bg-surface-2 px-3 py-2"><span class="text-xs text-muted">left rope</span><div class="break-all text-text">{f.leftStr || '∅'}</div></div>
          <div class="rounded-lg bg-surface-2 px-3 py-2"><span class="text-xs text-muted">right rope</span><div class="break-all text-text">{f.rightStr || '∅'}</div></div>
        </div>
      )}

      <p class="mt-3 min-h-[2.5rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">{f.caption}</p>

      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={stepB} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏮ Back</button>
        <button onClick={play} class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90">{playing ? '⏸ Pause' : '▶ Play'}</button>
        <button onClick={stepF} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏭ Step</button>
        <button onClick={reset} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">↺ Reset</button>
        <span class="text-xs text-muted">step {idx + 1}/{frames.length}</span>
        <label class="ml-auto flex items-center gap-2 text-xs text-muted">speed
          <input type="range" min={0.5} max={3} step={0.5} value={speed} onInput={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))} class="w-24 accent-[#4f46e5]" />
        </label>
      </div>
      <p class="mt-2 text-center text-xs text-muted">Tip: internal nodes show their <em>weight</em> (left-subtree length). A plain string would copy all {text.length} chars; the rope touches only the path.</p>
    </div>
  );
}
