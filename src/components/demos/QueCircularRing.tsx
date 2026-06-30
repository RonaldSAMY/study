import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated circular queue (ring buffer) drawn on canvas.
   - A fixed array of `capacity` slots is laid out as a RING. The learner
     edits a script of operations (+x enqueues, - dequeues) and a capacity.
   - front  points at the slot that will leave next.
     rear   points at the slot the NEXT enqueue will write into.
     Both pointers WRAP around modulo capacity — that is the whole idea.
   - Frames are precomputed (index-driven); transport controls move a
     cursor over them. Autoplay uses requestAnimationFrame, cancelled on
     pause / unmount.
   ------------------------------------------------------------------ */

const COLORS = { front: '#0ea5e9', rear: '#10b981', fill: '#4f46e5', grid: 'rgba(128,128,128,0.25)' };

type Frame = {
  slots: (string | null)[];
  front: number;
  rear: number; // next write position
  count: number;
  changed: number | null;
  caption: string;
};

function parseOps(text: string): { kind: 'enq' | 'deq'; val?: string }[] {
  return text
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
    .map((t) => {
      if (t === '-' || t.toLowerCase() === 'd') return { kind: 'deq' as const };
      const val = t.startsWith('+') ? t.slice(1).trim() : t;
      return { kind: 'enq' as const, val };
    });
}

function buildFrames(text: string, cap: number): Frame[] {
  const ops = parseOps(text);
  const slots: (string | null)[] = new Array(cap).fill(null);
  let front = 0;
  let rear = 0;
  let count = 0;
  const snap = (changed: number | null, caption: string): Frame => ({
    slots: [...slots],
    front,
    rear,
    count,
    changed,
    caption,
  });
  const frames: Frame[] = [snap(null, `An empty ring of ${cap} slots. front and rear both point at index 0. Press Play.`)];
  for (const op of ops) {
    if (op.kind === 'enq') {
      if (count === cap) {
        frames.push(snap(null, `enqueue(${op.val}) FAILS — the ring is full (count = capacity = ${cap}). No overwrite.`));
      } else {
        const at = rear;
        slots[rear] = op.val ?? '?';
        rear = (rear + 1) % cap;
        count++;
        frames.push(snap(at, `enqueue(${op.val}) writes into slot ${at}, then rear wraps to ${rear}. size = ${count}.`));
      }
    } else {
      if (count === 0) {
        frames.push(snap(null, 'dequeue() on an empty ring returns undefined.'));
      } else {
        const at = front;
        const v = slots[front];
        slots[front] = null;
        front = (front + 1) % cap;
        count--;
        frames.push(snap(at, `dequeue() returns ${v} from slot ${at}, then front wraps to ${front}. size = ${count}.`));
      }
    }
  }
  return frames;
}

export default function QueCircularRing() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 360, h: 360 });
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);

  const [text, setText] = useState('+A, +B, +C, -, -, +D, +E, +F');
  const [cap, setCap] = useState(6);
  const [frames, setFrames] = useState<Frame[]>(() => buildFrames('+A, +B, +C, -, -, +D, +E, +F', 6));
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  idxRef.current = idx;

  const frameRef = useRef<Frame>(frames[0]);
  frameRef.current = frames[idx];

  const commit = () => { setFrames(buildFrames(text, cap)); setIdx(0); setPlaying(false); };

  // rebuild when capacity changes
  useEffect(() => { setFrames(buildFrames(text, cap)); setIdx(0); setPlaying(false); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [cap]);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);
    const f = frameRef.current;
    const n = f.slots.length;
    const cx = w / 2;
    const cy = h / 2;
    const R = Math.min(w, h) * 0.34;
    const slotR = Math.min(34, (R * Math.PI) / n - 4);

    const pos = (i: number) => {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      return { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a), a };
    };

    // slots
    for (let i = 0; i < n; i++) {
      const { x, y } = pos(i);
      const occupied = f.slots[i] != null;
      const isChanged = i === f.changed;
      ctx.beginPath();
      ctx.arc(x, y, slotR, 0, Math.PI * 2);
      ctx.fillStyle = occupied ? COLORS.fill : 'rgba(128,128,128,0.07)';
      ctx.fill();
      ctx.lineWidth = isChanged ? 4 : 2;
      ctx.strokeStyle = isChanged ? (occupied ? COLORS.rear : COLORS.front) : COLORS.grid;
      ctx.stroke();
      // value
      ctx.fillStyle = occupied ? '#fff' : 'rgba(128,128,128,0.6)';
      ctx.font = `bold ${Math.round(slotR * 0.8)}px ui-monospace, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(occupied ? String(f.slots[i]) : '·', x, y + 1);
      // index label outside
      const lx = cx + (R + slotR + 12) * Math.cos(pos(i).a);
      const ly = cy + (R + slotR + 12) * Math.sin(pos(i).a);
      ctx.fillStyle = 'rgba(128,128,128,0.8)';
      ctx.font = `${Math.round(slotR * 0.5)}px ui-monospace, monospace`;
      ctx.fillText(String(i), lx, ly);
    }

    // pointer arrow from center toward a slot
    const arrow = (i: number, color: string, label: string, inset: number) => {
      const { x, y } = pos(i);
      const dx = x - cx;
      const dy = y - cy;
      const len = Math.hypot(dx, dy);
      const ux = dx / len;
      const uy = dy / len;
      const tipR = len - slotR - 4;
      const tx = cx + ux * tipR;
      const ty = cy + uy * tipR;
      const sx = cx + ux * inset;
      const sy = cy + uy * inset;
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      // arrow head
      const ah = 8;
      const ang = Math.atan2(uy, ux);
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(tx - ah * Math.cos(ang - 0.4), ty - ah * Math.sin(ang - 0.4));
      ctx.lineTo(tx - ah * Math.cos(ang + 0.4), ty - ah * Math.sin(ang + 0.4));
      ctx.closePath();
      ctx.fill();
      // label near tip
      ctx.font = 'bold 12px ui-sans-serif, system-ui';
      ctx.fillText(label, cx + ux * (tipR * 0.55), cy + uy * (tipR * 0.55) - 2);
    };
    // draw rear first, then front (so they read clearly if equal)
    arrow(f.rear % n, COLORS.rear, 'rear', 14);
    arrow(f.front % n, COLORS.front, 'front', 26);

    // center label
    ctx.fillStyle = 'rgba(128,128,128,0.9)';
    ctx.font = 'bold 13px ui-monospace, monospace';
    ctx.fillText(`size ${f.count}/${n}`, cx, cy);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 420);
      const h = w;
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

  useEffect(draw, [frames, idx]);

  useEffect(() => {
    if (!playing) {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      return;
    }
    const interval = 950 / speed;
    const tick = (t: number) => {
      if (!lastRef.current) lastRef.current = t;
      if (t - lastRef.current >= interval) {
        lastRef.current = t;
        const next = idxRef.current + 1;
        if (next >= frames.length) { setIdx(frames.length - 1); setPlaying(false); return; }
        setIdx(next);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
  }, [playing, speed, frames]);

  const reset = () => { setPlaying(false); setIdx(0); lastRef.current = 0; };
  const stepF = () => { setPlaying(false); setIdx((v) => Math.min(frames.length - 1, v + 1)); };
  const stepB = () => { setPlaying(false); setIdx((v) => Math.max(0, v - 1)); };
  const play = () => { if (idx >= frames.length - 1) setIdx(0); lastRef.current = 0; setPlaying((p) => !p); };

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <input
          value={text}
          onInput={(e) => setText((e.target as HTMLInputElement).value)}
          class="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm"
          placeholder="+A, +B, -, +C   (+x enqueues, - dequeues)"
        />
        <label class="flex items-center gap-1 text-xs text-muted">cap
          <input type="number" min={3} max={9} value={cap} onInput={(e) => setCap(Math.max(3, Math.min(9, parseInt((e.target as HTMLInputElement).value, 10) || 6)))} class="w-14 rounded-lg border border-border bg-surface-2 px-2 py-1 font-mono text-sm" />
        </label>
        <button onClick={commit} class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Load</button>
      </div>

      <div class="grid gap-3 md:grid-cols-[auto,1fr] md:items-center">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />
        <div class="space-y-3">
          <p class="min-h-[3rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">{frames[idx].caption}</p>
          <div class="flex flex-wrap items-center gap-2">
            <button onClick={stepB} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏮ Back</button>
            <button onClick={play} class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90">{playing ? '⏸ Pause' : '▶ Play'}</button>
            <button onClick={stepF} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏭ Step</button>
            <button onClick={reset} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">↺ Reset</button>
          </div>
          <div class="flex items-center gap-3">
            <span class="font-mono text-xs text-muted">step {idx}/{frames.length - 1}</span>
            <label class="ml-auto flex items-center gap-2 text-xs text-muted">speed
              <input type="range" min={0.5} max={3} step={0.5} value={speed} onInput={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))} class="w-24 accent-[#4f46e5]" />
            </label>
          </div>
          <p class="text-xs text-muted">Fill the ring, dequeue a couple, then keep enqueuing — watch <span style={`color:${COLORS.rear}`}>rear</span> wrap past the end back to slot 0 and reuse the freed space.</p>
        </div>
      </div>
    </div>
  );
}
