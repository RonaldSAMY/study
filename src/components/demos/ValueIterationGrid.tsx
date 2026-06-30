import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Value-iteration on a grid-world.
   - Press "Sweep" to apply one Bellman optimality backup to every cell.
   - Cells are shaded by their current value V(s); the greedy policy
     (the best action from each cell) is drawn as an arrow.
   - Watch the values flood outward from the goal, sweep by sweep.
   ------------------------------------------------------------------ */

const COLS = 4;
const ROWS = 3;

type Cell = { c: number; r: number };
const GOAL: Cell = { c: 3, r: 0 };
const PIT: Cell = { c: 3, r: 1 };
const WALL: Cell = { c: 1, r: 1 };

const eq = (a: Cell, b: Cell) => a.c === b.c && a.r === b.r;
const isWall = (c: Cell) => eq(c, WALL);
const isTerminal = (c: Cell) => eq(c, GOAL) || eq(c, PIT);
const inBounds = (c: Cell) => c.c >= 0 && c.c < COLS && c.r >= 0 && c.r < ROWS;
const idx = (c: number, r: number) => r * COLS + c;

const ACTIONS: { dc: number; dr: number; ang: number }[] = [
  { dc: 0, dr: -1, ang: -Math.PI / 2 },
  { dc: 0, dr: 1, ang: Math.PI / 2 },
  { dc: -1, dr: 0, ang: Math.PI },
  { dc: 1, dr: 0, ang: 0 },
];

function initValues() {
  const V = new Array(COLS * ROWS).fill(0);
  V[idx(GOAL.c, GOAL.r)] = 1;
  V[idx(PIT.c, PIT.r)] = -1;
  return V;
}

export default function ValueIterationGrid() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ cell: 120, w: 480, h: 360 });
  const [V, setV] = useState<number[]>(initValues);
  const [gamma, setGamma] = useState(0.9);
  const [sweeps, setSweeps] = useState(0);
  const stepReward = -0.04;

  const bestAction = (Varr: number[], c: number, r: number) => {
    let best = -Infinity;
    let bestA = 0;
    ACTIONS.forEach((a, ai) => {
      let nc = c + a.dc, nr = r + a.dr;
      if (!inBounds({ c: nc, r: nr }) || isWall({ c: nc, r: nr })) { nc = c; nr = r; }
      const v = stepReward + gamma * Varr[idx(nc, nr)];
      if (v > best) { best = v; bestA = ai; }
    });
    return { best, bestA };
  };

  const sweep = () => {
    const next = [...V];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const here = { c, r };
        if (isWall(here) || isTerminal(here)) continue;
        next[idx(c, r)] = bestAction(V, c, r).best;
      }
    }
    setV(next);
    setSweeps((s) => s + 1);
  };

  const reset = () => { setV(initValues()); setSweeps(0); };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { cell, w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const here = { c, r };
        const x = c * cell, y = r * cell;
        const v = V[idx(c, r)];
        if (isWall(here)) {
          ctx.fillStyle = 'rgba(128,128,128,0.45)';
        } else {
          // emerald for positive, red for negative, scaled by magnitude
          const m = Math.max(-1, Math.min(1, v));
          ctx.fillStyle = m >= 0
            ? `rgba(16,185,129,${0.12 + 0.55 * m})`
            : `rgba(239,68,68,${0.12 + 0.55 * -m})`;
        }
        ctx.fillRect(x, y, cell, cell);
        ctx.strokeStyle = 'rgba(128,128,128,0.25)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x, y, cell, cell);

        if (isWall(here)) continue;

        // value text
        ctx.font = '600 15px Inter, sans-serif';
        ctx.fillStyle = 'rgba(20,20,20,0.85)';
        ctx.fillText(v.toFixed(2), x + 10, y + 24);

        if (isTerminal(here)) {
          ctx.font = '26px serif';
          ctx.fillText(eq(here, GOAL) ? '🏁' : '🕳️', x + cell / 2 - 14, y + cell / 2 + 18);
          continue;
        }

        // greedy policy arrow
        const { bestA } = bestAction(V, c, r);
        const ang = ACTIONS[bestA].ang;
        const cx = x + cell / 2, cy = y + cell / 2 + 8;
        const len = cell * 0.22;
        ctx.strokeStyle = '#4f46e5';
        ctx.fillStyle = '#4f46e5';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(cx - len * Math.cos(ang), cy - len * Math.sin(ang));
        ctx.lineTo(cx + len * Math.cos(ang), cy + len * Math.sin(ang));
        ctx.stroke();
        const hx = cx + len * Math.cos(ang), hy = cy + len * Math.sin(ang);
        ctx.beginPath();
        ctx.moveTo(hx, hy);
        ctx.lineTo(hx - 8 * Math.cos(ang - 0.5), hy - 8 * Math.sin(ang - 0.5));
        ctx.lineTo(hx - 8 * Math.cos(ang + 0.5), hy - 8 * Math.sin(ang + 0.5));
        ctx.closePath();
        ctx.fill();
      }
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 480);
      const cell = Math.floor(w / COLS);
      const gw = cell * COLS, gh = cell * ROWS;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = gw * dpr;
      canvas.height = gh * dpr;
      canvas.style.width = `${gw}px`;
      canvas.style.height = `${gh}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { cell, w: gw, h: gh };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(draw, [V, gamma]);

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

        <div class="space-y-3 text-sm">
          <p class="text-muted">
            Each cell shows its value V(s); the indigo arrow is the greedy action. Sweep to apply one Bellman backup everywhere.
          </p>

          <div class="flex gap-2">
            <button class="rounded-lg bg-brand px-3 py-1.5 font-semibold text-white" onClick={sweep}>Sweep ▶</button>
            <button class="rounded-lg bg-surface-2 px-3 py-1.5 font-semibold text-muted hover:text-text" onClick={reset}>Reset</button>
          </div>

          <label class="block">
            <span class="mb-1 block text-muted">discount γ = {gamma.toFixed(2)}</span>
            <input
              type="range" min={0} max={0.99} step={0.01} value={gamma}
              onInput={(e) => { setGamma(parseFloat((e.target as HTMLInputElement).value)); }}
              class="w-full accent-[#4f46e5]"
            />
          </label>

          <div class="rounded-lg bg-surface-2 p-3">
            <div class="flex justify-between"><span class="text-muted">sweeps done</span><strong>{sweeps}</strong></div>
            <p class="mt-1 text-xs text-muted">
              Values stop changing once they reach the fixed point — that is the optimal value function V*.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
