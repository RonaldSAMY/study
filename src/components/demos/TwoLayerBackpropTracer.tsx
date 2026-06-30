import { useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Two-layer backprop tracer (robotics framing).
   A sensor reading x feeds a 2-neuron hidden layer (ReLU), then an
   output neuron predicts a motor command o; loss is squared error to
   target t.
       z1 = w1·x,  h1 = relu(z1)
       z2 = w2·x,  h2 = relu(z2)
       o  = v1·h1 + v2·h2
       L  = (o − t)^2
   Toggle FORWARD (activations, left→right) vs BACKWARD (gradients,
   right→left). Slide the weights and watch every number update.
   ------------------------------------------------------------------ */

type Dir = 'forward' | 'backward';
const relu = (z: number) => Math.max(0, z);

export default function TwoLayerBackpropTracer() {
  const [w1, setW1] = useState(0.9);
  const [w2, setW2] = useState(-0.6);
  const [v1, setV1] = useState(1.1);
  const [v2, setV2] = useState(0.7);
  const [x, setX] = useState(1.4);
  const [t, setT] = useState(1.0);
  const [dir, setDir] = useState<Dir>('forward');

  // forward
  const z1 = w1 * x, h1 = relu(z1);
  const z2 = w2 * x, h2 = relu(z2);
  const o = v1 * h1 + v2 * h2;
  const L = (o - t) ** 2;

  // backward
  const dO = 2 * (o - t);
  const dV1 = dO * h1, dV2 = dO * h2;
  const dH1 = dO * v1, dH2 = dO * v2;
  const dZ1 = dH1 * (z1 > 0 ? 1 : 0), dZ2 = dH2 * (z2 > 0 ? 1 : 0);
  const dW1 = dZ1 * x, dW2 = dZ2 * x;

  const back = dir === 'backward';
  const ec = (g: number) => (!back ? '#94a3b8' : g > 0.001 ? '#10b981' : g < -0.001 ? '#0ea5e9' : '#94a3b8');
  const fmt = (n: number) => (Math.abs(n) < 1e-9 ? '0' : n.toFixed(2));

  const N = {
    x: { x: 60, y: 150 },
    h1: { x: 220, y: 80 },
    h2: { x: 220, y: 220 },
    o: { x: 380, y: 150 },
    L: { x: 510, y: 150 },
  };

  const edges: { a: keyof typeof N; b: keyof typeof N; w: number; g: number }[] = [
    { a: 'x', b: 'h1', w: w1, g: dW1 },
    { a: 'x', b: 'h2', w: w2, g: dW2 },
    { a: 'h1', b: 'o', w: v1, g: dV1 },
    { a: 'h2', b: 'o', w: v2, g: dV2 },
  ];

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap gap-2">
        {(['forward', 'backward'] as Dir[]).map((d) => (
          <button
            key={d}
            onClick={() => setDir(d)}
            class={`rounded-lg px-3 py-1.5 text-sm font-semibold capitalize transition ${
              dir === d ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
            }`}
          >
            {d === 'forward' ? 'Forward (activations)' : 'Backward (gradients)'}
          </button>
        ))}
      </div>

      <div class="grid gap-4 md:grid-cols-[1fr,auto] md:items-start">
        <svg viewBox="0 0 560 300" class="w-full rounded-xl bg-surface-2" style="max-width:560px">
          {edges.map((e, i) => {
            const A = N[e.a], B = N[e.b];
            const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2;
            return (
              <g key={i}>
                <line x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke={ec(e.g)} stroke-width={back ? 3 : 2} />
                <rect x={mx - 24} y={my - 12} width="48" height="18" rx="4" fill="var(--color-surface, #fff)" opacity="0.85" />
                <text x={mx} y={my + 1} text-anchor="middle" font-size="11" font-weight="600" fill={back ? ec(e.g) : '#64748b'}>
                  {back ? fmt(e.g) : fmt(e.w)}
                </text>
              </g>
            );
          })}
          <line x1={N.o.x} y1={N.o.y} x2={N.L.x} y2={N.L.y} stroke={ec(dO)} stroke-width={back ? 3 : 2} />
          <text x={(N.o.x + N.L.x) / 2} y={N.o.y - 8} text-anchor="middle" font-size="11" font-weight="600" fill={back ? ec(dO) : '#64748b'}>
            {back ? fmt(dO) : ''}
          </text>

          <Node at={N.x} label="x" val={x} color="#0ea5e9" sub="sensor" />
          <Node at={N.h1} label="h₁" val={back ? dH1 : h1} color="#4f46e5" sub={back ? '∂L/∂h₁' : 'relu'} />
          <Node at={N.h2} label="h₂" val={back ? dH2 : h2} color="#4f46e5" sub={back ? '∂L/∂h₂' : 'relu'} />
          <Node at={N.o} label="o" val={back ? dO : o} color="#10b981" sub={back ? '∂L/∂o' : 'output'} />
          <Node at={N.L} label="L" val={L} color="#ef4444" sub="loss" />
        </svg>

        <div class="space-y-2 text-sm">
          <p class="text-muted">
            {back
              ? 'Gradients flow right→left. ReLU passes the gradient only where its input was positive — that is why a "dead" unit shows 0.'
              : 'Activations flow left→right. Each edge multiplies by its weight; ReLU zeroes out negatives.'}
          </p>
          <Slide label={`w₁ = ${w1.toFixed(2)}`} v={w1} set={setW1} />
          <Slide label={`w₂ = ${w2.toFixed(2)}`} v={w2} set={setW2} />
          <Slide label={`v₁ = ${v1.toFixed(2)}`} v={v1} set={setV1} />
          <Slide label={`v₂ = ${v2.toFixed(2)}`} v={v2} set={setV2} />
          <Slide label={`x = ${x.toFixed(2)}`} v={x} set={setX} min={-2} max={2} />
          <Slide label={`target t = ${t.toFixed(2)}`} v={t} set={setT} min={-2} max={2} />
          <div class="rounded-lg bg-surface-2 p-3 text-xs">
            <div class="flex justify-between"><span class="text-muted">output o</span><strong>{o.toFixed(3)}</strong></div>
            <div class="flex justify-between"><span class="text-muted">loss L</span><strong>{L.toFixed(3)}</strong></div>
            <div class="flex justify-between"><span class="text-muted">∂L/∂w₁</span><strong>{dW1.toFixed(3)}</strong></div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Node({ at, label, val, color, sub }: { at: { x: number; y: number }; label: string; val: number; color: string; sub: string }) {
  return (
    <g>
      <circle cx={at.x} cy={at.y} r="26" fill="#fff" stroke={color} stroke-width="3" />
      <text x={at.x} y={at.y - 2} text-anchor="middle" font-size="12" font-weight="700" fill={color}>{label}</text>
      <text x={at.x} y={at.y + 12} text-anchor="middle" font-size="11" font-family="monospace" fill="#334155">
        {Math.abs(val) < 1e-9 ? '0' : val.toFixed(2)}
      </text>
      <text x={at.x} y={at.y + 40} text-anchor="middle" font-size="9" fill="#94a3b8">{sub}</text>
    </g>
  );
}

function Slide({ label, v, set, min = -2, max = 2 }: { label: string; v: number; set: (n: number) => void; min?: number; max?: number }) {
  return (
    <label class="block">
      <span class="mb-0.5 block text-xs text-muted">{label}</span>
      <input
        type="range" min={min} max={max} step={0.05} value={v}
        onInput={(e) => set(parseFloat((e.target as HTMLInputElement).value))}
        class="w-full accent-[#4f46e5]"
      />
    </label>
  );
}
