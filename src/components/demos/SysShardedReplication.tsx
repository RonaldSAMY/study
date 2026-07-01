import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated sharding + replication.
   - A write for a key is hashed to a shard, lands on that shard's
     PRIMARY, then flows to the FOLLOWERS (with replication lag).
   - Toggle sync vs async to change when the client's write is
     acknowledged.
   - Step through: route -> write primary -> replicate f1 -> replicate f2 -> ack.
   Canvas conventions: devicePixelRatio scaling, resize handler,
   touch-none, redraw via useEffect. rAF autoplay cancelled on
   pause / unmount. Helpers live inside the island.
   ------------------------------------------------------------------ */

const SHARDS = 3;
const FOLLOWERS = 2;
const COLORS = { primary: '#4f46e5', follower: '#0ea5e9', done: '#10b981', dim: 'rgba(128,128,128,0.28)' };

function hashInt(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export default function SysShardedReplication() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 560, h: 300 });
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);

  const [text, setText] = useState('user:42');
  const [key, setKey] = useState('user:42');
  const [sync, setSync] = useState(false);
  const [idx, setIdx] = useState(0); // 0..STEPS
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  const STEPS = 2 + FOLLOWERS + 1; // route, primary, each follower, ack
  const shard = hashInt(key) % SHARDS;
  idxRef.current = idx;
  const shardRef = useRef(shard);
  shardRef.current = shard;
  const syncRef = useRef(sync);
  syncRef.current = sync;

  const commit = () => { const k = text.trim(); if (k) { setKey(k); setIdx(0); setPlaying(false); } };

  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 950 / speed;
    const tick = (t: number) => {
      if (!lastRef.current) lastRef.current = t;
      if (t - lastRef.current >= interval) {
        lastRef.current = t;
        const next = idxRef.current + 1;
        if (next >= STEPS + 1) { setIdx(STEPS); setPlaying(false); return; }
        setIdx(next);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
  }, [playing, speed, key]);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w } = sizeRef.current;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const i = idxRef.current;
    const s = shardRef.current;
    const colW = w / SHARDS;
    const boxW = Math.min(120, colW - 20);
    const boxH = 44;
    const topY = 56;
    const gapY = 30;

    // header
    ctx.fillStyle = 'rgba(128,128,128,0.85)';
    ctx.font = '12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(i >= 1 ? `write "${key}"  →  shard ${s} (of ${SHARDS})` : `write "${key}"  →  hash → pick a shard`, w / 2, 20);

    for (let sh = 0; sh < SHARDS; sh++) {
      const cx = colW * sh + colW / 2;
      const activeShard = i >= 1 && sh === s;
      // shard label
      ctx.fillStyle = activeShard ? COLORS.primary : 'rgba(128,128,128,0.6)';
      ctx.font = `${activeShard ? 'bold ' : ''}11px system-ui, sans-serif`;
      ctx.fillText(`shard ${sh}`, cx, topY - 16);

      const rows = 1 + FOLLOWERS;
      for (let row = 0; row < rows; row++) {
        const y = topY + row * (boxH + gapY);
        const isPrimary = row === 0;
        const boxX = cx - boxW / 2;
        // arrows primary -> follower on active shard
        if (activeShard && !isPrimary) {
          const reached = i >= 2 + row; // follower row-1 replicated at step 2+row
          ctx.beginPath();
          ctx.moveTo(cx, topY + boxH);
          ctx.lineTo(cx, y);
          ctx.strokeStyle = reached ? COLORS.done : COLORS.dim;
          ctx.lineWidth = reached ? 3 : 1.5;
          ctx.setLineDash(reached ? [] : [4, 4]);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        // box
        let fill = COLORS.dim;
        let filled = false;
        if (activeShard) {
          if (isPrimary && i >= 2) { fill = i >= STEPS ? COLORS.done : COLORS.primary; filled = true; }
          if (!isPrimary && i >= 2 + row) { fill = i >= STEPS ? COLORS.done : COLORS.follower; filled = true; }
        }
        ctx.fillStyle = filled ? fill : 'rgba(128,128,128,0.10)';
        roundRect(ctx, boxX, y, boxW, boxH, 8);
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = activeShard ? (filled ? fill : COLORS.dim) : COLORS.dim;
        roundRect(ctx, boxX, y, boxW, boxH, 8);
        ctx.stroke();
        // label
        ctx.fillStyle = filled ? '#fff' : 'rgba(128,128,128,0.75)';
        ctx.font = 'bold 11px system-ui, sans-serif';
        ctx.fillText(isPrimary ? 'PRIMARY' : `follower ${row}`, cx, y + boxH / 2 - 6);
        ctx.font = '10px ui-monospace, monospace';
        ctx.fillStyle = filled ? 'rgba(255,255,255,0.9)' : 'rgba(128,128,128,0.5)';
        ctx.fillText(filled ? key : '—', cx, y + boxH / 2 + 8);
      }
    }
  };

  function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 600);
      const h = 300;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w, h };
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

  useEffect(draw, [idx, key, sync]);

  const reset = () => { setPlaying(false); setIdx(0); lastRef.current = 0; };
  const stepF = () => { setPlaying(false); setIdx((v) => Math.min(STEPS, v + 1)); };
  const stepB = () => { setPlaying(false); setIdx((v) => Math.max(0, v - 1)); };
  const play = () => { if (idx >= STEPS) setIdx(0); lastRef.current = 0; setPlaying((p) => !p); };

  const captions = [
    'Press Play. The key will be hashed to choose a shard.',
    `hash("${key}") mod ${SHARDS} = shard ${shard}. All of this key's data lives on shard ${shard}.`,
    sync ? `Write applied to shard ${shard}'s PRIMARY. In sync mode the client is NOT acked yet — it waits.` : `Write applied to shard ${shard}'s PRIMARY. In async mode the client is acked NOW; replicas catch up.`,
    `Replicating to follower 1… replication lag means it is briefly behind the primary.`,
    `Replicating to follower 2… a read hitting a follower right now could still be stale.`,
    sync ? `All followers acked → client's write returns. Strong consistency, higher latency.` : `All followers caught up. Reads from any replica are now consistent.`,
  ];
  const caption = captions[Math.min(idx, captions.length - 1)];
  const done = idx >= STEPS;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <input value={text} onInput={(e) => setText((e.target as HTMLInputElement).value)} class="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm" placeholder="a key to write, e.g. user:42" />
        <button onClick={commit} class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Route</button>
        <label class="flex items-center gap-2 text-xs text-muted">
          <input type="checkbox" checked={sync} onInput={(e) => { setSync((e.target as HTMLInputElement).checked); }} class="h-4 w-4 accent-[#4f46e5]" />
          sync replication
        </label>
      </div>

      <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

      <p class="mt-3 min-h-[2.5rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">{caption}</p>
      {done && (
        <p class="mt-2 rounded-lg bg-brand-soft px-3 py-2 text-sm font-semibold text-text">
          {sync ? 'Sync: safe but slow — the write waits for every replica.' : 'Async: fast but replicas lag — reads can be briefly stale.'} Sharding splits data across machines; replication copies each shard for durability and read scaling.
        </p>
      )}

      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={stepB} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏮ Back</button>
        <button onClick={play} class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90">{playing ? '⏸ Pause' : '▶ Play'}</button>
        <button onClick={stepF} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏭ Step</button>
        <button onClick={reset} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">↺ Reset</button>
        <label class="ml-auto flex items-center gap-2 text-xs text-muted">speed
          <input type="range" min={0.5} max={3} step={0.5} value={speed} onInput={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))} class="w-24 accent-[#4f46e5]" />
        </label>
      </div>
      <p class="mt-2 text-center text-xs text-muted">Tip: change the key and watch which shard it lands on — the hash decides, and it never changes for a given key.</p>
    </div>
  );
}
