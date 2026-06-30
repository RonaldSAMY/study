import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Q-learning agent on a grid-world.
   - Q(s,a) starts at zero. Each episode the agent uses ε-greedy action
     selection and updates Q with the temporal-difference rule.
   - "Watch one" animates a single episode; "Train 20" runs them fast.
   - Cells shade by max_a Q(s,a); arrows show the greedy action learned.
   - Any pending animation frame is cancelled on unmount.
   ------------------------------------------------------------------ */

const COLS = 4;
const ROWS = 3;

type Cell = { c: number; r: number };
const GOAL: Cell = { c: 3, r: 0 };
const PIT: Cell = { c: 3, r: 1 };
const WALL: Cell = { c: 1, r: 1 };
const START: Cell = { c: 0, r: 2 };

const eq = (a: Cell, b: Cell) => a.c === b.c && a.r === b.r;
const isWall = (c: Cell) => eq(c, WALL);
const isTerminal = (c: Cell) => eq(c, GOAL) || eq(c, PIT);
const inBounds = (c: Cell) => c.c >= 0 && c.c < COLS && c.r >= 0 && c.r < ROWS;
const idx = (c: number, r: number) => r * COLS + c;

const ACTIONS = [
  { dc: 0, dr: -1, ang: -Math.PI / 2 },
  { dc: 0, dr: 1, ang: Math.PI / 2 },
  { dc: -1, dr: 0, ang: Math.PI },
  { dc: 1, dr: 0, ang: 0 },
];

const newQ = () => Array.from({ length: COLS * ROWS }, () => [0, 0, 0, 0]);
const rewardAt = (c: Cell) => (eq(c, GOAL) ? 1 : eq(c, PIT) ? -1 : -0.04);

function stepEnv(c: Cell, ai: number): Cell {
  const a = ACTIONS[ai];
  const next = { c: c.c + a.dc, r: c.r + a.dr };
  if (!inBounds(next) || isWall(next)) return c;
  return next;
}

export default function QLearningGridAgent() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ cell: 120, w: 480, h: 360 });
  const qRef = useRef<number[][]>(newQ());
  const rafRef = useRef<number | null>(null);
  const [, force] = useState(0);
  const [agent, setAgent] = useState<Cell>(START);
  const [epsilon, setEpsilon] = useState(0.2);
  const [alpha, setAlpha] = useState(0.5);
  const [episodes, setEpisodes] = useState(0);
  const [busy, setBusy] = useState(false);
  const gamma = 0.95;

  const greedy = (s: number) => {
    const q = qRef.current[s];
    let best = 0;
    for (let a = 1; a < 4; a++) if (q[a] > q[best]) best = a;
    return best;
  };

  const pickAction = (s: number) => (Math.random() < epsilon ? Math.floor(Math.random() * 4) : greedy(s));

  // one full episode of learning (no animation). returns steps taken.
  const runEpisode = () => {
    let s: Cell = START;
    let guard = 0;
    while (!isTerminal(s) && guard++ < 200) {
      const si = idx(s.c, s.r);
      const a = pickAction(si);
      const sp = stepEnv(s, a);
      const r = rewardAt(sp);
      const spi = idx(sp.c, sp.r);
      const target = r + (isTerminal(sp) ? 0 : gamma * Math.max(...qRef.current[spi]));
      qRef.current[si][a] += alpha * (target - qRef.current[si][a]);
      s = sp;
    }
  };

  const trainBatch = (n: number) => {
    for (let i = 0; i < n; i++) runEpisode();
    setEpisodes((e) => e + n);
    setAgent(START);
    force((x) => x + 1);
  };

  // animated single episode
  const watchOne = () => {
    if (busy) return;
    setBusy(true);
    let s: Cell = START;
    let guard = 0;
    setAgent(START);
    const tick = () => {
      if (isTerminal(s) || guard++ > 60) {
        setEpisodes((e) => e + 1);
        setBusy(false);
        rafRef.current = null;
        force((x) => x + 1);
        return;
      }
      const si = idx(s.c, s.r);
      const a = pickAction(si);
      const sp = stepEnv(s, a);
      const r = rewardAt(sp);
      const spi = idx(sp.c, sp.r);
      const target = r + (isTerminal(sp) ? 0 : gamma * Math.max(...qRef.current[spi]));
      qRef.current[si][a] += alpha * (target - qRef.current[si][a]);
      s = sp;
      setAgent(sp);
      force((x) => x + 1);
      // pace the animation
      const start = performance.now();
      const wait = () => {
        if (performance.now() - start > 260) tick();
        else rafRef.current = requestAnimationFrame(wait);
      };
      rafRef.current = requestAnimationFrame(wait);
    };
    tick();
  };

  const reset = () => {
    qRef.current = newQ();
    setEpisodes(0);
    setAgent(START);
    force((x) => x + 1);
  };

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
        const maxQ = Math.max(...qRef.current[idx(c, r)]);
        if (isWall(here)) ctx.fillStyle = 'rgba(128,128,128,0.45)';
        else if (eq(here, GOAL)) ctx.fillStyle = 'rgba(16,185,129,0.25)';
        else if (eq(here, PIT)) ctx.fillStyle = 'rgba(239,68,68,0.25)';
        else {
          const m = Math.max(-1, Math.min(1, maxQ));
          ctx.fillStyle = m >= 0 ? `rgba(14,165,233,${0.08 + 0.5 * m})` : `rgba(239,68,68,${0.08 + 0.5 * -m})`;
        }
        ctx.fillRect(x, y, cell, cell);
        ctx.strokeStyle = 'rgba(128,128,128,0.25)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x, y, cell, cell);

        if (isWall(here)) continue;
        if (isTerminal(here)) {
          ctx.font = '26px serif';
          ctx.fillText(eq(here, GOAL) ? '🏁' : '🕳️', x + cell / 2 - 14, y + cell / 2 + 10);
          continue;
        }
        ctx.font = '600 12px Inter, sans-serif';
        ctx.fillStyle = 'rgba(20,20,20,0.7)';
        ctx.fillText(maxQ.toFixed(2), x + 8, y + 18);

        // greedy arrow (only if learned something)
        if (Math.abs(maxQ) > 1e-4) {
          const ang = ACTIONS[greedy(idx(c, r))].ang;
          const cx = x + cell / 2, cy = y + cell / 2 + 6, len = cell * 0.2;
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
    }

    // agent
    const ax = agent.c * cell + cell / 2;
    const ay = agent.r * cell + cell / 2;
    ctx.font = '24px serif';
    ctx.fillText('🤖', ax - 14, ay + 9);
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
    return () => {
      window.removeEventListener('resize', resize);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(draw);

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

        <div class="space-y-3 text-sm">
          <p class="text-muted">
            The agent learns Q(s,a) by trial and error. Numbers show max Q per cell; arrows show the greedy path it has discovered.
          </p>

          <div class="flex flex-wrap gap-2">
            <button class="rounded-lg bg-brand px-3 py-1.5 font-semibold text-white disabled:opacity-50" disabled={busy} onClick={watchOne}>Watch one</button>
            <button class="rounded-lg bg-surface-2 px-3 py-1.5 font-semibold text-muted hover:text-text disabled:opacity-50" disabled={busy} onClick={() => trainBatch(20)}>Train 20</button>
            <button class="rounded-lg bg-surface-2 px-3 py-1.5 font-semibold text-muted hover:text-text disabled:opacity-50" disabled={busy} onClick={reset}>Reset</button>
          </div>

          <label class="block">
            <span class="mb-1 block text-muted">explore ε = {epsilon.toFixed(2)}</span>
            <input type="range" min={0} max={1} step={0.05} value={epsilon}
              onInput={(e) => setEpsilon(parseFloat((e.target as HTMLInputElement).value))}
              class="w-full accent-[#0ea5e9]" />
          </label>
          <label class="block">
            <span class="mb-1 block text-muted">learning rate α = {alpha.toFixed(2)}</span>
            <input type="range" min={0.05} max={1} step={0.05} value={alpha}
              onInput={(e) => setAlpha(parseFloat((e.target as HTMLInputElement).value))}
              class="w-full accent-[#10b981]" />
          </label>

          <div class="rounded-lg bg-surface-2 p-3">
            <div class="flex justify-between"><span class="text-muted">episodes trained</span><strong>{episodes}</strong></div>
            <p class="mt-1 text-xs text-muted">
              High ε early = lots of exploration. Lower it as the policy sharpens.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
