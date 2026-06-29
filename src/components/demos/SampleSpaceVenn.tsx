import { useMemo, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Sample Spaces & Events — clickable grid of outcomes.
   - 36 numbered lottery balls form the sample space Ω.
   - Event A is editable: click a ball to add/remove it from A (indigo).
   - Event B is a fixed rule ("greater than 24", sky).
   - Mode buttons compute P(A), P(B), P(A∪B), P(A∩B) and P(Aᶜ),
     recoloring the grid and updating the probability readout live.
   ------------------------------------------------------------------ */

type Mode = 'A' | 'B' | 'union' | 'inter' | 'compA';

const N = 36;
const ALL = Array.from({ length: N }, (_, i) => i + 1);
// Event B (fixed): the ball number is greater than 24.
const B = new Set(ALL.filter((n) => n > 24));
// Event A starts as "a multiple of 3" — but the learner can edit it.
const A_START = ALL.filter((n) => n % 3 === 0);

const C = {
  a: '#4f46e5',
  b: '#0ea5e9',
  both: '#10b981',
};

const MODES: { id: Mode; label: string; desc: string }[] = [
  { id: 'A', label: 'A', desc: 'Event A (your selection)' },
  { id: 'B', label: 'B', desc: 'Event B: number > 24' },
  { id: 'union', label: 'A ∪ B', desc: 'In A or B (or both)' },
  { id: 'inter', label: 'A ∩ B', desc: 'In both A and B' },
  { id: 'compA', label: 'Aᶜ', desc: 'Everything NOT in A' },
];

export default function SampleSpaceVenn() {
  const [A, setA] = useState<Set<number>>(new Set(A_START));
  const [mode, setMode] = useState<Mode>('A');

  const toggle = (n: number) => {
    setA((prev) => {
      const next = new Set(prev);
      next.has(n) ? next.delete(n) : next.add(n);
      return next;
    });
  };

  const inEvent = useMemo(() => {
    return (n: number): boolean => {
      const inA = A.has(n);
      const inB = B.has(n);
      switch (mode) {
        case 'A': return inA;
        case 'B': return inB;
        case 'union': return inA || inB;
        case 'inter': return inA && inB;
        case 'compA': return !inA;
      }
    };
  }, [A, mode]);

  const count = ALL.filter(inEvent).length;
  const prob = count / N;
  const activeMode = MODES.find((m) => m.id === mode)!;

  const cellColor = (n: number) => {
    const inA = A.has(n);
    const inB = B.has(n);
    if (!inEvent(n)) return null;
    if (mode === 'union') return inA && inB ? C.both : inA ? C.a : C.b;
    if (mode === 'inter') return C.both;
    if (mode === 'B') return C.b;
    return C.a; // A or complement
  };

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap gap-2">
        {MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              mode === m.id ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div class="grid gap-4 md:grid-cols-[1fr,auto] md:items-start">
        <div>
          <div class="grid grid-cols-6 gap-1.5">
            {ALL.map((n) => {
              const col = cellColor(n);
              const selected = col !== null;
              return (
                <button
                  key={n}
                  onClick={() => toggle(n)}
                  title="Click to add/remove from event A"
                  class="touch-none grid aspect-square place-items-center rounded-md border text-sm font-bold transition"
                  style={
                    selected
                      ? `background:${col};border-color:${col};color:#fff`
                      : 'background:var(--surface-2,#f1f5f9);border-color:transparent'
                  }
                >
                  {n}
                </button>
              );
            })}
          </div>
          <p class="mt-2 text-xs text-muted">
            Click any ball to add or remove it from <strong>event A</strong>. The grid recolors for the mode you pick.
          </p>
        </div>

        <div class="space-y-3 text-sm md:w-56">
          <div class="rounded-lg bg-surface-2 p-3">
            <div class="text-muted">{activeMode.label} — {activeMode.desc}</div>
            <div class="mt-2 flex items-baseline justify-between">
              <span class="text-muted">favorable</span>
              <strong class="font-mono">{count} / {N}</strong>
            </div>
            <div class="flex items-baseline justify-between">
              <span class="text-muted">P</span>
              <strong class="font-mono text-lg" style={`color:${C.both}`}>{prob.toFixed(3)}</strong>
            </div>
          </div>
          <div class="space-y-1.5 text-xs text-muted">
            <div class="flex items-center gap-2"><span class="inline-block h-3 w-3 rounded-sm" style={`background:${C.a}`} /> only in A</div>
            <div class="flex items-center gap-2"><span class="inline-block h-3 w-3 rounded-sm" style={`background:${C.b}`} /> only in B</div>
            <div class="flex items-center gap-2"><span class="inline-block h-3 w-3 rounded-sm" style={`background:${C.both}`} /> in both (A ∩ B)</div>
          </div>
          <p class="text-xs text-muted">
            Each of the {N} balls is equally likely, so probability is just the fraction of the grid that lights up.
          </p>
        </div>
      </div>
    </div>
  );
}
