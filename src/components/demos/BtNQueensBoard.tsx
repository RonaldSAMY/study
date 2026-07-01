import { useEffect, useMemo, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Animated N-Queens backtracking on a real chessboard.
   - Pick the board size N. The demo places queens row by row, recording
     every attempt: a square that is attacked is rejected (red), a safe
     square gets a queen (placed), and a full board is a solution (emerald).
   - Attacked squares are tinted so you can SEE why a try is pruned.
   - Transport: Play / Pause / Step / Back / Reset + speed.
   Helpers live INSIDE this island file.
   ------------------------------------------------------------------ */

type QFrame = { action: 'try' | 'place' | 'prune' | 'backtrack' | 'accept'; row: number; col: number; queens: number[]; caption: string; solutions: number };
type QTrace = { n: number; frames: QFrame[]; solutions: number };

const COLORS = { idx: '#4f46e5', sky: '#0ea5e9', em: '#10b981', red: '#ef4444' };

function buildTrace(n: number): QTrace {
  const frames: QFrame[] = [];
  const cols = new Set<number>(), d1 = new Set<number>(), d2 = new Set<number>();
  const queens: number[] = [];
  let solutions = 0;
  const push = (action: QFrame['action'], row: number, col: number, caption: string) =>
    frames.push({ action, row, col, queens: queens.slice(), caption, solutions });
  const rec = (row: number) => {
    if (row === n) { solutions++; push('accept', -1, -1, `all ${n} queens placed with no two attacking — solution #${solutions} ✓`); return; }
    for (let col = 0; col < n; col++) {
      if (cols.has(col) || d1.has(row - col) || d2.has(row + col)) {
        let by = 'another queen';
        for (let r = 0; r < row; r++) {
          const c = queens[r];
          if (c === col) { by = `column, by the queen at (${r}, ${c})`; break; }
          if (r - c === row - col) { by = `the ↘ diagonal, by the queen at (${r}, ${c})`; break; }
          if (r + c === row + col) { by = `the ↗ diagonal, by the queen at (${r}, ${c})`; break; }
        }
        push('prune', row, col, `(${row}, ${col})? attacked on ${by} → skip`);
        continue;
      }
      push('try', row, col, `(${row}, ${col}) is safe — place a queen here`);
      queens[row] = col; cols.add(col); d1.add(row - col); d2.add(row + col);
      push('place', row, col, `placed queen at (${row}, ${col}); descend to row ${row + 1}`);
      rec(row + 1);
      queens.length = row; cols.delete(col); d1.delete(row - col); d2.delete(row + col);
      push('backtrack', row, col, `dead end below (${row}, ${col}) — remove this queen and try the next column`);
    }
  };
  rec(0);
  return { n, frames, solutions };
}

export default function BtNQueensBoard() {
  const [n, setN] = useState(4);
  const trace = useMemo(() => buildTrace(n), [n]);

  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ cell: 60, ox: 0, oy: 0 });
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0); idxRef.current = idx;
  const traceRef = useRef<QTrace>(trace); traceRef.current = trace;
  const resizeRef = useRef<() => void>(() => {});
  const last = trace.frames.length - 1;

  const draw = () => {
    const c = canvasRef.current; if (!c) return; const ctx = c.getContext('2d'); if (!ctx) return;
    const tr = traceRef.current; const N = tr.n;
    const { cell, ox, oy } = sizeRef.current;
    const i = Math.min(idxRef.current, tr.frames.length - 1);
    const f = tr.frames[i];
    ctx.clearRect(0, 0, c.width, c.height);

    // attacked squares from currently placed queens
    const queens = f.queens;
    const attacked = (rr: number, cc: number) => {
      for (let r = 0; r < queens.length; r++) {
        const qc = queens[r]; if (qc === undefined) continue;
        if (r === rr && qc === cc) continue;
        if (qc === cc || r - qc === rr - cc || r + qc === rr + cc || r === rr) return true;
      }
      return false;
    };

    for (let r = 0; r < N; r++) {
      for (let cc = 0; cc < N; cc++) {
        const x = ox + cc * cell, y = oy + r * cell;
        const light = (r + cc) % 2 === 0;
        ctx.fillStyle = light ? 'rgba(148,163,184,0.10)' : 'rgba(148,163,184,0.22)';
        ctx.fillRect(x, y, cell, cell);
        if (queens[r] === undefined && attacked(r, cc)) {
          ctx.fillStyle = 'rgba(239,68,68,0.12)';
          ctx.fillRect(x, y, cell, cell);
        }
      }
    }

    // highlight the square under consideration
    if (f.row >= 0 && f.col >= 0) {
      const x = ox + f.col * cell, y = oy + f.row * cell;
      const col = f.action === 'prune' ? COLORS.red : f.action === 'backtrack' ? COLORS.sky : COLORS.idx;
      ctx.fillStyle = f.action === 'prune' ? 'rgba(239,68,68,0.28)' : 'rgba(79,70,229,0.22)';
      ctx.fillRect(x, y, cell, cell);
      ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.strokeRect(x + 1.5, y + 1.5, cell - 3, cell - 3);
    }

    // queens
    ctx.font = `${Math.round(cell * 0.62)}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let r = 0; r < queens.length; r++) {
      const qc = queens[r]; if (qc === undefined) continue;
      const cx = ox + qc * cell + cell / 2, cy = oy + r * cell + cell / 2;
      const justPlaced = f.action === 'place' && r === f.row;
      ctx.fillStyle = f.action === 'accept' ? COLORS.em : justPlaced ? COLORS.idx : '#334155';
      ctx.fillText('♛', cx, cy + 1);
    }

    // emerald frame on accept
    if (f.action === 'accept') {
      ctx.strokeStyle = COLORS.em; ctx.lineWidth = 4;
      ctx.strokeRect(ox + 2, oy + 2, N * cell - 4, N * cell - 4);
    }

    // board border
    ctx.strokeStyle = 'rgba(148,163,184,0.5)'; ctx.lineWidth = 1.5;
    ctx.strokeRect(ox, oy, N * cell, N * cell);
  };

  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const resize = () => {
      const parent = c.parentElement!; const N = traceRef.current.n;
      const w = Math.min(parent.clientWidth, 440);
      const cell = Math.floor((w - 4) / N);
      const side = cell * N + 4;
      const dpr = window.devicePixelRatio || 1;
      c.width = side * dpr; c.height = side * dpr; c.style.width = `${side}px`; c.style.height = `${side}px`;
      const ctx = c.getContext('2d'); if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { cell, ox: 2, oy: 2 };
      draw();
    };
    resizeRef.current = resize; resize();
    window.addEventListener('resize', resize);
    return () => { window.removeEventListener('resize', resize); if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { resizeRef.current(); }, [trace]);
  useEffect(draw, [idx, trace]);

  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 620 / speed;
    const tick = (t: number) => {
      if (!lastRef.current) lastRef.current = t;
      if (t - lastRef.current >= interval) {
        lastRef.current = t;
        const next = idxRef.current + 1;
        if (next > last) { setIdx(last); setPlaying(false); return; }
        setIdx(next);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
  }, [playing, speed, last]);

  const reset = () => { setPlaying(false); setIdx(0); lastRef.current = 0; };
  const stepF = () => { setPlaying(false); setIdx((v) => Math.min(last, v + 1)); };
  const stepB = () => { setPlaying(false); setIdx((v) => Math.max(0, v - 1)); };
  const play = () => { if (idx >= last) setIdx(0); lastRef.current = 0; setPlaying((p) => !p); };
  const changeN = (nn: number) => { setN(nn); setIdx(0); setPlaying(false); };

  const f = trace.frames[Math.min(idx, last)];
  const foundSoFar = trace.frames.slice(0, idx + 1).filter((x) => x.action === 'accept').length;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-3">
        <label class="flex items-center gap-2 text-sm text-muted">board N = {n}
          <input type="range" min={4} max={7} value={n} onInput={(e) => changeN(parseInt((e.target as HTMLInputElement).value, 10))} class="w-32 accent-[#4f46e5]" />
        </label>
        <span class="ml-auto text-xs text-muted">total solutions: <strong class="text-text">{trace.solutions}</strong></span>
      </div>

      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <div><canvas ref={canvasRef} class="touch-none rounded-xl" /></div>
        <div class="space-y-3">
          <p class="min-h-[3rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">{f.caption}</p>
          <div class="grid grid-cols-2 gap-2 text-sm">
            <div class="rounded-lg bg-surface-2 px-3 py-2"><span class="text-xs text-muted">solutions found so far</span><div class="font-mono font-semibold">{foundSoFar}</div></div>
            <div class="rounded-lg bg-surface-2 px-3 py-2"><span class="text-xs text-muted">step</span><div class="font-mono font-semibold">{Math.min(idx, last) + 1}/{last + 1}</div></div>
          </div>
          <div class="flex flex-wrap gap-3 text-xs text-muted">
            <span><span class="mr-1 inline-block h-3 w-3 rounded-sm align-middle" style="background:#4f46e5" />safe placement</span>
            <span><span class="mr-1 inline-block h-3 w-3 rounded-sm align-middle" style="background:#ef4444" />attacked (prune)</span>
            <span><span class="mr-1 inline-block h-3 w-3 rounded-sm align-middle" style="background:#10b981" />solved board</span>
          </div>
        </div>
      </div>

      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={stepB} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏮ Back</button>
        <button onClick={play} class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90">{playing ? '⏸ Pause' : '▶ Play'}</button>
        <button onClick={stepF} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏭ Step</button>
        <button onClick={reset} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">↺ Reset</button>
        <label class="ml-auto flex items-center gap-2 text-xs text-muted">speed
          <input type="range" min={0.5} max={3} step={0.5} value={speed} onInput={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))} class="w-24 accent-[#4f46e5]" />
        </label>
      </div>
      <p class="mt-2 text-center text-xs text-muted">N = 4 has 2 solutions; N = 6 has 4; N = 7 has 40. Larger boards mean a much bigger search.</p>
    </div>
  );
}
