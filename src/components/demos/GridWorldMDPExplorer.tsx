import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Grid-world MDP explorer.
   - Move the agent (indigo) with the arrow buttons or by tapping a
     neighbouring cell. The environment hands back a reward each step.
   - A goal cell (+1, emerald) ends the episode; a pit (-1) punishes.
   - A live readout tracks steps, the last reward, and the discounted
     return G = Σ γ^t r_t so the discount factor becomes tangible.
   ------------------------------------------------------------------ */

const COLS = 4;
const ROWS = 3;
const COLORS = {
  agent: '#4f46e5',
  goal: '#10b981',
  pit: '#ef4444',
  grid: 'rgba(128,128,128,0.25)',
};

type Cell = { c: number; r: number };

const GOAL: Cell = { c: 3, r: 0 };
const PIT: Cell = { c: 3, r: 1 };
const WALL: Cell = { c: 1, r: 1 };
const START: Cell = { c: 0, r: 2 };

const eq = (a: Cell, b: Cell) => a.c === b.c && a.r === b.r;
const isWall = (c: Cell) => eq(c, WALL);
const inBounds = (c: Cell) => c.c >= 0 && c.c < COLS && c.r >= 0 && c.r < ROWS;

export default function GridWorldMDPExplorer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 480, h: 360, cell: 120, ox: 0, oy: 0 });
  const [agent, setAgent] = useState<Cell>(START);
  const [gamma, setGamma] = useState(0.9);
  const [steps, setSteps] = useState(0);
  const [lastR, setLastR] = useState(0);
  const [ret, setRet] = useState(0);
  const [done, setDone] = useState(false);

  const rewardAt = (c: Cell) => (eq(c, GOAL) ? 1 : eq(c, PIT) ? -1 : -0.04);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h, cell, ox, oy } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const x = ox + c * cell;
        const y = oy + r * cell;
        const here = { c, r };
        let fill = 'rgba(128,128,128,0.06)';
        if (isWall(here)) fill = 'rgba(128,128,128,0.45)';
        else if (eq(here, GOAL)) fill = 'rgba(16,185,129,0.18)';
        else if (eq(here, PIT)) fill = 'rgba(239,68,68,0.18)';
        ctx.fillStyle = fill;
        ctx.fillRect(x, y, cell, cell);
        ctx.strokeStyle = COLORS.grid;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x, y, cell, cell);

        if (!isWall(here)) {
          ctx.font = '600 13px Inter, sans-serif';
          ctx.fillStyle = eq(here, GOAL) ? COLORS.goal : eq(here, PIT) ? COLORS.pit : 'rgba(128,128,128,0.7)';
          const label = eq(here, GOAL) ? '+1' : eq(here, PIT) ? '-1' : '-0.04';
          ctx.fillText(label, x + 8, y + 20);
        }
        if (eq(here, GOAL)) { ctx.font = '28px serif'; ctx.fillText('🏁', x + cell / 2 - 16, y + cell / 2 + 14); }
        if (eq(here, PIT)) { ctx.font = '28px serif'; ctx.fillText('🕳️', x + cell / 2 - 16, y + cell / 2 + 14); }
      }
    }

    // agent
    const ax = ox + agent.c * cell + cell / 2;
    const ay = oy + agent.r * cell + cell / 2;
    ctx.beginPath();
    ctx.arc(ax, ay, cell * 0.26, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.agent;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#fff';
    ctx.stroke();
    ctx.font = '20px serif';
    ctx.fillText('🤖', ax - 12, ay + 7);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 480);
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
      sizeRef.current = { w: gw, h: gh, cell, ox: 0, oy: 0 };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(draw, [agent]);

  const move = (dc: number, dr: number) => {
    if (done) return;
    const next = { c: agent.c + dc, r: agent.r + dr };
    if (!inBounds(next) || isWall(next)) return; // bump into wall: stay put, no step
    const r = rewardAt(next);
    setAgent(next);
    setLastR(r);
    setRet((g) => g + Math.pow(gamma, steps) * r);
    setSteps((s) => s + 1);
    if (eq(next, GOAL) || eq(next, PIT)) setDone(true);
  };

  const reset = () => {
    setAgent(START);
    setSteps(0);
    setLastR(0);
    setRet(0);
    setDone(false);
  };

  const onTap = (e: PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const { cell } = sizeRef.current;
    const c = Math.floor((e.clientX - rect.left) / cell);
    const r = Math.floor((e.clientY - rect.top) / cell);
    const dc = c - agent.c;
    const dr = r - agent.r;
    if (Math.abs(dc) + Math.abs(dr) === 1) move(dc, dr); // only adjacent moves
  };

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas
          ref={canvasRef}
          class="touch-none rounded-xl bg-surface-2"
          onPointerDown={onTap}
        />

        <div class="space-y-3 text-sm">
          <p class="text-muted">
            Tap an adjacent square (or use the arrows) to take an action. The environment returns a reward each step.
          </p>

          <div class="grid grid-cols-3 gap-1.5 w-40">
            <span />
            <button class="rounded-lg bg-surface-2 py-2 font-bold hover:bg-brand-soft" onClick={() => move(0, -1)}>↑</button>
            <span />
            <button class="rounded-lg bg-surface-2 py-2 font-bold hover:bg-brand-soft" onClick={() => move(-1, 0)}>←</button>
            <button class="rounded-lg bg-surface-2 py-2 font-bold hover:bg-brand-soft" onClick={() => move(0, 1)}>↓</button>
            <button class="rounded-lg bg-surface-2 py-2 font-bold hover:bg-brand-soft" onClick={() => move(1, 0)}>→</button>
          </div>

          <label class="block">
            <span class="mb-1 block text-muted">discount γ = {gamma.toFixed(2)}</span>
            <input
              type="range" min={0} max={1} step={0.05} value={gamma}
              onInput={(e) => setGamma(parseFloat((e.target as HTMLInputElement).value))}
              class="w-full accent-[#4f46e5]"
            />
          </label>

          <div class="grid grid-cols-3 gap-2">
            <MdpReadout label="steps t" value={`${steps}`} />
            <MdpReadout label="last reward" value={lastR.toFixed(2)} />
            <MdpReadout label="return G" value={ret.toFixed(3)} />
          </div>

          {done && (
            <div class="rounded-lg bg-surface-2 p-3 text-xs">
              {eq(agent, GOAL) ? 'Reached the goal — episode over. ' : 'Fell in the pit — episode over. '}
              The return G is the discounted sum of every reward collected.
            </div>
          )}

          <button class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white" onClick={reset}>
            Reset episode
          </button>
        </div>
      </div>
    </div>
  );
}

function MdpReadout({ label, value }: { label: string; value: string }) {
  return (
    <div class="rounded-lg bg-surface-2 px-3 py-2">
      <span class="text-muted text-xs">{label}</span>
      <div class="font-mono font-semibold">{value}</div>
    </div>
  );
}
