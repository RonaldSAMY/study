import { useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Frame-budget meter.
   - Each game system has a per-frame cost in milliseconds.
   - A stacked bar shows the total against the 16.6 ms budget for 60 FPS.
   - Push any slider and watch the frame blow past the budget line,
     dragging the achievable FPS down with it.
   ------------------------------------------------------------------ */

type Sys = { key: string; label: string; color: string; ms: number };

const TARGETS = [
  { fps: 60, budget: 1000 / 60 },
  { fps: 30, budget: 1000 / 30 },
];

const INITIAL: Sys[] = [
  { key: 'sim', label: 'Physics / sim', color: '#4f46e5', ms: 3.2 },
  { key: 'ai', label: 'AI & pathfinding', color: '#0ea5e9', ms: 2.1 },
  { key: 'render', label: 'Rendering', color: '#10b981', ms: 5.4 },
  { key: 'audio', label: 'Audio mixing', color: '#f59e0b', ms: 1.1 },
  { key: 'gameplay', label: 'Gameplay scripts', color: '#ec4899', ms: 1.6 },
];

export default function FrameBudgetMeter() {
  const [systems, setSystems] = useState<Sys[]>(INITIAL);
  const [targetIdx, setTargetIdx] = useState(0);

  const budget = TARGETS[targetIdx].budget;
  const targetFps = TARGETS[targetIdx].fps;
  const total = systems.reduce((s, x) => s + x.ms, 0);
  const overBudget = total > budget;
  const achievableFps = Math.min(targetFps, Math.round(1000 / total));
  const headroom = budget - total;

  // bar scale: show up to the larger of the budget*1.6 or current total
  const scaleMax = Math.max(budget * 1.6, total * 1.05);

  const setMs = (key: string, ms: number) =>
    setSystems((prev) => prev.map((s) => (s.key === key ? { ...s, ms } : s)));

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        {TARGETS.map((t, i) => (
          <button
            key={t.fps}
            onClick={() => setTargetIdx(i)}
            class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              targetIdx === i ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
            }`}
          >
            Target {t.fps} FPS
          </button>
        ))}
        <span class="ml-auto text-sm text-muted">
          budget = <strong class="text-text">{budget.toFixed(1)} ms</strong>
        </span>
      </div>

      {/* stacked frame bar */}
      <div class="relative h-12 w-full overflow-hidden rounded-xl bg-surface-2">
        <div class="flex h-full">
          {systems.map((s) => (
            <div
              key={s.key}
              style={`width:${(s.ms / scaleMax) * 100}%;background:${s.color}`}
              class="h-full"
              title={`${s.label}: ${s.ms.toFixed(1)} ms`}
            />
          ))}
        </div>
        {/* budget marker */}
        <div
          class="absolute top-0 h-full border-l-2 border-dashed border-text/70"
          style={`left:${(budget / scaleMax) * 100}%`}
        >
          <span class="absolute -top-0 left-1 text-[10px] font-bold text-text/80">budget</span>
        </div>
      </div>

      <div class="mt-3 grid grid-cols-3 gap-2 text-sm">
        <Stat label="frame time" value={`${total.toFixed(1)} ms`} bad={overBudget} />
        <Stat label="achievable" value={`${achievableFps} FPS`} bad={overBudget} />
        <Stat
          label={headroom >= 0 ? 'headroom' : 'over by'}
          value={`${Math.abs(headroom).toFixed(1)} ms`}
          bad={overBudget}
        />
      </div>

      {overBudget && (
        <p class="mt-2 rounded-lg bg-geometry/10 p-2 text-xs font-semibold text-geometry">
          Over budget — the frame can't finish in time, so the game drops below {targetFps} FPS and stutters.
        </p>
      )}

      <div class="mt-4 space-y-2 text-sm">
        {systems.map((s) => (
          <label key={s.key} class="block">
            <span class="mb-1 flex items-center justify-between">
              <span class="flex items-center gap-2">
                <span class="inline-block h-3 w-3 rounded-sm" style={`background:${s.color}`} />
                <span class="text-muted">{s.label}</span>
              </span>
              <span class="font-mono font-semibold">{s.ms.toFixed(1)} ms</span>
            </span>
            <input
              type="range" min={0} max={12} step={0.1} value={s.ms}
              onInput={(e) => setMs(s.key, parseFloat((e.target as HTMLInputElement).value))}
              class="w-full"
              style={`accent-color:${s.color}`}
            />
          </label>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, bad }: { label: string; value: string; bad: boolean }) {
  return (
    <div class={`rounded-lg p-3 ${bad ? 'bg-geometry/10' : 'bg-surface-2'}`}>
      <div class="text-muted">{label}</div>
      <div class={`font-mono text-lg font-semibold ${bad ? 'text-geometry' : 'text-text'}`}>{value}</div>
    </div>
  );
}
