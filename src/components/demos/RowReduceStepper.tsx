import { useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Gaussian-elimination stepper (no canvas — an animated table).
   Walks a fixed 3x4 augmented matrix from start to reduced form,
   one row operation at a time, ending at the solution.
   Steps were verified with exact fractions.
   ------------------------------------------------------------------ */

type Step = {
  op: string;
  why: string;
  m: string[][]; // 3 rows x 4 cols, display strings
  pivot?: [number, number];
};

const STEPS: Step[] = [
  { op: 'Starting system', why: 'Three equations in x, y, z written as an augmented matrix [A | b].',
    m: [['2','1','-1','8'], ['-3','-1','2','-11'], ['-2','1','2','-3']] },
  { op: 'R₁ → R₁ ÷ 2', why: 'Scale row 1 so its leading entry (the pivot) becomes 1.', pivot: [0,0],
    m: [['1','1/2','-1/2','4'], ['-3','-1','2','-11'], ['-2','1','2','-3']] },
  { op: 'R₂ → R₂ + 3R₁', why: 'Add a multiple of row 1 to clear the x-term below the pivot.', pivot: [0,0],
    m: [['1','1/2','-1/2','4'], ['0','1/2','1/2','1'], ['-2','1','2','-3']] },
  { op: 'R₃ → R₃ + 2R₁', why: 'Same move on row 3: knock out its x-term.', pivot: [0,0],
    m: [['1','1/2','-1/2','4'], ['0','1/2','1/2','1'], ['0','2','1','5']] },
  { op: 'R₂ → R₂ × 2', why: 'Make the next pivot (the y-term in row 2) equal to 1.', pivot: [1,1],
    m: [['1','1/2','-1/2','4'], ['0','1','1','2'], ['0','2','1','5']] },
  { op: 'R₃ → R₃ − 2R₂', why: 'Clear the y-term in row 3 using the new pivot.', pivot: [1,1],
    m: [['1','1/2','-1/2','4'], ['0','1','1','2'], ['0','0','-1','1']] },
  { op: 'R₃ → R₃ ÷ (−1)', why: 'Make the last pivot 1. Now z is solved: z = −1.', pivot: [2,2],
    m: [['1','1/2','-1/2','4'], ['0','1','1','2'], ['0','0','1','-1']] },
  { op: 'R₂ → R₂ − R₃', why: 'Back-substitute z into row 2 → y = 3.', pivot: [2,2],
    m: [['1','1/2','-1/2','4'], ['0','1','0','3'], ['0','0','1','-1']] },
  { op: 'R₁ → R₁ + ½R₃, then − ½R₂', why: 'Back-substitute into row 1 → x = 2. Reduced!', pivot: [0,0],
    m: [['1','0','0','2'], ['0','1','0','3'], ['0','0','1','-1']] },
];

export default function RowReduceStepper() {
  const [i, setI] = useState(0);
  const step = STEPS[i];
  const done = i === STEPS.length - 1;
  const headers = ['x', 'y', 'z', '='];

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <p class="mb-3 text-sm text-muted">
        Step {i + 1} of {STEPS.length}. Use the buttons to row-reduce the system to its solution.
      </p>

      <div class="overflow-x-auto">
        <table class="border-collapse text-center font-mono text-sm">
          <thead>
            <tr>
              {headers.map((h, c) => (
                <th key={c} class={`px-3 pb-1 text-xs font-bold ${c === 3 ? 'text-brand' : 'text-muted'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {step.m.map((row, r) => (
              <tr key={r}>
                {row.map((val, c) => {
                  const isPivot = step.pivot && step.pivot[0] === r && step.pivot[1] === c;
                  const isAug = c === 3;
                  return (
                    <td key={c} class={`border-2 px-4 py-2 transition ${
                      isPivot ? 'border-brand bg-brand-soft font-bold text-brand'
                      : isAug ? 'border-border bg-surface-2 text-text'
                      : 'border-border bg-surface text-text'
                    }`}>{val}</td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div class={`mt-3 rounded-lg p-3 text-sm ${done ? 'bg-brand-soft' : 'bg-surface-2'}`}>
        <p class="font-semibold">{step.op}</p>
        <p class="mt-0.5 text-muted">{step.why}</p>
        {done && <p class="mt-2 font-mono font-bold text-brand">Solution: x = 2, y = 3, z = −1</p>}
      </div>

      <div class="mt-3 flex gap-2">
        <button onClick={() => setI((n) => Math.max(0, n - 1))} disabled={i === 0}
          class="rounded-lg bg-surface-2 px-4 py-1.5 text-sm font-semibold text-muted transition hover:text-text disabled:opacity-40">
          ← Back
        </button>
        <button onClick={() => setI((n) => Math.min(STEPS.length - 1, n + 1))} disabled={done}
          class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white transition disabled:opacity-40">
          Next step →
        </button>
        <button onClick={() => setI(0)}
          class="ml-auto rounded-lg bg-surface-2 px-4 py-1.5 text-sm font-semibold text-muted transition hover:text-text">
          Reset
        </button>
      </div>
    </div>
  );
}
