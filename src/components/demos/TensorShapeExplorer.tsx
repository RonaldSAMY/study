import { useMemo, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Tensor shape explorer for a 2 x 3 x 4 tensor.
   - Pick an index (i, j, k) with the steppers.
   - See the selected element light up, plus shape / rank / axes /
     size and the flat (row-major) memory offset.
   ------------------------------------------------------------------ */

const D0 = 2; // axis 0 (depth / "slices")
const D1 = 3; // axis 1 (rows)
const D2 = 4; // axis 2 (cols)

const COLORS = { a: '#4f46e5', b: '#0ea5e9', c: '#10b981' };

// A deterministic, readable "value" for each cell so the tensor feels real.
const valueAt = (i: number, j: number, k: number) => i * 100 + j * 10 + k;

function Stepper({
  label,
  color,
  value,
  max,
  onChange,
}: {
  label: string;
  color: string;
  value: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div class="rounded-lg bg-surface-2 px-3 py-2">
      <div class="mb-1 flex items-center justify-between">
        <span class="font-mono text-xs font-semibold" style={`color:${color}`}>
          {label}
        </span>
        <span class="font-mono text-sm font-bold">{value}</span>
      </div>
      <div class="flex gap-1">
        <button
          class="grid h-7 w-7 place-items-center rounded-md bg-surface text-muted hover:text-text disabled:opacity-40"
          disabled={value <= 0}
          onClick={() => onChange(Math.max(0, value - 1))}
        >
          −
        </button>
        <button
          class="grid h-7 w-7 place-items-center rounded-md bg-surface text-muted hover:text-text disabled:opacity-40"
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, value + 1))}
        >
          +
        </button>
        <span class="ml-auto self-center text-xs text-muted">0…{max}</span>
      </div>
    </div>
  );
}

export default function TensorShapeExplorer() {
  const [i, setI] = useState(1);
  const [j, setJ] = useState(2);
  const [k, setK] = useState(0);

  const flat = useMemo(() => i * (D1 * D2) + j * D2 + k, [i, j, k]);

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="grid gap-4 md:grid-cols-[1fr,auto] md:items-start">
        {/* the tensor: 2 slices, each a 3x4 grid */}
        <div class="flex flex-wrap gap-4">
          {Array.from({ length: D0 }, (_, si) => (
            <div key={si} class="rounded-xl bg-surface-2 p-3">
              <div class="mb-2 text-center text-xs font-semibold text-muted">
                axis 0 index = <span style={`color:${COLORS.a}`}>{si}</span>
              </div>
              <div class="grid gap-1.5" style={`grid-template-columns:repeat(${D2},minmax(0,1fr))`}>
                {Array.from({ length: D1 }, (_, rj) =>
                  Array.from({ length: D2 }, (_, ck) => {
                    const selected = si === i && rj === j && ck === k;
                    return (
                      <button
                        key={`${rj}-${ck}`}
                        onClick={() => {
                          setI(si);
                          setJ(rj);
                          setK(ck);
                        }}
                        class={`grid h-11 w-11 place-items-center rounded-md font-mono text-xs font-semibold transition ${
                          selected
                            ? 'bg-brand text-white shadow ring-2 ring-offset-2 ring-brand ring-offset-surface-2'
                            : 'bg-surface text-text hover:bg-brand-soft'
                        }`}
                        title={`[${si}, ${rj}, ${ck}]`}
                      >
                        {valueAt(si, rj, ck)}
                      </button>
                    );
                  }),
                )}
              </div>
            </div>
          ))}
        </div>

        {/* controls + readouts */}
        <div class="w-full space-y-3 text-sm md:w-64">
          <p class="text-muted">Step the index on each axis (or tap a cell).</p>
          <div class="grid grid-cols-3 gap-2">
            <Stepper label="i" color={COLORS.a} value={i} max={D0 - 1} onChange={setI} />
            <Stepper label="j" color={COLORS.b} value={j} max={D1 - 1} onChange={setJ} />
            <Stepper label="k" color={COLORS.c} value={k} max={D2 - 1} onChange={setK} />
          </div>

          <div class="rounded-lg bg-surface-2 p-3">
            <div class="flex justify-between">
              <span class="text-muted">element T[i, j, k]</span>
              <strong class="font-mono">{valueAt(i, j, k)}</strong>
            </div>
            <div class="flex justify-between">
              <span class="text-muted">shape</span>
              <strong class="font-mono">(2, 3, 4)</strong>
            </div>
            <div class="flex justify-between">
              <span class="text-muted">rank (ndim)</span>
              <strong class="font-mono">3</strong>
            </div>
            <div class="flex justify-between">
              <span class="text-muted">size (numel)</span>
              <strong class="font-mono">24</strong>
            </div>
            <div class="flex justify-between">
              <span class="text-muted">flat offset</span>
              <strong class="font-mono">{flat}</strong>
            </div>
            <p class="mt-2 text-xs text-muted">
              Row-major: offset = i·12 + j·4 + k = {i}·12 + {j}·4 + {k} = {flat}.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
