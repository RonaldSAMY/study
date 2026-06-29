import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Inner product of functions on [-π, π].
   - Pick two functions f and g from the menu.
   - The shaded region is their product f(x)·g(x): green where positive,
     rose where negative. The inner product ⟨f,g⟩ = ∫ f·g dx is the signed
     area — when the greens and roses cancel, ⟨f,g⟩ = 0 → orthogonal.
   ------------------------------------------------------------------ */

const C = {
  f: '#0ea5e9',
  g: '#4f46e5',
  pos: 'rgba(16,185,129,0.30)',
  neg: 'rgba(244,63,94,0.28)',
  axis: 'rgba(128,128,128,0.55)',
  text: '#64748b',
};

const PI = Math.PI;

type Fn = { key: string; label: string; f: (x: number) => number };
const FUNCS: Fn[] = [
  { key: 'one', label: '1', f: () => 1 },
  { key: 'sin', label: 'sin x', f: (x) => Math.sin(x) },
  { key: 'cos', label: 'cos x', f: (x) => Math.cos(x) },
  { key: 'sin2', label: 'sin 2x', f: (x) => Math.sin(2 * x) },
  { key: 'cos2', label: 'cos 2x', f: (x) => Math.cos(2 * x) },
  { key: 'x', label: 'x', f: (x) => x },
];

export default function FunctionInnerProductLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 560, h: 320 });
  const [fi, setFi] = useState(1); // sin x
  const [gi, setGi] = useState(2); // cos x

  const F = FUNCS[fi].f;
  const G = FUNCS[gi].f;

  // numeric inner product over [-π, π]
  const N = 2000;
  let inner = 0;
  const dx = (2 * PI) / N;
  for (let i = 0; i < N; i++) {
    const x = -PI + (i + 0.5) * dx;
    inner += F(x) * G(x) * dx;
  }
  const orthogonal = Math.abs(inner) < 1e-2;

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);
    const padL = 16, padR = 16, padT = 14, padB = 22;
    const midY = (padT + (h - padB)) / 2;
    const plotH = (h - padB - padT) / 2;

    const xToPx = (x: number) => padL + ((x + PI) / (2 * PI)) * (w - padL - padR);
    // y-scale: max abs over f, g, product
    let maxAbs = 1;
    for (let i = 0; i <= 400; i++) {
      const x = -PI + (i / 400) * (2 * PI);
      maxAbs = Math.max(maxAbs, Math.abs(F(x)), Math.abs(G(x)), Math.abs(F(x) * G(x)));
    }
    const yToPx = (y: number) => midY - (y / maxAbs) * plotH * 0.92;

    // product fill (sign-colored)
    for (let i = 0; i < 400; i++) {
      const x0 = -PI + (i / 400) * (2 * PI);
      const x1 = -PI + ((i + 1) / 400) * (2 * PI);
      const xm = (x0 + x1) / 2;
      const p = F(xm) * G(xm);
      ctx.fillStyle = p >= 0 ? C.pos : C.neg;
      ctx.beginPath();
      ctx.moveTo(xToPx(x0), midY);
      ctx.lineTo(xToPx(x0), yToPx(F(x0) * G(x0)));
      ctx.lineTo(xToPx(x1), yToPx(F(x1) * G(x1)));
      ctx.lineTo(xToPx(x1), midY);
      ctx.closePath(); ctx.fill();
    }

    // axes
    ctx.strokeStyle = C.axis; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(padL, midY); ctx.lineTo(w - padR, midY); ctx.stroke();
    ctx.fillStyle = C.text; ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    [['-π', -PI], ['-π/2', -PI / 2], ['0', 0], ['π/2', PI / 2], ['π', PI]].forEach(([lab, x]) => {
      ctx.fillText(lab as string, xToPx(x as number), h - padB + 4);
    });

    const curve = (fn: (x: number) => number, color: string) => {
      ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
      ctx.beginPath();
      for (let i = 0; i <= 400; i++) {
        const x = -PI + (i / 400) * (2 * PI);
        const y = yToPx(fn(x));
        i === 0 ? ctx.moveTo(xToPx(x), y) : ctx.lineTo(xToPx(x), y);
      }
      ctx.stroke();
    };
    curve(F, C.f);
    curve(G, C.g);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 620);
      const h = Math.round(Math.min(w * 0.58, 320));
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr; canvas.height = h * dpr;
      canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w, h };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(draw, [fi, gi]);

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 grid gap-3 sm:grid-cols-2">
        <Picker label="f(x)" color={C.f} value={fi} onChange={setFi} />
        <Picker label="g(x)" color={C.g} value={gi} onChange={setGi} />
      </div>

      <canvas ref={canvasRef} class="w-full rounded-xl bg-surface-2" />

      <div class="mt-3 flex items-center justify-between rounded-lg bg-surface-2 p-3 text-sm">
        <span class="text-muted">⟨f, g⟩ = ∫₋π&#8203;ᵖⁱ f·g dx</span>
        <strong class="font-mono text-lg" style={`color:${orthogonal ? '#10b981' : C.g}`}>
          {inner.toFixed(3)}
        </strong>
      </div>
      <p class="mt-2 text-xs text-muted">
        {orthogonal
          ? '≈ 0 → the green and rose areas cancel: f and g are ORTHOGONAL functions.'
          : 'Non-zero → the product leans one way; these functions are correlated, not orthogonal.'}
      </p>
    </div>
  );
}

function Picker({ label, color, value, onChange }: {
  label: string; color: string; value: number; onChange: (v: number) => void;
}) {
  return (
    <div>
      <span class="mb-1 block text-sm font-semibold" style={`color:${color}`}>{label}</span>
      <div class="flex flex-wrap gap-1.5">
        {FUNCS.map((fn, i) => (
          <button
            key={fn.key}
            onClick={() => onChange(i)}
            class={`rounded-md px-2.5 py-1 text-xs font-mono font-semibold transition ${
              value === i ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
            }`}
          >
            {fn.label}
          </button>
        ))}
      </div>
    </div>
  );
}
