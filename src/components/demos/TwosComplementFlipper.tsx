import { useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Two's-complement explorer for an 8-bit signed integer.
   - Flip any of the 8 bits and watch the signed value change.
   - The sign bit (leftmost) is highlighted: it is "worth" -128.
   - "Negate" performs the trick: invert all bits, then add 1.
   ------------------------------------------------------------------ */

// place values for two's complement: the top bit is NEGATIVE.
const PLACES = [-128, 64, 32, 16, 8, 4, 2, 1];

export default function TwosComplementFlipper() {
  const [bits, setBits] = useState<number[]>([1, 1, 0, 1, 0, 0, 1, 1]);

  const flip = (i: number) =>
    setBits((b) => b.map((v, j) => (j === i ? (v ? 0 : 1) : v)));

  const signed = bits.reduce((sum, b, i) => sum + b * PLACES[i], 0);
  const unsigned = bits.reduce((sum, b, i) => sum + b * Math.abs(i === 0 ? 128 : PLACES[i]), 0);
  const binary = bits.join('');

  // negation trick: invert then +1 (mod 256)
  const negate = () => {
    const inverted = bits.map((b) => (b ? 0 : 1));
    let carry = 1;
    const result = [...inverted];
    for (let i = 7; i >= 0; i--) {
      const s = result[i] + carry;
      result[i] = s % 2;
      carry = s >= 2 ? 1 : 0;
    }
    setBits(result);
  };

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-4 flex flex-wrap gap-2">
        <button
          onClick={negate}
          class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white transition hover:opacity-90"
        >
          Negate (invert + 1)
        </button>
        <button
          onClick={() => setBits([0, 0, 0, 0, 0, 0, 0, 0])}
          class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted transition hover:text-text"
        >
          Reset to 0
        </button>
      </div>

      <div class="flex flex-wrap justify-center gap-1.5 sm:gap-2">
        {bits.map((b, i) => (
          <button
            key={i}
            onClick={() => flip(i)}
            class="flex w-10 flex-col items-center gap-1 sm:w-12"
            aria-label={`bit worth ${PLACES[i]}, currently ${b}`}
          >
            <span class={`text-[0.6rem] font-semibold ${i === 0 ? 'text-geometry' : 'text-muted'}`}>
              {PLACES[i]}
            </span>
            <span
              class={`grid h-10 w-10 place-items-center rounded-lg border text-lg font-bold transition sm:h-12 sm:w-12 ${
                b
                  ? i === 0
                    ? 'border-geometry bg-geometry text-white'
                    : 'border-brand bg-brand text-white'
                  : 'border-border bg-surface-2 text-muted'
              }`}
            >
              {b}
            </span>
          </button>
        ))}
      </div>

      <p class="mt-2 text-center text-xs text-muted">
        The leftmost <span class="font-semibold text-geometry">sign bit</span> is worth -128.
        All the others are positive.
      </p>

      <div class="mt-4 grid grid-cols-3 gap-2 text-sm">
        <Readout label="Bits" value={binary} />
        <Readout label="Signed value" value={String(signed)} highlight />
        <Readout label="If unsigned" value={String(unsigned)} />
      </div>

      <p class="mt-3 text-center text-xs text-muted">
        Signed 8-bit range: -128 to +127. The same bits read as unsigned go 0 to 255.
      </p>
    </div>
  );
}

function Readout({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div class="rounded-lg bg-surface-2 px-3 py-2 text-center">
      <span class="text-xs text-muted">{label}</span>
      <div class={`font-mono text-base font-semibold ${highlight ? 'text-brand' : 'text-text'}`}>
        {value}
      </div>
    </div>
  );
}
