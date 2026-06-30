import { useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Reverse-mode autodiff on f = (a * b) + c.
   - Forward pass (blue, left→right) computes values.
   - Backward pass (rose, right→left) computes gradients via the chain
     rule. Seed df/df = 1, then:
       add:  df/dd = 1,        df/dc = 1
       mul:  df/da = b,        df/db = a   (times upstream df/dd)
   ------------------------------------------------------------------ */

const COLORS = {
  input: '#4f46e5',
  op: '#0ea5e9',
  out: '#10b981',
  grad: '#f43f5e',
  edge: 'rgba(128,128,128,0.55)',
};

function Slider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label class="block">
      <span class="mb-1 block text-muted">
        <span class="font-mono font-semibold" style={`color:${COLORS.input}`}>
          {label}
        </span>{' '}
        = {value.toFixed(1)}
      </span>
      <input
        type="range"
        min={-5}
        max={5}
        step={0.5}
        value={value}
        onInput={(e) => onChange(parseFloat((e.target as HTMLInputElement).value))}
        class="w-full accent-[#f43f5e]"
      />
    </label>
  );
}

export default function AutodiffGraphFlow() {
  const [a, setA] = useState(3);
  const [b, setB] = useState(2);
  const [c, setC] = useState(1);

  const d = a * b;
  const f = d + c;

  // gradients (reverse mode)
  const gF = 1;
  const gD = gF * 1; // add passes gradient through
  const gC = gF * 1;
  const gA = gD * b; // local deriv of d=a*b wrt a is b
  const gB = gD * a;

  const N = {
    a: { x: 60, y: 50 },
    b: { x: 60, y: 120 },
    c: { x: 60, y: 190 },
    mul: { x: 185, y: 85 },
    add: { x: 290, y: 120 },
  };

  const edge = (
    p: { x: number; y: number },
    q: { x: number; y: number },
    val: number,
    grad: number,
  ) => (
    <g>
      <line x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke={COLORS.edge} stroke-width={2} />
      <text
        x={(p.x + q.x) / 2}
        y={(p.y + q.y) / 2 - 6}
        text-anchor="middle"
        class="font-mono text-[11px] font-semibold"
        fill={COLORS.op}
      >
        {val.toFixed(1)}
      </text>
      <text
        x={(p.x + q.x) / 2}
        y={(p.y + q.y) / 2 + 12}
        text-anchor="middle"
        class="font-mono text-[11px] font-semibold"
        fill={COLORS.grad}
      >
        ∂{grad.toFixed(1)}
      </text>
    </g>
  );

  const node = (cx: number, cy: number, label: string, color: string, r = 26) => (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="var(--surface-2, #f1f5f9)" stroke={color} stroke-width={3} />
      <text x={cx} y={cy + 5} text-anchor="middle" class="font-mono text-base font-bold" fill={color}>
        {label}
      </text>
    </g>
  );

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="grid gap-4 md:grid-cols-[1fr,auto] md:items-center">
        <svg viewBox="0 0 360 240" class="w-full" role="img" aria-label="Autodiff graph with forward values and gradients">
          {edge(N.a, N.mul, a, gA)}
          {edge(N.b, N.mul, b, gB)}
          {edge(N.mul, N.add, d, gD)}
          {edge(N.c, N.add, c, gC)}
          {node(N.a.x, N.a.y, 'a', COLORS.input)}
          {node(N.b.x, N.b.y, 'b', COLORS.input)}
          {node(N.c.x, N.c.y, 'c', COLORS.input)}
          {node(N.mul.x, N.mul.y, '×', COLORS.op)}
          {node(N.add.x, N.add.y, '+', COLORS.out, 30)}
        </svg>

        <div class="w-full space-y-3 text-sm md:w-56">
          <p class="text-xs text-muted">
            <span class="font-mono font-semibold" style={`color:${COLORS.op}`}>
              blue
            </span>{' '}
            = forward value,{' '}
            <span class="font-mono font-semibold" style={`color:${COLORS.grad}`}>
              ∂rose
            </span>{' '}
            = gradient of f.
          </p>
          <Slider label="a" value={a} onChange={setA} />
          <Slider label="b" value={b} onChange={setB} />
          <Slider label="c" value={c} onChange={setC} />
          <div class="rounded-lg bg-surface-2 p-3">
            <div class="flex justify-between">
              <span class="text-muted">f = a·b + c</span>
              <strong class="font-mono" style={`color:${COLORS.out}`}>
                {f.toFixed(1)}
              </strong>
            </div>
            <div class="mt-1 grid grid-cols-3 gap-1 text-center" style={`color:${COLORS.grad}`}>
              <div>
                <div class="text-[10px] text-muted">∂f/∂a</div>
                <strong class="font-mono">{gA.toFixed(1)}</strong>
              </div>
              <div>
                <div class="text-[10px] text-muted">∂f/∂b</div>
                <strong class="font-mono">{gB.toFixed(1)}</strong>
              </div>
              <div>
                <div class="text-[10px] text-muted">∂f/∂c</div>
                <strong class="font-mono">{gC.toFixed(1)}</strong>
              </div>
            </div>
            <p class="mt-2 text-xs text-muted">∂f/∂a equals b, ∂f/∂b equals a — change a slider and watch.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
