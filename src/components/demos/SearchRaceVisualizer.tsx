import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Linear vs binary search race.
   - A sorted array is drawn as a row of cells (top: linear, bottom: binary).
   - Pick a target, press Race, and both searches animate step by step.
   - Step counters show how many comparisons each one needed.
   - Binary search greys out the half it has ruled out.
   ------------------------------------------------------------------ */

const COLORS = {
  linear: '#0ea5e9',
  binary: '#4f46e5',
  found: '#10b981',
  ruled: 'rgba(128,128,128,0.18)',
};

const SIZE = 16;

function makeSorted(): number[] {
  // strictly increasing values, mildly irregular gaps
  const arr: number[] = [];
  let v = 2 + Math.floor(Math.random() * 4);
  for (let i = 0; i < SIZE; i++) {
    arr.push(v);
    v += 1 + Math.floor(Math.random() * 5);
  }
  return arr;
}

export default function SearchRaceVisualizer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const [data, setData] = useState<number[]>(makeSorted);
  const [targetIdx, setTargetIdx] = useState(11);
  const target = data[targetIdx];

  // animation state
  const [running, setRunning] = useState(false);
  const [linPos, setLinPos] = useState(-1);
  const [linSteps, setLinSteps] = useState(0);
  const [linDone, setLinDone] = useState(false);
  const [binLo, setBinLo] = useState(0);
  const [binHi, setBinHi] = useState(SIZE - 1);
  const [binMid, setBinMid] = useState(-1);
  const [binSteps, setBinSteps] = useState(0);
  const [binDone, setBinDone] = useState(false);

  const sizeRef = useRef({ w: 480, h: 220 });

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);

    const pad = 8;
    const cellW = (w - pad * 2) / SIZE;
    const cellH = 46;
    const gapY = 40;
    const rowY = [56, 56 + cellH + gapY];

    const labels = ['Linear', 'Binary'];
    ctx.font = '700 12px Inter, sans-serif';
    ctx.fillStyle = 'rgba(128,128,128,0.85)';
    ctx.fillText(`${labels[0]}  (left to right)`, pad, rowY[0] - 10);
    ctx.fillText(`${labels[1]}  (halve each step)`, pad, rowY[1] - 10);

    for (let row = 0; row < 2; row++) {
      for (let i = 0; i < SIZE; i++) {
        const x = pad + i * cellW;
        const y = rowY[row];
        let fill = 'rgba(128,128,128,0.10)';
        let stroke = 'rgba(128,128,128,0.35)';
        let textColor = '#888';

        if (row === 0) {
          if (linDone && i === linPos) { fill = COLORS.found; textColor = '#fff'; }
          else if (i === linPos) { fill = COLORS.linear; textColor = '#fff'; }
          else if (i < linPos) { fill = COLORS.ruled; }
        } else {
          if (i < binLo || i > binHi) { fill = COLORS.ruled; }
          if (binDone && i === binMid) { fill = COLORS.found; textColor = '#fff'; }
          else if (i === binMid) { fill = COLORS.binary; textColor = '#fff'; }
        }

        ctx.fillStyle = fill;
        roundRect(ctx, x + 2, y, cellW - 4, cellH, 7);
        ctx.fill();
        ctx.lineWidth = 1.5; ctx.strokeStyle = stroke; ctx.stroke();

        ctx.fillStyle = textColor;
        ctx.font = '600 13px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(String(data[i]), x + cellW / 2, y + cellH / 2 + 5);
        ctx.textAlign = 'left';
      }
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 620);
      const hgt = 220;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = hgt * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${hgt}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w, h: hgt };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  useEffect(draw, [data, linPos, linDone, binLo, binHi, binMid, binDone]);

  const reset = (newData?: number[]) => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    setRunning(false);
    setLinPos(-1); setLinSteps(0); setLinDone(false);
    setBinLo(0); setBinHi(SIZE - 1); setBinMid(-1); setBinSteps(0); setBinDone(false);
    if (newData) setData(newData);
  };

  const race = () => {
    reset();
    setRunning(true);
    // build linear steps
    const linOrder: number[] = [];
    for (let i = 0; i < SIZE; i++) { linOrder.push(i); if (data[i] === target) break; }
    // build binary steps
    type B = { lo: number; hi: number; mid: number };
    const binOrder: B[] = [];
    let lo = 0, hi = SIZE - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      binOrder.push({ lo, hi, mid });
      if (data[mid] === target) break;
      if (data[mid] < target) lo = mid + 1; else hi = mid - 1;
    }

    let li = 0, bi = 0;
    let last = performance.now();
    const tick = (t: number) => {
      if (t - last >= 650) {
        last = t;
        if (li < linOrder.length) {
          const idx = linOrder[li];
          setLinPos(idx); setLinSteps(li + 1);
          if (data[idx] === target) setLinDone(true);
          li++;
        }
        if (bi < binOrder.length) {
          const s = binOrder[bi];
          setBinLo(s.lo); setBinHi(s.hi); setBinMid(s.mid); setBinSteps(bi + 1);
          if (data[s.mid] === target) setBinDone(true);
          bi++;
        }
      }
      if (li < linOrder.length || bi < binOrder.length) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setRunning(false);
        rafRef.current = null;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <button
          onClick={race}
          disabled={running}
          class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white transition disabled:opacity-50"
        >
          ▶ Race
        </button>
        <button
          onClick={() => reset(makeSorted())}
          disabled={running}
          class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted transition hover:text-text disabled:opacity-50"
        >
          ↻ New array
        </button>
        <label class="ml-auto flex items-center gap-2 text-sm">
          <span class="text-muted">target</span>
          <select
            value={targetIdx}
            disabled={running}
            onChange={(e) => { setTargetIdx(parseInt((e.target as HTMLSelectElement).value)); reset(); }}
            class="rounded-lg bg-surface-2 px-2 py-1 font-mono font-semibold"
          >
            {data.map((v, i) => <option key={i} value={i}>{v}</option>)}
          </select>
        </label>
      </div>

      <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

      <div class="mt-3 grid grid-cols-2 gap-2 text-sm">
        <Readout label="Linear comparisons" color={COLORS.linear} value={String(linSteps)} />
        <Readout label="Binary comparisons" color={COLORS.binary} value={String(binSteps)} />
      </div>
      <p class="mt-2 text-xs text-muted">
        Looking for <strong>{target}</strong>. Linear scans one cell at a time; binary jumps to the middle and throws away half the array each step.
      </p>
    </div>
  );
}

function Readout({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div class="rounded-lg bg-surface-2 px-3 py-2">
      <span class="text-muted" style={color ? `color:${color}` : ''}>{label}</span>
      <div class="font-mono text-lg font-semibold">{value}</div>
    </div>
  );
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
