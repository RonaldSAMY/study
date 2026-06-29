import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Differentiation-rules builder.
   - Choose a function tied to a real scenario (power, product,
     quotient or chain rule).
   - "Reveal next step" walks through the rule line by line.
   - The canvas plots f (indigo) and its derivative f' (emerald),
     computed numerically so the picture always matches the algebra.
   - For the chain-rule case, a small panel shows the two nested
     rates multiplying together.
   ------------------------------------------------------------------ */

const COLORS = {
  f: '#4f46e5',
  df: '#10b981',
  grid: 'rgba(128,128,128,0.18)',
  axis: 'rgba(128,128,128,0.5)',
};

type Recipe = {
  key: string;
  rule: string;
  scenario: string;
  fLabel: string;
  dfLabel: string;
  f: (x: number) => number;
  steps: string[];
  domain: [number, number];
  chain?: { inner: (x: number) => number; dInner: string; dOuter: string };
};

const RECIPES: Recipe[] = [
  {
    key: 'power',
    rule: 'Power rule',
    scenario: 'Car braking distance d(v) = 0.01 v²',
    fLabel: 'd(v) = 0.01 v²',
    dfLabel: "d'(v) = 0.02 v",
    f: (v) => 0.01 * v * v,
    domain: [0, 12],
    steps: [
      'Power rule: bring the exponent down, then subtract one from it.',
      'd(v) = 0.01 · v²  →  multiply by the 2: 0.01 · 2 · v²',
      'Drop the exponent by one: v² becomes v¹.',
      "d'(v) = 0.02 v  — stopping distance grows twice as fast as speed.",
    ],
  },
  {
    key: 'product',
    rule: 'Product rule',
    scenario: 'Revenue R(p) = p · (10 − p)  (price × units sold)',
    fLabel: 'R(p) = p (10 − p)',
    dfLabel: "R'(p) = 10 − 2p",
    f: (p) => p * (10 - p),
    domain: [0, 10],
    steps: [
      "Product rule: (u·v)' = u'·v + u·v'.",
      'Let u = p (so u′ = 1) and v = 10 − p (so v′ = −1).',
      "Assemble: (1)(10 − p) + (p)(−1) = 10 − p − p.",
      "R'(p) = 10 − 2p  — revenue stops rising when p = 5.",
    ],
  },
  {
    key: 'quotient',
    rule: 'Quotient rule',
    scenario: 'Drug concentration C(t) = 5t / (t² + 1)',
    fLabel: 'C(t) = 5t / (t² + 1)',
    dfLabel: "C'(t) = 5(1 − t²)/(t² + 1)²",
    f: (t) => (5 * t) / (t * t + 1),
    domain: [0, 6],
    steps: [
      "Quotient rule: (u/v)' = (u'v − uv') / v².",
      'u = 5t (u′ = 5),  v = t² + 1 (v′ = 2t).',
      'Top: 5(t² + 1) − 5t(2t) = 5t² + 5 − 10t² = 5 − 5t².',
      "C'(t) = 5(1 − t²)/(t² + 1)²  — peaks at t = 1, then falls.",
    ],
  },
  {
    key: 'chain',
    rule: 'Chain rule',
    scenario: 'Tank depth d(t) = √(4t + 1) as water pours in',
    fLabel: 'd(t) = (4t + 1)^{1/2}',
    dfLabel: "d'(t) = 2 / √(4t + 1)",
    f: (t) => Math.sqrt(4 * t + 1),
    domain: [0, 6],
    chain: { inner: (t) => 4 * t + 1, dInner: 'du/dt = 4', dOuter: 'd(√u)/du = 1/(2√u)' },
    steps: [
      "Chain rule: differentiate the OUTER, keep the inner, times the inner's derivative.",
      'Outer = √u with u = 4t + 1.  Outer rate: 1/(2√u).',
      'Inner rate: du/dt = 4.',
      "Multiply the nested rates: 1/(2√u) · 4 = 2/√(4t + 1).",
    ],
  },
];

export default function DerivativeRuleBuilder() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [idx, setIdx] = useState(0);
  const [shown, setShown] = useState(1);
  const sizeRef = useRef({ w: 480, h: 360 });
  const r = RECIPES[idx];

  // numeric derivative (central difference)
  const dfNum = (x: number) => (r.f(x + 1e-4) - r.f(x - 1e-4)) / 2e-4;

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);
    const pad = 30;
    const [xmin, xmax] = r.domain;

    // auto y-range from both curves
    let ymin = Infinity, ymax = -Infinity;
    for (let i = 0; i <= 100; i++) {
      const x = xmin + (i / 100) * (xmax - xmin);
      for (const y of [r.f(x), dfNum(x)]) {
        if (isFinite(y)) { ymin = Math.min(ymin, y); ymax = Math.max(ymax, y); }
      }
    }
    const padY = (ymax - ymin) * 0.12 || 1;
    ymin -= padY; ymax += padY;

    const toPx = (x: number, y: number) => ({
      x: pad + ((x - xmin) / (xmax - xmin)) * (w - 2 * pad),
      y: h - pad - ((y - ymin) / (ymax - ymin)) * (h - 2 * pad),
    });

    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    for (let i = 0; i <= 8; i++) {
      const gx = pad + (i / 8) * (w - 2 * pad);
      ctx.beginPath(); ctx.moveTo(gx, pad); ctx.lineTo(gx, h - pad); ctx.stroke();
      const gy = pad + (i / 8) * (h - 2 * pad);
      ctx.beginPath(); ctx.moveTo(pad, gy); ctx.lineTo(w - pad, gy); ctx.stroke();
    }
    // y = 0 axis if visible
    if (ymin < 0 && ymax > 0) {
      const zero = toPx(xmin, 0).y;
      ctx.strokeStyle = COLORS.axis; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(pad, zero); ctx.lineTo(w - pad, zero); ctx.stroke();
    }

    const plot = (g: (x: number) => number, color: string, width: number) => {
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round';
      ctx.beginPath();
      let started = false;
      for (let i = 0; i <= 240; i++) {
        const x = xmin + (i / 240) * (xmax - xmin);
        const y = g(x);
        if (!isFinite(y)) { started = false; continue; }
        const p = toPx(x, y);
        if (!started) { ctx.moveTo(p.x, p.y); started = true; }
        else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    };
    plot(r.f, COLORS.f, 3);
    plot(dfNum, COLORS.df, 3);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 560);
      const h = Math.round(w * 0.72);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w, h };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(draw, [idx]);

  const pick = (i: number) => { setIdx(i); setShown(1); };

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap gap-2">
        {RECIPES.map((rec, i) => (
          <button
            key={rec.key}
            onClick={() => pick(i)}
            class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              idx === i ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
            }`}
          >
            {rec.rule}
          </button>
        ))}
      </div>

      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

        <div class="space-y-3 text-sm">
          <p class="text-muted">{r.scenario}</p>
          <div class="flex flex-wrap gap-3">
            <span class="font-mono" style={`color:${COLORS.f}`}>{r.fLabel}</span>
            <span class="font-mono" style={`color:${COLORS.df}`}>{r.dfLabel}</span>
          </div>

          <ol class="space-y-2">
            {r.steps.slice(0, shown).map((s, i) => (
              <li key={i} class="animate-fade-up rounded-lg bg-surface-2 p-2.5">
                <span class="mr-2 font-bold text-brand">{i + 1}.</span>{s}
              </li>
            ))}
          </ol>

          {r.chain && shown >= r.steps.length && (
            <div class="rounded-lg border border-brand/30 bg-brand-soft p-3">
              <p class="mb-1 font-semibold text-brand">Nested rates multiply</p>
              <p class="font-mono text-xs">
                outer ({r.chain.dOuter}) × inner ({r.chain.dInner})
              </p>
            </div>
          )}

          <div class="flex gap-2">
            <button
              onClick={() => setShown((s) => Math.min(r.steps.length, s + 1))}
              disabled={shown >= r.steps.length}
              class="rounded-lg bg-brand px-3 py-1.5 font-semibold text-white disabled:opacity-40"
            >
              Reveal next step
            </button>
            <button
              onClick={() => setShown(1)}
              class="rounded-lg bg-surface-2 px-3 py-1.5 font-semibold text-muted hover:text-text"
            >
              Reset
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
