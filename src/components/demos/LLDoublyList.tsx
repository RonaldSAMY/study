import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated doubly linked list. Every node carries BOTH a next arrow
   (top lane) and a prev arrow (bottom lane), so traversal works in
   either direction and a known node is removed in O(1).
   - Operations: Prepend, Append (re-link two pointers each), Remove at
     index (re-link the two neighbours, drop the node), Traverse back
     (walk tail -> head via prev pointers).
   - Transport: Play / Pause / Step / Step-back / Reset + speed.
   ------------------------------------------------------------------ */

type Op = 'prepend' | 'append' | 'removeAt' | 'traverseBack';
type Ptr = { label: string; idx: number; color: string };
type Frame = {
  values: number[];
  ghost: number | null;
  ghostSide: 'left' | 'right';
  ghostNext: number | 'null' | null;
  ghostPrev: number | 'null' | null;
  fade: number;
  skipFwd: [number, number] | null;
  skipBwd: [number, number] | null;
  ptrs: Ptr[];
  caption: string;
};

const COLORS = { node: '#4f46e5', curr: '#0ea5e9', done: '#10b981', ghost: '#10b981', fwd: 'rgba(79,70,229,0.85)', bwd: 'rgba(14,165,233,0.85)' };

const parseList = (s: string): number[] =>
  s.split(',').map((x) => parseInt(x.trim(), 10)).filter((x) => Number.isFinite(x)).slice(0, 7);

const blank = (values: number[]): Frame => ({ values, ghost: null, ghostSide: 'left', ghostNext: null, ghostPrev: null, fade: -1, skipFwd: null, skipBwd: null, ptrs: [], caption: '' });

function buildFrames(values: number[], op: Op, arg: number): Frame[] {
  const out: Frame[] = [];
  const n = values.length;
  const head: Ptr = { label: 'head', idx: 0, color: COLORS.node };
  const tail: Ptr = { label: 'tail', idx: n - 1, color: COLORS.node };

  if (n === 0 && op !== 'prepend' && op !== 'append') {
    return [{ ...blank(values), caption: 'Empty list. Try Prepend or Append.' }];
  }

  if (op === 'prepend') {
    out.push({ ...blank(values), ghost: arg, ghostSide: 'left', ptrs: n ? [head, tail] : [], caption: `Create a node holding ${arg} to the left of head.` });
    out.push({ ...blank(values), ghost: arg, ghostSide: 'left', ghostNext: n ? 0 : 'null', ptrs: n ? [head, tail] : [], caption: 'new.next = head (top lane).' });
    if (n) out.push({ ...blank(values), ghost: arg, ghostSide: 'left', ghostNext: 0, ghostPrev: 'null', ptrs: [head, { ...tail }, { label: 'head.prev', idx: 0, color: COLORS.bwd }], caption: 'head.prev = new (bottom lane).' });
    const nv = [arg, ...values];
    out.push({ ...blank(nv), ptrs: [{ label: 'head', idx: 0, color: COLORS.done }, { label: 'tail', idx: nv.length - 1, color: COLORS.node }], caption: `head = new. Prepend is O(1): [${nv.join(', ')}].` });
    return out;
  }

  if (op === 'append') {
    out.push({ ...blank(values), ghost: arg, ghostSide: 'right', ptrs: n ? [head, tail] : [], caption: `Create a node holding ${arg} to the right of tail.` });
    if (n) out.push({ ...blank(values), ghost: arg, ghostSide: 'right', ghostPrev: n - 1, ptrs: [head, tail], caption: 'new.prev = tail (bottom lane).' });
    out.push({ ...blank(values), ghost: arg, ghostSide: 'right', ghostPrev: n ? n - 1 : 'null', ghostNext: 'null', ptrs: n ? [head, { label: 'tail.next', idx: n - 1, color: COLORS.fwd }] : [], caption: n ? 'tail.next = new (top lane).' : 'First node: head = tail = new.' });
    const nv = [...values, arg];
    out.push({ ...blank(nv), ptrs: [{ label: 'head', idx: 0, color: COLORS.node }, { label: 'tail', idx: nv.length - 1, color: COLORS.done }], caption: `tail = new. Append is O(1) with a tail pointer: [${nv.join(', ')}].` });
    return out;
  }

  if (op === 'removeAt') {
    const i = Math.max(0, Math.min(n - 1, arg));
    if (n === 0) return [{ ...blank(values), caption: 'Nothing to remove.' }];
    out.push({ ...blank(values), fade: -1, ptrs: [{ label: 'node', idx: i, color: COLORS.curr }], caption: `Remove index ${i} (value ${values[i]}). We hold the node, so no search is needed.` });
    if (i > 0 && i < n - 1) {
      out.push({ ...blank(values), fade: i, skipFwd: [i - 1, i + 1], ptrs: [{ label: 'node', idx: i, color: COLORS.curr }], caption: 'node.prev.next = node.next — the top arrow hops over the node.' });
      out.push({ ...blank(values), fade: i, skipFwd: [i - 1, i + 1], skipBwd: [i + 1, i - 1], ptrs: [{ label: 'node', idx: i, color: COLORS.curr }], caption: 'node.next.prev = node.prev — the bottom arrow hops back.' });
    } else {
      out.push({ ...blank(values), fade: i, ptrs: [{ label: 'node', idx: i, color: COLORS.curr }], caption: i === 0 ? 'It is the head: head = head.next, then head.prev = null.' : 'It is the tail: tail = tail.prev, then tail.next = null.' });
    }
    const nv = values.filter((_, k) => k !== i);
    out.push({ ...blank(nv), ptrs: nv.length ? [{ label: 'head', idx: 0, color: COLORS.done }, { label: 'tail', idx: nv.length - 1, color: COLORS.done }] : [], caption: nv.length ? `Node dropped in O(1): [${nv.join(', ')}]. No shifting, unlike an array.` : 'List is now empty.' });
    return out;
  }

  // traverseBack
  out.push({ ...blank(values), ptrs: [{ ...tail }, { label: 'curr', idx: n - 1, color: COLORS.curr }], caption: 'Start at tail. We follow prev pointers — impossible in a singly linked list.' });
  for (let i = n - 1; i >= 0; i--) {
    out.push({ ...blank(values), ptrs: [{ ...tail }, { label: 'curr', idx: i, color: COLORS.curr }], caption: `Visit ${values[i]} (index ${i}); curr = curr.prev.` });
  }
  out.push({ ...blank(values), ptrs: [{ label: 'curr', idx: -1, color: COLORS.done }], caption: 'curr = null at the front. We walked the list backward in O(n).' });
  return out;
}

export default function LLDoublyList() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 600, h: 210 });
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);

  const [text, setText] = useState('8, 1, 6, 3');
  const [values, setValues] = useState<number[]>(() => parseList('8, 1, 6, 3'));
  const [op, setOp] = useState<Op>('removeAt');
  const [argText, setArgText] = useState('1');
  const [frames, setFrames] = useState<Frame[]>(() => buildFrames(parseList('8, 1, 6, 3'), 'removeAt', 1));
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  idxRef.current = idx;

  const rebuild = (vals: number[], o: Op, a: number) => { setFrames(buildFrames(vals, o, a)); setIdx(0); setPlaying(false); lastRef.current = 0; };
  const commit = () => { const v = parseList(text); setValues(v); rebuild(v, op, parseInt(argText, 10) || 0); };
  const chooseOp = (o: Op) => { setOp(o); rebuild(values, o, parseInt(argText, 10) || 0); };

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
    const v = f.values;
    const n = v.length;

    const baseW = 56, baseH = 46, baseGap = 40;
    const contentW = (n + (f.ghost != null ? 1 : 0)) * baseW + (n + 1) * baseGap;
    const s = Math.min(1, (w - 16) / Math.max(contentW, 1));
    const nodeW = baseW * s, nodeH = baseH * s, gap = baseGap * s;
    const total = n * nodeW + (n - 1) * gap;
    const startX = Math.max(nodeW * 0.7, (w - total) / 2);
    const rowY = 110;
    const cx = (i: number) => startX + i * (nodeW + gap) + nodeW / 2;
    const FWD = rowY - 9, BWD = rowY + 9;

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
    const curve = (x1: number, y1: number, x2: number, y2: number, dip: number, color: string) => {
      ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.bezierCurveTo((x1 + x2) / 2, y1 + dip, (x1 + x2) / 2, y2 + dip, x2, y2);
      ctx.stroke();
      arrow(x2 - Math.sign(x2 - x1) * 0.1, y2 + (dip > 0 ? 6 : -6), x2, y2, color);
    };

    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

    // adjacent next/prev arrows (skip the faded node's links)
    for (let i = 0; i < n - 1; i++) {
      const dropped = f.fade === i || f.fade === i + 1;
      if (dropped) continue;
      arrow(cx(i) + nodeW / 2, FWD, cx(i + 1) - nodeW / 2 - 2, FWD, COLORS.fwd);
      arrow(cx(i + 1) - nodeW / 2, BWD, cx(i) + nodeW / 2 + 2, BWD, COLORS.bwd);
    }
    // bypass arrows during removal
    if (f.skipFwd) curve(cx(f.skipFwd[0]) + nodeW / 2, FWD, cx(f.skipFwd[1]) - nodeW / 2, FWD, -34, COLORS.done);
    if (f.skipBwd) curve(cx(f.skipBwd[0]) - nodeW / 2, BWD, cx(f.skipBwd[1]) + nodeW / 2, BWD, 34, COLORS.done);

    // null markers at the ends
    ctx.fillStyle = '#94a3b8'; ctx.font = `${Math.round(14 * s)}px ui-monospace, monospace`;
    if (n) { ctx.fillText('∅', startX - gap * 0.6, BWD); ctx.fillText('∅', startX + total + gap * 0.6, FWD); }

    // nodes
    for (let i = 0; i < n; i++) {
      const x = cx(i) - nodeW / 2;
      const ptr = f.ptrs.find((p) => p.idx === i);
      const faded = f.fade === i;
      ctx.globalAlpha = faded ? 0.3 : 1;
      ctx.fillStyle = ptr ? ptr.color : COLORS.node;
      roundRect(ctx, x, rowY - nodeH / 2, nodeW, nodeH, 8 * s); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = `bold ${Math.round(16 * s)}px ui-monospace, monospace`;
      ctx.fillText(String(v[i]), cx(i), rowY);
      ctx.globalAlpha = 1;
    }

    // ghost node + its links
    if (f.ghost != null) {
      const gx = f.ghostSide === 'left' ? startX - nodeW - gap : startX + total + gap;
      const gy = 48;
      ctx.fillStyle = COLORS.ghost;
      roundRect(ctx, gx, gy - nodeH / 2, nodeW, nodeH, 8 * s); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = `bold ${Math.round(16 * s)}px ui-monospace, monospace`;
      ctx.fillText(String(f.ghost), gx + nodeW / 2, gy);
      if (f.ghostNext != null && f.ghostNext !== 'null') arrow(gx + nodeW / 2, gy + nodeH / 2, cx(f.ghostNext) - 2, FWD - nodeH / 2 + 2, COLORS.fwd);
      if (f.ghostPrev != null && f.ghostPrev !== 'null') arrow(cx(f.ghostPrev), BWD + nodeH / 2 - 2, gx + nodeW / 2, gy + nodeH / 2, COLORS.bwd);
    }

    // pointer labels above nodes
    ctx.font = `bold ${Math.round(11.5 * s)}px ui-sans-serif, system-ui`;
    const top = rowY - nodeH / 2;
    f.ptrs.forEach((p, k) => {
      if (p.idx < 0 || p.idx >= n) return;
      const x = cx(p.idx);
      const ly = top - 8 - (k % 2) * 16;
      arrow(x, ly - 11, x, top - 2, p.color);
      ctx.fillStyle = p.color; ctx.fillText(p.label, x, ly - 17);
    });
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 640);
      const h = 210;
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

  useEffect(draw, [frames, idx]);

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

  const ops: { id: Op; label: string }[] = [
    { id: 'prepend', label: 'Prepend' },
    { id: 'append', label: 'Append' },
    { id: 'removeAt', label: 'Remove at' },
    { id: 'traverseBack', label: 'Traverse ←' },
  ];
  const argLabel = op === 'removeAt' ? 'index' : op === 'traverseBack' ? '' : 'value';

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <input value={text} onInput={(e) => setText((e.target as HTMLInputElement).value)} class="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm" placeholder="comma-separated values" />
        <button onClick={commit} class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Load</button>
      </div>
      <div class="mb-3 flex flex-wrap items-center gap-2">
        {ops.map((o) => (
          <button key={o.id} onClick={() => chooseOp(o.id)} class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${op === o.id ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'}`}>{o.label}</button>
        ))}
        {argLabel && (
          <label class="flex items-center gap-1 text-xs text-muted">{argLabel}
            <input value={argText} onInput={(e) => { const val = (e.target as HTMLInputElement).value; setArgText(val); rebuild(values, op, parseInt(val, 10) || 0); }} class="w-16 rounded-lg border border-border bg-surface-2 px-2 py-1 font-mono text-sm" />
          </label>
        )}
      </div>

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
      <p class="mt-2 text-center text-xs text-muted">Top arrows are next, bottom arrows are prev. Removing a known node only re-links its two neighbours — O(1), no shifting.</p>
    </div>
  );
}
