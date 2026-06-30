import { useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Stacks (LIFO) and Queues (FIFO) side by side.
   - Stack: push adds on top, pop removes from the top (undo system).
   - Queue: enqueue adds at the back, dequeue removes from the front
     (matchmaking / turn order).
   Plain HTML/Preact island with the site's CSS-variable classes.
   ------------------------------------------------------------------ */

type Mode = 'stack' | 'queue';

let counter = 1;
const nextLabel = () => `#${counter++}`;

export default function StackQueueSimulator() {
  const [mode, setMode] = useState<Mode>('stack');
  const [items, setItems] = useState<string[]>(['#0']);
  const [note, setNote] = useState('');

  const add = () => {
    const v = nextLabel();
    setItems((xs) => [...xs, v]); // we always append; removal end differs
    setNote(mode === 'stack' ? `push(${v}) → onto the top` : `enqueue(${v}) → joins the back`);
  };

  const remove = () => {
    setItems((xs) => {
      if (xs.length === 0) {
        setNote('empty — nothing to remove');
        return xs;
      }
      if (mode === 'stack') {
        const top = xs[xs.length - 1];
        setNote(`pop() → removed ${top} (most recent)`);
        return xs.slice(0, -1);
      }
      const front = xs[0];
      setNote(`dequeue() → removed ${front} (oldest)`);
      return xs.slice(1);
    });
  };

  const reset = () => {
    counter = 1;
    setItems(['#0']);
    setNote('');
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setNote('');
  };

  const addLabel = mode === 'stack' ? 'push()' : 'enqueue()';
  const removeLabel = mode === 'stack' ? 'pop()' : 'dequeue()';

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex gap-2">
        {(['stack', 'queue'] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => switchMode(m)}
            class={`rounded-lg px-3 py-1.5 text-sm font-semibold capitalize transition ${
              mode === m ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
            }`}
          >
            {m === 'stack' ? 'Stack (LIFO)' : 'Queue (FIFO)'}
          </button>
        ))}
      </div>

      <p class="mb-3 text-sm text-muted">
        {mode === 'stack'
          ? 'An undo stack: the last action you did is the first one undone.'
          : 'A matchmaking queue: the first player to join is the first matched.'}
      </p>

      {/* visualization */}
      {mode === 'stack' ? (
        <div class="mb-3 flex min-h-[180px] flex-col-reverse items-center justify-start gap-1.5 rounded-xl bg-surface-2 p-3">
          {items.length === 0 && <span class="text-xs text-muted">empty stack</span>}
          {items.map((it, i) => {
            const isTop = i === items.length - 1;
            return (
              <div
                key={it}
                class={`flex w-32 items-center justify-between rounded-lg border px-3 py-2 font-mono text-sm ${
                  isTop ? 'border-brand bg-brand-soft ring-2 ring-brand' : 'border-border bg-surface'
                }`}
              >
                <span>{it}</span>
                {isTop && <span class="text-[10px] font-sans font-semibold text-brand">top</span>}
              </div>
            );
          })}
        </div>
      ) : (
        <div class="mb-3 flex min-h-[80px] items-center gap-1.5 overflow-x-auto rounded-xl bg-surface-2 p-3">
          {items.length === 0 && <span class="text-xs text-muted">empty queue</span>}
          {items.map((it, i) => {
            const isFront = i === 0;
            const isBack = i === items.length - 1;
            return (
              <div
                key={it}
                class={`flex shrink-0 flex-col items-center rounded-lg border px-3 py-2 font-mono text-sm ${
                  isFront ? 'border-brand bg-brand-soft ring-2 ring-brand' : 'border-border bg-surface'
                }`}
              >
                <span>{it}</span>
                {(isFront || isBack) && (
                  <span class="text-[10px] font-sans font-semibold text-brand">
                    {isFront ? 'front' : 'back'}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div class="mb-3 flex gap-2">
        <button
          onClick={add}
          class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white transition hover:opacity-90"
        >
          {addLabel}
        </button>
        <button
          onClick={remove}
          class="rounded-lg bg-surface-2 px-4 py-1.5 text-sm font-semibold text-text transition hover:opacity-90"
        >
          {removeLabel}
        </button>
        <button
          onClick={reset}
          class="rounded-lg bg-surface-2 px-4 py-1.5 text-sm font-semibold text-muted transition hover:text-text"
        >
          reset
        </button>
      </div>

      <div class="rounded-lg bg-surface-2 p-3 text-center text-sm">
        <span class="font-mono">{note || 'Try adding and removing items.'}</span>
      </div>
    </div>
  );
}
