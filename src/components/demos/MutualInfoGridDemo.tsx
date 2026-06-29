import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Mutual-information explorer over a joint distribution grid.
   - A 4x4 grid is the joint p(x, y). Paint mass by clicking/dragging.
   - A "dependence" slider blends between an independent table (rank-1
     product of the current marginals) and a diagonal (perfectly
     dependent) table built from the same marginals.
   - Live readouts: H(X), H(Y), H(X,Y) and I(X;Y) = H(X)+H(Y)-H(X,Y).
   Canvas conventions copied from VectorPlayground.
   ------------------------------------------------------------------ */

const N = 4;
const COLORS = {
  hi: '#4f46e5',
  grid: 'rgba(128,128,128,0.35)',
  text: 'rgba(128,128,128,0.95)',
};

function uniformGrid() {
  return Array.from({ length: N * N }, () => 1 / (N * N));
}

export default function MutualInfoGridDemo() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // base "painted" joint (unnormalized weights)
  const [weights, setWeights] = useState<number[]>(() => uniformGrid());
  const [dep, setDep] = useState(0); // 0 = as painted (independent baseline), 1 = forced diagonal
  const paintingRef = useRef(false);
  const sizeRef = useRef({ w: 360, h: 360, pad: 30 });

  const idx = (r: number, c: number) => r * N + c;

  // normalized painted joint
  const totalW = weights.reduce((s, v) => s + v, 0) || 1;
  const painted = weights.map((v) => v / totalW);

  // marginals of the painted joint
  const px: number[] = Array(N).fill(0);
  const py: number[] = Array(N).fill(0);
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++) {
      px[c] += painted[idx(r, c)]; // x = column
      py[r] += painted[idx(r, c)]; // y = row
    }

  // independent table from marginals: p(x)p(y)
  const indep = Array.from({ length: N * N }, (_, k) => {
    const r = Math.floor(k / N), c = k % N;
    return px[c] * py[r];
  });
  // diagonal (dependent) table: put each x-column's mass on the matched row
  const diag = Array.from({ length: N * N }, (_, k) => {
    const r = Math.floor(k / N), c = k % N;
    return r === c ? px[c] : 0;
  });
  // blended joint shown & measured
  const joint = indep.map((v, k) => (1 - dep) * v + dep * diag[k]);
  const jTotal = joint.reduce((s, v) => s + v, 0) || 1;
  const J = joint.map((v) => v / jTotal);

  // recompute marginals of blend (diag may differ if marginals unequal)
  const mx: number[] = Array(N).fill(0);
  const my: number[] = Array(N).fill(0);
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++) {
      mx[c] += J[idx(r, c)];
      my[r] += J[idx(r, c)];
    }

  const Hlist = (arr: number[]) =>
    arr.reduce((s, p) => (p > 1e-9 ? s - p * Math.log2(p) : s), 0);
  const HX = Hlist(mx);
  const HY = Hlist(my);
  const HXY = Hlist(J);
  const MI = Math.max(0, HX + HY - HXY);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h, pad } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);
    const size = Math.min(w, h) - pad * 1.4;
    const x0 = pad;
    const y0 = pad * 0.4;
    const cell = size / N;
    const maxP = Math.max(...J, 1e-9);

    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const v = J[idx(r, c)];
        const t = v / maxP;
        const x = x0 + c * cell;
        const y = y0 + r * cell;
        // intensity fill
        ctx.fillStyle = `rgba(79,70,229,${0.08 + 0.9 * t})`;
        ctx.fillRect(x, y, cell, cell);
        ctx.strokeStyle = COLORS.grid;
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, cell, cell);
        if (v > 0.012) {
          ctx.fillStyle = t > 0.45 ? '#fff' : COLORS.text;
          ctx.font = '600 11px Inter, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(v.toFixed(2), x + cell / 2, y + cell / 2);
        }
      }
    }

    // axis labels
    ctx.fillStyle = COLORS.text;
    ctx.font = '600 12px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('X  (columns) →', x0 + size / 2, y0 + size + 6);
    ctx.save();
    ctx.translate(x0 - 16, y0 + size / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Y  (rows) →', 0, 0);
    ctx.restore();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 380);
      const h = w;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w, h, pad: 30 };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(draw, [weights, dep]);

  // ---- painting (only meaningful at dep = 0, edits the marginals) ----
  const cellAt = (e: PointerEvent): number | null => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const { w, h, pad } = sizeRef.current;
    const size = Math.min(w, h) - pad * 1.4;
    const x0 = pad, y0 = pad * 0.4, cell = size / N;
    const px = e.clientX - rect.left - x0;
    const py = e.clientY - rect.top - y0;
    if (px < 0 || py < 0 || px > size || py > size) return null;
    const c = Math.floor(px / cell), r = Math.floor(py / cell);
    return idx(r, c);
  };
  const addMass = (e: PointerEvent) => {
    const k = cellAt(e);
    if (k === null) return;
    setWeights((w) => w.map((v, i) => (i === k ? v + 0.25 : v)));
  };
  const onDown = (e: PointerEvent) => {
    paintingRef.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    addMass(e);
    e.preventDefault();
  };
  const onMove = (e: PointerEvent) => {
    if (paintingRef.current) addMass(e);
  };
  const onUp = () => { paintingRef.current = false; };

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap gap-2">
        <button
          onClick={() => setWeights(uniformGrid())}
          class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted transition hover:text-text"
        >
          reset marginals
        </button>
        <button
          onClick={() => { setWeights([3, 1, 1, 1, 1, 4, 1, 1, 1, 1, 2, 1, 1, 1, 1, 3]); }}
          class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted transition hover:text-text"
        >
          skewed marginals
        </button>
      </div>

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
            Click cells to shape the marginals. Then drag the <strong>dependence</strong> slider to
            move from independent (mass = p(x)·p(y)) to fully dependent (mass on the diagonal).
          </p>

          <label class="block">
            <span class="mb-1 block text-muted">dependence = {dep.toFixed(2)}</span>
            <input
              type="range" min={0} max={1} step={0.01} value={dep}
              onInput={(e) => setDep(parseFloat((e.target as HTMLInputElement).value))}
              class="w-full accent-[#4f46e5]"
            />
          </label>

          <div class="space-y-2">
            <Readout label="H(X)" value={`${HX.toFixed(3)} bits`} />
            <Readout label="H(Y)" value={`${HY.toFixed(3)} bits`} />
            <Readout label="H(X,Y)" value={`${HXY.toFixed(3)} bits`} />
            <Readout label="I(X;Y) mutual info" value={`${MI.toFixed(3)} bits`} color={COLORS.hi} />
          </div>

          <p class="text-xs text-muted">
            {MI < 0.02
              ? 'Independent: the joint factorizes, H(X,Y) = H(X) + H(Y), so I(X;Y) ≈ 0 — X says nothing about Y.'
              : 'Dependent: knowing X cuts the uncertainty about Y. I(X;Y) is exactly how many bits are shared.'}
          </p>
        </div>
      </div>
    </div>
  );
}

function Readout({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div class="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2">
      <span class="text-muted">{label}</span>
      <strong class="font-mono" style={color ? `color:${color}` : ''}>{value}</strong>
    </div>
  );
}
