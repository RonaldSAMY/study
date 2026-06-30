import { useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Utility-AI action selector for a survival-sim creature.
   - Three "needs" become sliders (0..1).
   - Each candidate action scores itself with a small utility curve.
   - The bars update live and the highest score wins — that is the action
     the agent would take this tick.
   ------------------------------------------------------------------ */

type Need = { key: 'hunger' | 'threat' | 'tired'; label: string; color: string };
const NEEDS: Need[] = [
  { key: 'hunger', label: 'Hunger', color: '#f59e0b' },
  { key: 'threat', label: 'Threat', color: '#ef4444' },
  { key: 'tired', label: 'Tiredness', color: '#0ea5e9' },
];

type Inputs = { hunger: number; threat: number; tired: number };

type Action = { name: string; icon: string; score: (i: Inputs) => number; note: string };
const ACTIONS: Action[] = [
  { name: 'Flee', icon: '🏃', score: (i) => Math.pow(i.threat, 1.4), note: 'threat^1.4 — danger overrides everything' },
  { name: 'Eat', icon: '🍖', score: (i) => i.hunger * i.hunger * (1 - i.threat), note: 'hunger² but only when safe' },
  { name: 'Sleep', icon: '😴', score: (i) => i.tired * i.tired * (1 - i.threat) * (1 - 0.5 * i.hunger), note: 'tiredness² when safe and fed' },
  { name: 'Wander', icon: '🚶', score: (i) => 0.22 * (1 - i.threat), note: 'a small constant baseline' },
];

export default function UtilityAiScorer() {
  const [inp, setInp] = useState<Inputs>({ hunger: 0.5, threat: 0.15, tired: 0.4 });

  const scored = ACTIONS.map((a) => ({ ...a, value: Math.max(0, Math.min(1, a.score(inp))) }));
  const best = scored.reduce((m, a) => (a.value > m.value ? a : m), scored[0]);

  const set = (key: Need['key'], v: number) => setInp((p) => ({ ...p, [key]: v }));

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="grid gap-5 md:grid-cols-2 md:items-start">
        <div class="space-y-3">
          <p class="text-sm text-muted">Drag the needs. Each one feeds the scoring curves on the right.</p>
          {NEEDS.map((n) => (
            <label key={n.key} class="block text-sm">
              <span class="mb-1 block font-medium" style={`color:${n.color}`}>
                {n.label} = {inp[n.key].toFixed(2)}
              </span>
              <input
                type="range" min={0} max={1} step={0.01} value={inp[n.key]}
                onInput={(e) => set(n.key, parseFloat((e.target as HTMLInputElement).value))}
                class="w-full"
                style={`accent-color:${n.color}`}
              />
            </label>
          ))}

          <div class="rounded-lg bg-brand-soft p-3 text-sm">
            <span class="text-muted">Chosen action</span>
            <div class="text-lg font-bold text-brand">{best.icon} {best.name}</div>
            <p class="mt-1 text-xs text-muted">argmax of the utility scores — recomputed every tick.</p>
          </div>
        </div>

        <div class="space-y-2.5">
          {scored.map((a) => {
            const isBest = a.name === best.name;
            return (
              <div key={a.name} class={`rounded-lg border p-2.5 transition ${isBest ? 'border-brand bg-brand-soft' : 'border-border bg-surface-2'}`}>
                <div class="mb-1 flex items-center justify-between text-sm">
                  <span class="font-semibold">{a.icon} {a.name}</span>
                  <span class="font-mono">{a.value.toFixed(2)}</span>
                </div>
                <div class="h-2.5 w-full overflow-hidden rounded-full bg-surface">
                  <div
                    class="h-full rounded-full transition-all duration-200"
                    style={`width:${(a.value * 100).toFixed(1)}%;background:${isBest ? '#4f46e5' : '#0ea5e9'}`}
                  />
                </div>
                <p class="mt-1 text-[0.7rem] text-muted">{a.note}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
