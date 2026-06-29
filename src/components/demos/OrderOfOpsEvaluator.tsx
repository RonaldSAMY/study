import { useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Order-of-operations evaluator.
   - Pick the variables a, b, c, d with sliders.
   - Toggle where the parentheses go: the SAME numbers and operators,
     grouped differently, give different answers.
   - The step-by-step evaluation and the final result update live.
   Expression skeleton:  a + b × c − d
   ------------------------------------------------------------------ */

type Opt = 0 | 1 | 2 | 3;

const OPTION_LABELS: Record<Opt, string> = {
  0: 'no parentheses',
  1: '( a + b ) × c − d',
  2: 'a + b × ( c − d )',
  3: '( a + b ) × ( c − d )',
};

function evalOption(opt: Opt, a: number, b: number, c: number, d: number) {
  switch (opt) {
    case 1: {
      const p = a + b, m = p * c, r = m - d;
      return {
        expr: `( ${a} + ${b} ) × ${c} − ${d}`,
        steps: [
          `Parentheses first:  ${a} + ${b} = ${p}`,
          `Multiply:  ${p} × ${c} = ${m}`,
          `Subtract:  ${m} − ${d} = ${r}`,
        ],
        result: r,
      };
    }
    case 2: {
      const p = c - d, m = b * p, r = a + m;
      return {
        expr: `${a} + ${b} × ( ${c} − ${d} )`,
        steps: [
          `Parentheses first:  ${c} − ${d} = ${p}`,
          `Multiply:  ${b} × ${p} = ${m}`,
          `Add:  ${a} + ${m} = ${r}`,
        ],
        result: r,
      };
    }
    case 3: {
      const p = a + b, q = c - d, r = p * q;
      return {
        expr: `( ${a} + ${b} ) × ( ${c} − ${d} )`,
        steps: [
          `Left parentheses:  ${a} + ${b} = ${p}`,
          `Right parentheses:  ${c} − ${d} = ${q}`,
          `Multiply:  ${p} × ${q} = ${r}`,
        ],
        result: r,
      };
    }
    default: {
      const m = b * c, s = a + m, r = s - d;
      return {
        expr: `${a} + ${b} × ${c} − ${d}`,
        steps: [
          `Multiply first (PEMDAS):  ${b} × ${c} = ${m}`,
          `Then left → right:  ${a} + ${m} = ${s}`,
          `Finally:  ${s} − ${d} = ${r}`,
        ],
        result: r,
      };
    }
  }
}

export default function OrderOfOpsEvaluator() {
  const [a, setA] = useState(2);
  const [b, setB] = useState(3);
  const [c, setC] = useState(4);
  const [d, setD] = useState(1);
  const [opt, setOpt] = useState<Opt>(0);

  const { expr, steps, result } = evalOption(opt, a, b, c, d);
  const baseResult = evalOption(0, a, b, c, d).result;
  const changed = result !== baseResult;

  const vars: [string, number, (n: number) => void][] = [
    ['a', a, setA],
    ['b', b, setB],
    ['c', c, setC],
    ['d', d, setD],
  ];

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-4 flex flex-wrap gap-2">
        {([0, 1, 2, 3] as Opt[]).map((o) => (
          <button
            key={o}
            onClick={() => setOpt(o)}
            class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              opt === o ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
            }`}
          >
            {OPTION_LABELS[o]}
          </button>
        ))}
      </div>

      <div class="grid gap-4 md:grid-cols-2 md:items-start">
        <div class="space-y-3">
          {vars.map(([name, val, set]) => (
            <label key={name} class="block">
              <span class="mb-1 flex justify-between text-sm text-muted">
                <span>
                  variable <span class="font-mono font-bold text-text">{name}</span>
                </span>
                <span class="font-mono font-bold text-text">{val}</span>
              </span>
              <input
                type="range"
                min={1}
                max={9}
                step={1}
                value={val}
                onInput={(e) => set(parseInt((e.target as HTMLInputElement).value, 10))}
                class="w-full accent-[#4f46e5]"
              />
            </label>
          ))}
        </div>

        <div class="space-y-3">
          <div class="rounded-xl bg-surface-2 p-3 text-center">
            <p class="font-mono text-lg font-bold text-text">{expr}</p>
          </div>

          <ol class="space-y-1.5 text-sm">
            {steps.map((s, i) => (
              <li key={i} class="flex gap-2 font-mono text-text">
                <span class="text-muted">{i + 1}.</span>
                <span>{s}</span>
              </li>
            ))}
          </ol>

          <div class="flex items-center justify-between rounded-xl bg-brand-soft p-3">
            <span class="text-sm font-semibold text-brand">result</span>
            <span class="font-mono text-2xl font-bold text-brand">{result}</span>
          </div>

          <p class="text-xs text-muted">
            {opt === 0
              ? 'No parentheses, so PEMDAS rules: × before + and −.'
              : changed
                ? `Same numbers — but the parentheses changed the answer (was ${baseResult}).`
                : `Here the parentheses happen to give the same answer (${baseResult}).`}
          </p>
        </div>
      </div>
    </div>
  );
}
