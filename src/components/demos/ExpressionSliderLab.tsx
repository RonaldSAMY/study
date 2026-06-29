import { useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Expression slider lab.
   - Slide the values of x and y.
   - The expression 2x + 3x + 4y − 5  evaluates live.
   - A toggle shows how collecting LIKE TERMS (2x + 3x = 5x) gives the
     exact same value with less writing — the bars prove it.
   ------------------------------------------------------------------ */

const COLORS = { x: '#4f46e5', y: '#0ea5e9', c: '#10b981' };

export default function ExpressionSliderLab() {
  const [x, setX] = useState(3);
  const [y, setY] = useState(2);
  const [simplified, setSimplified] = useState(false);

  // 2x + 3x + 4y − 5   ==   5x + 4y − 5
  const value = 5 * x + 4 * y - 5;

  // term contributions (for the bar chart)
  const terms = simplified
    ? [
        { label: '5x', val: 5 * x, color: COLORS.x },
        { label: '4y', val: 4 * y, color: COLORS.y },
        { label: '−5', val: -5, color: COLORS.c },
      ]
    : [
        { label: '2x', val: 2 * x, color: COLORS.x },
        { label: '3x', val: 3 * x, color: COLORS.x },
        { label: '4y', val: 4 * y, color: COLORS.y },
        { label: '−5', val: -5, color: COLORS.c },
      ];

  const maxMag = Math.max(10, ...terms.map((t) => Math.abs(t.val)));

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setSimplified((s) => !s)}
          class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
            simplified ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
          }`}
        >
          {simplified ? 'Showing: 5x + 4y − 5' : 'Showing: 2x + 3x + 4y − 5'}
        </button>
        <span class="text-xs text-muted">tap to {simplified ? 'expand' : 'simplify'}</span>
      </div>

      <div class="grid gap-4 md:grid-cols-2 md:items-start">
        <div class="space-y-4">
          <label class="block">
            <span class="mb-1 flex justify-between text-sm text-muted">
              <span style={`color:${COLORS.x}`} class="font-bold">x</span>
              <span class="font-mono font-bold text-text">{x}</span>
            </span>
            <input
              type="range" min={-5} max={5} step={1} value={x}
              onInput={(e) => setX(parseInt((e.target as HTMLInputElement).value, 10))}
              class="w-full accent-[#4f46e5]"
            />
          </label>
          <label class="block">
            <span class="mb-1 flex justify-between text-sm text-muted">
              <span style={`color:${COLORS.y}`} class="font-bold">y</span>
              <span class="font-mono font-bold text-text">{y}</span>
            </span>
            <input
              type="range" min={-5} max={5} step={1} value={y}
              onInput={(e) => setY(parseInt((e.target as HTMLInputElement).value, 10))}
              class="w-full accent-[#0ea5e9]"
            />
          </label>

          <div class="flex items-center justify-between rounded-xl bg-brand-soft p-3">
            <span class="text-sm font-semibold text-brand">value</span>
            <span class="font-mono text-2xl font-bold text-brand">{value}</span>
          </div>
          <p class="text-xs text-muted">
            Both forms always give the same number — that is what "simplifying" means.
          </p>
        </div>

        <div class="space-y-2 rounded-xl bg-surface-2 p-3">
          <p class="text-xs font-semibold uppercase tracking-wide text-muted">term contributions</p>
          {terms.map((t) => (
            <div key={t.label} class="flex items-center gap-2 text-sm">
              <span class="w-8 shrink-0 font-mono font-bold" style={`color:${t.color}`}>{t.label}</span>
              <div class="relative h-5 flex-1 rounded bg-surface">
                <div
                  class="absolute top-0 h-5 rounded"
                  style={`background:${t.color};left:50%;width:${(Math.abs(t.val) / maxMag) * 50}%;${
                    t.val < 0 ? 'transform:translateX(-100%);' : ''
                  }`}
                />
                <div class="absolute left-1/2 top-0 h-5 w-px bg-border" />
              </div>
              <span class="w-8 shrink-0 text-right font-mono font-semibold text-text">{t.val}</span>
            </div>
          ))}
          <div class="flex items-center gap-2 border-t border-border pt-2 text-sm">
            <span class="w-8 shrink-0 font-bold text-brand">Σ</span>
            <span class="flex-1 text-muted">sum of all terms</span>
            <span class="w-8 shrink-0 text-right font-mono font-bold text-brand">{value}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
