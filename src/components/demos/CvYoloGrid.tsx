import { useEffect, useMemo, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   YOLO grid detection, animated.
   - The image is split into an S×S grid. Drag the object.
   - Step the scan across cells; the cell that holds the object's CENTER
     is "responsible" and predicts (x, y, w, h, confidence).
   - The final step decodes that cell's box back to pixels:
        px_center = (col + x)/S · W,   py_center = (row + y)/S · H.
   Reference: /dsa/32-computer-vision/04-yolo-family/yolo-v1.ts
   ------------------------------------------------------------------ */

const VW = 360;
const VH = 360;

export default function CvYoloGrid() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ scale: 1 });
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);

  const [S, setS] = useState(5);
  const [obj, setObj] = useState({ x: 120, y: 130, w: 120, h: 100 });
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  idxRef.current = idx;

  const info = useMemo(() => {
    const cell = VW / S;
    const cx = obj.x + obj.w / 2;
    const cy = obj.y + obj.h / 2;
    const col = Math.max(0, Math.min(S - 1, Math.floor(cx / cell)));
    const row = Math.max(0, Math.min(S - 1, Math.floor(cy / cell)));
    const xFrac = cx / cell - col;
    const yFrac = cy / cell - row;
    const wRel = obj.w / VW;
    const hRel = obj.h / VH;
    return { cell, cx, cy, col, row, respIndex: row * S + col, xFrac, yFrac, wRel, hRel };
  }, [S, obj]);

  const N = S * S;
  const nFrames = N + 2; // scan cells, predict, done

  useEffect(() => {
    if (!playing) {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      return;
    }
    const interval = 480 / speed;
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

  const activeCell = idx < N ? idx : -1;
  const predicting = idx >= N;

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { scale } = sizeRef.current;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const Sc = (v: number) => v * scale;
    const { cell, col, row, respIndex, cx, cy } = info;

    ctx.fillStyle = 'rgba(128,128,128,0.05)';
    ctx.fillRect(0, 0, Sc(VW), Sc(VH));

    // scanned + active + responsible cell fills
    for (let i = 0; i <= (predicting ? N - 1 : activeCell); i++) {
      const c = i % S;
      const r = Math.floor(i / S);
      if (i === respIndex) {
        ctx.fillStyle = 'rgba(16,185,129,0.30)';
        ctx.fillRect(Sc(c * cell), Sc(r * cell), Sc(cell), Sc(cell));
      } else if (i === activeCell) {
        ctx.fillStyle = 'rgba(79,70,229,0.28)';
        ctx.fillRect(Sc(c * cell), Sc(r * cell), Sc(cell), Sc(cell));
      } else {
        ctx.fillStyle = 'rgba(14,165,233,0.06)';
        ctx.fillRect(Sc(c * cell), Sc(r * cell), Sc(cell), Sc(cell));
      }
    }

    // grid lines
    ctx.strokeStyle = 'rgba(128,128,128,0.30)';
    ctx.lineWidth = 1;
    for (let k = 0; k <= S; k++) {
      ctx.beginPath();
      ctx.moveTo(Sc(k * cell), 0);
      ctx.lineTo(Sc(k * cell), Sc(VH));
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, Sc(k * cell));
      ctx.lineTo(Sc(VW), Sc(k * cell));
      ctx.stroke();
    }

    // responsible star
    if (predicting || activeCell >= respIndex) {
      ctx.fillStyle = '#10b981';
      ctx.font = `${Math.round(Sc(cell * 0.5))}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('★', Sc((col + 0.5) * cell), Sc((row + 0.5) * cell));
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    // object box (ground truth)
    ctx.strokeStyle = '#0ea5e9';
    ctx.lineWidth = 3;
    ctx.strokeRect(Sc(obj.x), Sc(obj.y), Sc(obj.w), Sc(obj.h));
    // center dot
    ctx.fillStyle = '#0ea5e9';
    ctx.beginPath();
    ctx.arc(Sc(cx), Sc(cy), Math.max(3, Sc(3.5)), 0, Math.PI * 2);
    ctx.fill();

    // predicted (decoded) box
    if (predicting) {
      const pcx = (col + info.xFrac) * cell;
      const pcy = (row + info.yFrac) * cell;
      const pw = info.wRel * VW;
      const ph = info.hRel * VH;
      ctx.save();
      ctx.setLineDash([7, 5]);
      ctx.strokeStyle = '#4f46e5';
      ctx.lineWidth = 3;
      ctx.strokeRect(Sc(pcx - pw / 2), Sc(pcy - ph / 2), Sc(pw), Sc(ph));
      ctx.restore();
      ctx.fillStyle = '#4f46e5';
      ctx.font = `${Math.round(Sc(13))}px system-ui, sans-serif`;
      ctx.fillText('predicted', Sc(pcx - pw / 2) + 3, Sc(pcy - ph / 2) - 4);
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const cssW = Math.min(parent.clientWidth, 420);
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

  useEffect(draw, [obj, idx, S, info]);

  const posFromEvent = (e: PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const { scale } = sizeRef.current;
    return { x: (e.clientX - rect.left) / scale, y: (e.clientY - rect.top) / scale };
  };
  const onDown = (e: PointerEvent) => {
    const p = posFromEvent(e);
    if (p.x >= obj.x && p.x <= obj.x + obj.w && p.y >= obj.y && p.y <= obj.y + obj.h) {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      dragRef.current = { dx: p.x - obj.x, dy: p.y - obj.y };
      setPlaying(false);
    }
  };
  const onMove = (e: PointerEvent) => {
    if (!dragRef.current) return;
    const p = posFromEvent(e);
    const nx = Math.max(0, Math.min(VW - obj.w, p.x - dragRef.current.dx));
    const ny = Math.max(0, Math.min(VH - obj.h, p.y - dragRef.current.dy));
    setObj((o) => ({ ...o, x: nx, y: ny }));
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
    const { col, row, respIndex } = info;
    if (activeCell >= 0) {
      const c = activeCell % S;
      const r = Math.floor(activeCell / S);
      if (activeCell === respIndex)
        return `Cell (row ${r}, col ${c}) holds the object's center ★ — it is RESPONSIBLE for predicting this box.`;
      return `Scanning cell (row ${r}, col ${c})… center not here, so it predicts "no object".`;
    }
    if (idx === N)
      return `Responsible cell (row ${row}, col ${col}) predicts x=${info.xFrac.toFixed(2)}, y=${info.yFrac.toFixed(2)} (center within the cell) and w=${info.wRel.toFixed(2)}, h=${info.hRel.toFixed(2)} (size ÷ image).`;
    return `Decode: px_center = (${col}+${info.xFrac.toFixed(2)})/${S}·${VW} = ${((col + info.xFrac) / S * VW).toFixed(0)}. The dashed indigo box matches the object in one forward pass.`;
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
            Drag the object. One cell — the one under its <strong>center dot</strong> — owns the
            prediction. That single-owner rule is what makes YOLO's output a fixed-size tensor.
          </p>
          <label class="flex items-center gap-2 text-xs text-muted">
            grid S = <span class="font-mono text-text">{S}×{S}</span>
            <input
              type="range"
              min={3}
              max={7}
              step={1}
              value={S}
              onInput={(e) => {
                setS(parseInt((e.target as HTMLInputElement).value, 10));
                setIdx(0);
              }}
              class="flex-1 accent-[#4f46e5]"
            />
          </label>
          <div class="rounded-lg bg-surface-2 px-3 py-2 font-mono text-xs">
            responsible cell → (row {info.row}, col {info.col})
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
        Coarsen the grid (small S) and two nearby objects can fall in one cell — exactly why early YOLO missed flocks of birds.
      </p>
    </div>
  );
}
