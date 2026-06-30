import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Finite State Machine demo.
   - A guard agent has three states: PATROL, CHASE, FLEE.
   - Drag the player (red). The agent switches state by distance:
       far  -> PATROL,  near -> CHASE,  very near -> FLEE.
   - The mini state graph on the right highlights the active node.
   ------------------------------------------------------------------ */

type State = 'patrol' | 'chase' | 'flee';
type Vec = { x: number; y: number };

const COLORS = {
  agent: '#4f46e5',
  player: '#ef4444',
  chase: '#0ea5e9',
  flee: '#f59e0b',
  patrol: '#10b981',
  grid: 'rgba(128,128,128,0.18)',
};

const CHASE_RADIUS = 170;
const FLEE_RADIUS = 70;

function Readout({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div class="rounded-lg bg-surface-2 px-3 py-2">
      <span class="text-muted" style={color ? `color:${color}` : ''}>{label}</span>
      <div class="font-mono font-semibold">{value}</div>
    </div>
  );
}

export default function FSMStateSwitcher() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [player, setPlayer] = useState<Vec>({ x: 360, y: 90 });
  const [state, setState] = useState<State>('patrol');
  const agentRef = useRef<Vec>({ x: 120, y: 200 });
  const patrolTRef = useRef(0);
  const playerRef = useRef(player);
  const stateRef = useRef<State>('patrol');
  const sizeRef = useRef({ w: 480, h: 320 });
  const draggingRef = useRef(false);
  const rafRef = useRef<number | null>(null);

  useEffect(() => { playerRef.current = player; }, [player]);
  useEffect(() => { stateRef.current = state; }, [state]);

  const decideState = (d: number): State => {
    if (d < FLEE_RADIUS) return 'flee';
    if (d < CHASE_RADIUS) return 'chase';
    return 'patrol';
  };

  const draw = (ctx: CanvasRenderingContext2D) => {
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);

    // grid
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    for (let gx = 0; gx < w; gx += 32) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke(); }
    for (let gy = 0; gy < h; gy += 32) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke(); }

    const a = agentRef.current;
    const p = playerRef.current;
    const st = stateRef.current;
    const stColor = st === 'chase' ? COLORS.chase : st === 'flee' ? COLORS.flee : COLORS.patrol;

    // detection rings around the agent
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = 'rgba(14,165,233,0.35)';
    ctx.beginPath(); ctx.arc(a.x, a.y, CHASE_RADIUS, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(245,158,11,0.4)';
    ctx.beginPath(); ctx.arc(a.x, a.y, FLEE_RADIUS, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);

    // line agent -> player
    ctx.strokeStyle = 'rgba(128,128,128,0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(p.x, p.y); ctx.stroke();

    // agent
    ctx.beginPath(); ctx.arc(a.x, a.y, 13, 0, Math.PI * 2);
    ctx.fillStyle = stColor; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.stroke();
    ctx.fillStyle = stColor;
    ctx.font = '600 13px Inter, sans-serif';
    ctx.fillText(st.toUpperCase(), a.x - 22, a.y - 20);

    // player
    ctx.beginPath(); ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
    ctx.fillStyle = '#fff'; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = COLORS.player; ctx.stroke();
    ctx.fillStyle = COLORS.player;
    ctx.fillText('player', p.x + 12, p.y - 10);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 560);
      const h = Math.round(w * 0.66);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w, h };
    };
    resize();
    window.addEventListener('resize', resize);

    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const { w, h } = sizeRef.current;
      const a = agentRef.current;
      const p = playerRef.current;
      const d = Math.hypot(p.x - a.x, p.y - a.y);
      const next = decideState(d);
      if (next !== stateRef.current) setState(next);

      // act according to current state
      const speed = 90;
      if (next === 'patrol') {
        patrolTRef.current += dt * 0.6;
        const cx = w * 0.28, cy = h * 0.6, r = Math.min(w, h) * 0.22;
        const tx = cx + Math.cos(patrolTRef.current) * r;
        const ty = cy + Math.sin(patrolTRef.current) * r;
        a.x += (tx - a.x) * Math.min(1, dt * 3);
        a.y += (ty - a.y) * Math.min(1, dt * 3);
      } else if (next === 'chase') {
        const inv = 1 / (d || 1);
        a.x += (p.x - a.x) * inv * speed * dt;
        a.y += (p.y - a.y) * inv * speed * dt;
      } else {
        const inv = 1 / (d || 1);
        a.x -= (p.x - a.x) * inv * speed * 1.3 * dt;
        a.y -= (p.y - a.y) * inv * speed * 1.3 * dt;
        a.x = Math.max(16, Math.min(w - 16, a.x));
        a.y = Math.max(16, Math.min(h - 16, a.y));
      }

      const ctx = canvas.getContext('2d');
      if (ctx) draw(ctx);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener('resize', resize);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const pointer = (e: PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };
  const onDown = (e: PointerEvent) => {
    const { x, y } = pointer(e);
    if (Math.hypot(x - playerRef.current.x, y - playerRef.current.y) < 30) {
      draggingRef.current = true;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      e.preventDefault();
    }
  };
  const onMove = (e: PointerEvent) => {
    if (!draggingRef.current) return;
    const { x, y } = pointer(e);
    setPlayer({ x, y });
  };
  const onUp = () => { draggingRef.current = false; };

  const dist = Math.hypot(player.x - agentRef.current.x, player.y - agentRef.current.y);
  const nodes: { id: State; label: string; color: string }[] = [
    { id: 'patrol', label: 'PATROL', color: COLORS.patrol },
    { id: 'chase', label: 'CHASE', color: COLORS.chase },
    { id: 'flee', label: 'FLEE', color: COLORS.flee },
  ];

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
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
          <p class="text-muted">Drag the <span class="font-semibold" style="color:#ef4444">player</span> toward and away from the guard.</p>
          <div class="grid grid-cols-2 gap-2">
            <Readout label="state" value={state.toUpperCase()} color={state === 'chase' ? COLORS.chase : state === 'flee' ? COLORS.flee : COLORS.patrol} />
            <Readout label="distance" value={dist.toFixed(0)} />
          </div>

          <div class="rounded-lg bg-surface-2 p-3">
            <p class="mb-2 text-xs font-bold uppercase tracking-wide text-muted">State graph</p>
            <div class="flex flex-col gap-2">
              {nodes.map((n) => (
                <div
                  key={n.id}
                  class="flex items-center justify-between rounded-lg border px-3 py-1.5 transition"
                  style={state === n.id
                    ? `border-color:${n.color};background:${n.color}1a;color:${n.color};font-weight:700`
                    : 'border-color:var(--border);color:var(--muted)'}
                >
                  <span>{n.label}</span>
                  <span class="text-xs">
                    {n.id === 'patrol' ? `d ≥ ${CHASE_RADIUS}` : n.id === 'chase' ? `${FLEE_RADIUS} ≤ d < ${CHASE_RADIUS}` : `d < ${FLEE_RADIUS}`}
                  </span>
                </div>
              ))}
            </div>
            <p class="mt-2 text-xs text-muted">Exactly one state is active at a time — that is the whole idea of a finite state machine.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
