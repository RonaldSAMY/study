import { useEffect, useMemo, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Feature Pyramid Network (FPN) top-down fusion, animated.
   Backbone laterals L3 (4x4), L4 (2x2), L5 (1x1) sit on the left.
   Step the top-down pathway on the right:
     P5 = L5;  P4 = L4 + Upsample(P5);  P3 = L3 + Upsample(P4).
   Deep semantics (the value you set at L5) flow DOWN into every scale.
   Reference: /dsa/32-computer-vision/02-backbones-necks/feature-pyramid.ts
   ------------------------------------------------------------------ */

type Grid = number[][];

const upsample2 = (g: Grid): Grid => {
  const h = g.length;
  const w = g[0].length;
  const out: Grid = Array.from({ length: h * 2 }, () => Array(w * 2).fill(0));
  for (let i = 0; i < h * 2; i++)
    for (let j = 0; j < w * 2; j++) out[i][j] = g[Math.floor(i / 2)][Math.floor(j / 2)];
  return out;
};
const add = (a: Grid, b: Grid): Grid => a.map((row, i) => row.map((v, j) => v + b[i][j]));

const L4: Grid = [
  [2, 4],
  [6, 8],
];
const L3: Grid = [
  [1, 1, 2, 2],
  [1, 1, 2, 2],
  [3, 3, 4, 4],
  [3, 3, 4, 4],
];

const STEP_CAPTIONS = [
  'Backbone laterals: L5 is deep & semantic (1×1), L3 is shallow & high-res (4×4). Set L5 below.',
  'P5 = L5. The top of the pyramid is just the deepest lateral — nothing to fuse yet.',
  'Upsample P5 ×2 (nearest-neighbor) so its size matches L4 before the add.',
  'P4 = L4 + Upsample(P5): deep semantics are now summed into the higher-res level.',
  'Upsample P4 ×2 to reach L3’s resolution.',
  'P3 = L3 + Upsample(P4): every pyramid level now carries deep meaning AND fine detail.',
  'Done. One backbone pass feeds a head that sees objects at every scale — big and small.',
];

export default function CvFeaturePyramid() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ scale: 1 });
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);

  const [deep, setDeep] = useState(10);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  idxRef.current = idx;

  const maps = useMemo(() => {
    const L5: Grid = [[deep]];
    const P5 = L5;
    const upP5 = upsample2(P5);
    const P4 = add(L4, upP5);
    const upP4 = upsample2(P4);
    const P3 = add(L3, upP4);
    return { L5, P5, upP5, P4, upP4, P3 };
  }, [deep]);

  const nFrames = STEP_CAPTIONS.length;

  useEffect(() => {
    if (!playing) {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      return;
    }
    const interval = 1100 / speed;
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

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { scale } = sizeRef.current;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const S = (v: number) => v * scale;

    const vmax = Math.max(deep + 8, 18);
    const heat = (v: number) => {
      const t = Math.max(0, Math.min(1, v / vmax));
      const r = Math.round(238 - t * (238 - 79));
      const g = Math.round(240 - t * (240 - 70));
      const b = Math.round(247 - t * (247 - 229));
      return `rgb(${r},${g},${b})`;
    };

    const drawGrid = (g: Grid, x: number, y: number, unit: number, label: string, active: boolean) => {
      const rows = g.length;
      const cols = g[0].length;
      if (active) {
        ctx.strokeStyle = '#4f46e5';
        ctx.lineWidth = 3;
        ctx.strokeRect(S(x - 4), S(y - 4), S(cols * unit + 8), S(rows * unit + 8));
      }
      for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
          ctx.fillStyle = heat(g[i][j]);
          ctx.fillRect(S(x + j * unit), S(y + i * unit), S(unit) - 1, S(unit) - 1);
          ctx.fillStyle = g[i][j] > vmax * 0.55 ? '#fff' : '#334155';
          ctx.font = `${Math.round(S(unit * 0.42))}px system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`${g[i][j]}`, S(x + j * unit + unit / 2), S(y + i * unit + unit / 2));
        }
      }
      ctx.fillStyle = '#64748b';
      ctx.font = `${Math.round(S(12))}px system-ui, sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(label, S(x), S(y - 8));
    };

    // Left column: static backbone laterals.
    ctx.fillStyle = '#94a3b8';
    ctx.font = `${Math.round(S(12))}px system-ui, sans-serif`;
    ctx.fillText('backbone laterals', S(14), S(14));
    drawGrid(maps.L5, 40, 34, 22, 'L5', false);
    drawGrid(L4, 24, 84, 22, 'L4', false);
    drawGrid(L3, 14, 150, 22, 'L3', false);

    // Right column: pyramid, revealed progressively.
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('top-down pyramid', S(300), S(14));
    if (idx >= 1) drawGrid(maps.P5, 330, 34, 22, 'P5', idx === 1);
    if (idx === 2) drawGrid(maps.upP5, 300, 34, 22, 'Up(P5)', true);
    if (idx >= 3) drawGrid(maps.P4, 300, 84, 22, 'P4', idx === 3);
    if (idx === 4) drawGrid(maps.upP4, 300, 150, 22, 'Up(P4)', true);
    if (idx >= 5) drawGrid(maps.P3, 300, 150, 22, 'P3', idx === 5);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const VW = 480;
    const VH = 260;
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

  useEffect(draw, [maps, idx, deep]);

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

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

      <label class="mt-3 flex items-center gap-2 text-xs text-muted">
        deep semantic value at L5 = <span class="font-mono text-text">{deep}</span>
        <input
          type="range"
          min={2}
          max={16}
          step={1}
          value={deep}
          onInput={(e) => {
            setDeep(parseInt((e.target as HTMLInputElement).value, 10));
          }}
          class="flex-1 accent-[#4f46e5]"
        />
      </label>

      <p class="mt-3 min-h-[2.5rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">
        {STEP_CAPTIONS[idx]}
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
        Raise L5 and step to P3: the big deep number is copied down into all 16 cells — that is semantics reaching the high-res level.
      </p>
    </div>
  );
}
