import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Union-Find (disjoint-set forest), step by step.
   - Edit a list of union ops ("0-1, 2-3, ..."); element count is
     inferred from the largest index. Press Load.
   - Each step processes one union: find both roots, then attach the
     smaller-rank tree under the larger. If the roots already match,
     the edge would close a cycle and is skipped (flashes rose).
   - Nodes are coloured by their current set; parent pointers point
     child -> root. Live component count + caption.
   - Transport: Play / Pause / Step / Back / Reset + speed.
   ------------------------------------------------------------------ */

const SKY = '#0ea5e9';
const EMERALD = '#10b981';
const ROSE = '#f43f5e';
const ROOT_COLORS = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6', '#ef4444'];

type Op = [number, number];

type Frame = {
  parent: number[];
  count: number;
  op: Op | null;
  a: number | null;
  b: number | null;
  ra: number | null;
  rb: number | null;
  newRoot: number | null;
  cycle: boolean;
  caption: string;
};

export default function GphUnionFind() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 420, h: 320 });
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);

  const [text, setText] = useState('0-1, 2-3, 0-2, 4-5');
  const [ops, setOps] = useState<Op[]>(() => parseOps('0-1, 2-3, 0-2, 4-5'));
  const [idx, setIdx] = useState(0); // 0..ops.length (frame index)
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  idxRef.current = idx;

  const n = Math.max(1, opsCount(ops));
  const frames = computeFrames(ops, n);
  const fr = frames[Math.min(idx, frames.length - 1)];
  const parent = fr.parent;

  const findRoot = (x: number): number => { let r = x; while (parent[r] !== r) r = parent[r]; return r; };
  const depthOf = (x: number): number => { let d = 0, r = x; while (parent[r] !== r) { r = parent[r]; d++; } return d; };

  // assign one colour per distinct root, in first-seen order
  const rootColor = new Map<number, string>();
  for (let i = 0; i < n; i++) {
    const r = findRoot(i);
    if (!rootColor.has(r)) rootColor.set(r, ROOT_COLORS[rootColor.size % ROOT_COLORS.length]);
  }

  // forest layout: x by element index, y by depth (roots near top)
  const pos = (() => {
    const { w, h } = sizeRef.current;
    const m = new Map<number, { x: number; y: number }>();
    const gap = w / (n + 1);
    const top = 44;
    const level = Math.min(70, (h - top - 30) / Math.max(1, maxDepth(parent)));
    for (let i = 0; i < n; i++) m.set(i, { x: gap * (i + 1), y: top + depthOf(i) * level });
    return m;
  })();

  // groups: members keyed by root
  const groups = (() => {
    const g = new Map<number, number[]>();
    for (let i = 0; i < n; i++) { const r = findRoot(i); (g.get(r) ?? g.set(r, []).get(r)!).push(i); }
    return [...g.entries()].sort((a, b) => a[0] - b[0]);
  })();

  const commit = () => {
    const p = parseOps(text);
    if (p.length) { setOps(p); setIdx(0); setPlaying(false); lastRef.current = 0; }
  };

  const draw = () => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);

    // parent-pointer edges (child -> root)
    for (let i = 0; i < n; i++) {
      if (parent[i] === i) continue;
      const a = pos.get(i)!, b = pos.get(parent[i])!;
      const fresh = !fr.cycle && fr.newRoot != null && parent[i] === fr.newRoot && (i === fr.ra || i === fr.rb);
      ctx.strokeStyle = fresh ? EMERALD : '#94a3b8';
      ctx.lineWidth = fresh ? 3.5 : 2;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      drawArrow(ctx, a, b, fresh ? EMERALD : '#94a3b8');
    }

    // cycle hint: dashed rose line between the two elements that would join
    if (fr.cycle && fr.a != null && fr.b != null) {
      const a = pos.get(fr.a)!, b = pos.get(fr.b)!;
      ctx.save();
      ctx.setLineDash([6, 5]); ctx.strokeStyle = ROSE; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.restore();
    }

    // nodes
    for (let i = 0; i < n; i++) {
      const p = pos.get(i)!;
      const touched = i === fr.a || i === fr.b;
      ctx.beginPath(); ctx.arc(p.x, p.y, 16, 0, Math.PI * 2);
      ctx.fillStyle = rootColor.get(findRoot(i))!;
      ctx.fill();
      ctx.lineWidth = touched ? 4 : 2;
      ctx.strokeStyle = touched ? (fr.cycle ? ROSE : SKY) : '#fff';
      ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 13px ui-sans-serif, system-ui';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(i), p.x, p.y);
    }
  };

  function drawArrow(ctx: CanvasRenderingContext2D, a: { x: number; y: number }, b: { x: number; y: number }, color: string) {
    const ang = Math.atan2(b.y - a.y, b.x - a.x);
    const tx = b.x - 16 * Math.cos(ang), ty = b.y - 16 * Math.sin(ang);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(tx - 9 * Math.cos(ang - 0.4), ty - 9 * Math.sin(ang - 0.4));
    ctx.lineTo(tx - 9 * Math.cos(ang + 0.4), ty - 9 * Math.sin(ang + 0.4));
    ctx.closePath(); ctx.fill();
  }

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const resize = () => {
      const parentEl = canvas.parentElement!;
      const w = Math.min(parentEl.clientWidth, 460);
      const h = 320;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr; canvas.height = h * dpr;
      canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d'); if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w, h };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => { window.removeEventListener('resize', resize); if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(draw, [idx, ops]);

  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 950 / speed;
    const tick = (t: number) => {
      if (!lastRef.current) lastRef.current = t;
      if (t - lastRef.current >= interval) {
        lastRef.current = t;
        const next = idxRef.current + 1;
        if (next > ops.length) { setPlaying(false); return; }
        setIdx(next);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
  }, [playing, speed, ops]);

  const reset = () => { setPlaying(false); setIdx(0); lastRef.current = 0; };
  const stepF = () => { setPlaying(false); setIdx((v) => Math.min(ops.length, v + 1)); };
  const stepB = () => { setPlaying(false); setIdx((v) => Math.max(0, v - 1)); };
  const play = () => { if (idx >= ops.length) setIdx(0); lastRef.current = 0; setPlaying((p) => !p); };

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <input value={text} onInput={(e) => setText((e.target as HTMLInputElement).value)} class="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm" placeholder="0-1, 2-3, 0-2, ..." />
        <button onClick={commit} class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Load</button>
        <span class="text-xs text-muted">{n} elements</span>
      </div>

      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />
        <div class="space-y-3 text-sm">
          <div>
            <div class="mb-1 flex items-center justify-between">
              <span class="text-xs font-semibold uppercase tracking-wide text-muted">Disjoint sets</span>
              <span class="rounded-md bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand">{fr.count} component{fr.count === 1 ? '' : 's'}</span>
            </div>
            <div class="space-y-0.5 rounded-lg bg-surface-2 p-2 font-mono text-xs">
              {groups.map(([root, members]) => (
                <div key={root}>
                  <span class="font-bold" style={`color:${rootColor.get(root)}`}>root {root}</span>
                  <span class="text-muted">: </span>
                  <span class="text-text">{`{ ${members.join(', ')} }`}</span>
                </div>
              ))}
            </div>
          </div>
          <div class="rounded-lg bg-surface-2 p-3 text-xs text-muted">
            Each circle is an element; an arrow points from a child to its parent, up to the set&apos;s
            root. Same colour means same set. A union that finds equal roots is a cycle and is skipped.
          </div>
        </div>
      </div>

      <p class="mt-3 min-h-[2.5rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">{fr.caption}</p>
      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={stepB} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏮ Back</button>
        <button onClick={play} class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90">{playing ? '⏸ Pause' : '▶ Play'}</button>
        <button onClick={stepF} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏭ Step</button>
        <button onClick={reset} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">↺ Reset</button>
        <label class="ml-auto flex items-center gap-2 text-xs text-muted">speed
          <input type="range" min={0.5} max={3} step={0.5} value={speed} onInput={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))} class="w-24 accent-[#4f46e5]" />
        </label>
      </div>
      <p class="mt-2 text-center text-xs text-muted">Step {idx} / {ops.length} unions processed.</p>
    </div>
  );
}

/* ---- helpers (inside the island) ---- */

function parseOps(s: string): Op[] {
  return s.split(',').map((p) => p.trim()).filter(Boolean).map((p) => {
    const [u, v] = p.split('-').map((x) => parseInt(x.trim(), 10));
    return [u, v] as Op;
  }).filter(([u, v]) => Number.isInteger(u) && Number.isInteger(v) && u >= 0 && v >= 0 && u !== v);
}

function opsCount(ops: Op[]): number {
  let max = -1;
  for (const [u, v] of ops) { if (u > max) max = u; if (v > max) max = v; }
  return Math.min(8, max + 1);
}

function maxDepth(parent: number[]): number {
  let md = 0;
  for (let i = 0; i < parent.length; i++) {
    let d = 0, r = i;
    while (parent[r] !== r) { r = parent[r]; d++; }
    if (d > md) md = d;
  }
  return md;
}

function computeFrames(ops: Op[], n: number): Frame[] {
  const parent = Array.from({ length: n }, (_, i) => i);
  const rank = Array(n).fill(0);
  let count = n;
  const find = (x: number): number => {
    if (parent[x] !== x) parent[x] = find(parent[x]); // path compression
    return parent[x];
  };

  const frames: Frame[] = [];
  frames.push({
    parent: parent.slice(), count, op: null, a: null, b: null, ra: null, rb: null, newRoot: null, cycle: false,
    caption: `${n} singleton sets — every element is its own root. Press Play to process the unions.`,
  });

  for (const [a, b] of ops) {
    if (a >= n || b >= n) continue;
    const ra = find(a), rb = find(b);
    if (ra === rb) {
      frames.push({
        parent: parent.slice(), count, op: [a, b], a, b, ra, rb, newRoot: null, cycle: true,
        caption: `union(${a}, ${b}): both already have root ${ra} → this edge would form a cycle, so it is skipped. Components: ${count}.`,
      });
      continue;
    }
    let newRoot: number;
    if (rank[ra] < rank[rb]) { parent[ra] = rb; newRoot = rb; }
    else if (rank[ra] > rank[rb]) { parent[rb] = ra; newRoot = ra; }
    else { parent[rb] = ra; rank[ra]++; newRoot = ra; }
    count--;
    frames.push({
      parent: parent.slice(), count, op: [a, b], a, b, ra, rb, newRoot, cycle: false,
      caption: `union(${a}, ${b}): roots ${ra} and ${rb} differ → attach the smaller-rank tree under root ${newRoot}. Components: ${count}.`,
    });
  }
  return frames;
}
