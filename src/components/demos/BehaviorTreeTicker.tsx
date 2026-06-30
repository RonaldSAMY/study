import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Behavior-tree ticker for a guard NPC.
   - The tree is a Selector (try Combat, else Patrol).
   - Toggle "enemy visible" and tick the tree; the active branch and each
     node's returned status (success / failure / running) light up.
   - "Look around" is a RUNNING action that finishes after a few ticks,
     so you can watch a leaf hold the tree before it succeeds.
   ------------------------------------------------------------------ */

type Status = 'success' | 'failure' | 'running' | 'idle';

const STATUS_COLOR: Record<Status, string> = {
  success: '#10b981',
  failure: '#ef4444',
  running: '#f59e0b',
  idle: 'rgba(128,128,128,0.45)',
};

type NodeDef = { id: string; label: string; kind: 'selector' | 'sequence' | 'leaf' };
const NODES: NodeDef[] = [
  { id: 'root', label: 'Selector ?', kind: 'selector' },
  { id: 'combat', label: 'Sequence →', kind: 'sequence' },
  { id: 'patrol', label: 'Sequence →', kind: 'sequence' },
  { id: 'cEnemy', label: 'Enemy visible?', kind: 'leaf' },
  { id: 'cShoot', label: 'Shoot', kind: 'leaf' },
  { id: 'pGo', label: 'Go to post', kind: 'leaf' },
  { id: 'pLook', label: 'Look around', kind: 'leaf' },
];
const EDGES: [string, string][] = [
  ['root', 'combat'], ['root', 'patrol'],
  ['combat', 'cEnemy'], ['combat', 'cShoot'],
  ['patrol', 'pGo'], ['patrol', 'pLook'],
];

function layout(w: number) {
  const fx: Record<string, number> = {
    cEnemy: 0.16, cShoot: 0.38, pGo: 0.62, pLook: 0.84,
    combat: 0.27, patrol: 0.73, root: 0.5,
  };
  const fy: Record<string, number> = {
    root: 0.16, combat: 0.5, patrol: 0.5, cEnemy: 0.86, cShoot: 0.86, pGo: 0.86, pLook: 0.86,
  };
  const H = 230;
  const pos: Record<string, { x: number; y: number }> = {};
  for (const n of NODES) pos[n.id] = { x: fx[n.id] * w, y: fy[n.id] * H };
  return { pos, H };
}

export default function BehaviorTreeTicker() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 480, H: 230 });
  const rafRef = useRef<number | null>(null);
  const lookRef = useRef(0);
  const lastRef = useRef(0);
  const runningRef = useRef(false);

  const [enemy, setEnemy] = useState(false);
  const [status, setStatus] = useState<Record<string, Status>>({});
  const [visited, setVisited] = useState<Set<string>>(new Set());
  const [rootResult, setRootResult] = useState<Status>('idle');
  const [ticks, setTicks] = useState(0);
  const [auto, setAuto] = useState(false);

  const enemyRef = useRef(enemy);
  enemyRef.current = enemy;
  const statusRef = useRef<Record<string, Status>>({});
  const visitedRef = useRef<Set<string>>(new Set());

  const tick = () => {
    const st: Record<string, Status> = {};
    const vis = new Set<string>();
    const set = (id: string, s: Status): Status => { vis.add(id); st[id] = s; return s; };

    const cEnemy = () => set('cEnemy', enemyRef.current ? 'success' : 'failure');
    const cShoot = () => set('cShoot', 'success');
    const pGo = () => set('pGo', 'success');
    const pLook = () => {
      lookRef.current += 1;
      if (lookRef.current < 3) return set('pLook', 'running');
      lookRef.current = 0;
      return set('pLook', 'success');
    };
    const sequence = (id: string, kids: (() => Status)[]): Status => {
      vis.add(id);
      for (const k of kids) { const s = k(); if (s !== 'success') { st[id] = s; return s; } }
      st[id] = 'success'; return 'success';
    };
    const selector = (id: string, kids: (() => Status)[]): Status => {
      vis.add(id);
      for (const k of kids) { const s = k(); if (s !== 'failure') { st[id] = s; return s; } }
      st[id] = 'failure'; return 'failure';
    };

    const result = selector('root', [
      () => sequence('combat', [cEnemy, cShoot]),
      () => sequence('patrol', [pGo, pLook]),
    ]);

    statusRef.current = st;
    visitedRef.current = vis;
    setStatus(st);
    setVisited(vis);
    setRootResult(result);
    setTicks((t) => t + 1);
    draw();
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, H } = sizeRef.current;
    const { pos } = layout(w);
    ctx.clearRect(0, 0, w, H);
    const st = statusRef.current;
    const vis = visitedRef.current;

    // edges
    for (const [a, b] of EDGES) {
      const on = vis.has(a) && vis.has(b);
      ctx.strokeStyle = on ? '#4f46e5' : 'rgba(128,128,128,0.3)';
      ctx.lineWidth = on ? 2.5 : 1.2;
      ctx.beginPath();
      ctx.moveTo(pos[a].x, pos[a].y + 18);
      ctx.lineTo(pos[b].x, pos[b].y - 18);
      ctx.stroke();
    }

    // nodes
    for (const n of NODES) {
      const p = pos[n.id];
      const s: Status = st[n.id] ?? 'idle';
      const bw = n.kind === 'leaf' ? Math.min(96, w * 0.2) : 86;
      const bh = 36;
      const color = STATUS_COLOR[s];
      ctx.fillStyle = s === 'idle' ? 'rgba(128,128,128,0.10)' : color;
      roundRect(ctx, p.x - bw / 2, p.y - bh / 2, bw, bh, 8);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = color;
      roundRect(ctx, p.x - bw / 2, p.y - bh / 2, bw, bh, 8);
      ctx.stroke();
      ctx.fillStyle = s === 'idle' ? 'rgba(120,120,120,0.95)' : '#fff';
      ctx.font = `600 ${n.kind === 'leaf' ? 10 : 11}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(n.label, p.x, p.y);
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 560);
      const { H } = layout(w);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = H * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${H}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w, H };
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

  const loop = (now: number) => {
    if (!runningRef.current) return;
    if (now - lastRef.current > 650) {
      lastRef.current = now;
      tick();
    }
    rafRef.current = requestAnimationFrame(loop);
  };
  const toggleAuto = () => {
    const next = !runningRef.current;
    runningRef.current = next;
    setAuto(next);
    if (next) { lastRef.current = 0; rafRef.current = requestAnimationFrame(loop); }
    else if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
  };

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

        <div class="space-y-3 text-sm">
          <p class="text-muted">
            Tick the tree top-down. The Selector tries <strong>Combat</strong> first; only if it fails
            does it fall through to <strong>Patrol</strong>.
          </p>

          <label class="flex items-center gap-2">
            <input
              type="checkbox" checked={enemy}
              onInput={(e) => setEnemy((e.target as HTMLInputElement).checked)}
              class="h-4 w-4 accent-[#4f46e5]"
            />
            <span>Enemy visible</span>
          </label>

          <div class="flex flex-wrap gap-2">
            <button onClick={tick} class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">
              Tick once
            </button>
            <button onClick={toggleAuto} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">
              {auto ? 'Stop auto-tick' : 'Auto-tick'}
            </button>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <BtReadout label="ticks" value={`${ticks}`} />
            <BtReadout label="root returns" value={rootResult} color={STATUS_COLOR[rootResult]} />
          </div>

          <div class="flex flex-wrap gap-3 text-xs">
            {(['success', 'failure', 'running'] as Status[]).map((s) => (
              <span key={s} class="flex items-center gap-1.5">
                <span class="inline-block h-3 w-3 rounded" style={`background:${STATUS_COLOR[s]}`} />
                {s}
              </span>
            ))}
          </div>

          <p class="text-xs text-muted">
            With no enemy, Combat fails fast and Patrol runs. "Look around" returns
            <strong> running</strong> for a few ticks before it succeeds — that is how a tree remembers
            what it is in the middle of doing.
          </p>
        </div>
      </div>
    </div>
  );
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function BtReadout({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div class="rounded-lg bg-surface-2 px-3 py-2">
      <span class="text-muted text-xs">{label}</span>
      <div class="font-mono font-semibold capitalize" style={color ? `color:${color}` : ''}>{value}</div>
    </div>
  );
}
