import { useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Forward pass through a tiny computational graph: f = (a * b) + c.
   - Slide a, b, c and watch values flow left-to-right through the
     multiply node and the add node to the output.
   ------------------------------------------------------------------ */

const COLORS = { input: '#4f46e5', op: '#0ea5e9', out: '#10b981', edge: 'rgba(128,128,128,0.55)' };

function Slider({
  label,
  color,
  value,
  onChange,
}: {
  label: string;
  color: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label class="block">
      <span class="mb-1 block text-muted">
        <span class="font-mono font-semibold" style={`color:${color}`}>
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
        class="w-full accent-[#0ea5e9]"
      />
    </label>
  );
}

export default function ComputeGraphForward() {
  const [a, setA] = useState(3);
  const [b, setB] = useState(2);
  const [c, setC] = useState(1);

  const d = a * b; // intermediate
  const f = d + c; // output

  // node centers in a 360 x 240 viewBox
  const N = {
    a: { x: 60, y: 50 },
    b: { x: 60, y: 120 },
    c: { x: 60, y: 190 },
    mul: { x: 185, y: 85 },
    add: { x: 290, y: 120 },
  };

  const edge = (p: { x: number; y: number }, q: { x: number; y: number }, val: number) => (
    <g>
      <line x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke={COLORS.edge} stroke-width={2} />
      <text
        x={(p.x + q.x) / 2}
        y={(p.y + q.y) / 2 - 6}
        text-anchor="middle"
        class="fill-current font-mono text-[11px] font-semibold text-text"
      >
        {val.toFixed(1)}
      </text>
    </g>
  );

  const node = (
    cx: number,
    cy: number,
    label: string,
    sub: string,
    color: string,
    r = 26,
  ) => (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="var(--surface-2, #f1f5f9)" stroke={color} stroke-width={3} />
      <text x={cx} y={cy - 2} text-anchor="middle" class="font-mono text-base font-bold" fill={color}>
        {label}
      </text>
      <text x={cx} y={cy + 13} text-anchor="middle" class="font-mono text-[10px]" fill={color}>
        {sub}
      </text>
    </g>
  );

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="grid gap-4 md:grid-cols-[1fr,auto] md:items-center">
        <svg viewBox="0 0 360 240" class="w-full" role="img" aria-label="Computational graph a times b plus c">
          {edge(N.a, N.mul, a)}
          {edge(N.b, N.mul, b)}
          {edge(N.mul, N.add, d)}
          {edge(N.c, N.add, c)}
          {node(N.a.x, N.a.y, 'a', a.toFixed(1), COLORS.input)}
          {node(N.b.x, N.b.y, 'b', b.toFixed(1), COLORS.input)}
          {node(N.c.x, N.c.y, 'c', c.toFixed(1), COLORS.input)}
          {node(N.mul.x, N.mul.y, '×', `d=${d.toFixed(1)}`, COLORS.op)}
          {node(N.add.x, N.add.y, '+', `f=${f.toFixed(1)}`, COLORS.out, 30)}
        </svg>

        <div class="w-full space-y-3 text-sm md:w-56">
          <Slider label="a" color={COLORS.input} value={a} onChange={setA} />
          <Slider label="b" color={COLORS.input} value={b} onChange={setB} />
          <Slider label="c" color={COLORS.input} value={c} onChange={setC} />
          <div class="rounded-lg bg-surface-2 p-3">
            <div class="flex justify-between">
              <span class="text-muted">d = a · b</span>
              <strong class="font-mono">{d.toFixed(1)}</strong>
            </div>
            <div class="flex justify-between">
              <span class="text-muted">f = d + c</span>
              <strong class="font-mono" style={`color:${COLORS.out}`}>
                {f.toFixed(1)}
              </strong>
            </div>
            <p class="mt-1 text-xs text-muted">Values flow left → right, one op at a time.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
