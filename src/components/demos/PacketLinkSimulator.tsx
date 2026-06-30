import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Packet link simulator.
   - Watch packets travel across a wire from sender to receiver.
   - Slide latency (one-way delay) and loss (% dropped on the wire).
   - Toggle UDP (fire and forget) vs TCP (lost packets are resent).
   - Continuous requestAnimationFrame loop, cancelled on unmount.
   ------------------------------------------------------------------ */

type Proto = 'udp' | 'tcp';
type Packet = {
  id: number;
  start: number;       // timestamp the packet left the sender
  travel: number;      // one-way travel time in ms
  doomed: boolean;     // will it be dropped on the wire?
  attempt: number;     // 1 = first try, 2+ = retransmit (TCP)
};

const COLORS = {
  a: '#4f46e5',        // sender / link
  b: '#0ea5e9',        // receiver
  ok: '#10b981',       // delivered / good
  bad: '#ef4444',      // dropped
  grid: 'rgba(128,128,128,0.18)',
};

export default function PacketLinkSimulator() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const packetsRef = useRef<Packet[]>([]);
  const lastSpawnRef = useRef<number>(0);
  const nextIdRef = useRef<number>(1);
  const sizeRef = useRef({ w: 480, h: 300 });

  const [latency, setLatency] = useState(120);   // one-way ms
  const [loss, setLoss] = useState(15);          // percent
  const [proto, setProto] = useState<Proto>('udp');
  const [running, setRunning] = useState(true);
  const [stats, setStats] = useState({ sent: 0, delivered: 0, dropped: 0, resent: 0 });

  // keep live params readable inside the rAF loop
  const paramRef = useRef({ latency, loss, proto, running });
  paramRef.current = { latency, loss, proto, running };

  const draw = (now: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    const { latency: lat, loss: lossPct, proto: pr, running: run } = paramRef.current;

    const padX = 56;
    const wireY = h * 0.42;
    const left = padX;
    const right = w - padX;

    // ---- spawn a new packet roughly every 700ms ----
    if (run && now - lastSpawnRef.current > 700) {
      lastSpawnRef.current = now;
      const doomed = Math.random() * 100 < lossPct;
      packetsRef.current.push({
        id: nextIdRef.current++,
        start: now,
        travel: lat,
        doomed,
        attempt: 1,
      });
      setStats((s) => ({ ...s, sent: s.sent + 1 }));
    }

    ctx.clearRect(0, 0, w, h);

    // ---- the wire ----
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(left, wireY); ctx.lineTo(right, wireY); ctx.stroke();

    // endpoints
    endpoint(ctx, left, wireY, COLORS.a, 'Sender');
    endpoint(ctx, right, wireY, COLORS.b, 'Receiver');

    // ---- advance + draw packets ----
    const survivors: Packet[] = [];
    for (const p of packetsRef.current) {
      const age = now - p.start;
      const t = age / p.travel;          // 0..1 across the wire
      if (p.doomed && t >= 0.5) {
        // dropped at the midpoint of the wire
        const x = left + (right - left) * 0.5;
        ctx.fillStyle = COLORS.bad;
        ctx.font = '700 16px Inter, sans-serif';
        ctx.fillText('✕', x - 6, wireY - 16);
        setStats((s) => ({ ...s, dropped: s.dropped + 1 }));
        // TCP notices the loss and resends after one round trip
        if (pr === 'tcp') {
          packetsRef.current.push({
            id: nextIdRef.current++,
            start: now + p.travel, // wait ~1 one-way for the timeout, simplified
            travel: p.travel,
            doomed: Math.random() * 100 < lossPct,
            attempt: p.attempt + 1,
          });
          setStats((s) => ({ ...s, resent: s.resent + 1 }));
        }
        continue; // remove this packet
      }
      if (t >= 1) {
        setStats((s) => ({ ...s, delivered: s.delivered + 1 }));
        continue; // arrived, remove
      }
      if (age < 0) { survivors.push(p); continue; } // queued (TCP resend waiting)
      const x = left + (right - left) * Math.max(0, t);
      const col = p.attempt > 1 ? '#f59e0b' : COLORS.ok;
      ctx.beginPath();
      ctx.arc(x, wireY, 9, 0, Math.PI * 2);
      ctx.fillStyle = col; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
      survivors.push(p);
    }
    packetsRef.current = survivors;

    // ---- info line ----
    ctx.fillStyle = 'rgba(128,128,128,0.9)';
    ctx.font = '600 13px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      `${pr.toUpperCase()} · one-way ${lat} ms · RTT ≈ ${lat * 2} ms · loss ${lossPct}%`,
      w / 2,
      h - 16,
    );
    ctx.textAlign = 'left';

    rafRef.current = requestAnimationFrame(draw);
  };

  // ---- responsive sizing with devicePixelRatio ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 620);
      const h = Math.round(w * 0.5);
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
    rafRef.current = requestAnimationFrame(draw);
    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const reset = () => {
    packetsRef.current = [];
    setStats({ sent: 0, delivered: 0, dropped: 0, resent: 0 });
  };

  const deliveryRate = stats.sent ? Math.round((stats.delivered / stats.sent) * 100) : 0;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        {(['udp', 'tcp'] as Proto[]).map((p) => (
          <button
            key={p}
            onClick={() => setProto(p)}
            class={`rounded-lg px-3 py-1.5 text-sm font-semibold uppercase transition ${
              proto === p ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
            }`}
          >
            {p}
          </button>
        ))}
        <button
          onClick={() => setRunning((r) => !r)}
          class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted transition hover:text-text"
        >
          {running ? 'Pause' : 'Resume'}
        </button>
        <button
          onClick={reset}
          class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted transition hover:text-text"
        >
          Reset
        </button>
      </div>

      <div class="grid gap-4 md:grid-cols-[1fr,auto] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

        <div class="space-y-3 text-sm">
          <label class="block">
            <span class="mb-1 block text-muted">one-way latency = {latency} ms</span>
            <input
              type="range" min={20} max={400} step={10} value={latency}
              onInput={(e) => setLatency(parseInt((e.target as HTMLInputElement).value))}
              class="w-full accent-[#4f46e5]"
            />
          </label>
          <label class="block">
            <span class="mb-1 block text-muted">packet loss = {loss}%</span>
            <input
              type="range" min={0} max={60} step={1} value={loss}
              onInput={(e) => setLoss(parseInt((e.target as HTMLInputElement).value))}
              class="w-full accent-[#ef4444]"
            />
          </label>
          <div class="grid grid-cols-2 gap-2">
            <Readout label="sent" value={`${stats.sent}`} />
            <Readout label="delivered" value={`${stats.delivered}`} color={COLORS.ok} />
            <Readout label="dropped" value={`${stats.dropped}`} color={COLORS.bad} />
            <Readout label="resent (TCP)" value={`${stats.resent}`} color="#f59e0b" />
          </div>
          <Readout label="delivery rate" value={`${deliveryRate}%`} />
        </div>
      </div>
    </div>
  );
}

function Readout({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div class="rounded-lg bg-surface-2 px-3 py-2">
      <span class="text-muted" style={color ? `color:${color}` : ''}>{label}</span>
      <div class="font-mono font-semibold">{value}</div>
    </div>
  );
}

function endpoint(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, name: string) {
  ctx.beginPath();
  ctx.arc(x, y, 16, 0, Math.PI * 2);
  ctx.fillStyle = color; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.stroke();
  ctx.fillStyle = 'rgba(128,128,128,0.95)';
  ctx.font = '600 12px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(name, x, y + 34);
  ctx.textAlign = 'left';
}
