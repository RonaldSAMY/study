import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   A* pathfinding on a tile grid.
   - Paint walls by dragging; switch modes to move the start / goal.
   - Run the search and watch cells get "expanded" in priority order,
     then the shortest path light up in emerald.
   - Toggle the heuristic off to fall back to plain Dijkstra and see how
     many more cells it explores.
   ------------------------------------------------------------------ */

const COLS = 16;
const ROWS = 11;

const COLORS = {
  start: '#4f46e5',
  goal: '#10b981',
  wall: 'rgba(100,116,139,0.85)',
  explored: 'rgba(14,165,233,0.30)',
  head: 'rgba(14,165,233,0.65)',
  path: '#10b981',
  grid: 'rgba(128,128,128,0.22)',
};

type Cell = { c: number; r: number };
type Mode = 'wall' | 'start' | 'goal';
type Result = { order: Cell[]; path: Cell[]; found: boolean };

const key = (c: number, r: number) => `${c},${r}`;
const eq = (a: Cell, b: Cell) => a.c === b.c && a.r === b.r;
const inBounds = (c: number, r: number) => c >= 0 && c < COLS && r >= 0 && r < ROWS;

function runAStar(walls: Set<string>, start: Cell, goal: Cell, useHeuristic: boolean): Result {
  const h = (c: number, r: number) =>
    useHeuristic ? Math.abs(c - goal.c) + Math.abs(r - goal.r) : 0;
  const g = new Map<string, number>();
  const came = new Map<string, string>();
  const closed = new Set<string>();
  const order: Cell[] = [];
  // open list: array of {c,r,f}; we extract the minimum f each step.
  const open: { c: number; r: number; f: number }[] = [];
  g.set(key(start.c, start.r), 0);
  open.push({ c: start.c, r: start.r, f: h(start.c, start.r) });

  while (open.length) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
    const cur = open.splice(bi, 1)[0];
    const ck = key(cur.c, cur.r);
    if (closed.has(ck)) continue;
    closed.add(ck);
    if (!(cur.c === start.c && cur.r === start.r)) order.push({ c: cur.c, r: cur.r });

    if (cur.c === goal.c && cur.r === goal.r) {
      const path: Cell[] = [];
      let k: string | undefined = ck;
      while (k) {
        const [c, r] = k.split(',').map(Number);
        path.unshift({ c, r });
        k = came.get(k);
      }
      return { order, path, found: true };
    }

    const gc = g.get(ck) ?? Infinity;
    for (const [dc, dr] of [[0, -1], [1, 0], [0, 1], [-1, 0]] as const) {
      const nc = cur.c + dc;
      const nr = cur.r + dr;
      if (!inBounds(nc, nr)) continue;
      const nk = key(nc, nr);
      if (walls.has(nk) || closed.has(nk)) continue;
      const tentative = gc + 1;
      if (tentative < (g.get(nk) ?? Infinity)) {
        g.set(nk, tentative);
        came.set(nk, ck);
        open.push({ c: nc, r: nr, f: tentative + h(nc, nr) });
      }
    }
  }
  return { order, path: [], found: false };
}

export default function AStarGridSearch() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ cell: 36, ox: 0, oy: 0 });
  const rafRef = useRef<number | null>(null);
  const paintRef = useRef<null | boolean>(null); // true = add wall, false = erase

  const [walls, setWalls] = useState<Set<string>>(() => {
    const w = new Set<string>();
    // a couple of starter obstacles
    for (let r = 2; r <= 7; r++) w.add(key(6, r));
    for (let c = 9; c <= 12; c++) w.add(key(c, 4));
    return w;
  });
  const [start, setStart] = useState<Cell>({ c: 2, r: 5 });
  const [goal, setGoal] = useState<Cell>({ c: 14, r: 5 });
  const [mode, setMode] = useState<Mode>('wall');
  const [useHeuristic, setUseHeuristic] = useState(true);
  const [result, setResult] = useState<Result | null>(null);
  const [revealed, setRevealed] = useState(0);
  const [running, setRunning] = useState(false);

  const resultRef = useRef<Result | null>(null);
  const revealedRef = useRef(0);
  resultRef.current = result;
  revealedRef.current = revealed;

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { cell, ox, oy } = sizeRef.current;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const res = resultRef.current;
    const rev = revealedRef.current;
    const done = res && rev >= res.order.length;

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const x = ox + c * cell;
        const y = oy + r * cell;
        ctx.fillStyle = walls.has(key(c, r)) ? COLORS.wall : 'rgba(128,128,128,0.05)';
        ctx.fillRect(x, y, cell, cell);
        ctx.strokeStyle = COLORS.grid;
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, cell, cell);
      }
    }

    // explored cells (in expansion order, up to `revealed`)
    if (res) {
      const upto = Math.min(rev, res.order.length);
      for (let i = 0; i < upto; i++) {
        const cl = res.order[i];
        if (eq(cl, start) || eq(cl, goal)) continue;
        ctx.fillStyle = i === upto - 1 && !done ? COLORS.head : COLORS.explored;
        ctx.fillRect(ox + cl.c * cell, oy + cl.r * cell, cell, cell);
      }
      // final path
      if (done && res.found) {
        ctx.strokeStyle = COLORS.path;
        ctx.lineWidth = Math.max(3, cell * 0.18);
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.beginPath();
        res.path.forEach((p, i) => {
          const px = ox + p.c * cell + cell / 2;
          const py = oy + p.r * cell + cell / 2;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.stroke();
      }
    }

    // start & goal markers
    const marker = (cl: Cell, color: string, glyph: string) => {
      const cx = ox + cl.c * cell + cell / 2;
      const cy = oy + cl.r * cell + cell / 2;
      ctx.beginPath();
      ctx.arc(cx, cy, cell * 0.34, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#fff';
      ctx.stroke();
      ctx.font = `${Math.round(cell * 0.5)}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(glyph, cx, cy + 1);
    };
    marker(start, COLORS.start, '🚩');
    marker(goal, COLORS.goal, '🎯');
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 560);
      const cell = Math.floor(w / COLS);
      const gw = cell * COLS;
      const gh = cell * ROWS;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = gw * dpr;
      canvas.height = gh * dpr;
      canvas.style.width = `${gw}px`;
      canvas.style.height = `${gh}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { cell, ox: 0, oy: 0 };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(draw, [walls, start, goal, result, revealed]);

  const cellFromEvent = (e: PointerEvent): Cell | null => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const { cell } = sizeRef.current;
    const c = Math.floor((e.clientX - rect.left) / cell);
    const r = Math.floor((e.clientY - rect.top) / cell);
    return inBounds(c, r) ? { c, r } : null;
  };

  const clearSearch = () => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    setRunning(false);
    setResult(null);
    setRevealed(0);
  };

  const applyWall = (cell: Cell, add: boolean) => {
    if (eq(cell, start) || eq(cell, goal)) return;
    setWalls((prev) => {
      const next = new Set(prev);
      const k = key(cell.c, cell.r);
      if (add) next.add(k);
      else next.delete(k);
      return next;
    });
  };

  const onDown = (e: PointerEvent) => {
    const cell = cellFromEvent(e);
    if (!cell) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    clearSearch();
    if (mode === 'start') {
      if (!walls.has(key(cell.c, cell.r)) && !eq(cell, goal)) setStart(cell);
      return;
    }
    if (mode === 'goal') {
      if (!walls.has(key(cell.c, cell.r)) && !eq(cell, start)) setGoal(cell);
      return;
    }
    const add = !walls.has(key(cell.c, cell.r));
    paintRef.current = add;
    applyWall(cell, add);
  };
  const onMove = (e: PointerEvent) => {
    if (paintRef.current === null || mode !== 'wall') return;
    const cell = cellFromEvent(e);
    if (cell) applyWall(cell, paintRef.current);
  };
  const onUp = () => {
    paintRef.current = null;
  };

  const run = () => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    const res = runAStar(walls, start, goal, useHeuristic);
    resultRef.current = res;
    setResult(res);
    setRevealed(0);
    revealedRef.current = 0;
    setRunning(true);
    const step = Math.max(1, Math.round(res.order.length / 110));
    const loop = () => {
      const next = revealedRef.current + step;
      revealedRef.current = next;
      setRevealed(next);
      if (next < res.order.length) {
        rafRef.current = requestAnimationFrame(loop);
      } else {
        setRunning(false);
      }
    };
    rafRef.current = requestAnimationFrame(loop);
  };

  const expanded = result ? Math.min(revealed, result.order.length) : 0;
  const pathLen = result && result.found && revealed >= result.order.length ? result.path.length - 1 : null;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        {(['wall', 'start', 'goal'] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            class={`rounded-lg px-3 py-1.5 text-sm font-semibold capitalize transition ${
              mode === m ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
            }`}
          >
            {m === 'wall' ? 'Paint walls' : m === 'start' ? 'Move start' : 'Move goal'}
          </button>
        ))}
        <button
          onClick={run}
          class="ml-auto rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white transition hover:opacity-90"
        >
          {running ? 'Searching…' : 'Run A*'}
        </button>
        <button
          onClick={() => { clearSearch(); setWalls(new Set()); }}
          class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text"
        >
          Clear
        </button>
      </div>

      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas
          ref={canvasRef}
          class="touch-none rounded-xl bg-surface-2"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        />

        <div class="space-y-3 text-sm">
          <p class="text-muted">
            Drag on the grid to paint or erase walls, then press <strong>Run A*</strong>. Blue cells are
            the ones the search expanded; the emerald line is the shortest path.
          </p>

          <label class="flex items-center gap-2">
            <input
              type="checkbox"
              checked={useHeuristic}
              onInput={(e) => { clearSearch(); setUseHeuristic((e.target as HTMLInputElement).checked); }}
              class="h-4 w-4 accent-[#4f46e5]"
            />
            <span>
              Use the heuristic <span class="text-muted">(off = plain Dijkstra)</span>
            </span>
          </label>

          <div class="grid grid-cols-2 gap-2">
            <AStarReadout label="cells expanded" value={`${expanded}`} />
            <AStarReadout label="path length" value={pathLen != null ? `${pathLen}` : '—'} />
          </div>

          {result && revealed >= result.order.length && !result.found && (
            <div class="rounded-lg bg-surface-2 p-3 text-xs">
              No path — the goal is walled off. Erase some walls and try again.
            </div>
          )}

          <div class="rounded-lg bg-surface-2 p-3 text-xs text-muted">
            With the heuristic on, A* aims straight at the 🎯 and expands far fewer cells. Turn it off
            and Dijkstra fans out in every direction — same path, much more work.
          </div>
        </div>
      </div>
    </div>
  );
}

function AStarReadout({ label, value }: { label: string; value: string }) {
  return (
    <div class="rounded-lg bg-surface-2 px-3 py-2">
      <span class="text-muted text-xs">{label}</span>
      <div class="font-mono font-semibold">{value}</div>
    </div>
  );
}
