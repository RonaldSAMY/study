import { useEffect, useMemo, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Detection foundations: IoU + greedy Non-Max Suppression, animated.
   - Drag the boxes around; each carries a confidence score.
   - Slide the IoU threshold Nt.
   - Step through greedy NMS: it repeatedly PICKS the highest-scoring
     survivor, then SUPPRESSES every remaining box whose IoU with it is
     >= Nt. The active pair shows its shaded intersection + live IoU.
   Colors: kept #10b981, active-pick #4f46e5, candidate #0ea5e9.
   ------------------------------------------------------------------ */

const VW = 460; // virtual image width
const VH = 300; // virtual image height
const COLORS = { pick: '#4f46e5', cand: '#0ea5e9', kept: '#10b981' };

type XYWH = { x: number; y: number; w: number; h: number; score: number };
type Corner = [number, number, number, number];

const toCorner = (b: XYWH): Corner => [b.x, b.y, b.x + b.w, b.y + b.h];

function iou(a: Corner, b: Corner): { iou: number; inter: Corner | null } {
  const xi1 = Math.max(a[0], b[0]);
  const yi1 = Math.max(a[1], b[1]);
  const xi2 = Math.min(a[2], b[2]);
  const yi2 = Math.min(a[3], b[3]);
  const iw = Math.max(0, xi2 - xi1);
  const ih = Math.max(0, yi2 - yi1);
  const I = iw * ih;
  const areaA = (a[2] - a[0]) * (a[3] - a[1]);
  const areaB = (b[2] - b[0]) * (b[3] - b[1]);
  const U = areaA + areaB - I;
  return { iou: U <= 0 ? 0 : I / U, inter: I > 0 ? [xi1, yi1, xi2, yi2] : null };
}

type Frame = {
  kind: 'pick' | 'compare' | 'done';
  m: number;
  c?: number;
  ov?: number;
  suppress?: boolean;
  kept: number[];
  suppressed: number[];
  caption: string;
};

function buildFrames(boxes: XYWH[], thresh: number): Frame[] {
  const order = boxes.map((_, i) => i).sort((a, b) => boxes[b].score - boxes[a].score);
  const suppressed = new Array(boxes.length).fill(false);
  const kept: number[] = [];
  const frames: Frame[] = [];
  for (const i of order) {
    if (suppressed[i]) continue;
    kept.push(i);
    frames.push({
      kind: 'pick',
      m: i,
      kept: [...kept],
      suppressed: suppressed.map((s, k) => (s ? k : -1)).filter((k) => k >= 0),
      caption: `Pick box ${i} (score ${boxes[i].score.toFixed(2)}) — the highest-scoring survivor. Keep it.`,
    });
    for (const j of order) {
      if (j === i || suppressed[j]) continue;
      const { iou: ov } = iou(toCorner(boxes[i]), toCorner(boxes[j]));
      const willSuppress = ov >= thresh;
      if (willSuppress) suppressed[j] = true;
      frames.push({
        kind: 'compare',
        m: i,
        c: j,
        ov,
        suppress: willSuppress,
        kept: [...kept],
        suppressed: suppressed.map((s, k) => (s ? k : -1)).filter((k) => k >= 0),
        caption: willSuppress
          ? `IoU(${i}, ${j}) = ${ov.toFixed(3)} ≥ ${thresh.toFixed(2)} → box ${j} is a duplicate, suppress it.`
          : `IoU(${i}, ${j}) = ${ov.toFixed(3)} < ${thresh.toFixed(2)} → box ${j} is a distinct object, keep it.`,
      });
    }
  }
  frames.push({
    kind: 'done',
    m: -1,
    kept: [...kept],
    suppressed: suppressed.map((s, k) => (s ? k : -1)).filter((k) => k >= 0),
    caption: `Done. ${kept.length} clean detection${kept.length === 1 ? '' : 's'} survive from ${boxes.length} raw boxes.`,
  });
  return frames;
}

const START: XYWH[] = [
  { x: 60, y: 70, w: 150, h: 150, score: 0.92 },
  { x: 82, y: 92, w: 150, h: 150, score: 0.74 },
  { x: 44, y: 54, w: 150, h: 150, score: 0.61 },
  { x: 270, y: 110, w: 130, h: 120, score: 0.85 },
  { x: 292, y: 128, w: 130, h: 120, score: 0.55 },
];

export default function CvDetectionFoundations() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ scale: 1 });
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);
  const dragRef = useRef<{ i: number; dx: number; dy: number } | null>(null);

  const [boxes, setBoxes] = useState<XYWH[]>(START);
  const [thresh, setThresh] = useState(0.5);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  idxRef.current = idx;

  const frames = useMemo(() => buildFrames(boxes, thresh), [boxes, thresh]);
  const frame = frames[Math.min(idx, frames.length - 1)];

  useEffect(() => {
    if (!playing) {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      return;
    }
    const interval = 900 / speed;
    const tick = (t: number) => {
      if (!lastRef.current) lastRef.current = t;
      if (t - lastRef.current >= interval) {
        lastRef.current = t;
        const next = idxRef.current + 1;
        if (next >= frames.length) {
          setIdx(frames.length - 1);
          setPlaying(false);
          return;
        }
        setIdx(next);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [playing, speed, frames.length]);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { scale } = sizeRef.current;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const S = (v: number) => v * scale;

    // faint scene background
    ctx.fillStyle = 'rgba(128,128,128,0.05)';
    ctx.fillRect(0, 0, S(VW), S(VH));

    const keptSet = new Set(frame.kept);
    const supSet = new Set(frame.suppressed);

    // intersection shading for the active pair
    if (frame.kind === 'compare' && frame.c != null) {
      const { inter } = iou(toCorner(boxes[frame.m]), toCorner(boxes[frame.c]));
      if (inter) {
        ctx.fillStyle = 'rgba(79,70,229,0.28)';
        ctx.fillRect(S(inter[0]), S(inter[1]), S(inter[2] - inter[0]), S(inter[3] - inter[1]));
      }
    }

    boxes.forEach((b, i) => {
      let color = 'rgba(120,130,150,0.55)';
      let dashed = false;
      let lw = 2;
      if (supSet.has(i)) {
        color = 'rgba(120,130,150,0.35)';
        dashed = true;
      }
      if (keptSet.has(i)) {
        color = COLORS.kept;
        lw = 3;
      }
      if (frame.kind !== 'done' && i === frame.m) {
        color = COLORS.pick;
        lw = 3.5;
      }
      if (frame.kind === 'compare' && i === frame.c) {
        color = COLORS.cand;
        lw = 3.5;
      }
      ctx.save();
      ctx.setLineDash(dashed ? [6, 5] : []);
      ctx.strokeStyle = color;
      ctx.lineWidth = lw;
      ctx.strokeRect(S(b.x), S(b.y), S(b.w), S(b.h));
      ctx.restore();
      // score tag
      ctx.fillStyle = color;
      ctx.font = `${Math.round(S(13))}px system-ui, sans-serif`;
      ctx.fillText(`${i}:${b.score.toFixed(2)}`, S(b.x) + 3, S(b.y) + Math.round(S(14)));
    });
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const cssW = Math.min(parent.clientWidth, 560);
      const scale = cssW / VW;
      const cssH = VH * scale;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = cssW * dpr;
      canvas.height = cssH * dpr;
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { scale };
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

  useEffect(draw, [boxes, idx, thresh, frames]);

  const posFromEvent = (e: PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const { scale } = sizeRef.current;
    return { x: (e.clientX - rect.left) / scale, y: (e.clientY - rect.top) / scale };
  };

  const onDown = (e: PointerEvent) => {
    const p = posFromEvent(e);
    // topmost box hit
    for (let i = boxes.length - 1; i >= 0; i--) {
      const b = boxes[i];
      if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) {
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        dragRef.current = { i, dx: p.x - b.x, dy: p.y - b.y };
        setPlaying(false);
        return;
      }
    }
  };
  const onMove = (e: PointerEvent) => {
    if (!dragRef.current) return;
    const p = posFromEvent(e);
    const { i, dx, dy } = dragRef.current;
    setBoxes((prev) => {
      const next = prev.slice();
      const b = next[i];
      const nx = Math.max(0, Math.min(VW - b.w, p.x - dx));
      const ny = Math.max(0, Math.min(VH - b.h, p.y - dy));
      next[i] = { ...b, x: nx, y: ny };
      return next;
    });
  };
  const onUp = () => {
    if (dragRef.current) {
      dragRef.current = null;
      setIdx(0);
    }
  };

  const reset = () => {
    setPlaying(false);
    setIdx(0);
    lastRef.current = 0;
  };
  const stepF = () => {
    setPlaying(false);
    setIdx((v) => Math.min(frames.length - 1, v + 1));
  };
  const stepB = () => {
    setPlaying(false);
    setIdx((v) => Math.max(0, v - 1));
  };
  const play = () => {
    if (idx >= frames.length - 1) setIdx(0);
    lastRef.current = 0;
    setPlaying((p) => !p);
  };

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas
          ref={canvasRef}
          class="touch-none rounded-xl bg-surface-2"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        />
        <div class="space-y-3 text-sm">
          <p class="text-muted">
            Drag any box. Then step greedy <strong>NMS</strong>: it keeps the highest score and
            deletes overlaps whose IoU clears the threshold.
          </p>
          <label class="flex items-center gap-2 text-xs text-muted">
            IoU threshold Nt = <span class="font-mono text-text">{thresh.toFixed(2)}</span>
            <input
              type="range"
              min={0.1}
              max={0.9}
              step={0.05}
              value={thresh}
              onInput={(e) => {
                setThresh(parseFloat((e.target as HTMLInputElement).value));
                setIdx(0);
              }}
              class="flex-1 accent-[#4f46e5]"
            />
          </label>
          <div class="grid grid-cols-2 gap-2">
            <div class="rounded-lg bg-surface-2 px-3 py-2">
              <span class="text-xs text-muted">kept so far</span>
              <div class="font-mono font-semibold text-[#10b981]">{frame.kept.length}</div>
            </div>
            <div class="rounded-lg bg-surface-2 px-3 py-2">
              <span class="text-xs text-muted">step</span>
              <div class="font-mono font-semibold">
                {idx + 1}/{frames.length}
              </div>
            </div>
          </div>
        </div>
      </div>

      <p class="mt-3 min-h-[2.5rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">
        {frame.caption}
      </p>

      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={stepB} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏮ Back</button>
        <button onClick={play} class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90">{playing ? '⏸ Pause' : '▶ Play'}</button>
        <button onClick={stepF} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏭ Step</button>
        <button onClick={reset} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">↺ Reset</button>
        <label class="ml-auto flex items-center gap-2 text-xs text-muted">speed
          <input type="range" min={0.5} max={3} step={0.5} value={speed} onInput={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))} class="w-24 accent-[#4f46e5]" />
        </label>
      </div>
      <p class="mt-2 text-center text-xs text-muted">
        Tip: drag the two clusters apart, or raise Nt, and watch more boxes survive as "distinct objects".
      </p>
    </div>
  );
}
