import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Convolution lab — slide a 3×3 kernel over an image and build a
   feature map. The same kernel (shared weights) is dragged across
   every position; pick an edge detector to see edges light up.
   ------------------------------------------------------------------ */

const COLORS = { brand: '#4f46e5', sky: '#0ea5e9', emerald: '#10b981', warn: '#ef4444' };

const N = 14;          // input grid size
const OUT = N - 2;     // valid-convolution output size

// build an input "image": a bright square + a diagonal stripe
const IMG: number[][] = (() => {
  const g = Array.from({ length: N }, () => new Array(N).fill(0.1));
  for (let r = 3; r < 10; r++) for (let c = 3; c < 10; c++) g[r][c] = 0.9;
  for (let r = 0; r < N; r++) { const c = N - 1 - r; if (c >= 0 && c < N) g[r][c] = Math.max(g[r][c], 0.7); }
  return g;
})();

type KName = 'edgeV' | 'edgeH' | 'blur' | 'sharpen' | 'identity';
const KERNELS: Record<KName, { label: string; k: number[][] }> = {
  edgeV:    { label: 'Edge ↕ (vert.)', k: [[1, 0, -1], [2, 0, -2], [1, 0, -1]] },
  edgeH:    { label: 'Edge ↔ (horiz.)', k: [[1, 2, 1], [0, 0, 0], [-1, -2, -1]] },
  sharpen:  { label: 'Sharpen', k: [[0, -1, 0], [-1, 5, -1], [0, -1, 0]] },
  blur:     { label: 'Blur', k: [[1, 1, 1], [1, 1, 1], [1, 1, 1]].map((r) => r.map((v) => v / 9)) },
  identity: { label: 'Identity', k: [[0, 0, 0], [0, 1, 0], [0, 0, 0]] },
};

export default function ConvKernelSlideLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [kname, setKname] = useState<KName>('edgeV');
  const [pos, setPos] = useState(0);            // 0 .. OUT*OUT-1, top-left of window
  const [playing, setPlaying] = useState(true);
  const rafRef = useRef<number | null>(null);
  const tickRef = useRef(0);
  const sizeRef = useRef({ w: 480, h: 280, cell: 16 });

  const kern = KERNELS[kname].k;
  const oc = pos % OUT, or = Math.floor(pos / OUT); // current output cell row/col

  // full feature map
  const fmap: number[][] = [];
  for (let r = 0; r < OUT; r++) {
    fmap[r] = [];
    for (let c = 0; c < OUT; c++) {
      let acc = 0;
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) acc += IMG[r + i][c + j] * kern[i][j];
      fmap[r][c] = acc;
    }
  }
  const curVal = fmap[or][oc];

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);

    const gap = 18;
    const cell = Math.min((w - gap) / (N + OUT), (h - 16) / N);
    const inX = 0, inY = (h - cell * N) / 2;
    const outX = cell * N + gap, outY = (h - cell * OUT) / 2;

    // input grid
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const g = Math.round(IMG[r][c] * 255);
      ctx.fillStyle = `rgb(${g},${g},${g})`;
      ctx.fillRect(inX + c * cell, inY + r * cell, cell - 1, cell - 1);
    }
    // sliding window highlight (3×3 at or,oc)
    ctx.strokeStyle = COLORS.brand; ctx.lineWidth = 2.5;
    ctx.strokeRect(inX + oc * cell - 1, inY + or * cell - 1, cell * 3, cell * 3);

    // output feature map (normalized for display)
    let lo = Infinity, hi = -Infinity;
    for (let r = 0; r < OUT; r++) for (let c = 0; c < OUT; c++) { lo = Math.min(lo, fmap[r][c]); hi = Math.max(hi, fmap[r][c]); }
    const span = hi - lo || 1;
    for (let r = 0; r < OUT; r++) for (let c = 0; c < OUT; c++) {
      const t = (fmap[r][c] - lo) / span;
      const g = Math.round(t * 255);
      ctx.fillStyle = (r < or || (r === or && c <= oc)) ? `rgb(${g},${g},${g})` : 'rgba(128,128,128,0.12)';
      ctx.fillRect(outX + c * cell, outY + r * cell, cell - 1, cell - 1);
    }
    // current output cell
    ctx.strokeStyle = COLORS.emerald; ctx.lineWidth = 2.5;
    ctx.strokeRect(outX + oc * cell - 1, outY + or * cell - 1, cell, cell);

    ctx.fillStyle = 'rgba(128,128,128,0.95)'; ctx.font = '600 12px Inter, sans-serif';
    ctx.fillText('input image', inX, inY - 6);
    ctx.fillText('feature map', outX, outY - 6);
  };

  // animation loop
  useEffect(() => {
    const loop = () => {
      tickRef.current++;
      if (playing && tickRef.current % 12 === 0) setPos((p) => (p + 1) % (OUT * OUT));
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [playing]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const wv = Math.min(parent.clientWidth, 560);
      const hv = Math.round(wv * 0.58);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = wv * dpr; canvas.height = hv * dpr;
      canvas.style.width = `${wv}px`; canvas.style.height = `${hv}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w: wv, h: hv, cell: 16 };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(draw, [kname, pos]);

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap gap-2">
        {(Object.keys(KERNELS) as KName[]).map((k) => (
          <button key={k} onClick={() => setKname(k)}
            class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              kname === k ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
            }`}>{KERNELS[k].label}</button>
        ))}
      </div>

      <div class="grid gap-4 md:grid-cols-[1fr,auto] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

        <div class="space-y-3 text-sm md:w-48">
          <div class="flex gap-2">
            <button onClick={() => setPlaying((p) => !p)}
              class="flex-1 rounded-lg bg-brand px-3 py-1.5 font-semibold text-white">{playing ? 'Pause' : 'Play'}</button>
            <button onClick={() => { setPlaying(false); setPos((p) => (p + 1) % (OUT * OUT)); }}
              class="flex-1 rounded-lg bg-surface-2 px-3 py-1.5 font-semibold text-muted hover:text-text">Step</button>
          </div>
          <div class="rounded-lg bg-surface-2 p-3">
            <span class="text-muted">kernel (shared weights)</span>
            <div class="mt-1 grid grid-cols-3 gap-1 font-mono text-xs">
              {kern.flat().map((v, i) => (
                <span key={i} class="rounded bg-surface px-1 py-0.5 text-center">{(+v.toFixed(2))}</span>
              ))}
            </div>
          </div>
          <Readout label="output cell" value={`(${or}, ${oc})`} />
          <Readout label="conv value" value={curVal.toFixed(2)} />
          <p class="text-xs text-muted">The window dot-products the kernel with the patch underneath — one number per position.</p>
        </div>
      </div>
    </div>
  );
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div class="rounded-lg bg-surface-2 px-3 py-2">
      <span class="text-muted">{label}</span>
      <div class="font-mono font-semibold">{value}</div>
    </div>
  );
}
