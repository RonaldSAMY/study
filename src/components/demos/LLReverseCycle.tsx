import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated linked-list operations: in-place REVERSAL and Floyd's
   fast/slow CYCLE DETECTION.
   - Reverse mode: watch prev / curr / next and each next-pointer flip
     one step at a time until the chain points the other way.
   - Cycle mode: a slow marker (1 step) and a fast marker (2 steps)
     race; if there is a loop they eventually land on the same node.
     Set "loops to" to choose where the tail links back (-1 = no loop).
   - Transport: Play / Pause / Step / Step-back / Reset + speed.
   ------------------------------------------------------------------ */

type Mode = 'reverse' | 'cycle';

type RFrame = { processed: number; prev: number; curr: number; caption: string };
type CFrame = { slow: number; fast: number; meet: boolean; off: boolean; caption: string };

const COLORS = { node: '#4f46e5', prev: '#10b981', curr: '#0ea5e9', slow: '#0ea5e9', fast: '#4f46e5', meet: '#10b981' };

const parseList = (s: string): number[] =>
  s.split(',').map((x) => parseInt(x.trim(), 10)).filter((x) => Number.isFinite(x)).slice(0, 7);

function reverseFrames(v: number[]): RFrame[] {
  const out: RFrame[] = [{ processed: 0, prev: -1, curr: 0, caption: 'prev = null, curr = head. We will flip each next pointer to point backward.' }];
  for (let i = 0; i < v.length; i++) {
    const back = i > 0 ? `node ${v[i - 1]}` : 'null';
    const ahead = i + 1 < v.length ? `node ${v[i + 1]}` : 'null';
    out.push({ processed: i + 1, prev: i, curr: i + 1, caption: `next = curr.next; curr.next = prev — node ${v[i]} now points back to ${back}. Then prev = ${v[i]}, curr = ${ahead}.` });
  }
  out.push({ processed: v.length, prev: v.length - 1, curr: v.length, caption: `curr is null. prev = node ${v[v.length - 1] ?? '?'} is the new head. Reversed in O(n) time, O(1) space.` });
  return out;
}

function cycleFrames(v: number[], loopTo: number): CFrame[] {
  const n = v.length;
  const nextOf = (i: number): number => (i < n - 1 ? i + 1 : loopTo >= 0 && loopTo < n ? loopTo : -1);
  const out: CFrame[] = [{ slow: 0, fast: 0, meet: false, off: false, caption: 'Both markers start at the head.' }];
  let slow = 0, fast = 0;
  for (let step = 0; step < 2 * n + 4; step++) {
    const f1 = nextOf(fast);
    const f2 = f1 < 0 ? -1 : nextOf(f1);
    if (f1 < 0 || f2 < 0) { out.push({ slow, fast: -1, meet: false, off: true, caption: 'fast walked off the end (reached null) — there is no cycle.' }); break; }
    fast = f2;
    slow = nextOf(slow);
    if (slow === fast) { out.push({ slow, fast, meet: true, off: false, caption: `slow and fast collided at node ${v[slow]} — a cycle exists. (Move slow back to head, then step both 1-by-1 to find where the loop starts.)` }); break; }
    out.push({ slow, fast, meet: false, off: false, caption: `slow -> node ${v[slow]} (1 step), fast -> node ${v[fast]} (2 steps).` });
  }
  return out;
}

export default function LLReverseCycle() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 600, h: 200 });
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);

  const [mode, setMode] = useState<Mode>('reverse');
  const [text, setText] = useState('1, 2, 3, 4, 5');
  const [values, setValues] = useState<number[]>(() => parseList('1, 2, 3, 4, 5'));
  const [loopTo, setLoopTo] = useState(2);
  const [frames, setFrames] = useState<(RFrame | CFrame)[]>(() => reverseFrames(parseList('1, 2, 3, 4, 5')));
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  idxRef.current = idx;

  const rebuild = (vals: number[], m: Mode, lt: number) => {
    setFrames(m === 'reverse' ? reverseFrames(vals) : cycleFrames(vals, lt));
    setIdx(0); setPlaying(false); lastRef.current = 0;
  };

  const commit = () => { const v = parseList(text); setValues(v); rebuild(v, mode, loopTo); };
  const chooseMode = (m: Mode) => { setMode(m); rebuild(values, m, loopTo); };
  const setLoop = (lt: number) => { setLoopTo(lt); rebuild(values, mode, lt); };

  const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);
    const f = frames[Math.min(idx, frames.length - 1)];
    if (!f) return;
    const v = values;
    const n = v.length;

    const baseW = 54, baseH = 42, baseGap = 34;
    const contentW = n * baseW + (n + 1) * baseGap; // room for null markers on both sides
    const s = Math.min(1, (w - 16) / contentW);
    const nodeW = baseW * s, nodeH = baseH * s, gap = baseGap * s;
    const total = n * nodeW + (n - 1) * gap;
    const startX = (w - total) / 2;
    const rowY = 100;
    const cx = (i: number) => startX + i * (nodeW + gap) + nodeW / 2;

    const arrow = (x1: number, y1: number, x2: number, y2: number, color: string, lw = 2) => {
      ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = lw;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      const a = Math.atan2(y2 - y1, x2 - x1);
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - 7 * Math.cos(a - 0.4), y2 - 7 * Math.sin(a - 0.4));
      ctx.lineTo(x2 - 7 * Math.cos(a + 0.4), y2 - 7 * Math.sin(a + 0.4));
      ctx.closePath(); ctx.fill();
    };

    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

    if (mode === 'reverse') {
      const rf = f as RFrame;
      // null markers
      ctx.fillStyle = '#94a3b8'; ctx.font = `${Math.round(15 * s)}px ui-monospace, monospace`;
      ctx.fillText('∅', startX - gap / 2, rowY);
      ctx.fillText('∅', startX + total + gap / 2, rowY);
      // arrows
      for (let i = 0; i < n; i++) {
        if (i < rf.processed) {
          // points backward to i-1 (or left null)
          const x1 = cx(i) - nodeW / 2;
          const x2 = i > 0 ? cx(i - 1) + nodeW / 2 : startX - gap / 2 + 6;
          arrow(x1, rowY, x2 + 2, rowY, COLORS.prev);
        } else {
          // forward to i+1 (or right null)
          const x1 = cx(i) + nodeW / 2;
          const x2 = i < n - 1 ? cx(i + 1) - nodeW / 2 : startX + total + gap / 2 - 6;
          arrow(x1, rowY, x2 - 2, rowY, 'rgba(148,163,184,0.9)');
        }
      }
      // nodes
      for (let i = 0; i < n; i++) {
        const x = cx(i) - nodeW / 2;
        ctx.fillStyle = i < rf.processed ? COLORS.prev : COLORS.node;
        roundRect(ctx, x, rowY - nodeH / 2, nodeW, nodeH, 8 * s); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = `bold ${Math.round(16 * s)}px ui-monospace, monospace`;
        ctx.fillText(String(v[i]), cx(i), rowY);
      }
      // pointer labels
      ctx.font = `bold ${Math.round(12 * s)}px ui-sans-serif, system-ui`;
      const labelPtr = (label: string, i: number, color: string, lane: number) => {
        const x = i < 0 ? startX - gap / 2 : i >= n ? startX + total + gap / 2 : cx(i);
        const ly = rowY + nodeH / 2 + 6 + lane * 16;
        arrow(x, ly + 11, x, rowY + nodeH / 2 + 2, color);
        ctx.fillStyle = color; ctx.fillText(label, x, ly + 20);
      };
      labelPtr('prev', rf.prev, COLORS.prev, 0);
      labelPtr('curr', rf.curr, COLORS.curr, 1);
    } else {
      const cf = f as CFrame;
      // forward arrows
      for (let i = 0; i < n - 1; i++) {
        arrow(cx(i) + nodeW / 2, rowY, cx(i + 1) - nodeW / 2 - 2, rowY, 'rgba(148,163,184,0.9)');
      }
      // back-link (cycle)
      if (loopTo >= 0 && loopTo < n) {
        const x1 = cx(n - 1), x2 = cx(loopTo);
        const dipY = rowY + nodeH / 2 + 40;
        ctx.strokeStyle = '#f59e0b'; ctx.fillStyle = '#f59e0b'; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x1, rowY + nodeH / 2);
        ctx.bezierCurveTo(x1, dipY, x2, dipY, x2, rowY + nodeH / 2 + 2);
        ctx.stroke();
        arrow(x2, dipY - (dipY - rowY) * 0.18, x2, rowY + nodeH / 2 + 2, '#f59e0b');
      } else {
        ctx.fillStyle = '#94a3b8'; ctx.font = `${Math.round(15 * s)}px ui-monospace, monospace`;
        ctx.fillText('∅', cx(n - 1) + nodeW / 2 + gap / 2, rowY);
      }
      // nodes
      for (let i = 0; i < n; i++) {
        const x = cx(i) - nodeW / 2;
        const onSlow = cf.slow === i, onFast = cf.fast === i;
        ctx.fillStyle = cf.meet && onSlow ? COLORS.meet : onFast ? COLORS.fast : onSlow ? COLORS.slow : COLORS.node;
        roundRect(ctx, x, rowY - nodeH / 2, nodeW, nodeH, 8 * s); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = `bold ${Math.round(16 * s)}px ui-monospace, monospace`;
        ctx.fillText(String(v[i]), cx(i), rowY);
      }
      // markers above nodes
      ctx.font = `bold ${Math.round(12 * s)}px ui-sans-serif, system-ui`;
      const top = rowY - nodeH / 2;
      if (cf.slow >= 0) { const x = cx(cf.slow); arrow(x - 8, top - 24, x - 8, top - 4, COLORS.slow); ctx.fillStyle = COLORS.slow; ctx.fillText('slow', x - 8, top - 30); }
      if (cf.fast >= 0) { const x = cx(cf.fast); arrow(x + 8, top - 24, x + 8, top - 4, COLORS.fast); ctx.fillStyle = COLORS.fast; ctx.fillText('fast', x + 8, top - 30); }
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 620);
      const h = 200;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr; canvas.height = h * dpr;
      canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
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

  useEffect(draw, [frames, idx, mode, values, loopTo]);

  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
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
  const stepF = () => { setPlaying(false); setIdx((x) => Math.min(frames.length - 1, x + 1)); };
  const stepB = () => { setPlaying(false); setIdx((x) => Math.max(0, x - 1)); };
  const play = () => { if (idx >= frames.length - 1) setIdx(0); lastRef.current = 0; setPlaying((p) => !p); };

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        {(['reverse', 'cycle'] as Mode[]).map((m) => (
          <button key={m} onClick={() => chooseMode(m)} class={`rounded-lg px-3 py-1.5 text-sm font-semibold capitalize transition ${mode === m ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'}`}>{m === 'reverse' ? 'Reverse' : 'Detect cycle'}</button>
        ))}
        <input value={text} onInput={(e) => setText((e.target as HTMLInputElement).value)} class="ml-auto w-44 rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm" placeholder="values" />
        <button onClick={commit} class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Load</button>
      </div>

      {mode === 'cycle' && (
        <div class="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted">
          <span>tail loops to index</span>
          <input type="number" min={-1} max={values.length - 1} value={loopTo} onInput={(e) => setLoop(parseInt((e.target as HTMLInputElement).value, 10))} class="w-16 rounded-lg border border-border bg-surface-2 px-2 py-1 font-mono text-sm" />
          <span>(-1 = no loop, so fast falls off the end)</span>
        </div>
      )}

      <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

      <p class="mt-3 min-h-[2.5rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">{frames[Math.min(idx, frames.length - 1)]?.caption}</p>

      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={stepB} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏮ Back</button>
        <button onClick={play} class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90">{playing ? '⏸ Pause' : '▶ Play'}</button>
        <button onClick={stepF} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏭ Step</button>
        <button onClick={reset} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">↺ Reset</button>
        <span class="ml-2 text-xs text-muted">{Math.min(idx + 1, frames.length)}/{frames.length}</span>
        <label class="ml-auto flex items-center gap-2 text-xs text-muted">speed
          <input type="range" min={0.5} max={3} step={0.5} value={speed} onInput={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))} class="w-24 accent-[#4f46e5]" />
        </label>
      </div>
      <p class="mt-2 text-center text-xs text-muted">Reverse flips one next-pointer per step. In cycle mode, fast gains one node on slow each step, so inside a loop it must eventually lap and collide.</p>
    </div>
  );
}
