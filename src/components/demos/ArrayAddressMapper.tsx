import { useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Arrays & memory layout.
   - An 8-slot inventory array laid out in contiguous memory.
   - Pick an index; watch address = base + i * elementSize compute live.
   - Slide the element size to see the stride change.
   Plain HTML/Preact island (memory cells are naturally box-based),
   using the site's CSS-variable Tailwind classes. Touch friendly.
   ------------------------------------------------------------------ */

const ITEMS = ['🗡️', '🛡️', '🧪', '🍞', '💎', '🔑', '🏹', '📜'];
const BASE = 0x1000; // pretend start address of the array
const SIZES = [1, 2, 4, 8];

const hex = (n: number) => '0x' + n.toString(16).toUpperCase();

export default function ArrayAddressMapper() {
  const [size, setSize] = useState(4); // bytes per element
  const [sel, setSel] = useState(3); // selected index

  const addr = BASE + sel * size;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <p class="mb-3 text-sm text-muted">
        An 8-slot <strong>inventory</strong> array sitting in contiguous memory. Tap a slot to look up its
        address.
      </p>

      {/* the array cells */}
      <div class="mb-4 grid grid-cols-8 gap-1.5">
        {ITEMS.map((it, i) => {
          const active = i === sel;
          return (
            <button
              key={i}
              onClick={() => setSel(i)}
              class={`flex aspect-square flex-col items-center justify-center rounded-lg border text-xl transition ${
                active
                  ? 'border-brand bg-brand-soft ring-2 ring-brand'
                  : 'border-border bg-surface-2 hover:border-brand'
              }`}
              title={`index ${i}`}
            >
              <span>{it}</span>
              <span class="mt-0.5 text-[10px] font-mono text-muted">{i}</span>
            </button>
          );
        })}
      </div>

      {/* address ruler */}
      <div class="mb-4 grid grid-cols-8 gap-1.5">
        {ITEMS.map((_, i) => (
          <div
            key={i}
            class={`rounded px-0.5 py-1 text-center font-mono text-[9px] sm:text-[10px] ${
              i === sel ? 'bg-brand text-white' : 'bg-surface-2 text-muted'
            }`}
          >
            {hex(BASE + i * size)}
          </div>
        ))}
      </div>

      {/* controls */}
      <label class="mb-3 block text-sm">
        <span class="mb-1 block text-muted">
          element size = <strong class="text-text">{size} byte{size > 1 ? 's' : ''}</strong>
        </span>
        <div class="flex gap-2">
          {SIZES.map((s) => (
            <button
              key={s}
              onClick={() => setSize(s)}
              class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                size === s ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
              }`}
            >
              {s}B
            </button>
          ))}
        </div>
      </label>

      {/* live readout */}
      <div class="rounded-lg bg-surface-2 p-3 text-sm">
        <div class="grid grid-cols-3 gap-2">
          <Readout label="base" value={hex(BASE)} />
          <Readout label="index i" value={String(sel)} />
          <Readout label="size" value={`${size} B`} />
        </div>
        <p class="mt-3 text-center font-mono text-sm">
          address = {hex(BASE)} + {sel} × {size} ={' '}
          <strong class="text-brand">{hex(addr)}</strong>
        </p>
        <p class="mt-1 text-center text-xs text-muted">
          One multiply, one add — the same cost no matter how big the array. That is{' '}
          <strong>O(1)</strong> indexing.
        </p>
      </div>
    </div>
  );
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div class="rounded-lg bg-surface px-3 py-2 text-center">
      <span class="text-muted">{label}</span>
      <div class="font-mono font-semibold">{value}</div>
    </div>
  );
}
