import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Bitmask / Profile DP — tiling a grid column by column.
   - Choose grid size m x n. The demo lays one valid domino tiling
     cell by cell in column-major order, exactly the order broken-
     profile DP processes cells.
   - The "profile" is the bitmask of rows in the current column whose
     horizontal domino sticks OUT into the next column. It is shown
     live as an m-bit string and updates as cells fill.
   - The full count of tilings (over ALL profiles) is shown too.
   - Transport: Play / Pause / Step / Back / Reset + speed.
   ------------------------------------------------------------------ */

const COLORS = { h: '#0ea5e9', v: '#4f46e5', active: '#10b981', grid: 'rgba(128,128,128,0.30)' };

type Domino = { cells: [number, number][]; horizontal: boolean };

// find one tiling (column-major first-empty), or null
function tile(m: number, n: number): { owner: number[][]; dominoes: Domino[] } | null {
  if ((m * n) % 2 !== 0) return null;
  const owner: number[][] = Array.from({ length: m }, () => Array(n).fill(-1));
  const dominoes: Domino[] = [];
  const solve = (): boolean => {
    let er = -1, ec = -1;
    outer: for (let c = 0; c < n; c++) for (let r = 0; r < m; r++) if (owner[r][c] === -1) { er = r; ec = c; break outer; }
    if (er === -1) return true;
    // vertical
    if (er + 1 < m && owner[er + 1][ec] === -1) {
      const id = dominoes.length;
      owner[er][ec] = id; owner[er + 1][ec] = id;
      dominoes.push({ cells: [[er, ec], [er + 1, ec]], horizontal: false });
      if (solve()) return true;
      dominoes.pop(); owner[er][ec] = -1; owner[er + 1][ec] = -1;
    }
    // horizontal
    if (ec + 1 < n && owner[er][ec + 1] === -1) {
      const id = dominoes.length;
      owner[er][ec] = id; owner[er][ec + 1] = id;
      dominoes.push({ cells: [[er, ec], [er, ec + 1]], horizontal: true });
      if (solve()) return true;
      dominoes.pop(); owner[er][ec] = -1; owner[er][ec + 1] = -1;
    }
    return false;
  };
  return solve() ? { owner, dominoes } : null;
}

// total number of tilings via broken-profile DP
function countTilings(m: number, n: number): number {
  if (m > n) [m, n] = [n, m];
  let dp: number[] = Array(1 << m).fill(0);
  dp[0] = 1;
  for (let col = 0; col < n; col++) for (let row = 0; row < m; row++) {
    const next = Array(1 << m).fill(0);
    const bit = 1 << row;
    for (let p = 0; p < (1 << m); p++) {
      if (dp[p] === 0) continue;
      if (p & bit) next[p ^ bit] += dp[p];
      else {
        next[p | bit] += dp[p];
        if (row + 1 < m && !(p & (1 << (row + 1)))) next[p] += dp[p];
      }
    }
    dp = next;
  }
  return dp[0];
}

export default function DpOptProfileTiling() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ cell: 44, w: 360, h: 200 });
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);

  const [m, setM] = useState(3);
  const [n, setN] = useState(4);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1.5);
  idxRef.current = idx;

  const solved = (() => tile(m, n))();
  const order: [number, number][] = [];
  for (let c = 0; c < n; c++) for (let r = 0; r < m; r++) order.push([r, c]);
  const total = order.length;
  const totalTilings = countTilings(m, n);

  const cur = idx < total ? order[idx] : order[total - 1];
  const activeCol = cur ? cur[1] : 0;

  // which cells are filled at frame idx
  const filledIndex = idx; // cells 0..idx processed (inclusive)
  const isFilled = (r: number, c: number) => order.findIndex(([rr, cc]) => rr === r && cc === c) <= filledIndex;

  // profile of active column: rows whose horizontal domino's LEFT cell is in activeCol and processed
  const profileBits: number[] = [];
  if (solved) {
    for (let r = 0; r < m; r++) {
      const id = solved.owner[r][activeCol];
      let bit = 0;
      if (id >= 0) {
        const d = solved.dominoes[id];
        if (d.horizontal && d.cells[0][0] === r && d.cells[0][1] === activeCol && isFilled(r, activeCol)) bit = 1;
      }
      profileBits.push(bit);
    }
  }

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas || !solved) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { cell, w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);
    const ox = 8, oy = 8;
    for (let r = 0; r < m; r++) for (let c = 0; c < n; c++) {
      const x = ox + c * cell, y = oy + r * cell;
      ctx.fillStyle = 'rgba(128,128,128,0.05)';
      ctx.fillRect(x, y, cell, cell);
      ctx.strokeStyle = COLORS.grid; ctx.lineWidth = 1; ctx.strokeRect(x, y, cell, cell);
    }
    // dominoes (filled only)
    const seen = new Set<number>();
    for (let i = 0; i <= Math.min(idx, total - 1); i++) {
      const [r, c] = order[i];
      const id = solved.owner[r][c];
      if (id < 0 || seen.has(id)) continue;
      // only draw a domino once both its cells are reached
      const d = solved.dominoes[id];
      const allIn = d.cells.every(([dr, dc]) => order.findIndex(([rr, cc]) => rr === dr && cc === dc) <= idx);
      if (!allIn) continue;
      seen.add(id);
      const xs = d.cells.map(([dr, dc]) => ox + dc * cell);
      const ys = d.cells.map(([dr, dc]) => oy + dr * cell);
      const x0 = Math.min(...xs), y0 = Math.min(...ys);
      const wpx = d.horizontal ? 2 * cell : cell;
      const hpx = d.horizontal ? cell : 2 * cell;
      ctx.fillStyle = d.horizontal ? COLORS.h : COLORS.v;
      const pad = 4;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x0 + pad, y0 + pad, wpx - 2 * pad, hpx - 2 * pad, 7);
      else ctx.rect(x0 + pad, y0 + pad, wpx - 2 * pad, hpx - 2 * pad);
      ctx.fill();
    }
    // active column outline
    ctx.strokeStyle = COLORS.active; ctx.lineWidth = 3;
    ctx.strokeRect(ox + activeCol * cell + 1, oy + 1, cell - 2, m * cell - 2);
    // active cell
    if (cur) {
      ctx.strokeStyle = COLORS.active; ctx.lineWidth = 3;
      ctx.strokeRect(ox + cur[1] * cell + 2, oy + cur[0] * cell + 2, cell - 4, cell - 4);
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const avail = Math.min(parent.clientWidth, 520) - 16;
      const cell = Math.max(28, Math.min(54, Math.floor(avail / n)));
      const w = n * cell + 16, h = m * cell + 16;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr; canvas.height = h * dpr;
      canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { cell, w, h };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => { window.removeEventListener('resize', resize); if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m, n]);

  useEffect(draw, [idx, m, n]);

  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 700 / speed;
    const tick = (t: number) => {
      if (!lastRef.current) lastRef.current = t;
      if (t - lastRef.current >= interval) {
        lastRef.current = t;
        const next = idxRef.current + 1;
        if (next >= total) { setIdx(total - 1); setPlaying(false); return; }
        setIdx(next);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
  }, [playing, speed, total]);

  const reset = () => { setPlaying(false); setIdx(0); lastRef.current = 0; };
  const stepF = () => { setPlaying(false); setIdx((v) => Math.min(total - 1, v + 1)); };
  const stepB = () => { setPlaying(false); setIdx((v) => Math.max(0, v - 1)); };
  const play = () => { if (idx >= total - 1) setIdx(0); lastRef.current = 0; setPlaying((p) => !p); };

  const setDim = (which: 'm' | 'n', val: number) => {
    const v = Math.max(1, Math.min(which === 'm' ? 5 : 8, val));
    if (which === 'm') setM(v); else setN(v);
    setIdx(0); setPlaying(false);
  };

  const profStr = profileBits.slice().reverse().join('');

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-3">
        <label class="flex items-center gap-1.5 text-sm text-muted">rows m
          <input type="number" min={1} max={5} value={m} onInput={(e) => setDim('m', parseInt((e.target as HTMLInputElement).value, 10))} class="w-16 rounded-lg border border-border bg-surface-2 px-2 py-1 font-mono text-sm" />
        </label>
        <label class="flex items-center gap-1.5 text-sm text-muted">cols n
          <input type="number" min={1} max={8} value={n} onInput={(e) => setDim('n', parseInt((e.target as HTMLInputElement).value, 10))} class="w-16 rounded-lg border border-border bg-surface-2 px-2 py-1 font-mono text-sm" />
        </label>
      </div>

      {solved ? (
        <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
          <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />
          <div class="space-y-3 text-sm">
            <div>
              <div class="text-xs font-semibold uppercase tracking-wide text-muted">Profile of column {activeCol}</div>
              <div class="mt-1 flex gap-1 font-mono text-lg">
                {profileBits.slice().reverse().map((b, i) => (
                  <span key={i} class={`flex h-9 w-9 items-center justify-center rounded-md border ${b ? 'text-white' : 'bg-surface-2 text-muted'}`} style={b ? `background:${COLORS.h};border-color:${COLORS.h}` : 'border-color:rgba(128,128,128,0.3)'}>{b}</span>
                ))}
                <span class="ml-2 flex items-center text-muted">= {profStr || '0'.repeat(m)}</span>
              </div>
              <p class="mt-1 text-xs text-muted">bit r = 1 means row r holds a <span style={`color:${COLORS.h}`}>horizontal</span> domino sticking into column {activeCol + 1}.</p>
            </div>
            <div class="rounded-lg bg-surface-2 p-3 text-xs text-muted">
              <span style={`color:${COLORS.h}`}>■</span> horizontal (extends right) &nbsp; <span style={`color:${COLORS.v}`}>■</span> vertical (stays in column)
            </div>
            <div class="rounded-lg bg-brand-soft px-3 py-2 text-sm font-semibold text-text">
              Total tilings of {m}×{n} (all profiles): {totalTilings}
            </div>
          </div>
        </div>
      ) : (
        <p class="rounded-lg bg-surface-2 px-3 py-3 text-sm text-text">A {m}×{n} grid has an odd number of cells — no domino tiling exists. Change m or n so m·n is even.</p>
      )}

      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={stepB} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏮ Back</button>
        <button onClick={play} class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90">{playing ? '⏸ Pause' : '▶ Play'}</button>
        <button onClick={stepF} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏭ Step</button>
        <button onClick={reset} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">↺ Reset</button>
        <span class="ml-auto font-mono text-xs text-muted">cell {Math.min(idx + 1, total)}/{total}</span>
        <label class="flex items-center gap-2 text-xs text-muted">speed
          <input type="range" min={0.5} max={3} step={0.5} value={speed} onInput={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))} class="w-20 accent-[#4f46e5]" />
        </label>
      </div>
      <p class="mt-2 text-center text-xs text-muted">Cells fill column by column. The profile carries just enough state — the protruding cells — from one column to the next.</p>
    </div>
  );
}
