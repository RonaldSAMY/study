import { useEffect, useMemo, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Region Proposal Network anchor matching, animated.
   - A feature grid tiles the image with square ANCHORS (priors).
   - Drag the ground-truth object box.
   - Step the scan: each anchor's IoU with the object is measured and it
     is labelled POSITIVE / ignore / negative (Faster R-CNN rule).
   - Finally the positive anchors are regressed (snapped) onto the object,
     becoming refined proposals.
   Reference: /dsa/32-computer-vision/03-context-detectors/rcnn-family.ts
   ------------------------------------------------------------------ */

const VW = 420;
const VH = 300;
const COLS = 4;
const ROWS = 3;
const STRIDE = 100;
const ASIZE = 118; // anchor side (pixels)

type Corner = [number, number, number, number];

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

const ANCHORS: Corner[] = (() => {
  const out: Corner[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cx = (c + 0.5) * STRIDE;
      const cy = (r + 0.5) * STRIDE;
      out.push([cx - ASIZE / 2, cy - ASIZE / 2, cx + ASIZE / 2, cy + ASIZE / 2]);
    }
  }
  return out;
})();

type Label = 'positive' | 'ignore' | 'negative';
const LABEL_COLOR: Record<Label, string> = {
  positive: '#10b981',
  ignore: '#f59e0b',
  negative: 'rgba(120,130,150,0.4)',
};

export default function CvRpnProposals() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ scale: 1 });
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);

  const [gt, setGt] = useState<Corner>([150, 90, 300, 220]);
  const [posT, setPosT] = useState(0.4);
  const negT = 0.15;
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  idxRef.current = idx;

  const labels = useMemo<Label[]>(() => {
    return ANCHORS.map((a) => {
      const ov = iou(a, gt).iou;
      if (ov >= posT) return 'positive';
      if (ov < negT) return 'negative';
      return 'ignore';
    });
  }, [gt, posT]);

  // frames: 0..N-1 scan each anchor, N = refine, N+1 = done
  const N = ANCHORS.length;
  const nFrames = N + 2;

  useEffect(() => {
    if (!playing) {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      return;
    }
    const interval = 650 / speed;
    const tick = (t: number) => {
      if (!lastRef.current) lastRef.current = t;
      if (t - lastRef.current >= interval) {
        lastRef.current = t;
        const next = idxRef.current + 1;
        if (next >= nFrames) {
          setIdx(nFrames - 1);
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
  }, [playing, speed, nFrames]);

  const activeAnchor = idx < N ? idx : -1;
  const refining = idx >= N;
  const posCount = labels.filter((l) => l === 'positive').length;

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { scale } = sizeRef.current;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const S = (v: number) => v * scale;

    ctx.fillStyle = 'rgba(128,128,128,0.05)';
    ctx.fillRect(0, 0, S(VW), S(VH));

    // shade active anchor ∩ gt
    if (activeAnchor >= 0) {
      const { inter } = iou(ANCHORS[activeAnchor], gt);
      if (inter) {
        ctx.fillStyle = 'rgba(79,70,229,0.28)';
        ctx.fillRect(S(inter[0]), S(inter[1]), S(inter[2] - inter[0]), S(inter[3] - inter[1]));
      }
    }

    ANCHORS.forEach((a, i) => {
      const revealed = refining || i <= activeAnchor;
      let color = 'rgba(120,130,150,0.28)';
      let lw = 1.5;
      let dash = false;
      if (revealed) {
        color = LABEL_COLOR[labels[i]];
        lw = labels[i] === 'negative' ? 1.5 : 2.5;
      }
      if (i === activeAnchor) {
        color = '#4f46e5';
        lw = 3.5;
      }
      // center dot
      const cx = (a[0] + a[2]) / 2;
      const cy = (a[1] + a[3]) / 2;
      ctx.fillStyle = revealed ? color : 'rgba(120,130,150,0.5)';
      ctx.beginPath();
      ctx.arc(S(cx), S(cy), Math.max(2, S(2.5)), 0, Math.PI * 2);
      ctx.fill();
      // box (skip solid negatives when refining to reduce clutter)
      if (refining && labels[i] === 'negative') return;
      ctx.save();
      ctx.setLineDash(dash ? [5, 4] : []);
      ctx.strokeStyle = color;
      ctx.lineWidth = lw;
      ctx.strokeRect(S(a[0]), S(a[1]), S(a[2] - a[0]), S(a[3] - a[1]));
      ctx.restore();
    });

    // refined proposals: positives regress onto the GT box
    if (refining) {
      ctx.save();
      ctx.setLineDash([7, 5]);
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 3;
      ctx.strokeRect(S(gt[0]), S(gt[1]), S(gt[2] - gt[0]), S(gt[3] - gt[1]));
      ctx.restore();
    }

    // ground-truth object box
    ctx.strokeStyle = '#0ea5e9';
    ctx.lineWidth = 3;
    ctx.strokeRect(S(gt[0]), S(gt[1]), S(gt[2] - gt[0]), S(gt[3] - gt[1]));
    ctx.fillStyle = '#0ea5e9';
    ctx.font = `${Math.round(S(13))}px system-ui, sans-serif`;
    ctx.fillText('object', S(gt[0]) + 3, S(gt[1]) - 4);
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

  useEffect(draw, [gt, idx, posT, labels]);

  const posFromEvent = (e: PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const { scale } = sizeRef.current;
    return { x: (e.clientX - rect.left) / scale, y: (e.clientY - rect.top) / scale };
  };
  const onDown = (e: PointerEvent) => {
    const p = posFromEvent(e);
    if (p.x >= gt[0] && p.x <= gt[2] && p.y >= gt[1] && p.y <= gt[3]) {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      dragRef.current = { dx: p.x - gt[0], dy: p.y - gt[1] };
      setPlaying(false);
    }
  };
  const onMove = (e: PointerEvent) => {
    if (!dragRef.current) return;
    const p = posFromEvent(e);
    const w = gt[2] - gt[0];
    const h = gt[3] - gt[1];
    const nx = Math.max(0, Math.min(VW - w, p.x - dragRef.current.dx));
    const ny = Math.max(0, Math.min(VH - h, p.y - dragRef.current.dy));
    setGt([nx, ny, nx + w, ny + h]);
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
    setIdx((v) => Math.min(nFrames - 1, v + 1));
  };
  const stepB = () => {
    setPlaying(false);
    setIdx((v) => Math.max(0, v - 1));
  };
  const play = () => {
    if (idx >= nFrames - 1) setIdx(0);
    lastRef.current = 0;
    setPlaying((p) => !p);
  };

  const caption = (() => {
    if (activeAnchor >= 0) {
      const ov = iou(ANCHORS[activeAnchor], gt).iou;
      const l = labels[activeAnchor];
      const verdict =
        l === 'positive'
          ? `≥ ${posT.toFixed(2)} → POSITIVE (a box-regression target)`
          : l === 'negative'
            ? `< ${negT.toFixed(2)} → negative (background, no box loss)`
            : `between ${negT.toFixed(2)} and ${posT.toFixed(2)} → ignored (ambiguous)`;
      return `Anchor ${activeAnchor}: IoU with the object = ${ov.toFixed(3)}. ${verdict}`;
    }
    if (idx === N) return `Regress every positive anchor onto the object: t = ((Gx−Ax)/Aw, …, log(Gw/Aw), …). The dashed box is the refined proposal.`;
    return `${posCount} positive anchor${posCount === 1 ? '' : 's'} became proposals. After NMS these RoIs go to the second-stage head for class + box.`;
  })();

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
            Drag the sky-blue <strong>object</strong>. Each grid cell holds one anchor; stepping scores
            them by IoU and labels each one.
          </p>
          <label class="flex items-center gap-2 text-xs text-muted">
            positive threshold = <span class="font-mono text-text">{posT.toFixed(2)}</span>
            <input
              type="range"
              min={0.2}
              max={0.7}
              step={0.05}
              value={posT}
              onInput={(e) => {
                setPosT(parseFloat((e.target as HTMLInputElement).value));
                setIdx(0);
              }}
              class="flex-1 accent-[#4f46e5]"
            />
          </label>
          <div class="flex flex-wrap gap-2 text-xs">
            <span class="rounded px-2 py-1" style="background:rgba(16,185,129,0.15);color:#10b981">positive {posCount}</span>
            <span class="rounded px-2 py-1" style="background:rgba(245,158,11,0.15);color:#b45309">ignore {labels.filter((l) => l === 'ignore').length}</span>
            <span class="rounded bg-surface-2 px-2 py-1 text-muted">negative {labels.filter((l) => l === 'negative').length}</span>
          </div>
        </div>
      </div>

      <p class="mt-3 min-h-[2.5rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">{caption}</p>

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
        Lower the threshold and more anchors turn green — the classic recall/precision knob for proposals.
      </p>
    </div>
  );
}
