import { useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Dynamic arrays / growable lists.
   - Push entities into a list; when length hits capacity it doubles,
     triggering a (highlighted) reallocation + copy.
   - Tracks total copy operations to make "amortized O(1)" visible.
   Plain HTML/Preact island using the site's CSS-variable classes.
   ------------------------------------------------------------------ */

const GLYPHS = ['👾', '🤖', '👻', '🐉', '🦠', '🛸', '⚔️', '🔥', '🐙', '🦂', '🕷️', '🦅'];

type Step = { len: number; cap: number; reallocated: boolean; copied: number };

function start(): Step {
  return { len: 0, cap: 1, reallocated: false, copied: 0 };
}

export default function DynamicArrayGrowthLab() {
  const [step, setStep] = useState<Step>(start());
  const [totalCopies, setTotalCopies] = useState(0);

  const push = () => {
    setStep((s) => {
      if (s.len < s.cap) {
        return { len: s.len + 1, cap: s.cap, reallocated: false, copied: 0 };
      }
      // full → allocate a new block of double capacity, copy old elements
      const newCap = s.cap * 2;
      setTotalCopies((c) => c + s.len);
      return { len: s.len + 1, cap: newCap, reallocated: true, copied: s.len };
    });
  };

  const reset = () => {
    setStep(start());
    setTotalCopies(0);
  };

  const cells = Array.from({ length: step.cap }, (_, i) => i);

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <p class="mb-3 text-sm text-muted">
        Spawning <strong>enemies</strong> into a growable list. When it fills up, the list grabs a bigger
        block and copies everything over.
      </p>

      {/* the backing block */}
      <div class="mb-3 flex flex-wrap gap-1.5">
        {cells.map((i) => {
          const filled = i < step.len;
          const justCopied = step.reallocated && i < step.copied;
          return (
            <div
              key={i}
              class={`grid h-10 w-10 place-items-center rounded-lg border text-lg transition ${
                filled
                  ? justCopied
                    ? 'border-brand bg-brand-soft ring-2 ring-brand'
                    : 'border-border bg-surface-2'
                  : 'border-dashed border-border bg-surface text-muted'
              }`}
              title={filled ? `index ${i}` : 'reserved (empty) capacity'}
            >
              {filled ? GLYPHS[i % GLYPHS.length] : ''}
            </div>
          );
        })}
      </div>

      {step.reallocated && (
        <p class="mb-3 rounded-lg bg-brand-soft px-3 py-2 text-xs font-semibold text-brand">
          ⚡ Full! Allocated a block of capacity {step.cap} and copied {step.copied} existing element
          {step.copied === 1 ? '' : 's'} across.
        </p>
      )}

      <div class="mb-3 flex gap-2">
        <button
          onClick={push}
          class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white transition hover:opacity-90"
        >
          push() an enemy
        </button>
        <button
          onClick={reset}
          class="rounded-lg bg-surface-2 px-4 py-1.5 text-sm font-semibold text-muted transition hover:text-text"
        >
          reset
        </button>
      </div>

      <div class="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <Readout label="length" value={String(step.len)} />
        <Readout label="capacity" value={String(step.cap)} />
        <Readout label="load" value={step.cap ? `${Math.round((step.len / step.cap) * 100)}%` : '0%'} />
        <Readout label="total copies" value={String(totalCopies)} />
      </div>

      <p class="mt-3 text-center text-xs text-muted">
        Most pushes are free O(1). A few are expensive (the copies). Spread over all the pushes, the
        average stays O(1) — that's <strong>amortized</strong> cost.
      </p>
    </div>
  );
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div class="rounded-lg bg-surface-2 px-3 py-2 text-center">
      <span class="text-muted">{label}</span>
      <div class="font-mono font-semibold">{value}</div>
    </div>
  );
}
