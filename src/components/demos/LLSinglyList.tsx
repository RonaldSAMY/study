import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated singly linked list.
   - Edit the node values (comma-separated). Pick an operation and step
     through it: a "head" pointer anchors the list, a moving "curr"
     pointer walks the chain, and insertions/deletions re-link arrows
     one frame at a time.
   - Operations: Traverse (walk head -> null), Prepend, Append, Remove head.
   - Transport: Play / Pause / Step / Step-back / Reset + speed.
   - Canvas: devicePixelRatio scaling, redraw on resize, touch-none.
   ------------------------------------------------------------------ */

type Op = 'traverse' | 'prepend' | 'append' | 'removeHead';

type Ptr = { label: string; idx: number; color: string };
type Frame = {
  values: number[];          // committed nodes, in order
  ghost: number | null;      // floating new node value (above the row)
  ghostLink: number | 'null' | null; // ghost.next target (node index or null)
  fade: number;              // index of a node being dropped (-1 = none)
  ptrs: Ptr[];               // pointer labels under nodes (idx === values.length => the "null" slot)
  caption: string;
};

const COLORS = { node: '#4f46e5', curr: '#0ea5e9', done: '#10b981', ghost: '#10b981' };

const parseList = (s: string): number[] =>
  s.split(',').map((x) => parseInt(x.trim(), 10)).filter((x) => Number.isFinite(x)).slice(0, 7);

function buildFrames(values: number[], op: Op, arg: number): Frame[] {
  const frames: Frame[] = [];
  const head: Ptr = { label: 'head', idx: 0, color: COLORS.node };

  if (values.length === 0) {
    return [{ values, ghost: null, ghostLink: null, fade: -1, ptrs: [], caption: 'The list is empty: head -> null. Load some values.' }];
  }

  if (op === 'traverse') {
    frames.push({ values, ghost: null, ghostLink: null, fade: -1, ptrs: [{ ...head }, { label: 'curr', idx: 0, color: COLORS.curr }], caption: 'curr starts at head. We follow next pointers until curr is null.' });
    for (let i = 0; i < values.length; i++) {
      frames.push({ values, ghost: null, ghostLink: null, fade: -1, ptrs: [{ ...head }, { label: 'curr', idx: i, color: COLORS.curr }], caption: `Visit node ${values[i]} (index ${i}). Then curr = curr.next.` });
    }
    frames.push({ values, ghost: null, ghostLink: null, fade: -1, ptrs: [{ ...head }, { label: 'curr', idx: values.length, color: COLORS.done }], caption: 'curr is now null — we walked the whole chain in O(n).' });
    return frames;
  }

  if (op === 'prepend') {
    frames.push({ values, ghost: arg, ghostLink: null, fade: -1, ptrs: [{ ...head }], caption: `Create a new node holding ${arg} (not linked yet).` });
    frames.push({ values, ghost: arg, ghostLink: 0, fade: -1, ptrs: [{ ...head }], caption: 'Point new.next at the current head — O(1), no shifting.' });
    const nv = [arg, ...values];
    frames.push({ values: nv, ghost: null, ghostLink: null, fade: -1, ptrs: [{ label: 'head', idx: 0, color: COLORS.done }], caption: `Move head to the new node. Prepend is O(1): the front of [${nv.join(', ')}] changed without touching the rest.` });
    return frames;
  }

  if (op === 'append') {
    frames.push({ values, ghost: null, ghostLink: null, fade: -1, ptrs: [{ ...head }, { label: 'curr', idx: 0, color: COLORS.curr }], caption: 'Without a tail pointer we must walk to the last node first.' });
    for (let i = 1; i < values.length; i++) {
      frames.push({ values, ghost: null, ghostLink: null, fade: -1, ptrs: [{ ...head }, { label: 'curr', idx: i, color: COLORS.curr }], caption: `Advance curr to node ${values[i]}.` });
    }
    const last = values.length - 1;
    frames.push({ values, ghost: arg, ghostLink: null, fade: -1, ptrs: [{ ...head }, { label: 'curr', idx: last, color: COLORS.curr }], caption: `curr is the last node. Create a new node holding ${arg}.` });
    const nv = [...values, arg];
    frames.push({ values: nv, ghost: null, ghostLink: null, fade: -1, ptrs: [{ label: 'head', idx: 0, color: COLORS.node }, { label: 'tail', idx: nv.length - 1, color: COLORS.done }], caption: `Link last.next to it: [${nv.join(', ')}]. The walk made this O(n) — keep a tail pointer to get O(1).` });
    return frames;
  }

  // removeHead
  frames.push({ values, ghost: null, ghostLink: null, fade: 0, ptrs: [{ ...head }], caption: `Detach the head node (${values[0]}).` });
  frames.push({ values, ghost: null, ghostLink: null, fade: 0, ptrs: [{ label: 'head', idx: 1, color: COLORS.done }], caption: 'Move head to head.next — the old node is now unreachable and gets garbage-collected.' });
  const nv = values.slice(1);
  frames.push({ values: nv, ghost: null, ghostLink: null, fade: -1, ptrs: nv.length ? [{ label: 'head', idx: 0, color: COLORS.done }] : [], caption: nv.length ? `Done in O(1): the list is now [${nv.join(', ')}].` : 'The list is now empty: head -> null.' });
  return frames;
}

export default function LLSinglyList() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 600, h: 190 });
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);

  const [text, setText] = useState('7, 3, 9, 5');
  const [values, setValues] = useState<number[]>(() => parseList('7, 3, 9, 5'));
  const [op, setOp] = useState<Op>('traverse');
  const [argText, setArgText] = useState('4');
  const [frames, setFrames] = useState<Frame[]>(() => buildFrames(parseList('7, 3, 9, 5'), 'traverse', 4));
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  idxRef.current = idx;

  const rebuild = (vals: number[], o: Op, a: number) => {
    setFrames(buildFrames(vals, o, a));
    setIdx(0);
    setPlaying(false);
    lastRef.current = 0;
  };

  const commit = () => {
    const v = parseList(text);
    setValues(v);
    rebuild(v, op, parseInt(argText, 10) || 0);
  };
  const chooseOp = (o: Op) => { setOp(o); rebuild(values, o, parseInt(argText, 10) || 0); };

  // ----- drawing helpers (inside the island) -----
  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);
    const f = frames[Math.min(idx, frames.length - 1)];
    if (!f) return;

    const n = f.values.length;
    const slots = n + 1; // include the null terminator slot
    const baseW = 56, baseH = 44, baseGap = 30;
    const contentW = slots * baseW + (slots - 1) * baseGap;
    const s = Math.min(1, (w - 16) / contentW);
    const nodeW = baseW * s, nodeH = baseH * s, gap = baseGap * s;
    const total = slots * nodeW + (slots - 1) * gap;
    const startX = (w - total) / 2;
    const rowY = 108;

    const cx = (i: number) => startX + i * (nodeW + gap) + nodeW / 2;

    const arrow = (x1: number, y1: number, x2: number, y2: number, color: string) => {
      ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      const a = Math.atan2(y2 - y1, x2 - x1);
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - 7 * Math.cos(a - 0.4), y2 - 7 * Math.sin(a - 0.4));
      ctx.lineTo(x2 - 7 * Math.cos(a + 0.4), y2 - 7 * Math.sin(a + 0.4));
      ctx.closePath(); ctx.fill();
    };

    // arrows between nodes + tail -> null
    for (let i = 0; i < n; i++) {
      const x1 = cx(i) + nodeW / 2;
      const x2 = cx(i + 1) - nodeW / 2;
      const faded = f.fade === i;
      arrow(x1, rowY, x2 - 2, rowY, faded ? 'rgba(148,163,184,0.5)' : 'rgba(148,163,184,0.9)');
    }

    // nodes
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let i = 0; i < n; i++) {
      const x = cx(i) - nodeW / 2;
      const ptr = f.ptrs.find((p) => p.idx === i);
      const faded = f.fade === i;
      ctx.globalAlpha = faded ? 0.35 : 1;
      ctx.fillStyle = ptr ? ptr.color : COLORS.node;
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      roundRect(ctx, x, rowY - nodeH / 2, nodeW, nodeH, 8 * s);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.round(17 * s)}px ui-monospace, monospace`;
      ctx.fillText(String(f.values[i]), cx(i), rowY);
      ctx.globalAlpha = 1;
    }

    // null terminator slot
    ctx.fillStyle = '#94a3b8';
    ctx.font = `${Math.round(15 * s)}px ui-monospace, monospace`;
    ctx.fillText('∅', cx(n), rowY);

    // ghost (floating new) node
    if (f.ghost != null) {
      const gx = startX, gy = 44;
      ctx.fillStyle = COLORS.ghost;
      roundRect(ctx, gx, gy - nodeH / 2, nodeW, nodeH, 8 * s);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.round(17 * s)}px ui-monospace, monospace`;
      ctx.fillText(String(f.ghost), gx + nodeW / 2, gy);
      if (f.ghostLink != null) {
        const tx = f.ghostLink === 'null' ? cx(n) : cx(f.ghostLink);
        arrow(gx + nodeW / 2, gy + nodeH / 2, tx, rowY - nodeH / 2 - 2, COLORS.ghost);
      }
    }

    // pointer labels under nodes
    ctx.font = `bold ${Math.round(12 * s)}px ui-sans-serif, system-ui`;
    f.ptrs.forEach((p, k) => {
      const x = cx(p.idx);
      const ly = rowY + nodeH / 2 + 8 + (k % 2) * 16;
      arrow(x, ly + 11, x, rowY + nodeH / 2 + 2, p.color);
      ctx.fillStyle = p.color;
      ctx.fillText(p.label, x, ly + 20);
    });
  };

  const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 620);
      const h = 190;
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
    const interval = 900 / speed;
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

  const ops: { id: Op; label: string }[] = [
    { id: 'traverse', label: 'Traverse' },
    { id: 'prepend', label: 'Prepend' },
    { id: 'append', label: 'Append' },
    { id: 'removeHead', label: 'Remove head' },
  ];
  const needsArg = op === 'prepend' || op === 'append';

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
        {needsArg && (
          <label class="flex items-center gap-1 text-xs text-muted">value
            <input value={argText} onInput={(e) => { const v = (e.target as HTMLInputElement).value; setArgText(v); rebuild(values, op, parseInt(v, 10) || 0); }} class="w-16 rounded-lg border border-border bg-surface-2 px-2 py-1 font-mono text-sm" />
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
      <p class="mt-2 text-center text-xs text-muted">Prepend stays O(1); Append walks to the tail (O(n)) unless you cache a tail pointer.</p>
    </div>
  );
}
