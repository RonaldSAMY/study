import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Trees: a small binary "skill tree" you can collapse/expand, plus
   animated traversals (pre-order, in-order, post-order, level-order).
   - Click a node to collapse/expand its subtree.
   - Pick a traversal; nodes light up in visiting order.
   SVG island; the stepping interval is cleaned up on unmount.
   ------------------------------------------------------------------ */

type Order = 'pre' | 'in' | 'post' | 'level';

// fixed complete binary tree of 7 nodes; children of i are 2i+1, 2i+2
const LABELS = ['Combat', 'Melee', 'Magic', 'Sword', 'Shield', 'Fire', 'Ice'];
const POS = [
  { x: 240, y: 34 },
  { x: 120, y: 124 },
  { x: 360, y: 124 },
  { x: 56, y: 214 },
  { x: 184, y: 214 },
  { x: 296, y: 214 },
  { x: 424, y: 214 },
];
const kids = (i: number) => [2 * i + 1, 2 * i + 2].filter((c) => c < LABELS.length);

const ORDER_NAME: Record<Order, string> = {
  pre: 'Pre-order (root → left → right)',
  in: 'In-order (left → root → right)',
  post: 'Post-order (left → right → root)',
  level: 'Level-order / BFS',
};

export default function TreeTraversalExplorer() {
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const [order, setOrder] = useState<Order>('pre');
  const [sequence, setSequence] = useState<number[]>([]);
  const [stepIdx, setStepIdx] = useState(-1);
  const timer = useRef<number | null>(null);

  // which nodes are visible (a collapsed node hides its descendants)
  const hidden = new Set<number>();
  const hide = (i: number) => {
    for (const c of kids(i)) {
      hidden.add(c);
      hide(c);
    }
  };
  collapsed.forEach((i) => hide(i));

  const buildOrder = (o: Order): number[] => {
    const out: number[] = [];
    const visit = (i: number) => {
      if (hidden.has(i)) return;
      const ch = collapsed.has(i) ? [] : kids(i);
      if (o === 'pre') {
        out.push(i);
        ch.forEach(visit);
      } else if (o === 'in') {
        if (ch[0] !== undefined) visit(ch[0]);
        out.push(i);
        if (ch[1] !== undefined) visit(ch[1]);
      } else if (o === 'post') {
        ch.forEach(visit);
        out.push(i);
      }
    };
    if (o === 'level') {
      const q = [0];
      while (q.length) {
        const i = q.shift()!;
        if (hidden.has(i)) continue;
        out.push(i);
        if (!collapsed.has(i)) kids(i).forEach((c) => q.push(c));
      }
    } else {
      visit(0);
    }
    return out;
  };

  const stop = () => {
    if (timer.current !== null) {
      clearInterval(timer.current);
      timer.current = null;
    }
  };

  const run = (o: Order) => {
    setOrder(o);
    stop();
    const seq = buildOrder(o);
    setSequence(seq);
    setStepIdx(-1);
    let k = -1;
    timer.current = window.setInterval(() => {
      k += 1;
      setStepIdx(k);
      if (k >= seq.length - 1) stop();
    }, 650);
  };

  const toggle = (i: number) => {
    if (kids(i).length === 0) return; // leaves have nothing to collapse
    stop();
    setSequence([]);
    setStepIdx(-1);
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  useEffect(() => stop, []);

  const current = stepIdx >= 0 && stepIdx < sequence.length ? sequence[stepIdx] : -1;
  const visitedSet = new Set(sequence.slice(0, stepIdx + 1));

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <p class="mb-3 text-sm text-muted">
        A character <strong>skill tree</strong>. Tap a branch node to collapse or expand it, then run a
        traversal to see the visiting order.
      </p>

      <div class="mb-3 overflow-x-auto rounded-xl bg-surface-2 p-2">
        <svg viewBox="0 0 480 250" class="h-auto w-full touch-none" style="min-width:320px">
          {/* edges */}
          {LABELS.map((_, i) =>
            kids(i).map((c) =>
              hidden.has(c) || hidden.has(i) ? null : (
                <line
                  key={`${i}-${c}`}
                  x1={POS[i].x}
                  y1={POS[i].y}
                  x2={POS[c].x}
                  y2={POS[c].y}
                  stroke="rgba(128,128,128,0.45)"
                  stroke-width="2"
                />
              )
            )
          )}
          {/* nodes */}
          {LABELS.map((label, i) => {
            if (hidden.has(i)) return null;
            const isCurrent = i === current;
            const isVisited = visitedSet.has(i);
            const isCollapsed = collapsed.has(i);
            const fill = isCurrent ? '#4f46e5' : isVisited ? '#10b981' : 'var(--color-surface, #fff)';
            const stroke = isCurrent ? '#4f46e5' : isVisited ? '#10b981' : 'rgba(128,128,128,0.6)';
            const textFill = isCurrent || isVisited ? '#fff' : 'currentColor';
            return (
              <g key={i} onClick={() => toggle(i)} style="cursor:pointer">
                <circle cx={POS[i].x} cy={POS[i].y} r="26" fill={fill} stroke={stroke} stroke-width="2.5" />
                <text
                  x={POS[i].x}
                  y={POS[i].y + 4}
                  text-anchor="middle"
                  font-size="11"
                  font-weight="600"
                  fill={textFill}
                >
                  {label}
                </text>
                {isCollapsed && (
                  <text x={POS[i].x} y={POS[i].y + 20} text-anchor="middle" font-size="11" fill={textFill}>
                    ▾
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <div class="mb-3 flex flex-wrap gap-2">
        {(['pre', 'in', 'post', 'level'] as Order[]).map((o) => (
          <button
            key={o}
            onClick={() => run(o)}
            class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              order === o ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
            }`}
          >
            {o === 'pre' ? 'Pre' : o === 'in' ? 'In' : o === 'post' ? 'Post' : 'Level (BFS)'}
          </button>
        ))}
      </div>

      <div class="rounded-lg bg-surface-2 p-3 text-sm">
        <div class="mb-1 text-xs font-semibold text-muted">{ORDER_NAME[order]}</div>
        <div class="font-mono text-sm">
          {sequence.length === 0
            ? 'Pick a traversal above.'
            : sequence.slice(0, stepIdx + 1).map((i) => LABELS[i]).join(' → ') || '…'}
        </div>
      </div>
    </div>
  );
}
