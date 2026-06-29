import { useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Vector calculus for ML — backprop through a tiny computation graph.
   One neuron + squared-error loss:
       m = w·x      z = m + b      a = σ(z)      L = (a − t)²
   Forward values flow left→right; gradients ∂L/∂· flow right→left by
   the chain rule. Drag the sliders and watch both passes update.
   ------------------------------------------------------------------ */

type Dir = 'forward' | 'backward';

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

export default function BackpropGraph() {
  const [w, setW] = useState(0.8);
  const [x, setX] = useState(1.5);
  const [b, setB] = useState(-0.5);
  const [t, setT] = useState(1);
  const [dir, setDir] = useState<Dir>('backward');

  // ---- forward pass ----
  const m = w * x;
  const z = m + b;
  const a = sigmoid(z);
  const L = (a - t) ** 2;

  // ---- backward pass (chain rule) ----
  const dL_da = 2 * (a - t);
  const dL_dz = dL_da * a * (1 - a); // σ' = a(1−a)
  const dL_dm = dL_dz; // + node passes gradient through
  const dL_db = dL_dz;
  const dL_dw = dL_dm * x; // × node: local grad is the other input
  const dL_dx = dL_dm * w;

  const showBack = dir === 'backward';

  // node positions in the 560×300 viewBox
  const N = {
    w: { x: 55, y: 55 }, x: { x: 55, y: 150 }, b: { x: 55, y: 250 },
    mul: { x: 185, y: 100 }, add: { x: 300, y: 150 },
    sig: { x: 405, y: 150 }, L: { x: 505, y: 150 },
  };

  const edges: [keyof typeof N, keyof typeof N, number][] = [
    ['w', 'mul', dL_dw], ['x', 'mul', dL_dx], ['b', 'add', dL_db],
    ['mul', 'add', dL_dm], ['add', 'sig', dL_dz], ['sig', 'L', dL_da],
  ];

  const edgeColor = (g: number) =>
    !showBack ? '#94a3b8' : g > 0.001 ? '#10b981' : g < -0.001 ? '#0ea5e9' : '#94a3b8';

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap gap-2">
        {(['forward', 'backward'] as Dir[]).map((d) => (
          <button key={d} onClick={() => setDir(d)}
            class={`rounded-lg px-3 py-1.5 text-sm font-semibold capitalize transition ${
              dir === d ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
            }`}>
            {d === 'forward' ? 'Forward (values)' : 'Backward (gradients)'}
          </button>
        ))}
      </div>

      <svg viewBox="0 0 560 300" class="w-full" style="max-height:300px">
        <defs>
          <marker id="bpArrow" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto">
            <path d="M0,0 L7,3 L0,6 Z" fill="#64748b" />
          </marker>
        </defs>

        {edges.map(([from, to, g], i) => {
          const f = N[from], tt = N[to];
          return (
            <g key={i}>
              <line x1={f.x + 26} y1={f.y} x2={tt.x - 26} y2={tt.y}
                stroke={edgeColor(g)} stroke-width={showBack ? Math.min(6, 1.5 + Math.abs(g) * 14) : 2}
                marker-end="url(#bpArrow)" opacity={0.9} />
              {showBack && (
                <text x={(f.x + tt.x) / 2} y={(f.y + tt.y) / 2 - 6}
                  text-anchor="middle" font-size="10" font-family="monospace" fill={edgeColor(g)}>
                  {g >= 0 ? '+' : ''}{g.toFixed(2)}
                </text>
              )}
            </g>
          );
        })}

        <Node p={N.w} label="w" val={w} grad={dL_dw} show={showBack} fill="#4f46e5" />
        <Node p={N.x} label="x" val={x} grad={dL_dx} show={showBack} fill="#4f46e5" />
        <Node p={N.b} label="b" val={b} grad={dL_db} show={showBack} fill="#4f46e5" />
        <Node p={N.mul} label="×" val={m} grad={dL_dm} show={showBack} fill="#0ea5e9" />
        <Node p={N.add} label="+" val={z} grad={dL_dz} show={showBack} fill="#0ea5e9" />
        <Node p={N.sig} label="σ" val={a} grad={dL_da} show={showBack} fill="#0ea5e9" />
        <Node p={N.L} label="L" val={L} grad={1} show={showBack} fill="#10b981" />
      </svg>

      <div class="mt-3 grid gap-3 sm:grid-cols-2">
        <div class="space-y-2 text-sm">
          <Slider label="weight w" value={w} set={setW} />
          <Slider label="input x" value={x} set={setX} />
          <Slider label="bias b" value={b} set={setB} />
          <Slider label="target t" value={t} set={setT} min={0} max={1} step={0.05} />
        </div>
        <div class="space-y-2 text-sm">
          <div class="rounded-lg bg-surface-2 p-3">
            <div class="flex justify-between"><span class="text-muted">prediction a = σ(z)</span><strong class="font-mono">{a.toFixed(3)}</strong></div>
            <div class="flex justify-between"><span class="text-muted">loss L</span><strong class="font-mono">{L.toFixed(3)}</strong></div>
          </div>
          <div class="rounded-lg bg-surface-2 p-3 text-xs text-muted">
            <p class="mb-1 font-semibold text-text">Gradient on the weight:</p>
            <p class="font-mono">∂L/∂w = {dL_dw.toFixed(3)}</p>
            <p class="mt-1">
              {Math.abs(dL_dw) < 0.02
                ? 'Near zero — nudging w barely changes the loss (a flat spot).'
                : dL_dw > 0
                ? 'Positive → increasing w raises the loss, so descent will decrease w.'
                : 'Negative → increasing w lowers the loss, so descent will increase w.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Node({ p, label, val, grad, show, fill }:
  { p: { x: number; y: number }; label: string; val: number; grad: number; show: boolean; fill: string }) {
  return (
    <g>
      <circle cx={p.x} cy={p.y} r={24} fill={fill} opacity={0.14} stroke={fill} stroke-width={2} />
      <text x={p.x} y={p.y - 4} text-anchor="middle" font-size="14" font-weight="700" fill={fill}>{label}</text>
      <text x={p.x} y={p.y + 11} text-anchor="middle" font-size="9" font-family="monospace" fill="currentColor" class="text-text">{val.toFixed(2)}</text>
      {show && (
        <text x={p.x} y={p.y + 40} text-anchor="middle" font-size="10" font-family="monospace" fill="#10b981">
          ∂L={grad.toFixed(2)}
        </text>
      )}
    </g>
  );
}

function Slider({ label, value, set, min = -2, max = 2, step = 0.05 }:
  { label: string; value: number; set: (n: number) => void; min?: number; max?: number; step?: number }) {
  return (
    <label class="block">
      <span class="mb-1 block text-muted">{label} = {value.toFixed(2)}</span>
      <input type="range" min={min} max={max} step={step} value={value}
        onInput={(e) => set(parseFloat((e.target as HTMLInputElement).value))}
        class="w-full accent-[#4f46e5]" />
    </label>
  );
}
