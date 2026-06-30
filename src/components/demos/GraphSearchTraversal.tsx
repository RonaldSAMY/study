import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Graphs: build a small level graph and run BFS / DFS over it.
   - "Connect" mode: tap two rooms to toggle an edge between them.
   - "Start" mode: tap a room to choose where the search begins.
   - BFS (queue) and DFS (stack) animate the visiting order.
   SVG island; the stepping interval is cleaned up on unmount.
   ------------------------------------------------------------------ */

type Tool = 'start' | 'connect';

const LABELS = ['Spawn', 'Hall', 'Vault', 'Lab', 'Cave', 'Boss'];
const POS = [
  { x: 60, y: 140 },
  { x: 175, y: 56 },
  { x: 175, y: 224 },
  { x: 305, y: 56 },
  { x: 305, y: 224 },
  { x: 425, y: 140 },
];
const INIT_EDGES = ['0-1', '0-2', '1-2', '1-3', '2-4', '3-5', '4-5'];

const ekey = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);

export default function GraphSearchTraversal() {
  const [edges, setEdges] = useState<Set<string>>(new Set(INIT_EDGES));
  const [tool, setTool] = useState<Tool>('start');
  const [start, setStart] = useState(0);
  const [pendingEdge, setPendingEdge] = useState<number | null>(null);
  const [sequence, setSequence] = useState<number[]>([]);
  const [stepIdx, setStepIdx] = useState(-1);
  const [algoName, setAlgoName] = useState('');
  const timer = useRef<number | null>(null);

  const neighbors = (i: number): number[] => {
    const out: number[] = [];
    for (let j = 0; j < LABELS.length; j++) {
      if (j !== i && edges.has(ekey(i, j))) out.push(j);
    }
    return out; // already ascending order, for deterministic traversal
  };

  const stop = () => {
    if (timer.current !== null) {
      clearInterval(timer.current);
      timer.current = null;
    }
  };

  const animate = (seq: number[]) => {
    stop();
    setSequence(seq);
    setStepIdx(-1);
    let k = -1;
    timer.current = window.setInterval(() => {
      k += 1;
      setStepIdx(k);
      if (k >= seq.length - 1) stop();
    }, 600);
  };

  const runBFS = () => {
    setAlgoName('BFS — explores by distance, using a queue');
    const seen = new Set<number>([start]);
    const q = [start];
    const out: number[] = [];
    while (q.length) {
      const i = q.shift()!;
      out.push(i);
      for (const n of neighbors(i)) {
        if (!seen.has(n)) {
          seen.add(n);
          q.push(n);
        }
      }
    }
    animate(out);
  };

  const runDFS = () => {
    setAlgoName('DFS — dives deep first, using a stack');
    const seen = new Set<number>();
    const out: number[] = [];
    const visit = (i: number) => {
      if (seen.has(i)) return;
      seen.add(i);
      out.push(i);
      for (const n of neighbors(i)) visit(n);
    };
    visit(start);
    animate(out);
  };

  const onNode = (i: number) => {
    stop();
    setSequence([]);
    setStepIdx(-1);
    if (tool === 'start') {
      setStart(i);
      return;
    }
    // connect mode: pick two nodes to toggle an edge
    if (pendingEdge === null) {
      setPendingEdge(i);
    } else if (pendingEdge === i) {
      setPendingEdge(null);
    } else {
      const key = ekey(pendingEdge, i);
      setEdges((prev) => {
        const next = new Set(prev);
        next.has(key) ? next.delete(key) : next.add(key);
        return next;
      });
      setPendingEdge(null);
    }
  };

  useEffect(() => stop, []);

  const current = stepIdx >= 0 && stepIdx < sequence.length ? sequence[stepIdx] : -1;
  const visited = new Set(sequence.slice(0, stepIdx + 1));

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <p class="mb-3 text-sm text-muted">
        A game <strong>level graph</strong> of connected rooms. Wire up doors, choose a start room, then
        watch an AI explore.
      </p>

      <div class="mb-3 flex flex-wrap gap-2">
        {(['start', 'connect'] as Tool[]).map((t) => (
          <button
            key={t}
            onClick={() => {
              setTool(t);
              setPendingEdge(null);
            }}
            class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              tool === t ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
            }`}
          >
            {t === 'start' ? 'Set start' : 'Connect rooms'}
          </button>
        ))}
        <button
          onClick={runBFS}
          class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-text transition hover:opacity-90"
        >
          Run BFS
        </button>
        <button
          onClick={runDFS}
          class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-text transition hover:opacity-90"
        >
          Run DFS
        </button>
      </div>

      <div class="mb-3 overflow-x-auto rounded-xl bg-surface-2 p-2">
        <svg viewBox="0 0 485 280" class="h-auto w-full touch-none" style="min-width:320px">
          {/* edges */}
          {[...edges].map((key) => {
            const [a, b] = key.split('-').map(Number);
            return (
              <line
                key={key}
                x1={POS[a].x}
                y1={POS[a].y}
                x2={POS[b].x}
                y2={POS[b].y}
                stroke="rgba(128,128,128,0.5)"
                stroke-width="2.5"
              />
            );
          })}
          {/* nodes */}
          {LABELS.map((label, i) => {
            const isStart = i === start;
            const isCurrent = i === current;
            const isVisited = visited.has(i);
            const isPending = i === pendingEdge;
            let fill = 'var(--color-surface, #fff)';
            let stroke = 'rgba(128,128,128,0.6)';
            let textFill = 'currentColor';
            if (isCurrent) {
              fill = '#4f46e5';
              stroke = '#4f46e5';
              textFill = '#fff';
            } else if (isVisited) {
              fill = '#10b981';
              stroke = '#10b981';
              textFill = '#fff';
            } else if (isStart) {
              fill = '#0ea5e9';
              stroke = '#0ea5e9';
              textFill = '#fff';
            }
            return (
              <g key={i} onClick={() => onNode(i)} style="cursor:pointer">
                <circle
                  cx={POS[i].x}
                  cy={POS[i].y}
                  r="27"
                  fill={fill}
                  stroke={isPending ? '#4f46e5' : stroke}
                  stroke-width={isPending ? 4 : 2.5}
                  stroke-dasharray={isPending ? '5 4' : undefined}
                />
                <text
                  x={POS[i].x}
                  y={POS[i].y + 4}
                  text-anchor="middle"
                  font-size="12"
                  font-weight="600"
                  fill={textFill}
                >
                  {label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div class="rounded-lg bg-surface-2 p-3 text-sm">
        <div class="mb-1 text-xs font-semibold text-muted">
          {algoName || `Start: ${LABELS[start]}. ${tool === 'connect' ? 'Tap two rooms to toggle a door.' : 'Tap a room to set the start.'}`}
        </div>
        <div class="font-mono text-sm">
          {sequence.length === 0
            ? 'Run BFS or DFS to see the visiting order.'
            : sequence.slice(0, stepIdx + 1).map((i) => LABELS[i]).join(' → ') || '…'}
        </div>
      </div>
    </div>
  );
}
