import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Interactive function transformation + composition lab.
   - Transform mode: pick a base f and slide a, b, h, k to build
       g(x) = a · f( b·(x − h) ) + k   (emerald, bold)
     while the untouched base f (grey dashed) stays for comparison.
   - Compose mode: pick an inner g and outer f and plot f(g(x)) (sky)
     to see how chaining functions stacks their effects.
   - Crisp, responsive canvas with grid + axes. Sliders drive redraw.
   ------------------------------------------------------------------ */

type Mode = 'transform' | 'compose';
type FnKey = 'sq' | 'sin' | 'abs' | 'sqrt';

const COLORS = {
  base: '#4f46e5',     // indigo  (base function)
  result: '#10b981',   // emerald (transformed)
  compose: '#0ea5e9',  // sky     (composition)
  grid: 'rgba(128,128,128,0.18)',
  axis: 'rgba(128,128,128,0.5)',
};

const FNS: Record<FnKey, { label: string; tex: string; f: (x: number) => number }> = {
  sq:   { label: 'x²',  tex: 'x^2',          f: (x) => x * x },
  sin:  { label: 'sin x', tex: '\\sin x',    f: (x) => Math.sin(x) },
  abs:  { label: '|x|', tex: '|x|',          f: (x) => Math.abs(x) },
  sqrt: { label: '√x',  tex: '\\sqrt{x}',    f: (x) => (x < 0 ? NaN : Math.sqrt(x)) },
};

export default function TransformComposerLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [mode, setMode] = useState<Mode>('transform');
  const [base, setBase] = useState<FnKey>('sq');
  const [a, setA] = useState(1);
  const [b, setB] = useState(1);
  const [h, setH] = useState(0);
  const [k, setK] = useState(0);

  const [outer, setOuter] = useState<FnKey>('sqrt');
  const [inner, setInner] = useState<FnKey>('sq');

  // viewport: math units shown on screen
  const sizeRef = useRef({ w: 480, h: 360, scale: 36, ox: 240, oy: 180 });

  const toPxX = (x: number) => sizeRef.current.ox + x * sizeRef.current.scale;
  const toPxY = (y: number) => sizeRef.current.oy - y * sizeRef.current.scale;
  const toMathX = (px: number) => (px - sizeRef.current.ox) / sizeRef.current.scale;

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h: H, scale, ox, oy } = sizeRef.current;
    ctx.clearRect(0, 0, w, H);

    // grid
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    for (let gx = ox % scale; gx < w; gx += scale) {
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke();
    }
    for (let gy = oy % scale; gy < H; gy += scale) {
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke();
    }
    // axes
    ctx.strokeStyle = COLORS.axis;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, oy); ctx.lineTo(w, oy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ox, 0); ctx.lineTo(ox, H); ctx.stroke();

    if (mode === 'transform') {
      const f = FNS[base].f;
      // base function: faint dashed indigo
      plot(ctx, (x) => f(x), toPxX, toPxY, toMathX, w, 'rgba(79,70,229,0.45)', 2, [6, 5]);
      // transformed g(x) = a·f(b·(x−h)) + k : bold emerald
      plot(ctx, (x) => a * f(b * (x - h)) + k, toPxX, toPxY, toMathX, w, COLORS.result, 3.5);
    } else {
      const fo = FNS[outer].f;
      const fi = FNS[inner].f;
      // inner g(x): faint dashed indigo
      plot(ctx, (x) => fi(x), toPxX, toPxY, toMathX, w, 'rgba(79,70,229,0.4)', 2, [6, 5]);
      // composition f(g(x)): bold sky
      plot(ctx, (x) => fo(fi(x)), toPxX, toPxY, toMathX, w, COLORS.compose, 3.5);
    }
  };

  // ---- responsive sizing with devicePixelRatio ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 560);
      const hh = Math.round(w * 0.72);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = hh * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${hh}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const scale = Math.max(22, Math.min(40, w / 13));
      sizeRef.current = { w, h: hh, scale, ox: w / 2, oy: hh / 2 };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // redraw whenever state changes
  useEffect(draw, [mode, base, a, b, h, k, outer, inner]);

  const reset = () => { setA(1); setB(1); setH(0); setK(0); };

  // live formula strings
  const aStr = a.toFixed(1);
  const bStr = b.toFixed(1);
  const hStr = h >= 0 ? `x − ${h.toFixed(1)}` : `x + ${Math.abs(h).toFixed(1)}`;
  const kStr = k >= 0 ? `+ ${k.toFixed(1)}` : `− ${Math.abs(k).toFixed(1)}`;
  const baseLabel = FNS[base].label;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      {/* mode toggle */}
      <div class="mb-3 flex flex-wrap gap-2">
        {(['transform', 'compose'] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              mode === m ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
            }`}
          >
            {m === 'transform' ? 'Transform g(x)' : 'Compose f∘g'}
          </button>
        ))}
      </div>

      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

        <div class="space-y-3 text-sm">
          {mode === 'transform' ? (
            <>
              <p class="text-muted">Pick a base function, then bend it with the sliders.</p>
              <div class="flex flex-wrap gap-2">
                {(Object.keys(FNS) as FnKey[]).map((key) => (
                  <button
                    key={key}
                    onClick={() => setBase(key)}
                    class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                      base === key ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
                    }`}
                  >
                    {FNS[key].label}
                  </button>
                ))}
              </div>

              <Slider label={`a (vertical stretch / flip) = ${aStr}`} min={-3} max={3} step={0.1} value={a} onChange={setA} />
              <Slider label={`b (horizontal stretch) = ${bStr}`} min={-3} max={3} step={0.1} value={b} onChange={setB} />
              <Slider label={`h (horizontal shift) = ${h.toFixed(1)}`} min={-4} max={4} step={0.1} value={h} onChange={setH} />
              <Slider label={`k (vertical shift) = ${k.toFixed(1)}`} min={-4} max={4} step={0.1} value={k} onChange={setK} />

              <div class="rounded-lg bg-surface-2 p-3">
                <div class="text-muted text-xs mb-1">live formula</div>
                <div class="font-mono font-semibold" style={`color:${COLORS.result}`}>
                  g(x) = {aStr}·f({bStr}({hStr})) {kStr}
                </div>
                <div class="mt-1 text-xs text-muted">
                  base f(x) = {baseLabel} (grey dashed)
                </div>
              </div>

              <button onClick={reset} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">
                Reset sliders
              </button>
            </>
          ) : (
            <>
              <p class="text-muted">Chain two functions: the inner runs first, then the outer.</p>
              <div>
                <div class="mb-1 text-muted text-xs">outer f</div>
                <div class="flex flex-wrap gap-2">
                  {(Object.keys(FNS) as FnKey[]).map((key) => (
                    <button
                      key={key}
                      onClick={() => setOuter(key)}
                      class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                        outer === key ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
                      }`}
                    >
                      {FNS[key].label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div class="mb-1 text-muted text-xs">inner g</div>
                <div class="flex flex-wrap gap-2">
                  {(Object.keys(FNS) as FnKey[]).map((key) => (
                    <button
                      key={key}
                      onClick={() => setInner(key)}
                      class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                        inner === key ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
                      }`}
                    >
                      {FNS[key].label}
                    </button>
                  ))}
                </div>
              </div>

              <div class="rounded-lg bg-surface-2 p-3">
                <div class="text-muted text-xs mb-1">live formula</div>
                <div class="font-mono font-semibold" style={`color:${COLORS.compose}`}>
                  f(g(x)) = {composeText(outer, inner)}
                </div>
                <div class="mt-1 text-xs text-muted">
                  inner g(x) = {FNS[inner].label} (grey dashed)
                </div>
              </div>
              <p class="text-xs text-muted">
                Swap which function is inner vs outer to see that order matters: f(g(x)) ≠ g(f(x)) in general.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Slider({
  label, min, max, step, value, onChange,
}: { label: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void }) {
  return (
    <label class="block">
      <span class="mb-1 block text-muted">{label}</span>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onInput={(e) => onChange(parseFloat((e.target as HTMLInputElement).value))}
        class="w-full accent-[#10b981]"
      />
    </label>
  );
}

// build a readable f(g(x)) string for the readout
function composeText(outer: FnKey, inner: FnKey): string {
  const g = FNS[inner].label;
  switch (outer) {
    case 'sq': return `(${g})²`;
    case 'sin': return `sin(${g})`;
    case 'abs': return `|${g}|`;
    case 'sqrt': return `√(${g})`;
    default: return g;
  }
}

// ---- plot a function across the canvas width, breaking on NaN/Inf ----
function plot(
  ctx: CanvasRenderingContext2D,
  fn: (x: number) => number,
  toPxX: (x: number) => number,
  toPxY: (y: number) => number,
  toMathX: (px: number) => number,
  w: number,
  color: string,
  width: number,
  dash: number[] = [],
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.setLineDash(dash);
  ctx.beginPath();
  let started = false;
  let prevY = 0;
  for (let px = 0; px <= w; px += 1) {
    const x = toMathX(px);
    const y = fn(x);
    if (!isFinite(y)) { started = false; continue; }
    const py = toPxY(y);
    // guard against giant near-vertical jumps (e.g. asymptotes)
    if (started && Math.abs(py - prevY) > 4000) { started = false; }
    if (!started) { ctx.moveTo(px, py); started = true; }
    else ctx.lineTo(px, py);
    prevY = py;
  }
  ctx.stroke();
  ctx.restore();
}
