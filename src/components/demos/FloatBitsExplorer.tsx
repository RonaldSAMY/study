import { useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Floating-point explorer using a tiny 8-bit "minifloat":
     1 sign bit | 4 exponent bits (bias 7) | 3 mantissa bits.
   Same three-part structure as real IEEE-754, just small enough to see.
   - Sliders set the sign, exponent and mantissa.
   - The decoded value and the formula update live.
   ------------------------------------------------------------------ */

const BIAS = 7;
const EXP_BITS = 4;
const MAN_BITS = 3;

export default function FloatBitsExplorer() {
  const [sign, setSign] = useState(0); // 0 or 1
  const [exp, setExp] = useState(8); // 0..15
  const [man, setMan] = useState(4); // 0..7

  const expBin = exp.toString(2).padStart(EXP_BITS, '0');
  const manBin = man.toString(2).padStart(MAN_BITS, '0');

  // decode
  let value: number;
  let kind: string;
  if (exp === 0) {
    // subnormal
    value = (sign ? -1 : 1) * Math.pow(2, 1 - BIAS) * (man / 8);
    kind = man === 0 ? (sign ? 'negative zero' : 'zero') : 'subnormal';
  } else if (exp === 15) {
    value = man === 0 ? (sign ? -Infinity : Infinity) : NaN;
    kind = man === 0 ? 'infinity' : 'not a number (NaN)';
  } else {
    value = (sign ? -1 : 1) * Math.pow(2, exp - BIAS) * (1 + man / 8);
    kind = 'normal number';
  }

  const isFinite = Number.isFinite(value);
  const valueStr = Number.isNaN(value)
    ? 'NaN'
    : value === Infinity
      ? '+∞'
      : value === -Infinity
        ? '-∞'
        : value.toFixed(4);

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      {/* bit display */}
      <div class="mb-4 flex flex-wrap items-end justify-center gap-1">
        <BitGroup label="sign" color="#0ea5e9" bits={String(sign)} />
        <BitGroup label="exponent" color="#4f46e5" bits={expBin} />
        <BitGroup label="mantissa" color="#10b981" bits={manBin} />
      </div>

      {/* sliders */}
      <div class="space-y-3 text-sm">
        <label class="block">
          <span class="mb-1 block text-muted">
            sign = {sign} ({sign ? 'negative' : 'positive'})
          </span>
          <input
            type="range" min={0} max={1} step={1} value={sign}
            onInput={(e) => setSign(parseInt((e.target as HTMLInputElement).value, 10))}
            class="w-full accent-[#0ea5e9]"
          />
        </label>
        <label class="block">
          <span class="mb-1 block text-muted">
            exponent field = {exp} → 2<sup>{exp === 0 ? 1 - BIAS : exp - BIAS}</sup>
          </span>
          <input
            type="range" min={0} max={15} step={1} value={exp}
            onInput={(e) => setExp(parseInt((e.target as HTMLInputElement).value, 10))}
            class="w-full accent-[#4f46e5]"
          />
        </label>
        <label class="block">
          <span class="mb-1 block text-muted">mantissa field = {man} → fraction {man}/8</span>
          <input
            type="range" min={0} max={7} step={1} value={man}
            onInput={(e) => setMan(parseInt((e.target as HTMLInputElement).value, 10))}
            class="w-full accent-[#10b981]"
          />
        </label>
      </div>

      {/* readout */}
      <div class="mt-4 rounded-lg bg-surface-2 p-3 text-center">
        <div class="text-3xl font-bold text-brand">{valueStr}</div>
        <div class="mt-1 text-xs uppercase tracking-wide text-muted">{kind}</div>
        {isFinite && exp !== 0 && (
          <p class="mt-2 font-mono text-xs text-muted">
            ({sign ? '-' : '+'}1) × 2<sup>{exp} - {BIAS}</sup> × (1 + {man}/8) = {valueStr}
          </p>
        )}
        {isFinite && exp === 0 && (
          <p class="mt-2 font-mono text-xs text-muted">
            subnormal: ({sign ? '-' : '+'}1) × 2<sup>{1 - BIAS}</sup> × ({man}/8) = {valueStr}
          </p>
        )}
      </div>
    </div>
  );
}

function BitGroup({ label, color, bits }: { label: string; color: string; bits: string }) {
  return (
    <div class="flex flex-col items-center gap-1">
      <span class="text-[0.6rem] font-semibold" style={`color:${color}`}>
        {label}
      </span>
      <div class="flex gap-0.5">
        {bits.split('').map((b, i) => (
          <span
            key={i}
            class="grid h-8 w-7 place-items-center rounded border text-sm font-bold sm:h-9 sm:w-8"
            style={`border-color:${color}; color:${color}; background:${color}1a`}
          >
            {b}
          </span>
        ))}
      </div>
    </div>
  );
}
