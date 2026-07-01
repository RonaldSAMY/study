import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated consistent-hashing ring.
   - Servers sit at fixed angles on a ring; keys are hashed to angles.
     A key belongs to the first server found walking CLOCKWISE.
   - Step through the keys: each one lights up, walks the arc to its
     server, and is labelled in the caption.
   - Toggle "add cache-4": only the keys in the new server's arc move,
     and the banner reports exactly how few remapped (~1/n).
   Canvas conventions: devicePixelRatio scaling, resize handler,
   touch-none, redraw via useEffect. requestAnimationFrame autoplay
   is cancelled on pause / unmount. Helpers live inside the island.
   ------------------------------------------------------------------ */

// Illustrative fixed placement (matches /dsa/.../consistent-hashing.ts walkthrough).
const BASE_NODES = [
  { id: 'cache-1', angle: 30, color: '#4f46e5' },
  { id: 'cache-2', angle: 150, color: '#0ea5e9' },
  { id: 'cache-3', angle: 270, color: '#10b981' },
];
const EXTRA_NODE = { id: 'cache-4', angle: 330, color: '#f59e0b' };

// FNV-1a hash -> angle in [0, 360).
function hashAngle(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) % 360;
}

type Node = { id: string; angle: number; color: string };

// First node clockwise from a key's angle (wraps around the ring).
function assign(angle: number, nodes: Node[]): Node {
  const sorted = [...nodes].sort((a, b) => a.angle - b.angle);
  for (const n of sorted) if (n.angle >= angle) return n;
  return sorted[0]; // wrap to the first node
}

export default function SysConsistentHashRing() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 420, cx: 210, cy: 210, r: 150 });
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);

  const [text, setText] = useState('user:alice, user:bob, user:carol, order:42, order:88, cart:7');
  const [keys, setKeys] = useState<string[]>(() => 'user:alice, user:bob, user:carol, order:42, order:88, cart:7'.split(',').map((s) => s.trim()).filter(Boolean));
  const [extra, setExtra] = useState(false);
  const [idx, setIdx] = useState(0); // 0..keys.length
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  idxRef.current = idx;
  const extraRef = useRef(extra);
  extraRef.current = extra;

  const nodes: Node[] = extra ? [...BASE_NODES, EXTRA_NODE] : BASE_NODES;

  const keyData = keys.map((k) => ({ key: k, angle: hashAngle(k) }));
  // remap count: assignment with vs without cache-4
  const remapped = keyData.filter((kd) => assign(kd.angle, BASE_NODES).id !== assign(kd.angle, [...BASE_NODES, EXTRA_NODE]).id);

  const commit = () => {
    const parsed = text.split(',').map((s) => s.trim()).filter(Boolean);
    if (parsed.length) { setKeys(parsed); setIdx(0); setPlaying(false); }
  };

  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 950 / speed;
    const tick = (t: number) => {
      if (!lastRef.current) lastRef.current = t;
      if (t - lastRef.current >= interval) {
        lastRef.current = t;
        const next = idxRef.current + 1;
        if (next >= keys.length + 1) { setIdx(keys.length); setPlaying(false); return; }
        setIdx(next);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
  }, [playing, speed, keys]);

  const toXY = (angle: number, radius: number) => {
    const { cx, cy } = sizeRef.current;
    const th = ((angle - 90) * Math.PI) / 180; // 0deg at top, clockwise
    return { x: cx + radius * Math.cos(th), y: cy + radius * Math.sin(th) };
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { cx, cy, r } = sizeRef.current;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const useExtra = extraRef.current;
    const nd: Node[] = useExtra ? [...BASE_NODES, EXTRA_NODE] : BASE_NODES;

    // ring
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(128,128,128,0.30)';
    ctx.lineWidth = 2;
    ctx.stroke();

    const active = idxRef.current >= 1 ? keyData[idxRef.current - 1] : null;

    // active key's arc to its node (draw first, underneath)
    if (active) {
      const node = assign(active.angle, nd);
      let sweep = node.angle - active.angle;
      if (sweep < 0) sweep += 360;
      ctx.beginPath();
      ctx.arc(cx, cy, r, ((active.angle - 90) * Math.PI) / 180, ((active.angle + sweep - 90) * Math.PI) / 180);
      ctx.strokeStyle = node.color;
      ctx.lineWidth = 6;
      ctx.globalAlpha = 0.5;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // node markers
    nd.forEach((n) => {
      const p = toXY(n.angle, r);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 11, 0, Math.PI * 2);
      ctx.fillStyle = n.color;
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#fff';
      ctx.stroke();
      const lp = toXY(n.angle, r + 26);
      ctx.fillStyle = n.color;
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(n.id, lp.x, lp.y);
    });

    // revealed keys
    keyData.slice(0, idxRef.current).forEach((kd, i) => {
      const isActive = i === idxRef.current - 1;
      const p = toXY(kd.angle, r);
      const node = assign(kd.angle, nd);
      const c = toXY(kd.angle, r - 20);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(c.x, c.y);
      ctx.strokeStyle = node.color;
      ctx.globalAlpha = isActive ? 0.9 : 0.25;
      ctx.lineWidth = isActive ? 2.5 : 1;
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, isActive ? 7 : 4.5, 0, Math.PI * 2);
      ctx.fillStyle = isActive ? '#fff' : node.color;
      ctx.fill();
      if (isActive) { ctx.lineWidth = 2.5; ctx.strokeStyle = node.color; ctx.stroke(); }
    });

    // center label
    ctx.fillStyle = 'rgba(128,128,128,0.7)';
    ctx.font = '10px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('hash ring', cx, cy);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 420);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = w * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${w}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w, cx: w / 2, cy: w / 2, r: w / 2 - 42 };
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

  useEffect(draw, [idx, keys, extra]);

  const reset = () => { setPlaying(false); setIdx(0); lastRef.current = 0; };
  const stepF = () => { setPlaying(false); setIdx((v) => Math.min(keys.length, v + 1)); };
  const stepB = () => { setPlaying(false); setIdx((v) => Math.max(0, v - 1)); };
  const play = () => { if (idx >= keys.length) setIdx(0); lastRef.current = 0; setPlaying((p) => !p); };

  const active = idx >= 1 ? keyData[idx - 1] : null;
  const activeNode = active ? assign(active.angle, nodes) : null;
  const caption = active && activeNode
    ? `key "${active.key}" hashes to ${active.angle}° → walk clockwise → ${activeNode.id} at ${activeNode.angle}°`
    : 'Each key hashes to a point on the ring. Press Play to route them one by one.';

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <input value={text} onInput={(e) => setText((e.target as HTMLInputElement).value)} class="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-xs" placeholder="comma-separated keys" />
        <button onClick={commit} class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Load</button>
      </div>

      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

        <div class="space-y-3 text-sm">
          <p class="min-h-[3rem] rounded-lg bg-surface-2 px-3 py-2 font-mono text-xs text-text">{caption}</p>

          <label class="flex items-center gap-2">
            <input type="checkbox" checked={extra} onInput={(e) => { setExtra((e.target as HTMLInputElement).checked); }} class="h-4 w-4 accent-[#4f46e5]" />
            <span>Add <strong style="color:#f59e0b">cache-4</strong> at 330°</span>
          </label>

          {extra && (
            <p class="rounded-lg bg-brand-soft px-3 py-2 text-xs text-text">
              Adding cache-4 remapped <strong>{remapped.length} of {keys.length}</strong> keys — only those in the
              arc just before cache-4. Every other key stayed put. That is the ~1/n guarantee.
            </p>
          )}

          <p class="rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted">
            With plain <code>hash(key) % n</code>, changing n would move almost <strong>every</strong> key.
            On the ring, only one server's arc is affected.
          </p>
        </div>
      </div>

      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={stepB} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏮ Back</button>
        <button onClick={play} class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90">{playing ? '⏸ Pause' : '▶ Play'}</button>
        <button onClick={stepF} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏭ Step</button>
        <button onClick={reset} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">↺ Reset</button>
        <label class="ml-auto flex items-center gap-2 text-xs text-muted">speed
          <input type="range" min={0.5} max={3} step={0.5} value={speed} onInput={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))} class="w-24 accent-[#4f46e5]" />
        </label>
      </div>
      <p class="mt-2 text-center text-xs text-muted">Tip: real rings give each server 100–200 <em>virtual nodes</em> so the load spreads evenly.</p>
    </div>
  );
}
