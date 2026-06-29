import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Pascal's Triangle explorer.
   - Pick a row n; that row is highlighted and read out as the
     coefficients of (a + b)^n.
   - Tap any cell to see it light up with the two numbers above it
     that add to make it (the build rule of the triangle).
   ------------------------------------------------------------------ */

const COLORS = {
  brand: '#4f46e5',
  sky: '#0ea5e9',
  emerald: '#10b981',
  muted: 'rgba(128,128,128,0.85)',
};

function buildTriangle(rows: number): number[][] {
  const tri: number[][] = [];
  for (let i = 0; i <= rows; i++) {
    const row: number[] = [1];
    for (let j = 1; j <= i; j++) {
      row.push(tri[i - 1][j - 1] + tri[i - 1][j]);
    }
    tri.push(row);
  }
  return tri;
}

export default function PascalTriangleExplorer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 480, h: 360, cell: 34 });
  const cellsRef = useRef<{ x: number; y: number; i: number; j: number; rad: number }[]>([]);
  const ROWS = 8;
  const [selRow, setSelRow] = useState(4);
  const [sel, setSel] = useState<{ i: number; j: number } | null>(null);

  const tri = buildTriangle(ROWS);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h, cell } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);
    cellsRef.current = [];

    const rad = Math.min(cell * 0.42, 18);
    const topY = rad + 6;
    const rowH = cell;

    for (let i = 0; i <= ROWS; i++) {
      const rowWidth = i * cell;
      const startX = w / 2 - rowWidth / 2;
      const y = topY + i * rowH;
      for (let j = 0; j <= i; j++) {
        const x = startX + j * cell;
        cellsRef.current.push({ x, y, i, j, rad });

        const inSelRow = i === selRow;
        const isSel = sel && sel.i === i && sel.j === j;
        const isParent =
          sel && sel.i === i + 1 && (j === sel.j - 1 || j === sel.j) && i === sel.i - 1;

        let fill = 'rgba(128,128,128,0.10)';
        let textColor = COLORS.muted;
        if (isSel) {
          fill = COLORS.brand;
          textColor = '#fff';
        } else if (isParent) {
          fill = COLORS.emerald;
          textColor = '#fff';
        } else if (inSelRow) {
          fill = 'rgba(79,70,229,0.18)';
          textColor = COLORS.brand;
        }

        ctx.beginPath();
        ctx.arc(x, y, rad, 0, Math.PI * 2);
        ctx.fillStyle = fill;
        ctx.fill();

        ctx.fillStyle = textColor;
        ctx.font = `600 ${Math.round(rad * 0.85)}px Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${tri[i][j]}`, x, y + 0.5);
      }
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 520);
      const cell = Math.max(30, Math.min(46, w / (ROWS + 1.5)));
      const h = cell * (ROWS + 1) + 16;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w, h, cell };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(draw, [selRow, sel]);

  const onDown = (e: PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    let hit: { i: number; j: number } | null = null;
    for (const c of cellsRef.current) {
      if (Math.hypot(c.x - px, c.y - py) <= c.rad + 4) {
        hit = { i: c.i, j: c.j };
        break;
      }
    }
    if (hit) {
      setSel(hit);
      setSelRow(hit.i);
    }
  };

  // expansion string for the selected row
  const coeffs = tri[selRow];
  const terms = coeffs.map((c, k) => {
    const aPow = selRow - k;
    const bPow = k;
    const cpart = c === 1 ? '' : `${c}`;
    const apart = aPow === 0 ? '' : aPow === 1 ? 'a' : `a^${aPow}`;
    const bpart = bPow === 0 ? '' : bPow === 1 ? 'b' : `b^${bPow}`;
    const body = `${apart}${bpart}` || '1';
    return `${cpart}${body}`;
  });

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas
          ref={canvasRef}
          class="touch-none rounded-xl bg-surface-2"
          onPointerDown={onDown}
        />

        <div class="space-y-3 text-sm">
          <p class="text-muted">
            Slide to pick a row, or tap a number to see the two above it (green) that sum to it.
          </p>

          <label class="block">
            <span class="mb-1 block text-muted">Row n = {selRow}</span>
            <input
              type="range" min={0} max={ROWS} step={1} value={selRow}
              onInput={(e) => {
                setSelRow(parseInt((e.target as HTMLInputElement).value, 10));
                setSel(null);
              }}
              class="w-full accent-[#4f46e5]"
            />
          </label>

          <Readout label={`Row ${selRow} (the coefficients)`} value={coeffs.join('  ')} />
          <Readout label={`(a + b)^${selRow} =`} value={terms.join(' + ')} small />

          {sel && (
            <div class="rounded-lg bg-[#10b981]/10 p-3">
              {sel.i === 0 ? (
                <p class="text-xs text-muted">The apex is always 1 — the start of every row.</p>
              ) : sel.j === 0 || sel.j === sel.i ? (
                <p class="text-xs text-muted">
                  Edge cells are always <strong>1</strong> (only one way to choose all or none).
                </p>
              ) : (
                <p class="text-xs">
                  <strong class="text-[#10b981]">
                    {tri[sel.i - 1][sel.j - 1]} + {tri[sel.i - 1][sel.j]} = {tri[sel.i][sel.j]}
                  </strong>{' '}
                  — each cell is the sum of the two above it. This is C({sel.i}, {sel.j}).
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Readout({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div class="rounded-lg bg-brand-soft px-3 py-2">
      <span class="text-muted">{label}</span>
      <div class={`font-mono font-semibold text-brand ${small ? 'text-xs' : 'text-sm'}`}>{value}</div>
    </div>
  );
}
