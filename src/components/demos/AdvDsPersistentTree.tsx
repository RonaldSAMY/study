import { useEffect, useMemo, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated persistent (path-copying) binary tree.
   - Version 0 is a perfect binary tree over the leaf values.
   - Updating one leaf creates Version 1 by COPYING only the root→leaf
     path (emerald) and SHARING every off-path subtree (grey). The two
     versions coexist.
   - Transport: Play / Pause / Step / Back / Reset + speed, revealing the
     copied path node by node with a caption.
   ------------------------------------------------------------------ */

const EM = '#10b981';
const GREY = '#64748b';

function build(vals: number[], updIndex: number, newVal: number) {
  const n = vals.length; // power of two
  const h = Math.round(Math.log2(n));
  const x = (v: number): number => (v >= n ? v - n : (x(2 * v) + x(2 * v + 1)) / 2);
  const depth = (v: number) => Math.floor(Math.log2(v));
  const leaf = n + updIndex;
  const path: number[] = [];
  for (let v = leaf; v >= 1; v = Math.floor(v / 2)) path.unshift(v);

  const frames: { revealed: number; caption: string }[] = [];
  frames.push({ revealed: 0, caption: `Version 0 over [${vals.join(', ')}]. We will update leaf #${updIndex} to ${newVal}.` });
  for (let t = 0; t < path.length; t++) {
    const node = path[t];
    if (t < path.length - 1) {
      const onPath = path[t + 1];
      const side = onPath === 2 * node ? 'left' : 'right';
      const other = side === 'left' ? 'right' : 'left';
      frames.push({ revealed: t + 1,
        caption: `Copy node ${node} (a new node for v1). Its ${other} subtree is shared with v0 unchanged; only the ${side} child is re-copied.` });
    } else {
      frames.push({ revealed: t + 1,
        caption: `Copy the leaf and write ${newVal}. Done: only ${path.length} nodes copied — the rest of version 0 is shared by pointer.` });
    }
  }
  return { n, h, x, depth, path, frames, vals, updIndex, newVal };
}

export default function AdvDsPersistentTree() {
  const [text, setText] = useState('8, 3, 5, 9, 2, 7, 4, 6');
  const [vals, setVals] = useState<number[]>(() => [8, 3, 5, 9, 2, 7, 4, 6]);
  const [updIndex, setUpdIndex] = useState(5);
  const [newVal, setNewVal] = useState(99);

  const data = useMemo(() => {
    const v = vals.slice(0, 8);
    while (v.length < 8) v.push(0);
    const ui = Math.max(0, Math.min(7, updIndex));
    return build(v, ui, newVal);
  }, [vals, updIndex, newVal]);
  const { n, x, depth, path, frames, newVal: nv, updIndex: ui } = data;
  const valsP = data.vals;

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
    const parsed = text.split(',').map((s) => parseInt(s.trim(), 10)).filter((x2) => Number.isFinite(x2));
    if (parsed.length) setVals(parsed);
  };

  const f = frames[idx];
  const W = 540, H = 300, OFF = -16;
  const px = (v: number) => 36 + x(v) * ((W - 72) / (n - 1));
  const py = (v: number) => 34 + depth(v) * ((H - 68) / Math.round(Math.log2(n)));
  const revealedNodes = path.slice(0, f.revealed);
  const isLeaf = (v: number) => v >= n;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <input value={text} onInput={(e) => setText((e.target as HTMLInputElement).value)}
          class="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm" placeholder="8 leaf values" />
        <button onClick={commit} class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Load</button>
        <label class="flex items-center gap-1 text-xs text-muted">leaf
          <input type="number" min={0} max={7} value={updIndex} onInput={(e) => setUpdIndex(parseInt((e.target as HTMLInputElement).value, 10) || 0)} class="w-14 rounded-lg border border-border bg-surface-2 px-2 py-1 font-mono text-sm" />
        </label>
        <label class="flex items-center gap-1 text-xs text-muted">→
          <input type="number" value={newVal} onInput={(e) => setNewVal(parseInt((e.target as HTMLInputElement).value, 10) || 0)} class="w-16 rounded-lg border border-border bg-surface-2 px-2 py-1 font-mono text-sm" />
        </label>
      </div>

      <div class="overflow-x-auto rounded-xl bg-surface-2 p-2">
        <svg viewBox={`0 0 ${W} ${H}`} class="touch-none" style="width:100%;min-width:480px;height:auto">
          {/* version 0 edges (grey, shared) */}
          {Array.from({ length: n - 1 }, (_, k) => k + 1).map((v) => (
            <g key={`e${v}`}>
              <line x1={px(v)} y1={py(v)} x2={px(2 * v)} y2={py(2 * v)} stroke="rgba(100,116,139,0.45)" stroke-width={2} />
              <line x1={px(v)} y1={py(v)} x2={px(2 * v + 1)} y2={py(2 * v + 1)} stroke="rgba(100,116,139,0.45)" stroke-width={2} />
            </g>
          ))}
          {/* version 0 nodes */}
          {Array.from({ length: 2 * n - 1 }, (_, k) => k + 1).map((v) => (
            <g key={`n${v}`}>
              <circle cx={px(v)} cy={py(v)} r={isLeaf(v) ? 13 : 9} fill="#0f172a" stroke={GREY} stroke-width={1.5} />
              {isLeaf(v) && <text x={px(v)} y={py(v) + 4} text-anchor="middle" font-size="11" fill="#cbd5e1" font-weight="600">{valsP[v - n]}</text>}
            </g>
          ))}
          {/* version 1 path (emerald, copied) */}
          {revealedNodes.map((v, t) => {
            const cx = px(v) + OFF, cy = py(v) + OFF;
            const onPath = path[t + 1];
            const sib = onPath !== undefined ? (onPath === 2 * v ? 2 * v + 1 : 2 * v) : null;
            return (
              <g key={`p${v}`}>
                {/* shared pointer to off-path subtree (grey original) */}
                {sib !== null && (
                  <line x1={cx} y1={cy} x2={px(sib)} y2={py(sib)} stroke={EM} stroke-width={1.6} stroke-dasharray="4 3" opacity={0.7} />
                )}
                {/* pointer to next copied node */}
                {onPath !== undefined && t + 1 < revealedNodes.length && (
                  <line x1={cx} y1={cy} x2={px(onPath) + OFF} y2={py(onPath) + OFF} stroke={EM} stroke-width={2.4} />
                )}
                <circle cx={cx} cy={cy} r={isLeaf(v) ? 13 : 9} fill={EM} stroke="#fff" stroke-width={2} />
                {isLeaf(v) && <text x={cx} y={cy + 4} text-anchor="middle" font-size="11" fill="#fff" font-weight="700">{nv}</text>}
              </g>
            );
          })}
          <text x={px(1)} y={16} text-anchor="middle" font-size="11" fill={GREY}>v0 root</text>
          {f.revealed > 0 && <text x={px(1) + OFF - 6} y={16 + OFF + 8} text-anchor="end" font-size="11" fill={EM} font-weight="700">v1 root</text>}
        </svg>
      </div>

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
      <p class="mt-2 text-center text-xs text-muted">Tip: dashed emerald edges point into <em>shared</em> v0 subtrees. Updating index {ui} copies only log₂(8)+1 = 4 nodes.</p>
    </div>
  );
}
