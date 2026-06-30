import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Network topology diagram.
   - Toggle between Client-Server (authoritative hub) and Peer-to-Peer.
   - Click any player to make it "act"; watch the message pulses flow.
   - Client-Server: act -> server -> every client (2 hops).
   - P2P: act -> every other peer directly (1 hop, many links).
   - rAF animation loop, cancelled on unmount.
   ------------------------------------------------------------------ */

type Topo = 'cs' | 'p2p';
type Pulse = { fromX: number; fromY: number; toX: number; toY: number; start: number; dur: number; color: string };
type Node = { x: number; y: number };

const COLORS = {
  client: '#0ea5e9',
  server: '#4f46e5',
  pulse: '#10b981',
  pulse2: '#f59e0b',
  link: 'rgba(128,128,128,0.28)',
};

const N = 4; // number of players

export default function NetTopologyDiagram() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const pulsesRef = useRef<Pulse[]>([]);
  const sizeRef = useRef({ w: 480, h: 360 });
  const nodesRef = useRef<{ players: Node[]; server: Node }>({ players: [], server: { x: 0, y: 0 } });
  const topoRef = useRef<Topo>('cs');

  const [topo, setTopo] = useState<Topo>('cs');
  const [lastActor, setLastActor] = useState<number | null>(null);
  topoRef.current = topo;

  const layout = () => {
    const { w, h } = sizeRef.current;
    const cx = w / 2;
    const cy = h / 2;
    const r = Math.min(w, h) * 0.36;
    const players: Node[] = [];
    for (let i = 0; i < N; i++) {
      const ang = -Math.PI / 2 + (i / N) * Math.PI * 2;
      players.push({ x: cx + r * Math.cos(ang), y: cy + r * Math.sin(ang) });
    }
    nodesRef.current = { players, server: { x: cx, y: cy } };
  };

  const act = (actor: number) => {
    const now = performance.now();
    const { players, server } = nodesRef.current;
    const a = players[actor];
    if (topoRef.current === 'cs') {
      // hop 1: actor -> server
      pulsesRef.current.push({ fromX: a.x, fromY: a.y, toX: server.x, toY: server.y, start: now, dur: 400, color: COLORS.pulse });
      // hop 2: server -> every other client (after hop 1 lands)
      players.forEach((p, i) => {
        if (i === actor) return;
        pulsesRef.current.push({ fromX: server.x, fromY: server.y, toX: p.x, toY: p.y, start: now + 400, dur: 400, color: COLORS.pulse2 });
      });
    } else {
      // direct to every peer
      players.forEach((p, i) => {
        if (i === actor) return;
        pulsesRef.current.push({ fromX: a.x, fromY: a.y, toX: p.x, toY: p.y, start: now, dur: 480, color: COLORS.pulse });
      });
    }
    setLastActor(actor);
  };

  const draw = (now: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    const { players, server } = nodesRef.current;
    const t = topoRef.current;
    ctx.clearRect(0, 0, w, h);

    // ---- links ----
    ctx.strokeStyle = COLORS.link;
    ctx.lineWidth = 2;
    if (t === 'cs') {
      players.forEach((p) => { ctx.beginPath(); ctx.moveTo(server.x, server.y); ctx.lineTo(p.x, p.y); ctx.stroke(); });
    } else {
      for (let i = 0; i < players.length; i++) {
        for (let j = i + 1; j < players.length; j++) {
          ctx.beginPath(); ctx.moveTo(players[i].x, players[i].y); ctx.lineTo(players[j].x, players[j].y); ctx.stroke();
        }
      }
    }

    // ---- pulses ----
    const alive: Pulse[] = [];
    for (const p of pulsesRef.current) {
      const age = now - p.start;
      if (age < 0) { alive.push(p); continue; }
      const frac = age / p.dur;
      if (frac >= 1) continue;
      const x = p.fromX + (p.toX - p.fromX) * frac;
      const y = p.fromY + (p.toY - p.fromY) * frac;
      ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fillStyle = p.color; ctx.fill();
      alive.push(p);
    }
    pulsesRef.current = alive;

    // ---- server node (CS only) ----
    if (t === 'cs') {
      ctx.beginPath(); ctx.arc(server.x, server.y, 22, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.server; ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = '700 11px Inter, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('SERVER', server.x, server.y + 4);
    }

    // ---- player nodes ----
    players.forEach((p, i) => {
      ctx.beginPath(); ctx.arc(p.x, p.y, 18, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.client; ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = lastActor === i ? COLORS.pulse : '#fff'; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = '700 13px Inter, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(`P${i + 1}`, p.x, p.y + 4);
    });
    ctx.textAlign = 'left';

    rafRef.current = requestAnimationFrame(draw);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 520);
      const h = Math.round(w * 0.78);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w, h };
      layout();
    };
    resize();
    window.addEventListener('resize', resize);
    rafRef.current = requestAnimationFrame(draw);
    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const onClick = (e: MouseEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const { players } = nodesRef.current;
    let best = -1; let bd = 26;
    players.forEach((p, i) => {
      const d = Math.hypot(p.x - px, p.y - py);
      if (d < bd) { bd = d; best = i; }
    });
    if (best >= 0) act(best);
  };

  const links = topo === 'cs' ? N : (N * (N - 1)) / 2;
  const hops = topo === 'cs' ? 2 : 1;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap gap-2">
        <button
          onClick={() => setTopo('cs')}
          class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${topo === 'cs' ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'}`}
        >Client-Server</button>
        <button
          onClick={() => setTopo('p2p')}
          class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${topo === 'p2p' ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'}`}
        >Peer-to-Peer</button>
        <button
          onClick={() => act(Math.floor(Math.random() * N))}
          class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted transition hover:text-text"
        >Random player acts</button>
      </div>

      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" onClick={onClick} />

        <div class="space-y-3 text-sm">
          <p class="text-muted">Click any player to send an update. Watch where the messages go.</p>
          <div class="grid grid-cols-2 gap-2">
            <Readout label="topology" value={topo === 'cs' ? 'Client-Server' : 'Peer-to-Peer'} />
            <Readout label="links" value={`${links}`} />
            <Readout label="hops to peers" value={`${hops}`} />
            <Readout label="authority" value={topo === 'cs' ? 'Server' : 'Shared'} />
          </div>
          <div class="rounded-lg bg-surface-2 p-3 text-xs text-muted">
            {topo === 'cs'
              ? 'One trusted hub validates everything, then relays it. Two hops, but cheating is easy to reject.'
              : 'Everyone talks to everyone — fewer hops, but no referee, so any peer could lie.'}
          </div>
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
