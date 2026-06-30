import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Interactive ECS component table.
   - Entities are ROWS, components are COLUMNS (Position, Velocity,
     Health, Sprite). Each cell shows whether an entity *has* that
     component, and its value.
   - "Run MovementSystem" sweeps the Position + Velocity component
     arrays row by row (the archetype that has BOTH). The current row
     is highlighted and its position is advanced by its velocity.
   - A "struct-of-arrays" strip below shows the same Position/Velocity
     data laid out as contiguous arrays — the cache-friendly view a
     real system actually iterates.
   - Click a cell to add/remove a component from an entity. Entities
     missing Position or Velocity are skipped by the system.
   ------------------------------------------------------------------ */

const INDIGO = '#4f46e5';
const SKY = '#0ea5e9';
const EMERALD = '#10b981';

type CompKey = 'position' | 'velocity' | 'health' | 'sprite';

type Entity = {
  id: string;
  emoji: string;
  pos: { x: number; y: number };
  vel: { x: number; y: number };
  health: number;
  has: Record<CompKey, boolean>;
};

const COMPONENTS: { key: CompKey; label: string; color: string }[] = [
  { key: 'position', label: 'Position', color: SKY },
  { key: 'velocity', label: 'Velocity', color: INDIGO },
  { key: 'health', label: 'Health', color: EMERALD },
  { key: 'sprite', label: 'Sprite', color: '#a855f7' },
];

function initialEntities(): Entity[] {
  return [
    { id: 'e0', emoji: '🚀', pos: { x: 0, y: 0 }, vel: { x: 2, y: 1 }, health: 100, has: { position: true, velocity: true, health: true, sprite: true } },
    { id: 'e1', emoji: '👾', pos: { x: 5, y: 3 }, vel: { x: -1, y: 0 }, health: 60, has: { position: true, velocity: true, health: true, sprite: true } },
    { id: 'e2', emoji: '🪨', pos: { x: 8, y: 2 }, vel: { x: 0, y: 0 }, health: 100, has: { position: true, velocity: false, health: false, sprite: true } },
    { id: 'e3', emoji: '💥', pos: { x: 3, y: 7 }, vel: { x: 1, y: -2 }, health: 20, has: { position: true, velocity: true, health: true, sprite: true } },
    { id: 'e4', emoji: '🔊', pos: { x: 0, y: 0 }, vel: { x: 0, y: 0 }, health: 0, has: { position: false, velocity: false, health: false, sprite: false } },
  ];
}

const STEP_MS = 650;

export default function EcsComponentTable() {
  const [entities, setEntities] = useState<Entity[]>(initialEntities);
  const [running, setRunning] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [steps, setSteps] = useState(0);

  // animation bookkeeping lives in refs so the rAF loop never goes stale
  const rafRef = useRef<number | null>(null);
  const stepStartRef = useRef(0);
  const queueRef = useRef<number[]>([]);
  const qIdxRef = useRef(0);

  // always cancel the animation frame on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const stopSweep = () => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    setRunning(false);
    setActiveIndex(-1);
  };

  const applyMovement = (i: number) => {
    setEntities((prev) =>
      prev.map((e, idx) =>
        idx === i ? { ...e, pos: { x: e.pos.x + e.vel.x, y: e.pos.y + e.vel.y } } : e,
      ),
    );
    setSteps((s) => s + 1);
  };

  const tick = (now: number) => {
    if (now - stepStartRef.current >= STEP_MS) {
      stepStartRef.current = now;
      qIdxRef.current += 1;
      const q = queueRef.current;
      if (qIdxRef.current >= q.length) {
        stopSweep();
        return;
      }
      const ent = q[qIdxRef.current];
      setActiveIndex(ent);
      applyMovement(ent);
    }
    rafRef.current = requestAnimationFrame(tick);
  };

  const runSystem = () => {
    if (running) {
      stopSweep();
      return;
    }
    // The MovementSystem's archetype: entities owning BOTH Position and Velocity.
    const q = entities.map((_, i) => i).filter((i) => entities[i].has.position && entities[i].has.velocity);
    if (q.length === 0) return;
    queueRef.current = q;
    qIdxRef.current = 0;
    setSteps(0);
    setRunning(true);
    setActiveIndex(q[0]);
    applyMovement(q[0]);
    stepStartRef.current = performance.now();
    rafRef.current = requestAnimationFrame(tick);
  };

  const reset = () => {
    stopSweep();
    setSteps(0);
    setEntities(initialEntities());
  };

  const toggleComponent = (i: number, key: CompKey) => {
    if (running) return;
    setEntities((prev) =>
      prev.map((e, idx) => (idx === i ? { ...e, has: { ...e.has, [key]: !e.has[key] } } : e)),
    );
  };

  const cellText = (e: Entity, key: CompKey): string => {
    switch (key) {
      case 'position':
        return `(${e.pos.x}, ${e.pos.y})`;
      case 'velocity':
        return `(${e.vel.x}, ${e.vel.y})`;
      case 'health':
        return `${e.health}`;
      case 'sprite':
        return e.emoji;
    }
  };

  const archetypeCount = entities.filter((e) => e.has.position && e.has.velocity).length;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      {/* controls */}
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <button
          onClick={runSystem}
          class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
            running ? 'bg-surface-2 text-text hover:text-text' : 'bg-brand text-white'
          }`}
        >
          {running ? '■ Stop' : '▶ Run MovementSystem'}
        </button>
        <button
          onClick={reset}
          class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted transition hover:text-text"
        >
          ↺ Reset
        </button>
        <span class="ml-auto text-xs text-muted">
          archetype <span class="font-mono font-semibold text-text">Position+Velocity</span>:{' '}
          {archetypeCount} of {entities.length}
        </span>
      </div>

      {/* the entity x component table */}
      <div class="overflow-x-auto rounded-xl border border-border">
        <table class="w-full border-collapse text-sm">
          <thead>
            <tr class="bg-surface-2">
              <th class="px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-muted">Entity</th>
              {COMPONENTS.map((c) => (
                <th key={c.key} class="px-3 py-2 text-left text-xs font-bold uppercase tracking-wide" style={`color:${c.color}`}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {entities.map((e, i) => {
              const isActive = i === activeIndex;
              return (
                <tr
                  key={e.id}
                  class={`border-t border-border transition-colors ${isActive ? 'bg-brand-soft' : ''}`}
                >
                  <td class="px-3 py-2 font-mono font-semibold text-text">
                    <span class="mr-1">{e.emoji}</span>
                    {e.id}
                    {isActive && <span class="ml-2 text-brand">◀ system here</span>}
                  </td>
                  {COMPONENTS.map((c) => {
                    const present = e.has[c.key];
                    const litBySystem = isActive && (c.key === 'position' || c.key === 'velocity') && present;
                    return (
                      <td key={c.key} class="px-2 py-2">
                        <button
                          onClick={() => toggleComponent(i, c.key)}
                          disabled={running}
                          title={present ? 'Click to remove component' : 'Click to add component'}
                          class={`flex w-full items-center gap-2 rounded-md px-2 py-1 text-left font-mono transition ${
                            present
                              ? litBySystem
                                ? 'bg-brand text-white'
                                : 'bg-surface-2 text-text'
                              : 'text-muted hover:text-text'
                          } ${running ? '' : 'cursor-pointer'}`}
                        >
                          {present ? (
                            <>
                              <span style={litBySystem ? '' : `color:${c.color}`}>●</span>
                              <span>{cellText(e, c.key)}</span>
                            </>
                          ) : (
                            <span class="opacity-50">+ none</span>
                          )}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* struct-of-arrays strip: contiguous component arrays the system sweeps */}
      <div class="mt-4 grid gap-3">
        <p class="text-xs text-muted">
          How the engine really stores it — <strong class="text-text">struct of arrays</strong>. The system marches
          left-to-right through these contiguous arrays (one cache line at a time), touching nothing else:
        </p>
        <ArrayStrip
          label="Position[]"
          color={SKY}
          entities={entities}
          activeIndex={activeIndex}
          compKey="position"
        />
        <ArrayStrip
          label="Velocity[]"
          color={INDIGO}
          entities={entities}
          activeIndex={activeIndex}
          compKey="velocity"
        />
      </div>

      {/* readouts */}
      <div class="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Readout label="entities" value={`${entities.length}`} />
        <Readout label="in archetype" value={`${archetypeCount}`} accent={INDIGO} />
        <Readout label="rows swept" value={`${steps}`} accent={EMERALD} />
        <Readout label="status" value={running ? 'running…' : 'idle'} accent={SKY} />
      </div>

      <p class="mt-3 text-xs text-muted">
        Tip: remove Velocity from an entity (click its cell) and re-run — the system simply skips it, because it is no
        longer in the archetype. No branching on object type, no pointer chasing.
      </p>
    </div>
  );
}

function ArrayStrip({
  label,
  color,
  entities,
  activeIndex,
  compKey,
}: {
  label: string;
  color: string;
  entities: Entity[];
  activeIndex: number;
  compKey: 'position' | 'velocity';
}) {
  // Only entities that own this component live in the packed array.
  const cells = entities
    .map((e, i) => ({ e, i }))
    .filter(({ e }) => e.has[compKey]);
  return (
    <div class="flex flex-wrap items-center gap-2">
      <span class="w-20 shrink-0 font-mono text-xs font-semibold" style={`color:${color}`}>
        {label}
      </span>
      <div class="flex flex-wrap gap-1">
        {cells.map(({ e, i }) => {
          const isActive = i === activeIndex;
          const v = compKey === 'position' ? e.pos : e.vel;
          return (
            <div
              key={e.id}
              class={`rounded-md border px-2 py-1 text-center font-mono text-xs transition-colors ${
                isActive ? 'border-transparent bg-brand text-white' : 'border-border bg-surface-2 text-text'
              }`}
            >
              <div class="text-[10px] opacity-70">{e.id}</div>
              <div>
                {v.x},{v.y}
              </div>
            </div>
          );
        })}
        {cells.length === 0 && <span class="text-xs text-muted">empty</span>}
      </div>
    </div>
  );
}

function Readout({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div class="rounded-lg bg-surface-2 px-3 py-2">
      <span class="text-xs text-muted" style={accent ? `color:${accent}` : ''}>
        {label}
      </span>
      <div class="font-mono text-sm font-semibold text-text">{value}</div>
    </div>
  );
}
