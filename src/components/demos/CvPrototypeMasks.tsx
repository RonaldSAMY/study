import { useEffect, useMemo, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Prototype-mask instance segmentation (YOLACT / YOLO-seg), animated.
   - The network predicts k image-wide prototype masks ONCE.
   - Per object it predicts coefficients c1..c3 (edit them below).
   - The instance mask assembles as  mask = σ( Σ cᵢ · protoᵢ ), then is
     thresholded at 0.5 and cropped by the detection box.
   Reference: /dsa/32-computer-vision/05-segmentation-pose/instance-segmentation.ts
   ------------------------------------------------------------------ */

const G = 10; // grid side

type Grid = number[][];
const zeros = (): Grid => Array.from({ length: G }, () => Array(G).fill(0));

// three fixed prototype basis masks
const PROTOS: Grid[] = (() => {
  const p1 = zeros(); // vertical stripe
  const p2 = zeros(); // horizontal stripe
  const p3 = zeros(); // central blob
  for (let i = 0; i < G; i++) {
    for (let j = 0; j < G; j++) {
      p1[i][j] = j >= 4 && j <= 5 ? 1 : -0.35;
      p2[i][j] = i >= 4 && i <= 5 ? 1 : -0.35;
      const d = Math.hypot(i - 4.5, j - 4.5);
      p3[i][j] = 1 - d / 3.2;
    }
  }
  return [p1, p2, p3];
})();

// detection box (crop region): rows 1..8, cols 1..8
const BOX = { r0: 1, r1: 8, c0: 1, c1: 8 };
const sigmoid = (x: number): number => 1 / (1 + Math.exp(-x));

const CAPTIONS = [
  'Prototype 1: a vertical stripe basis mask, shared by every object in the image.',
  'Prototype 2: a horizontal stripe basis mask.',
  'Prototype 3: a central blob basis mask.',
  'Start the sum: c₁ · prototype 1.',
  'Add c₂ · prototype 2 to the running total.',
  'Add c₃ · prototype 3 — this is the raw mask logit Σ cᵢ·protoᵢ.',
  'Apply the sigmoid σ per pixel: logits become soft mask probabilities in (0, 1).',
  'Threshold at 0.5 and crop by the detection box → the final per-object mask.',
];

export default function CvPrototypeMasks() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ scale: 1 });
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);

  const [coeffs, setCoeffs] = useState<number[]>([1.5, -1, 1]);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  idxRef.current = idx;

  const stages = useMemo(() => {
    const [c1, c2, c3] = coeffs;
    const s3 = zeros();
    const s4 = zeros();
    const logit = zeros();
    const soft = zeros();
    const binary = zeros();
    for (let i = 0; i < G; i++) {
      for (let j = 0; j < G; j++) {
        s3[i][j] = c1 * PROTOS[0][i][j];
        s4[i][j] = s3[i][j] + c2 * PROTOS[1][i][j];
        logit[i][j] = s4[i][j] + c3 * PROTOS[2][i][j];
        soft[i][j] = sigmoid(logit[i][j]);
        const inBox = i >= BOX.r0 && i <= BOX.r1 && j >= BOX.c0 && j <= BOX.c1;
        binary[i][j] = soft[i][j] >= 0.5 && inBox ? 1 : 0;
      }
    }
    return [PROTOS[0], PROTOS[1], PROTOS[2], s3, s4, logit, soft, binary];
  }, [coeffs]);

  const modes: ('signed' | 'prob' | 'binary')[] = [
    'signed', 'signed', 'signed', 'signed', 'signed', 'signed', 'prob', 'binary',
  ];
  const nFrames = CAPTIONS.length;

  useEffect(() => {
    if (!playing) {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      return;
    }
    const interval = 1000 / speed;
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

    const mode = modes[idx];
    const field = stages[idx];

    const color = (v: number): string => {
      if (mode === 'binary') return v >= 0.5 ? '#10b981' : 'rgba(120,130,150,0.12)';
      if (mode === 'prob') {
        const t = Math.max(0, Math.min(1, v));
        return `rgba(16,185,129,${0.12 + t * 0.85})`;
      }
      // signed: sky (neg) → surface (0) → indigo (pos)
      const t = Math.max(-2, Math.min(2, v)) / 2;
      if (t >= 0) return `rgba(79,70,229,${0.1 + t * 0.85})`;
      return `rgba(14,165,233,${0.1 + -t * 0.85})`;
    };

    const unit = 26;
    const ox = 12;
    const oy = 14;
    for (let i = 0; i < G; i++) {
      for (let j = 0; j < G; j++) {
        ctx.fillStyle = color(field[i][j]);
        ctx.fillRect(S(ox + j * unit), S(oy + i * unit), S(unit) - 1, S(unit) - 1);
      }
    }
    // box outline on the final crop frame
    if (idx === nFrames - 1) {
      ctx.strokeStyle = '#0ea5e9';
      ctx.lineWidth = 3;
      ctx.strokeRect(S(ox + BOX.c0 * unit), S(oy + BOX.r0 * unit), S((BOX.c1 - BOX.c0 + 1) * unit), S((BOX.r1 - BOX.r0 + 1) * unit));
    }

    // thumbnails of the three prototypes with coeffs
    const tUnit = 9;
    const tx = ox + G * unit + 22;
    ['proto 1', 'proto 2', 'proto 3'].forEach((name, p) => {
      const ty = oy + p * (G * tUnit + 26);
      const active = (idx <= 2 && idx === p) || (idx === 3 && p === 0) || (idx === 4 && p === 1) || (idx === 5 && p === 2);
      if (active) {
        ctx.strokeStyle = '#4f46e5';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(S(tx - 3), S(ty - 3), S(G * tUnit + 6), S(G * tUnit + 6));
      }
      for (let i = 0; i < G; i++)
        for (let j = 0; j < G; j++) {
          const v = PROTOS[p][i][j];
          const t = Math.max(-1, Math.min(1, v));
          ctx.fillStyle = t >= 0 ? `rgba(79,70,229,${0.15 + t * 0.7})` : `rgba(14,165,233,${0.15 + -t * 0.7})`;
          ctx.fillRect(S(tx + j * tUnit), S(ty + i * tUnit), S(tUnit) - 0.5, S(tUnit) - 0.5);
        }
      ctx.fillStyle = '#64748b';
      ctx.font = `${Math.round(S(11))}px system-ui, sans-serif`;
      ctx.fillText(`${name}  c=${coeffs[p].toFixed(1)}`, S(tx), S(ty + G * tUnit + 14));
    });
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const VW = 400;
    const VH = 290;
    const resize = () => {
      const parent = canvas.parentElement!;
      const cssW = Math.min(parent.clientWidth, 540);
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

  useEffect(draw, [stages, idx, coeffs]);

  const setCoeff = (k: number, v: number) => {
    setCoeffs((prev) => {
      const next = prev.slice();
      next[k] = v;
      return next;
    });
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

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

      <div class="mt-3 grid gap-2 sm:grid-cols-3">
        {[0, 1, 2].map((k) => (
          <label key={k} class="flex items-center gap-2 text-xs text-muted">
            c{k + 1} = <span class="w-9 font-mono text-text">{coeffs[k].toFixed(1)}</span>
            <input
              type="range"
              min={-2}
              max={2}
              step={0.5}
              value={coeffs[k]}
              onInput={(e) => setCoeff(k, parseFloat((e.target as HTMLInputElement).value))}
              class="flex-1 accent-[#4f46e5]"
            />
          </label>
        ))}
      </div>

      <p class="mt-3 min-h-[2.5rem] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">{CAPTIONS[idx]}</p>

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
        A few shared bases + three numbers per object = any mask shape. That one matmul is why prototype masks run in real time.
      </p>
    </div>
  );
}
