import { useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Reusable in-browser code runner.
   - Shows a (read-only) snippet of plain JavaScript and a "Run" button.
   - On Run, the code is evaluated client-side with `new Function`, any
     console.log output is captured, and the value of each test expression
     is printed next to it.
   - Pass `code` (the snippet the learner reads) and `tests` (expressions
     evaluated AFTER the code runs, in the same scope). The snippet must be
     plain JS (no TS types) so it actually executes.

   Example:
     <CodeRunner client:visible
       code={`function add(a, b) { return a + b; }`}
       tests={[{ expr: 'add(2, 3)' }, { expr: 'add(-1, 1)' }]}
     />
   ------------------------------------------------------------------ */

type Test = { expr: string; label?: string };
type Line = { kind: 'log' | 'result' | 'error'; label: string; value: string };

function show(v: unknown): string {
  if (typeof v === 'string') return v;
  if (typeof v === 'function') return '[Function]';
  try {
    return JSON.stringify(v, (_k, val) => (typeof val === 'bigint' ? val.toString() : val));
  } catch {
    return String(v);
  }
}

export default function CodeRunner({
  code,
  tests = [],
  title = 'Run it',
  autoRun = false,
}: {
  code: string;
  tests?: Test[];
  title?: string;
  autoRun?: boolean;
}) {
  const [lines, setLines] = useState<Line[]>([]);
  const [ran, setRan] = useState(false);

  const run = () => {
    const out: Line[] = [];
    const logs: string[] = [];
    const fakeConsole = {
      log: (...args: unknown[]) => logs.push(args.map(show).join(' ')),
      warn: (...args: unknown[]) => logs.push(args.map(show).join(' ')),
      error: (...args: unknown[]) => logs.push(args.map(show).join(' ')),
    };
    try {
      // Build a function whose body is the snippet plus a return of all test
      // expressions, so declarations in `code` are in scope for the tests.
      const exprs = tests.length ? `[${tests.map((t) => `(${t.expr})`).join(',')}]` : '[]';
      // eslint-disable-next-line no-new-func
      const fn = new Function('console', `${code}\n;return ${exprs};`);
      const results = fn(fakeConsole) as unknown[];
      for (const l of logs) out.push({ kind: 'log', label: 'console', value: l });
      tests.forEach((t, i) => {
        out.push({ kind: 'result', label: t.label ?? t.expr, value: show(results[i]) });
      });
    } catch (err) {
      for (const l of logs) out.push({ kind: 'log', label: 'console', value: l });
      out.push({ kind: 'error', label: 'error', value: err instanceof Error ? err.message : String(err) });
    }
    setLines(out);
    setRan(true);
  };

  if (autoRun && !ran) run();

  return (
    <div class="not-prose my-4 overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
      <div class="flex items-center justify-between border-b border-border bg-surface-2 px-4 py-2">
        <span class="text-xs font-semibold uppercase tracking-wide text-muted">{title}</span>
        <button
          onClick={run}
          class="rounded-lg bg-brand px-3 py-1 text-sm font-semibold text-white transition hover:opacity-90"
        >
          ▶ Run
        </button>
      </div>
      <pre class="overflow-x-auto px-4 py-3 text-[13px] leading-relaxed"><code class="font-mono text-text">{code}</code></pre>
      {ran && (
        <div class="border-t border-border bg-surface-2 px-4 py-3 font-mono text-[13px]">
          {lines.length === 0 && <div class="text-muted">(no output)</div>}
          {lines.map((l, i) => (
            <div key={i} class="flex gap-2 py-0.5">
              <span
                class={
                  l.kind === 'error'
                    ? 'text-rose-500'
                    : l.kind === 'log'
                      ? 'text-muted'
                      : 'text-[#10b981]'
                }
              >
                {l.kind === 'log' ? '›' : l.kind === 'error' ? '✕' : '⟶'}
              </span>
              <span class="text-muted">{l.label}</span>
              <span class="text-text">=</span>
              <span class={`flex-1 break-all ${l.kind === 'error' ? 'text-rose-500' : 'text-text'}`}>{l.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
