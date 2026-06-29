import { useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Interactive truth-table + logic-gate builder.
   - Pick a connective (AND, OR, NOT, XOR, IMPLIES, IFF, NAND).
   - Click the input wires of the gate to toggle p and q true/false.
   - The full truth table fills in and the current row lights up.
   Theme: digital circuit logic gates carrying current (green = true).
   ------------------------------------------------------------------ */

type OpKey = 'and' | 'or' | 'not' | 'xor' | 'imp' | 'iff' | 'nand';

const ON = '#10b981';
const OFF = '#94a3b8';

const OPS: Record<OpKey, { label: string; sym: string; arity: 1 | 2; fn: (p: boolean, q: boolean) => boolean }> = {
  and: { label: 'AND', sym: '∧', arity: 2, fn: (p, q) => p && q },
  or: { label: 'OR', sym: '∨', arity: 2, fn: (p, q) => p || q },
  not: { label: 'NOT', sym: '¬', arity: 1, fn: (p) => !p },
  xor: { label: 'XOR', sym: '⊕', arity: 2, fn: (p, q) => p !== q },
  imp: { label: 'IMPLIES', sym: '→', arity: 2, fn: (p, q) => !p || q },
  iff: { label: 'IFF', sym: '↔', arity: 2, fn: (p, q) => p === q },
  nand: { label: 'NAND', sym: '⊼', arity: 2, fn: (p, q) => !(p && q) },
};

const T = (b: boolean) => (b ? 'T' : 'F');

export default function TruthTableBuilder() {
  const [op, setOp] = useState<OpKey>('and');
  const [p, setP] = useState(true);
  const [q, setQ] = useState(false);

  const spec = OPS[op];
  const out = spec.fn(p, q);
  const binary = spec.arity === 2;

  // all rows of the truth table
  const rows = binary
    ? [
        [false, false],
        [false, true],
        [true, false],
        [true, true],
      ]
    : [[false, false], [true, false]];

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap gap-2">
        {(Object.keys(OPS) as OpKey[]).map((k) => (
          <button
            key={k}
            onClick={() => setOp(k)}
            class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              op === k ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
            }`}
          >
            {OPS[k].label}
          </button>
        ))}
      </div>

      <div class="grid gap-5 md:grid-cols-2 md:items-center">
        {/* the gate */}
        <div class="rounded-xl bg-surface-2 p-3">
          <svg viewBox="0 0 280 170" class="w-full" role="img" aria-label="logic gate">
            {/* input p wire */}
            <line x1="20" y1={binary ? 55 : 85} x2="120" y2={binary ? 55 : 85}
              stroke={p ? ON : OFF} stroke-width="4" stroke-linecap="round" />
            {binary && (
              <line x1="20" y1="115" x2="120" y2="115"
                stroke={q ? ON : OFF} stroke-width="4" stroke-linecap="round" />
            )}
            {/* output wire */}
            <line x1="200" y1="85" x2="262" y2="85"
              stroke={out ? ON : OFF} stroke-width="4" stroke-linecap="round" />

            {/* gate body */}
            <rect x="118" y="42" width="84" height="86" rx="14"
              fill="var(--color-surface, #fff)" stroke="#4f46e5" stroke-width="2.5" />
            <text x="160" y="98" text-anchor="middle" font-size="34" font-weight="700" fill="#4f46e5">
              {spec.sym}
            </text>

            {/* clickable input terminals */}
            <circle cx="20" cy={binary ? 55 : 85} r="11" fill={p ? ON : OFF}
              class="cursor-pointer" onClick={() => setP((v) => !v)} />
            <text x="20" y={binary ? 39 : 69} text-anchor="middle" font-size="13" font-weight="700"
              fill="currentColor">p</text>
            {binary && (
              <>
                <circle cx="20" cy="115" r="11" fill={q ? ON : OFF}
                  class="cursor-pointer" onClick={() => setQ((v) => !v)} />
                <text x="20" y="99" text-anchor="middle" font-size="13" font-weight="700"
                  fill="currentColor">q</text>
              </>
            )}

            {/* output bulb */}
            <circle cx="262" cy="85" r="12" fill={out ? ON : OFF} stroke="#0ea5e9" stroke-width="2" />
            <text x="262" y="118" text-anchor="middle" font-size="13" font-weight="700"
              fill="currentColor">out</text>
          </svg>
          <p class="mt-1 text-center text-xs text-muted">
            Click the <span class="font-semibold">p</span>
            {binary ? ' and q' : ''} terminals to flip the inputs.
          </p>
        </div>

        {/* current evaluation + table */}
        <div class="space-y-3 text-sm">
          <div class="rounded-lg bg-surface-2 p-3 text-center">
            <span class="font-mono text-base">
              {binary ? `${T(p)} ${spec.sym} ${T(q)}` : `${spec.sym}${T(p)}`}
            </span>
            <span class="mx-2 text-muted">=</span>
            <strong class={out ? 'text-calculus' : 'text-geometry'}>{T(out)}</strong>
          </div>

          <table class="w-full overflow-hidden rounded-lg text-center text-sm">
            <thead>
              <tr class="bg-surface-2 text-muted">
                <th class="px-2 py-1.5 font-semibold">p</th>
                {binary && <th class="px-2 py-1.5 font-semibold">q</th>}
                <th class="px-2 py-1.5 font-semibold">{binary ? `p ${spec.sym} q` : `${spec.sym}p`}</th>
              </tr>
            </thead>
            <tbody class="font-mono">
              {rows.map(([rp, rq], i) => {
                const r = spec.fn(rp, rq);
                const active = binary ? rp === p && rq === q : rp === p;
                return (
                  <tr key={i} class={active ? 'bg-brand-soft font-bold' : 'odd:bg-surface-2/50'}>
                    <td class="px-2 py-1.5">{T(rp)}</td>
                    {binary && <td class="px-2 py-1.5">{T(rq)}</td>}
                    <td class={`px-2 py-1.5 ${r ? 'text-calculus' : 'text-geometry'}`}>{T(r)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
