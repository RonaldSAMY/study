import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Behavior Tree ticker.
   - A small guard-bot tree:
       Selector(root)
         Sequence "Fight"   -> [enemyVisible?, hasAmmo?, Attack]
         Sequence "Reload"  -> [outOfAmmo?, Reload]
         Action   "Patrol"
   - Toggle world facts (enemy visible, has ammo). Press "Tick" to walk
     the tree one node at a time; the active node + its result are
     highlighted (success=emerald, failure=amber).
   ------------------------------------------------------------------ */

type Status = 'idle' | 'success' | 'failure' | 'running';

interface TreeNode {
  id: string;
  label: string;
  kind: 'selector' | 'sequence' | 'condition' | 'action';
  children?: TreeNode[];
}

const TREE: TreeNode = {
  id: 'root', label: 'Selector (root)', kind: 'selector',
  children: [
    {
      id: 'fight', label: 'Sequence: Fight', kind: 'sequence',
      children: [
        { id: 'see', label: 'enemy visible?', kind: 'condition' },
        { id: 'ammo', label: 'has ammo?', kind: 'condition' },
        { id: 'attack', label: 'Attack', kind: 'action' },
      ],
    },
    {
      id: 'reload', label: 'Sequence: Reload', kind: 'sequence',
      children: [
        { id: 'empty', label: 'out of ammo?', kind: 'condition' },
        { id: 'doreload', label: 'Reload', kind: 'action' },
      ],
    },
    { id: 'patrol', label: 'Patrol', kind: 'action' },
  ],
};

const C = {
  running: '#4f46e5',
  success: '#10b981',
  failure: '#f59e0b',
};

interface World { enemy: boolean; ammo: boolean }

// Evaluate the whole tree, recording every visited node in order with its
// status. Pure function — lets us replay the tick step by step.
function evaluate(node: TreeNode, w: World, out: { id: string; status: Status }[]): Status {
  const leaf = (s: Status): Status => { out.push({ id: node.id, status: s }); return s; };

  if (node.kind === 'condition') {
    if (node.id === 'see') return leaf(w.enemy ? 'success' : 'failure');
    if (node.id === 'ammo') return leaf(w.ammo ? 'success' : 'failure');
    if (node.id === 'empty') return leaf(!w.ammo ? 'success' : 'failure');
    return leaf('failure');
  }
  if (node.kind === 'action') return leaf('success');

  if (node.kind === 'sequence') {
    for (const c of node.children!) {
      const s = evaluate(c, w, out);
      if (s !== 'success') { out.push({ id: node.id, status: 'failure' }); return 'failure'; }
    }
    out.push({ id: node.id, status: 'success' });
    return 'success';
  }
  // selector
  for (const c of node.children!) {
    const s = evaluate(c, w, out);
    if (s === 'success') { out.push({ id: node.id, status: 'success' }); return 'success'; }
  }
  out.push({ id: node.id, status: 'failure' });
  return 'failure';
}

function statusColor(s: Status | undefined): string | null {
  if (s === 'running') return C.running;
  if (s === 'success') return C.success;
  if (s === 'failure') return C.failure;
  return null;
}

function NodeRow({ node, depth, statuses, activeId }: {
  node: TreeNode; depth: number; statuses: Map<string, Status>; activeId: string | null;
}) {
  const s = statuses.get(node.id);
  const col = statusColor(s);
  const isActive = node.id === activeId;
  const icon = node.kind === 'selector' ? '?' : node.kind === 'sequence' ? '→' : node.kind === 'condition' ? '◇' : '●';
  return (
    <div>
      <div
        class="my-1 flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition"
        style={{
          marginLeft: `${depth * 18}px`,
          borderColor: col ?? 'var(--border)',
          background: col ? `${col}1a` : 'var(--surface-2)',
          color: col ?? 'var(--text)',
          fontWeight: col ? 700 : 500,
          outline: isActive ? `2px solid ${col ?? C.running}` : 'none',
        }}
      >
        <span class="font-mono opacity-70">{icon}</span>
        <span>{node.label}</span>
        {s && s !== 'idle' && <span class="ml-auto text-xs uppercase">{s}</span>}
      </div>
      {node.children?.map((c) => (
        <NodeRow key={c.id} node={c} depth={depth + 1} statuses={statuses} activeId={activeId} />
      ))}
    </div>
  );
}

export default function BTreeTickViz() {
  const [world, setWorld] = useState<World>({ enemy: true, ammo: true });
  const [step, setStep] = useState(0);
  const traceRef = useRef<{ id: string; status: Status }[]>([]);
  const timerRef = useRef<number | null>(null);

  // recompute trace whenever the world changes
  const trace: { id: string; status: Status }[] = [];
  evaluate(TREE, world, trace);
  traceRef.current = trace;

  useEffect(() => () => { if (timerRef.current !== null) clearTimeout(timerRef.current); }, []);

  // build status map up to current step
  const statuses = new Map<string, Status>();
  let activeId: string | null = null;
  for (let i = 0; i < Math.min(step, trace.length); i++) {
    statuses.set(trace[i].id, trace[i].status);
    if (i === step - 1) activeId = trace[i].id;
  }

  const done = step >= trace.length;
  const finalAction = (() => {
    if (!done) return null;
    for (let i = trace.length - 1; i >= 0; i--) {
      const t = trace[i];
      if (t.status === 'success' && ['attack', 'doreload', 'patrol'].includes(t.id)) {
        return t.id === 'attack' ? 'Attack' : t.id === 'doreload' ? 'Reload' : 'Patrol';
      }
    }
    return null;
  })();

  const reset = () => { if (timerRef.current !== null) clearTimeout(timerRef.current); setStep(0); };
  const tick = () => setStep((s) => Math.min(s + 1, trace.length));
  const setFact = (key: keyof World) => { setWorld((w) => ({ ...w, [key]: !w[key] })); reset(); };

  const autoRun = () => {
    reset();
    const run = (i: number) => {
      setStep(i);
      if (i < traceRef.current.length) timerRef.current = window.setTimeout(() => run(i + 1), 520) as unknown as number;
    };
    timerRef.current = window.setTimeout(() => run(1), 200) as unknown as number;
  };

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setFact('enemy')}
          class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${world.enemy ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'}`}
        >enemy visible: {world.enemy ? 'yes' : 'no'}</button>
        <button
          onClick={() => setFact('ammo')}
          class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${world.ammo ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'}`}
        >has ammo: {world.ammo ? 'yes' : 'no'}</button>
        <button onClick={tick} disabled={done} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-text hover:bg-brand-soft disabled:opacity-50">Tick ▸</button>
        <button onClick={autoRun} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-text hover:bg-brand-soft">Auto-run</button>
        <button onClick={reset} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">Reset</button>
      </div>

      <NodeRow node={TREE} depth={0} statuses={statuses} activeId={activeId} />

      <div class="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted">
        <span class="flex items-center gap-1"><span class="inline-block h-3 w-3 rounded" style={`background:${C.success}`} /> success</span>
        <span class="flex items-center gap-1"><span class="inline-block h-3 w-3 rounded" style={`background:${C.failure}`} /> failure</span>
        <span class="ml-auto">step {Math.min(step, trace.length)} / {trace.length}</span>
      </div>

      {done && finalAction && (
        <div class="mt-3 rounded-lg bg-brand-soft p-3 text-sm font-semibold text-brand">
          Tree resolved → the bot performs: {finalAction}
        </div>
      )}
    </div>
  );
}
