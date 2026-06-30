import { useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Bit & Byte toggler.
   - Click any of the 8 bits to flip it on/off.
   - See the byte's value in decimal, hexadecimal and binary update live.
   - Place values (128 .. 1) are shown above each bit.
   ------------------------------------------------------------------ */

const PLACES = [128, 64, 32, 16, 8, 4, 2, 1];

export default function BitByteToggler() {
  // bits[0] is the most-significant bit (place value 128)
  const [bits, setBits] = useState<number[]>([0, 1, 0, 0, 1, 0, 0, 1]);

  const flip = (i: number) =>
    setBits((b) => b.map((v, j) => (j === i ? (v ? 0 : 1) : v)));

  const decimal = bits.reduce((sum, b, i) => sum + b * PLACES[i], 0);
  const hex = decimal.toString(16).toUpperCase().padStart(2, '0');
  const binary = bits.join('');

  const setAll = (v: number) => setBits(PLACES.map(() => v));
  const randomize = () => setBits(PLACES.map(() => (Math.random() < 0.5 ? 0 : 1)));

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-4 flex flex-wrap gap-2">
        <button
          onClick={() => setAll(0)}
          class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted transition hover:text-text"
        >
          All 0
        </button>
        <button
          onClick={() => setAll(1)}
          class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted transition hover:text-text"
        >
          All 1
        </button>
        <button
          onClick={randomize}
          class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted transition hover:text-text"
        >
          Randomize
        </button>
      </div>

      {/* the 8 bits */}
      <div class="flex flex-wrap justify-center gap-1.5 sm:gap-2">
        {bits.map((b, i) => (
          <button
            key={i}
            onClick={() => flip(i)}
            class="flex w-10 flex-col items-center gap-1 sm:w-12"
            aria-label={`bit worth ${PLACES[i]}, currently ${b}`}
          >
            <span class="text-[0.65rem] font-semibold text-muted">{PLACES[i]}</span>
            <span
              class={`grid h-10 w-10 place-items-center rounded-lg border text-lg font-bold transition sm:h-12 sm:w-12 ${
                b
                  ? 'border-brand bg-brand text-white'
                  : 'border-border bg-surface-2 text-muted'
              }`}
            >
              {b}
            </span>
          </button>
        ))}
      </div>

      <p class="mt-2 text-center text-xs text-muted">
        Most significant bit (128) on the left, least significant (1) on the right.
      </p>

      {/* readouts */}
      <div class="mt-4 grid grid-cols-3 gap-2 text-sm">
        <Readout label="Decimal" value={String(decimal)} />
        <Readout label="Hex" value={`0x${hex}`} />
        <Readout label="Binary" value={binary} />
      </div>

      <p class="mt-3 text-center text-xs text-muted">
        One byte holds {decimal} of 256 possible values (0 to 255).
      </p>
    </div>
  );
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div class="rounded-lg bg-surface-2 px-3 py-2 text-center">
      <span class="text-xs text-muted">{label}</span>
      <div class="font-mono text-base font-semibold text-text">{value}</div>
    </div>
  );
}
