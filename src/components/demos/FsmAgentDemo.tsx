import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Finite-state machine for a guard NPC.
   - Move the player (you) with the cursor / finger over the canvas.
   - The guard reads ONE number — distance to you — and switches between
     three states: PATROL (far), CHASE (in sight), FLEE (too close).
   - The little state graph on the right lights up the active state.
   ------------------------------------------------------------------ */

type State = 'patrol' | 'chase' | 'flee';

const COLORS: Record<State, string> = {
  patrol: '#10b981',
  chase: '#0ea5e9',
  flee: '#ef4444',
};

const SIGHT = 170; // enter CHASE within this distance
const PANIC = 70; // enter FLEE within this distance

export default function FsmAgentDemo() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 480, h: 320 });
  const rafRef = useRef<number | null>(null);

  const agentRef = useRef({ x: 120, y: 160 });
  const playerRef = useRef({ x: 360, y: 160 });
  const wpRef = useRef(0);
  const stateRef = useRef<State>('patrol');

  const [state, setState] = useState<State>('patrol');
  const [dist, setDist] = useState(240);

  const waypoints = () => {
    const { w, h } = sizeRef.current;
    return [
      { x: w * 0.2, y: h * 0.25 },
      { x: w * 0.8, y: h * 0.25 },
      { x: w * 0.8, y: h * 0.78 },
      { x: w * 0.2, y: h * 0.78 },
    ];
  };

  const nextState = (d: number): State => {
    if (d < PANIC) return 'flee';
    if (d < SIGHT) return 'chase';
    return 'patrol';
  };

  const step = () => {
    const { w, h } = sizeRef.current;
    const a = agentRef.current;
    const p = playerRef.current;
    const d = Math.hypot(p.x - a.x, p.y - a.y);
    const st = nextState(d);
    stateRef.current = st;

    let tx = a.x;
    let ty = a.y;
    let speed = 1.4;
    if (st === 'chase') {
      tx = p.x; ty = p.y; speed = 2.6;
    } else if (st === 'flee') {
      tx = a.x - (p.x - a.x); ty = a.y - (p.y - a.y); speed = 3.4;
    } else {
      const wps = waypoints();
      const target = wps[wpRef.current % wps.length];
      tx = target.x; ty = target.y;
      if (Math.hypot(target.x - a.x, target.y - a.y) < 8) wpRef.current++;
    }
    const dx = tx - a.x;
    const dy = ty - a.y;
    const len = Math.hypot(dx, dy) || 1;
    a.x = Math.max(12, Math.min(w - 12, a.x + (dx / len) * speed));
    a.y = Math.max(12, Math.min(h - 12, a.y + (dy / len) * speed));

    setState(st);
    setDist(d);
    draw();
    rafRef.current = requestAnimationFrame(step);
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);

    const a = agentRef.current;
    const p = playerRef.current;
    const st = stateRef.current;

    // patrol route
    const wps = waypoints();
    ctx.setLineDash([5, 6]);
    ctx.strokeStyle = 'rgba(16,185,129,0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    wps.forEach((wp, i) => (i ? ctx.lineTo(wp.x, wp.y) : ctx.moveTo(wp.x, wp.y)));
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);

    // sight / panic rings around the guard
    ctx.beginPath(); ctx.arc(a.x, a.y, SIGHT, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(14,165,233,0.25)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.beginPath(); ctx.arc(a.x, a.y, PANIC, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(239,68,68,0.30)'; ctx.stroke();

    // line to player
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(p.x, p.y);
    ctx.strokeStyle = 'rgba(128,128,128,0.35)'; ctx.lineWidth = 1; ctx.stroke();

    // player
    ctx.beginPath(); ctx.arc(p.x, p.y, 11, 0, Math.PI * 2);
    ctx.fillStyle = '#4f46e5'; ctx.fill();
    ctx.font = '14px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('🧍', p.x, p.y + 1);

    // guard
    ctx.beginPath(); ctx.arc(a.x, a.y, 15, 0, Math.PI * 2);
    ctx.fillStyle = COLORS[st]; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.stroke();
    ctx.font = '16px serif';
    ctx.fillText('💂', a.x, a.y + 1);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 560);
      const h = Math.round(w * 0.64);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w, h };
      playerRef.current = { x: w * 0.72, y: h * 0.5 };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    rafRef.current = requestAnimationFrame(step);
    return () => {
      window.removeEventListener('resize', resize);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const movePlayer = (e: PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    playerRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas
          ref={canvasRef}
          class="touch-none rounded-xl bg-surface-2"
          onPointerMove={movePlayer}
          onPointerDown={movePlayer}
        />

        <div class="space-y-3 text-sm">
          <p class="text-muted">
            Move your cursor over the arena. The guard 💂 reacts only to how close you are.
          </p>

          <div class="rounded-lg p-3 font-semibold text-white" style={`background:${COLORS[state]}`}>
            Current state: <span class="uppercase tracking-wide">{state}</span>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <FsmReadout label="distance" value={Math.round(dist).toString()} />
            <FsmReadout label="thresholds" value={`${PANIC} / ${SIGHT}`} />
          </div>

          <StateGraph active={state} />

          <p class="text-xs text-muted">
            Outer ring = sight range (CHASE). Inner ring = panic range (FLEE). Outside both, the guard
            calmly PATROLS its route.
          </p>
        </div>
      </div>
    </div>
  );
}

function StateGraph({ active }: { active: State }) {
  const nodes: { id: State; x: number; label: string }[] = [
    { id: 'patrol', x: 30, label: 'Patrol' },
    { id: 'chase', x: 110, label: 'Chase' },
    { id: 'flee', x: 190, label: 'Flee' },
  ];
  return (
    <svg viewBox="0 0 220 70" class="w-full max-w-[260px]" role="img" aria-label="state graph">
      <defs>
        <marker id="fsm-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="rgba(128,128,128,0.7)" />
        </marker>
      </defs>
      {[[30, 110], [110, 190]].map(([x1, x2]) => (
        <g key={`${x1}`}>
          <line x1={x1 + 16} y1={28} x2={x2 - 18} y2={28} stroke="rgba(128,128,128,0.6)" stroke-width="1.5" marker-end="url(#fsm-arrow)" />
          <line x1={x2 - 16} y1={40} x2={x1 + 18} y2={40} stroke="rgba(128,128,128,0.6)" stroke-width="1.5" marker-end="url(#fsm-arrow)" />
        </g>
      ))}
      {nodes.map((n) => (
        <g key={n.id}>
          <circle cx={n.x} cy={34} r={15} fill={active === n.id ? COLORS[n.id] : 'transparent'} stroke={COLORS[n.id]} stroke-width="2" />
          <text x={n.x} y={37} text-anchor="middle" font-size="8" font-weight="700" fill={active === n.id ? '#fff' : 'currentColor'}>
            {n.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

function FsmReadout({ label, value }: { label: string; value: string }) {
  return (
    <div class="rounded-lg bg-surface-2 px-3 py-2">
      <span class="text-muted text-xs">{label}</span>
      <div class="font-mono font-semibold">{value}</div>
    </div>
  );
}
