import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Client-side prediction & server reconciliation lab.
   - Hold the move buttons (or arrow keys) to push the player.
   - Toggle prediction ON/OFF and watch how latency feels.
   - "Server knockback" injects a server-only shove the client did
     not predict, forcing a rollback-and-replay correction.
   ------------------------------------------------------------------ */

const COLORS = {
  you: '#4f46e5',
  server: '#10b981',
  link: 'rgba(128,128,128,0.6)',
  lane: 'rgba(128,128,128,0.25)',
  axis: 'rgba(128,128,128,0.5)',
};

type Cmd = { seq: number; dir: number };
type ToServer = { arrive: number; cmd: Cmd };
type ToClient = { arrive: number; seq: number; pos: number };

const TICK = 70; // ms between input samples
const STEP = 2.4; // world units per input command
const KNOCK = -22; // server-only shove (world units)
const MINP = 2;
const MAXP = 98;

const clamp = (x: number) => Math.max(MINP, Math.min(MAXP, x));

export default function PredictionReconcileLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [predict, setPredict] = useState(true);
  const [lag, setLag] = useState(110); // one-way latency (ms)
  const [ui, setUi] = useState({ display: 50, server: 50, pending: 0, status: 'Hold a button to move.' });

  // ---- simulation refs (do not trigger re-renders) ----
  const dirRef = useRef(0);
  const seqRef = useRef(1);
  const predictedRef = useRef(50);
  const unackedRef = useRef<Cmd[]>([]);
  const serverPosRef = useRef(50);
  const lastServerSeqRef = useRef(0);
  const serverDirtyRef = useRef(false);
  const knockRef = useRef(false);
  const toServerRef = useRef<ToServer[]>([]);
  const toClientRef = useRef<ToClient[]>([]);
  const displayServerRef = useRef(50);
  const lastSampleRef = useRef(0);
  const lagRef = useRef(lag);
  const predictRef = useRef(predict);
  const correctionRef = useRef(0); // size of last reconciliation snap
  const sizeRef = useRef({ w: 480, h: 220 });

  useEffect(() => { lagRef.current = lag; }, [lag]);
  useEffect(() => { predictRef.current = predict; }, [predict]);

  // ---- responsive canvas ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 560);
      const h = Math.round(Math.max(180, w * 0.42));
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
    return () => window.removeEventListener('resize', resize);
  }, []);

  // ---- keyboard ----
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a') { dirRef.current = -1; e.preventDefault(); }
      else if (e.key === 'ArrowRight' || e.key === 'd') { dirRef.current = 1; e.preventDefault(); }
    };
    const up = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'ArrowRight', 'a', 'd'].includes(e.key)) dirRef.current = 0;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  // ---- main loop ----
  useEffect(() => {
    let raf = 0;
    let uiClock = 0;

    const xpx = (p: number) => {
      const { w } = sizeRef.current;
      const m = 28;
      return m + (p / 100) * (w - 2 * m);
    };

    const marker = (ctx: CanvasRenderingContext2D, x: number, y: number, color: string, filled: boolean, text: string) => {
      ctx.beginPath();
      ctx.arc(x, y, 11, 0, Math.PI * 2);
      if (filled) { ctx.fillStyle = color; ctx.fill(); }
      else { ctx.fillStyle = '#fff'; ctx.fill(); }
      ctx.lineWidth = 3; ctx.strokeStyle = color; ctx.stroke();
      ctx.font = '600 12px Inter, sans-serif';
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.fillText(text, x, y - 18);
      ctx.textAlign = 'start';
    };

    const draw = (display: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const { w, h } = sizeRef.current;
      ctx.clearRect(0, 0, w, h);
      const yYou = h * 0.4;
      const yServer = h * 0.74;
      // lanes
      ctx.strokeStyle = COLORS.lane; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(xpx(0), yYou); ctx.lineTo(xpx(100), yYou); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(xpx(0), yServer); ctx.lineTo(xpx(100), yServer); ctx.stroke();
      // connector showing the gap
      const xd = xpx(display), xs = xpx(serverPosRef.current);
      ctx.setLineDash([4, 4]); ctx.strokeStyle = COLORS.link; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(xd, yYou); ctx.lineTo(xs, yServer); ctx.stroke();
      ctx.setLineDash([]);
      marker(ctx, xs, yServer, COLORS.server, false, 'server truth');
      marker(ctx, xd, yYou, COLORS.you, true, 'you see');
    };

    const frame = (t: number) => {
      if (!lastSampleRef.current) lastSampleRef.current = t;
      const lagV = lagRef.current;

      // 1) sample input at fixed ticks
      while (t - lastSampleRef.current >= TICK) {
        lastSampleRef.current += TICK;
        const dir = dirRef.current;
        if (dir !== 0) {
          const cmd: Cmd = { seq: seqRef.current++, dir };
          if (predictRef.current) predictedRef.current = clamp(predictedRef.current + dir * STEP);
          unackedRef.current.push(cmd);
          toServerRef.current.push({ arrive: t + lagV, cmd });
        }
      }

      // 2) server receives commands
      const stillServer: ToServer[] = [];
      for (const p of toServerRef.current) {
        if (p.arrive <= t) {
          serverPosRef.current = clamp(serverPosRef.current + p.cmd.dir * STEP);
          lastServerSeqRef.current = p.cmd.seq;
          serverDirtyRef.current = true;
        } else stillServer.push(p);
      }
      toServerRef.current = stillServer;

      // knockback: a server-only impulse the client never predicted
      if (knockRef.current) {
        knockRef.current = false;
        serverPosRef.current = clamp(serverPosRef.current + KNOCK);
        serverDirtyRef.current = true;
      }

      // server emits a snapshot when its state changed
      if (serverDirtyRef.current) {
        serverDirtyRef.current = false;
        toClientRef.current.push({ arrive: t + lagV, seq: lastServerSeqRef.current, pos: serverPosRef.current });
      }

      // 3) client receives snapshots -> reconcile
      const stillClient: ToClient[] = [];
      for (const s of toClientRef.current) {
        if (s.arrive <= t) {
          displayServerRef.current = s.pos;
          if (predictRef.current) {
            const before = predictedRef.current;
            // drop acknowledged inputs, then rollback to server pos and replay the rest
            unackedRef.current = unackedRef.current.filter((c) => c.seq > s.seq);
            let p = s.pos;
            for (const c of unackedRef.current) p = clamp(p + c.dir * STEP);
            predictedRef.current = p;
            correctionRef.current = Math.abs(p - before);
          }
        } else stillClient.push(s);
      }
      toClientRef.current = stillClient;

      const display = predictRef.current ? predictedRef.current : displayServerRef.current;
      draw(display);

      // 4) throttled UI readouts
      if (t - uiClock > 90) {
        uiClock = t;
        const corr = correctionRef.current;
        const status = predictRef.current
          ? (corr > 0.5 ? `Rollback: snapped ${corr.toFixed(0)} units to match the server.` : 'Predicted locally — controls feel instant.')
          : 'No prediction — you wait a full round trip before moving.';
        setUi({
          display: Math.round(display),
          server: Math.round(serverPosRef.current),
          pending: unackedRef.current.length,
          status,
        });
        correctionRef.current *= 0.4; // let the "rollback" note fade
      }

      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  const holdStart = (d: number) => () => { dirRef.current = d; };
  const holdEnd = () => { dirRef.current = 0; };

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setPredict((p) => !p)}
          class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${predict ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'}`}
        >
          Prediction: {predict ? 'ON' : 'OFF'}
        </button>
        <button
          onClick={() => { knockRef.current = true; }}
          class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted transition hover:text-text"
        >
          Server knockback
        </button>
      </div>

      <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button
          onPointerDown={holdStart(-1)} onPointerUp={holdEnd} onPointerLeave={holdEnd} onPointerCancel={holdEnd}
          class="touch-none select-none rounded-lg bg-surface-2 px-4 py-2 text-lg font-bold text-text active:bg-brand active:text-white"
        >◀</button>
        <button
          onPointerDown={holdStart(1)} onPointerUp={holdEnd} onPointerLeave={holdEnd} onPointerCancel={holdEnd}
          class="touch-none select-none rounded-lg bg-surface-2 px-4 py-2 text-lg font-bold text-text active:bg-brand active:text-white"
        >▶</button>
        <label class="ml-auto flex items-center gap-2 text-sm">
          <span class="text-muted">latency {lag} ms</span>
          <input type="range" min={20} max={250} step={10} value={lag}
            onInput={(e) => setLag(parseInt((e.target as HTMLInputElement).value))}
            class="w-32 accent-[#4f46e5]" />
        </label>
      </div>

      <div class="mt-3 grid grid-cols-3 gap-2 text-sm">
        <Readout label="round trip" value={`${lag * 2} ms`} />
        <Readout label="pending inputs" value={String(ui.pending)} />
        <Readout label="gap" value={`${Math.abs(ui.display - ui.server)} u`} />
      </div>
      <p class="mt-2 rounded-lg bg-surface-2 p-3 text-xs text-muted">{ui.status}</p>
    </div>
  );
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div class="rounded-lg bg-surface-2 px-3 py-2">
      <span class="text-muted">{label}</span>
      <div class="font-mono font-semibold">{value}</div>
    </div>
  );
}
