import { useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Hash maps: hashing keys into buckets, with collisions (chaining).
   - Insert a player name -> a tiny hash spreads it across N buckets.
   - Collisions land in the same bucket and chain together.
   Plain HTML/Preact island using the site's CSS-variable classes.
   ------------------------------------------------------------------ */

const NUM_BUCKETS = 6;
const SUGGESTIONS = ['Aria', 'Bjorn', 'Cleo', 'Dax', 'Echo', 'Fen', 'Gus', 'Hana', 'Iris', 'Juno'];

// tiny deterministic string hash
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

type Entry = { key: string; code: number };

export default function HashBucketDistributor() {
  const [buckets, setBuckets] = useState<Entry[][]>(() =>
    Array.from({ length: NUM_BUCKETS }, () => [])
  );
  const [draft, setDraft] = useState('');
  const [last, setLast] = useState<{ key: string; code: number; idx: number; collided: boolean } | null>(
    null
  );
  const [sugg, setSugg] = useState(0);

  const insert = (raw: string) => {
    const key = raw.trim();
    if (!key) return;
    const code = hash(key);
    const idx = code % NUM_BUCKETS;
    setBuckets((bs) => {
      if (bs[idx].some((e) => e.key === key)) return bs; // no duplicate keys
      const collided = bs[idx].length > 0;
      setLast({ key, code, idx, collided });
      const copy = bs.map((b) => b.slice());
      copy[idx].push({ key, code });
      return copy;
    });
    setDraft('');
  };

  const addSuggestion = () => {
    insert(SUGGESTIONS[sugg % SUGGESTIONS.length]);
    setSugg((s) => s + 1);
  };

  const reset = () => {
    setBuckets(Array.from({ length: NUM_BUCKETS }, () => []));
    setLast(null);
    setSugg(0);
  };

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <p class="mb-3 text-sm text-muted">
        A player lookup table: a <strong>name</strong> (key) is hashed to a bucket index, where its record
        is stored for instant retrieval.
      </p>

      {/* input */}
      <div class="mb-3 flex flex-wrap gap-2">
        <input
          value={draft}
          onInput={(e) => setDraft((e.target as HTMLInputElement).value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') insert(draft);
          }}
          placeholder="type a name…"
          class="min-w-0 flex-1 rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-sm outline-none focus:border-brand"
        />
        <button
          onClick={() => insert(draft)}
          class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white transition hover:opacity-90"
        >
          insert
        </button>
        <button
          onClick={addSuggestion}
          class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-text transition hover:opacity-90"
        >
          + random
        </button>
        <button
          onClick={reset}
          class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted transition hover:text-text"
        >
          reset
        </button>
      </div>

      {/* computation readout */}
      {last && (
        <div
          class={`mb-3 rounded-lg p-3 text-center font-mono text-xs sm:text-sm ${
            last.collided ? 'bg-brand-soft text-brand' : 'bg-surface-2 text-text'
          }`}
        >
          hash("{last.key}") = {last.code} ; {last.code} mod {NUM_BUCKETS} ={' '}
          <strong>bucket {last.idx}</strong>
          {last.collided && <span class="ml-1 font-sans font-semibold">— collision! chained here</span>}
        </div>
      )}

      {/* buckets */}
      <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {buckets.map((bucket, i) => {
          const hot = last?.idx === i;
          return (
            <div
              key={i}
              class={`rounded-xl border p-2 ${
                hot ? 'border-brand ring-2 ring-brand' : 'border-border'
              } bg-surface-2`}
            >
              <div class="mb-1 text-[11px] font-bold uppercase tracking-wide text-muted">
                bucket {i}
              </div>
              <div class="flex min-h-[2rem] flex-col gap-1">
                {bucket.length === 0 && <span class="text-[11px] text-muted">empty</span>}
                {bucket.map((e, j) => (
                  <div key={e.key} class="flex items-center gap-1">
                    {j > 0 && <span class="text-muted">→</span>}
                    <span class="rounded bg-surface px-2 py-0.5 font-mono text-xs">{e.key}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <p class="mt-3 text-center text-xs text-muted">
        With a good spread, each bucket holds about one item, so lookup is <strong>O(1)</strong>. A
        collision chains a few entries — search just walks that short list.
      </p>
    </div>
  );
}
