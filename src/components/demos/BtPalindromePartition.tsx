import { useEffect, useMemo, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated backtracking tree for PALINDROME PARTITIONING.
   - Edit a short string. At each position the demo tries every prefix
     as the next piece. A palindrome piece is taken (choose -> recurse);
     a non-palindrome prefix is pruned in red.
   - The root -> active path is the partition built so far (indigo);
     a partition that consumes the whole string is accepted in emerald.
   - Transport: Play / Pause / Step / Back / Reset + speed.
   Helpers live INSIDE this island file.
   ------------------------------------------------------------------ */

type TNode = { id: number; parent: number; depth: number; label: string; x: number; y: number };
type Frame = { id: number; action: 'visit' | 'accept' | 'prune' | 'backtrack'; caption: string };
type Trace = { nodes: TNode[]; frames: Frame[]; maxLeaf: number; maxDepth: number; solutions: number };

const COLORS = { idx: '#4f46e5', em: '#10b981', red: '#ef4444' };

const clean = (s: string): string => s.replace(/[^a-zA-Z]/g, '').slice(0, 7).toLowerCase();

function layoutTree(nodes: TNode[]): { maxLeaf: number; maxDepth: number } {
  const kids = new Map<number, number[]>();
  for (const n of nodes) if (n.parent >= 0) { if (!kids.has(n.parent)) kids.set(n.parent, []); kids.get(n.parent)!.push(n.id); }
  let leaf = 0, maxDepth = 0;
  const place = (id: number) => {
    const cs = kids.get(id) ?? [];
    nodes[id].y = nodes[id].depth; maxDepth = Math.max(maxDepth, nodes[id].depth);
    if (cs.length === 0) { nodes[id].x = leaf++; return; }
    for (const c of cs) place(c);
    nodes[id].x = (nodes[cs[0]].x + nodes[cs[cs.length - 1]].x) / 2;
  };
  if (nodes.length) place(0);
  return { maxLeaf: Math.max(0, leaf - 1), maxDepth };
}

function buildTrace(s: string): Trace {
  const nodes: TNode[] = [];
  const frames: Frame[] = [];
  let solutions = 0;
  const newNode = (parent: number, depth: number, label: string) => { const id = nodes.length; nodes.push({ id, parent, depth, label, x: 0, y: depth }); return id; };
  const root = newNode(-1, 0, s || '·');
  const isPal = (l: number, r: number) => { while (l < r) { if (s[l++] !== s[r--]) return false; } return true; };
  const rec = (start: number, parts: string[], nodeId: number, depth: number) => {
    frames.push({ id: nodeId, action: 'visit', caption: parts.length ? `partition so far: ${parts.join(' | ')}` : `partition "${s}" into palindromes` });
    if (start === s.length) { solutions++; frames.push({ id: nodeId, action: 'accept', caption: `every piece is a palindrome ✓ ${parts.join(' | ')}` }); return; }
    for (let end = start; end < s.length; end++) {
      const piece = s.slice(start, end + 1);
      const cid = newNode(nodeId, depth + 1, piece);
      if (!isPal(start, end)) {
        frames.push({ id: cid, action: 'visit', caption: `try piece "${piece}"` });
        frames.push({ id: cid, action: 'prune', caption: `"${piece}" reads differently backwards → not a palindrome, prune` });
        continue;
      }
      parts.push(piece);
      rec(end + 1, parts, cid, depth + 1);
      parts.pop();
      frames.push({ id: nodeId, action: 'backtrack', caption: `un-cut "${piece}" — back to ${parts.length ? parts.join(' | ') : 'the start'}` });
    }
  };
  rec(0, [], root, 0);
  const { maxLeaf, maxDepth } = layoutTree(nodes);
  return { nodes, frames, maxLeaf, maxDepth, solutions };
}

export default function BtPalindromePartition() {
  const [text, setText] = useState('aab');
  const [s, setS] = useState('aab');
  const trace = useMemo(() => buildTrace(s), [s]);

  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ cssW: 600, cssH: 280 });
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0); idxRef.current = idx;
  const traceRef = useRef<Trace>(trace); traceRef.current = trace;
  const resizeRef = useRef<() => void>(() => {});
  const last = trace.frames.length - 1;

  const draw = () => {
    const c = canvasRef.current; if (!c) return; const ctx = c.getContext('2d'); if (!ctx) return;
    const { cssW, cssH } = sizeRef.current; ctx.clearRect(0, 0, cssW, cssH);
    const tr = traceRef.current; const i = Math.min(idxRef.current, tr.frames.length - 1); if (i < 0) return;
    const revealed = new Set<number>(); const status = new Map<number, string>();
    for (let k = 0; k <= i; k++) {
      const fr = tr.frames[k]; revealed.add(fr.id);
      if (fr.action === 'accept') status.set(fr.id, 'accept');
      else if (fr.action === 'prune') status.set(fr.id, 'prune');
      else if (fr.action === 'backtrack') { const st = status.get(fr.id); if (st !== 'accept' && st !== 'prune') status.set(fr.id, 'done'); }
    }
    const active = tr.frames[i].id;
    const onPath = new Set<number>(); let a = active; while (a >= 0) { onPath.add(a); a = tr.nodes[a].parent; }
    const padX = 34, padTop = 26, padB = 16; const plotW = cssW - padX * 2, plotH = cssH - padTop - padB;
    const sx = (x: number) => padX + (tr.maxLeaf > 0 ? x / tr.maxLeaf : 0.5) * plotW;
    const sy = (d: number) => padTop + (tr.maxDepth > 0 ? d / tr.maxDepth : 0) * plotH;
    const r = Math.max(11, Math.min(19, plotW / ((tr.maxLeaf + 1) * 2.4)));
    for (const node of tr.nodes) {
      if (node.parent < 0 || !revealed.has(node.id) || !revealed.has(node.parent)) continue;
      const p = tr.nodes[node.parent]; const onp = onPath.has(node.id) && onPath.has(node.parent);
      ctx.strokeStyle = onp ? COLORS.idx : 'rgba(128,128,128,0.35)'; ctx.lineWidth = onp ? 2.5 : 1.4;
      ctx.beginPath(); ctx.moveTo(sx(p.x), sy(p.y)); ctx.lineTo(sx(node.x), sy(node.y)); ctx.stroke();
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `${Math.round(r * 0.82)}px ui-monospace, SFMono-Regular, monospace`;
    for (const node of tr.nodes) {
      if (!revealed.has(node.id)) continue;
      const st = status.get(node.id); const isActive = node.id === active;
      let fillC = 'rgba(148,163,184,0.18)', strokeC = onPath.has(node.id) ? COLORS.idx : 'rgba(148,163,184,0.65)', textC = '#64748b';
      if (isActive) { fillC = COLORS.idx; strokeC = COLORS.idx; textC = '#fff'; }
      else if (st === 'accept') { fillC = COLORS.em; strokeC = COLORS.em; textC = '#fff'; }
      else if (st === 'prune') { fillC = COLORS.red; strokeC = COLORS.red; textC = '#fff'; }
      ctx.beginPath(); ctx.arc(sx(node.x), sy(node.y), r, 0, Math.PI * 2);
      ctx.fillStyle = fillC; ctx.fill();
      ctx.lineWidth = isActive || onPath.has(node.id) ? 2.5 : 1.4; ctx.strokeStyle = strokeC; ctx.stroke();
      ctx.fillStyle = textC; const label = node.label.length > 4 ? node.label.slice(0, 4) : node.label;
      ctx.fillText(label, sx(node.x), sy(node.y) + 0.5);
    }
  };

  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const resize = () => {
      const parent = c.parentElement!; const tr = traceRef.current;
      const cols = tr.maxLeaf + 1, rows = tr.maxDepth + 1;
      const cssW = Math.max(parent.clientWidth, cols * 56 + 68);
      const cssH = Math.max(210, rows * 74 + 30);
      const dpr = window.devicePixelRatio || 1;
      c.width = cssW * dpr; c.height = cssH * dpr; c.style.width = `${cssW}px`; c.style.height = `${cssH}px`;
      const ctx = c.getContext('2d'); if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { cssW, cssH }; draw();
    };
    resizeRef.current = resize; resize();
    window.addEventListener('resize', resize);
    return () => { window.removeEventListener('resize', resize); if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { resizeRef.current(); }, [trace]);
  useEffect(draw, [idx, trace]);

  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 760 / speed;
    const tick = (t: number) => {
      if (!lastRef.current) lastRef.current = t;
      if (t - lastRef.current >= interval) {
        lastRef.current = t;
        const next = idxRef.current + 1;
        if (next > last) { setIdx(last); setPlaying(false); return; }
        setIdx(next);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
  }, [playing, speed, last]);

  const commit = () => { const v = clean(text); if (v) { setS(v); setText(v); setIdx(0); setPlaying(false); } };
  const reset = () => { setPlaying(false); setIdx(0); lastRef.current = 0; };
  const stepF = () => { setPlaying(false); setIdx((v) => Math.min(last, v + 1)); };
  const stepB = () => { setPlaying(false); setIdx((v) => Math.max(0, v - 1)); };
  const play = () => { if (idx >= last) setIdx(0); lastRef.current = 0; setPlaying((p) => !p); };

  const f = trace.frames[Math.min(idx, last)];
  const acceptedSoFar = trace.frames.slice(0, idx + 1).filter((x) => x.action === 'accept').length;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <input value={text} onInput={(e) => setText((e.target as HTMLInputElement).value)} class="w-44 rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm" placeholder="letters only, ≤ 7" />
        <button onClick={commit} class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Load</button>
        <span class="ml-auto text-xs text-muted">partitions: <strong class="text-text">{trace.solutions}</strong></span>
      </div>
      <div class="overflow-x-auto rounded-xl bg-surface-2"><canvas ref={canvasRef} class="touch-none" /></div>
      <p class="mt-3 min-h-[2.5rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">{f.caption}</p>
      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={stepB} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏮ Back</button>
        <button onClick={play} class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90">{playing ? '⏸ Pause' : '▶ Play'}</button>
        <button onClick={stepF} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏭ Step</button>
        <button onClick={reset} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">↺ Reset</button>
        <span class="text-xs text-muted">step {Math.min(idx, last) + 1}/{last + 1} · accepted {acceptedSoFar}</span>
        <label class="ml-auto flex items-center gap-2 text-xs text-muted">speed
          <input type="range" min={0.5} max={3} step={0.5} value={speed} onInput={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))} class="w-24 accent-[#4f46e5]" />
        </label>
      </div>
      <div class="mt-3 flex flex-wrap gap-3 text-xs text-muted">
        <span><span class="mr-1 inline-block h-3 w-3 rounded-full align-middle" style="background:#4f46e5" />partition so far</span>
        <span><span class="mr-1 inline-block h-3 w-3 rounded-full align-middle" style="background:#10b981" />whole string covered</span>
        <span><span class="mr-1 inline-block h-3 w-3 rounded-full align-middle" style="background:#ef4444" />not a palindrome (prune)</span>
      </div>
      <p class="mt-2 text-center text-xs text-muted">Try <code>aba</code>, <code>noon</code>, or <code>aabb</code> to see how palindrome pieces branch.</p>
    </div>
  );
}
