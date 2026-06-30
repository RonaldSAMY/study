import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Client-side prediction demo.
   - Hold the on-screen arrows (or keyboard ←/→) to move.
   - Top lane: NO prediction — the character only moves after a full
     round trip to the server, so it lags by the RTT.
   - Bottom lane: WITH prediction — moves instantly; a faint ghost
     shows the server's confirmed position trailing slightly behind.
   - "Force a rollback" injects a server correction that snaps the
     predicted character, then it replays — the classic correction.
   - rAF loop, cancelled on unmount.
   ------------------------------------------------------------------ */

const COLORS = {
  pred: '#10b981',
  noPred: '#0ea5e9',
  ghost: 'rgba(79,70,229,0.45)',
  server: '#4f46e5',
  track: 'rgba(128,128,128,0.18)',
};

const SPEED = 3.2;      // world units per second
const TRACK = 10;       // world width in units

export default function ClientPredictionDemo() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const lastTRef = useRef<number>(0);
  const sizeRef = useRef({ w: 480, h: 240 });

  const dirRef = useRef(0);
  const logRef = useRef<{ t: number; dir: number }[]>([{ t: 0, dir: 0 }]);
  const posRef = useRef({ pred: 1, noPred: 1, server: 1 });
  const corrRef = useRef<{ applyAt: number; delta: number }[]>([]);
  const flashRef = useRef(0);

  const [latency, setLatency] = useState(140); // one-way ms
  const latRef = useRef(latency);
  latRef.current = latency;

  const setDir = (d: number) => {
    if (dirRef.current === d) return;
    dirRef.current = d;
    logRef.current.push({ t: performance.now(), dir: d });
    if (logRef.current.length > 400) logRef.current.splice(0, 200);
  };

  const dirAt = (time: number) => {
    const log = logRef.current;
    for (let i = log.length - 1; i >= 0; i--) {
      if (log[i].t <= time) return log[i].dir;
    }
    return 0;
  };

  const forceRollback = () => {
    // server disagrees: pretend it saw a wall ~1.6 units back.
    corrRef.current.push({ applyAt: performance.now() + latRef.current, delta: -1.6 });
  };

  const clamp = (v: number) => Math.max(0.3, Math.min(TRACK - 0.3, v));

  const draw = (now: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    const rtt = latRef.current * 2;

    const dt = lastTRef.current ? Math.min(0.05, (now - lastTRef.current) / 1000) : 0;
    lastTRef.current = now;

    // integrate the three positions from one shared input timeline
    posRef.current.pred = clamp(posRef.current.pred + dirAt(now) * SPEED * dt);
    posRef.current.noPred = clamp(posRef.current.noPred + dirAt(now - rtt) * SPEED * dt);
    posRef.current.server = clamp(posRef.current.server + dirAt(now - latRef.current) * SPEED * dt);

    // apply due corrections (rollback)
    const stay: typeof corrRef.current = [];
    for (const c of corrRef.current) {
      if (now >= c.applyAt) {
        posRef.current.pred = clamp(posRef.current.pred + c.delta);
        posRef.current.server = clamp(posRef.current.server + c.delta);
        flashRef.current = now;
      } else stay.push(c);
    }
    corrRef.current = stay;

    ctx.clearRect(0, 0, w, h);
    const padX = 40;
    const usable = w - padX * 2;
    const xOf = (u: number) => padX + (u / TRACK) * usable;

    const laneY = (i: number) => h * (0.34 + i * 0.36);

    const lanes: [string, number][] = [['Without prediction', laneY(0)], ['With prediction', laneY(1)]];
    for (const [name, y] of lanes) {
      ctx.strokeStyle = COLORS.track;
      ctx.lineWidth = 10; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(xOf(0), y); ctx.lineTo(xOf(TRACK), y); ctx.stroke();
      ctx.fillStyle = 'rgba(128,128,128,0.85)';
      ctx.font = '600 12px Inter, sans-serif'; ctx.textAlign = 'left';
      ctx.fillText(name, xOf(0), y - 22);
    }

    // top lane: no-prediction char
    char(ctx, xOf(posRef.current.noPred), laneY(0), COLORS.noPred);

    // bottom lane: server ghost (confirmed) + predicted char
    char(ctx, xOf(posRef.current.server), laneY(1), COLORS.ghost, true);
    const flashing = now - flashRef.current < 260;
    char(ctx, xOf(posRef.current.pred), laneY(1), flashing ? '#f59e0b' : COLORS.pred);
    if (flashing) {
      ctx.fillStyle = '#f59e0b'; ctx.font = '700 12px Inter, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('rollback!', xOf(posRef.current.pred), laneY(1) - 24);
    }
    ctx.textAlign = 'left';

    rafRef.current = requestAnimationFrame(draw);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 620);
      const h = Math.round(w * 0.42);
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

    const kd = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') setDir(-1);
      else if (e.key === 'ArrowRight') setDir(1);
    };
    const ku = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') setDir(0);
    };
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const hold = (d: number) => ({
    onPointerDown: (e: PointerEvent) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); setDir(d); },
    onPointerUp: () => setDir(0),
    onPointerLeave: () => setDir(0),
    onPointerCancel: () => setDir(0),
  });

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

      <div class="mt-3 grid gap-4 md:grid-cols-[auto,1fr] md:items-center">
        <div class="flex items-center gap-2">
          <button {...hold(-1)} class="select-none touch-none rounded-lg bg-brand px-5 py-3 text-lg font-bold text-white active:scale-95">←</button>
          <button {...hold(1)} class="select-none touch-none rounded-lg bg-brand px-5 py-3 text-lg font-bold text-white active:scale-95">→</button>
          <button onClick={forceRollback} class="rounded-lg bg-surface-2 px-3 py-2 text-sm font-semibold text-muted transition hover:text-text">Force a rollback</button>
        </div>

        <div class="space-y-2 text-sm">
          <label class="block">
            <span class="mb-1 block text-muted">one-way latency = {latency} ms (RTT {latency * 2} ms)</span>
            <input type="range" min={20} max={300} step={10} value={latency}
              onInput={(e) => setLatency(parseInt((e.target as HTMLInputElement).value))}
              class="w-full accent-[#10b981]" />
          </label>
          <p class="text-xs text-muted">
            Hold an arrow: the green (predicted) character moves at once, while the blue one waits a full
            round trip. The faint purple ghost is the server's confirmed position.
          </p>
        </div>
      </div>
    </div>
  );
}

function char(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, ghost = false) {
  ctx.beginPath();
  ctx.arc(x, y, ghost ? 9 : 12, 0, Math.PI * 2);
  ctx.fillStyle = color; ctx.fill();
  if (!ghost) { ctx.lineWidth = 2.5; ctx.strokeStyle = '#fff'; ctx.stroke(); }
}
