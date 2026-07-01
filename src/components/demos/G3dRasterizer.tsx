import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated triangle rasterizer.
   - Drag the three vertices (indigo / sky / emerald).
   - A coarse pixel grid is swept ROW BY ROW, cell by cell. For each
     cell center we evaluate the three edge functions to get barycentric
     weights. Cells INSIDE get a barycentric blend of the three vertex
     colors; cells tested-but-outside are left faint.
   - The grid-resolution slider changes the pixel (cell) size.
   - Transport: Play / Pause / Step / Back / Reset + speed. A precomputed
     row-major list of cells is walked; `step` = how many cells tested.
   ------------------------------------------------------------------ */

type Vec = { x: number; y: number };
type RGB = [number, number, number];

const VCOLORS: RGB[] = [
  [79, 70, 229],   // #4f46e5 indigo  (V0)
  [14, 165, 233],  // #0ea5e9 sky     (V1)
  [16, 185, 129],  // #10b981 emerald (V2)
];
const VHEX = ['#4f46e5', '#0ea5e9', '#10b981'];

// --- rasterization core (all local) ---
// Edge function = 2D cross product of (B-A) and (P-A).
// Sign tells which side of line AB the point P is on; magnitude is 2*area.
function edge(ax: number, ay: number, bx: number, by: number, px: number, py: number): number {
  return (bx - ax) * (py - ay) - (by - ay) * (px - ax);
}

// Barycentric weights of (px,py) wrt triangle (a,b,c); inside iff all >= 0
// (after normalizing by the triangle's winding sign).
function bary(a: Vec, b: Vec, c: Vec, px: number, py: number) {
  const area2 = edge(a.x, a.y, b.x, b.y, c.x, c.y);
  if (area2 === 0) return { w0: 0, w1: 0, w2: 0, inside: false };
  const s = area2 < 0 ? -1 : 1; // normalize for either winding
  const w0 = (s * edge(b.x, b.y, c.x, c.y, px, py)) / (s * area2); // opposite a
  const w1 = (s * edge(c.x, c.y, a.x, a.y, px, py)) / (s * area2); // opposite b
  const w2 = (s * edge(a.x, a.y, b.x, b.y, px, py)) / (s * area2); // opposite c
  return { w0, w1, w2, inside: w0 >= 0 && w1 >= 0 && w2 >= 0 };
}

// Barycentric blend of the three vertex colors.
function blend(w0: number, w1: number, w2: number): RGB {
  return [
    w0 * VCOLORS[0][0] + w1 * VCOLORS[1][0] + w2 * VCOLORS[2][0],
    w0 * VCOLORS[0][1] + w1 * VCOLORS[1][1] + w2 * VCOLORS[2][1],
    w0 * VCOLORS[0][2] + w1 * VCOLORS[1][2] + w2 * VCOLORS[2][2],
  ];
}

export default function G3dRasterizer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [verts, setVerts] = useState<Vec[]>([
    { x: 120, y: 60 },
    { x: 360, y: 130 },
    { x: 150, y: 300 },
  ]);
  const [cell, setCell] = useState(24); // pixel (cell) size in CSS px
  const [step, setStep] = useState(0);  // number of cells evaluated (0..cols*rows)
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  const dragRef = useRef<number | null>(null);
  const sizeRef = useRef({ w: 480, h: 360 });
  const gridRef = useRef({ cols: 20, rows: 15 });
  const rafRef = useRef<number | null>(null);
  const stepRef = useRef(0);
  stepRef.current = step;

  const cols = gridRef.current.cols;
  const rows = gridRef.current.rows;
  const total = cols * rows;

  // ---- draw ----
  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    const nCols = Math.max(1, Math.ceil(w / cell));
    const nRows = Math.max(1, Math.ceil(h / cell));
    gridRef.current = { cols: nCols, rows: nRows };
    const nTotal = nCols * nRows;
    const s = Math.min(step, nTotal);

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#0b1020';
    ctx.globalAlpha = 0.03;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;

    const [A, B, C] = verts;

    // tested cells so far, row-major
    for (let i = 0; i < s; i++) {
      const c = i % nCols;
      const r = Math.floor(i / nCols);
      const x = c * cell;
      const y = r * cell;
      const px = x + cell / 2;
      const py = y + cell / 2;
      const b = bary(A, B, C, px, py);
      if (b.inside) {
        const [rr, gg, bb] = blend(b.w0, b.w1, b.w2);
        ctx.fillStyle = `rgb(${rr | 0}, ${gg | 0}, ${bb | 0})`;
        ctx.fillRect(x + 0.5, y + 0.5, cell - 1, cell - 1);
      } else {
        ctx.fillStyle = 'rgba(148,163,184,0.10)';
        ctx.fillRect(x + 0.5, y + 0.5, cell - 1, cell - 1);
      }
    }

    // current scanline highlight (row about to be / just tested)
    const rowNow = Math.min(nRows - 1, Math.floor(Math.max(0, s - 1) / nCols));
    ctx.fillStyle = 'rgba(79,70,229,0.14)';
    ctx.fillRect(0, rowNow * cell, w, cell);

    // grid lines
    ctx.strokeStyle = 'rgba(148,163,184,0.22)';
    ctx.lineWidth = 1;
    for (let gx = 0; gx <= w; gx += cell) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke(); }
    for (let gy = 0; gy <= h; gy += cell) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke(); }

    // triangle outline
    ctx.strokeStyle = 'rgba(226,232,240,0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.lineTo(C.x, C.y); ctx.closePath();
    ctx.stroke();

    // vertex handles
    verts.forEach((v, i) => {
      ctx.beginPath(); ctx.arc(v.x, v.y, 8, 0, Math.PI * 2);
      ctx.fillStyle = '#fff'; ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = VHEX[i]; ctx.stroke();
      ctx.fillStyle = VHEX[i];
      ctx.font = '700 12px Inter, sans-serif';
      ctx.fillText('V' + i, v.x + 11, v.y - 9);
    });
  };

  // ---- responsive sizing ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 520);
      const h = Math.round(w * 0.72);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // clamp vertices into the new canvas
      const prev = sizeRef.current;
      if (prev.w !== w || prev.h !== h) {
        setVerts((vs) => vs.map((v) => ({
          x: Math.max(6, Math.min(w - 6, (v.x / prev.w) * w)),
          y: Math.max(6, Math.min(h - 6, (v.y / prev.h) * h)),
        })));
      }
      sizeRef.current = { w, h };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // redraw on any state change
  useEffect(draw, [verts, cell, step, playing, speed]);

  // changing resolution restarts the sweep
  useEffect(() => { setPlaying(false); setStep(0); }, [cell]);

  // ---- play loop (requestAnimationFrame) ----
  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const perFrame = Math.max(1, Math.round(speed * 2));
    const tick = () => {
      const t = gridRef.current.cols * gridRef.current.rows;
      const next = stepRef.current + perFrame;
      if (next >= t) { setStep(t); setPlaying(false); return; }
      setStep(next);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
  }, [playing, speed]);

  // ---- transport ----
  const reset = () => { setPlaying(false); setStep(0); };
  const stepRow = (dir: 1 | -1) => {
    setPlaying(false);
    setStep((v) => Math.max(0, Math.min(total, v + dir * cols)));
  };
  const play = () => { if (step >= total) setStep(0); setPlaying((p) => !p); };

  // ---- pointer dragging ----
  const at = (e: PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };
  const onDown = (e: PointerEvent) => {
    const p = at(e);
    let best = -1, bestD = 20;
    verts.forEach((v, i) => { const d = Math.hypot(v.x - p.x, v.y - p.y); if (d < bestD) { bestD = d; best = i; } });
    if (best >= 0) {
      dragRef.current = best;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      e.preventDefault();
    }
  };
  const onMove = (e: PointerEvent) => {
    if (dragRef.current == null) return;
    const p = at(e);
    const { w, h } = sizeRef.current;
    const x = Math.max(4, Math.min(w - 4, p.x));
    const y = Math.max(4, Math.min(h - 4, p.y));
    setVerts((vs) => vs.map((v, i) => (i === dragRef.current ? { x, y } : v)));
  };
  const onUp = () => { dragRef.current = null; };

  // ---- caption + stats ----
  const rowNow = Math.min(rows, Math.ceil(step / cols));
  let inside = 0;
  for (let i = 0; i < Math.min(step, total); i++) {
    const c = i % cols, r = Math.floor(i / cols);
    if (bary(verts[0], verts[1], verts[2], c * cell + cell / 2, r * cell + cell / 2).inside) inside++;
  }
  const done = step >= total;
  const caption = step === 0
    ? 'Grid ready. Press Play to sweep row by row, testing each cell against the three edge functions.'
    : done
      ? `Done — swept all ${rows} rows. ${inside} cells landed inside and got a barycentric-blended color.`
      : `row ${rowNow}/${rows} — testing edge functions; cells inside get barycentric-blended color (${inside} filled so far).`;

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
          <p class="text-muted">Drag <span style={`color:${VHEX[0]}`}>V0</span>, <span style={`color:${VHEX[1]}`}>V1</span>, <span style={`color:${VHEX[2]}`}>V2</span> to reshape the triangle.</p>

          <label class="block">
            <span class="mb-1 block text-muted">pixel size = {cell}px ({cols}×{rows} grid)</span>
            <input
              type="range" min={12} max={44} step={2} value={cell}
              onInput={(e) => setCell(parseInt((e.target as HTMLInputElement).value, 10))}
              class="w-full accent-[#4f46e5]"
            />
          </label>

          <div class="rounded-lg bg-surface-2 p-3">
            <div class="flex justify-between"><span class="text-muted">cells tested</span><strong>{Math.min(step, total)} / {total}</strong></div>
            <div class="flex justify-between"><span class="text-muted">cells inside</span><strong>{inside}</strong></div>
          </div>
        </div>
      </div>

      <p class="mt-3 min-h-[2.5rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">{caption}</p>

      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={() => stepRow(-1)} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏮ Back</button>
        <button onClick={play} class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90">{playing ? '⏸ Pause' : '▶ Play'}</button>
        <button onClick={() => stepRow(1)} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏭ Step</button>
        <button onClick={reset} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">↺ Reset</button>
        <label class="ml-auto flex items-center gap-2 text-xs text-muted">speed
          <input type="range" min={0.5} max={3} step={0.5} value={speed} onInput={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))} class="w-24 accent-[#10b981]" />
        </label>
      </div>
      <p class="mt-2 text-center text-xs text-muted">Step / Back move one full scanline; Play advances cell by cell. Inside = all three edge functions share the triangle's winding sign.</p>
    </div>
  );
}
