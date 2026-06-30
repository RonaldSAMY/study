import { useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Utility AI scorer.
   - Two needs (hunger, threat) on 0..1 sliders.
   - Each candidate action scores itself with a utility curve over the
     needs; the highest score wins (shown highlighted with bars).
   ------------------------------------------------------------------ */

const BAR = '#4f46e5';
const WIN = '#10b981';

interface Inputs { hunger: number; threat: number }
interface Action { id: string; label: string; icon: string; score: (i: Inputs) => number; }

// Utility curves: each action maps the world state to a 0..1 desirability.
const ACTIONS: Action[] = [
  { id: 'flee', label: 'Flee to safety', icon: '🏃', score: (i) => i.threat * i.threat },
  { id: 'eat', label: 'Eat food', icon: '🍖', score: (i) => i.hunger * (1 - i.threat) },
  { id: 'forage', label: 'Forage', icon: '🧺', score: (i) => Math.sqrt(i.hunger) * (1 - i.threat) * 0.7 },
  { id: 'rest', label: 'Rest', icon: '😴', score: (i) => (1 - i.hunger) * (1 - i.threat) * 0.6 },
];

export default function UtilityCurvePicker() {
  const [hunger, setHunger] = useState(0.7);
  const [threat, setThreat] = useState(0.2);
  const inputs: Inputs = { hunger, threat };

  const scored = ACTIONS.map((a) => ({ ...a, value: Math.max(0, Math.min(1, a.score(inputs))) }))
    .sort((x, y) => y.value - x.value);
  const best = scored[0];

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="grid gap-5 md:grid-cols-2 md:items-start">
        <div class="space-y-4 text-sm">
          <p class="text-muted">Set the agent's <strong>needs</strong>. Each action scores itself; the best one is chosen.</p>
          <Slider label="Hunger" value={hunger} set={setHunger} color="#f59e0b" />
          <Slider label="Threat" value={threat} set={setThreat} color="#ef4444" />
          <div class="rounded-lg bg-brand-soft p-3 font-semibold text-brand">
            Chosen action: {best.icon} {best.label} <span class="font-mono">({best.value.toFixed(2)})</span>
          </div>
        </div>

        <div class="space-y-2">
          <p class="mb-1 text-xs font-bold uppercase tracking-wide text-muted">Action scores</p>
          {scored.map((a, idx) => {
            const isBest = idx === 0;
            const col = isBest ? WIN : BAR;
            return (
              <div key={a.id} class="space-y-1">
                <div class="flex justify-between text-sm">
                  <span style={isBest ? `color:${WIN};font-weight:700` : ''}>{a.icon} {a.label}</span>
                  <span class="font-mono text-muted">{a.value.toFixed(2)}</span>
                </div>
                <div class="h-3 overflow-hidden rounded-full bg-surface-2">
                  <div class="h-full rounded-full transition-all" style={`width:${a.value * 100}%;background:${col}`} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Slider({ label, value, set, color }: { label: string; value: number; set: (n: number) => void; color: string }) {
  return (
    <label class="block">
      <span class="mb-1 flex justify-between text-muted"><span style={`color:${color};font-weight:600`}>{label}</span><span class="font-mono">{value.toFixed(2)}</span></span>
      <input
        type="range" min={0} max={1} step={0.01} value={value}
        onInput={(e) => set(parseFloat((e.target as HTMLInputElement).value))}
        class="w-full"
        style={`accent-color:${color}`}
      />
    </label>
  );
}
