import { useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Base converter (decimal / binary / hexadecimal).
   - Type a value in any of the three bases; the others update live.
   - A place-value strip shows how the binary digits add up.
   - Range slider (0..255) for quick exploration of one byte.
   ------------------------------------------------------------------ */

const PLACES = [128, 64, 32, 16, 8, 4, 2, 1];

export default function BaseConverterLab() {
  const [value, setValue] = useState(173); // 0..255
  const [dec, setDec] = useState('173');
  const [bin, setBin] = useState('10101101');
  const [hex, setHex] = useState('AD');

  const sync = (n: number) => {
    const v = Math.max(0, Math.min(255, Math.floor(n)));
    setValue(v);
    setDec(String(v));
    setBin(v.toString(2).padStart(8, '0'));
    setHex(v.toString(16).toUpperCase().padStart(2, '0'));
  };

  const onDec = (s: string) => {
    setDec(s);
    if (/^\d+$/.test(s)) sync(parseInt(s, 10));
  };
  const onBin = (s: string) => {
    setBin(s);
    if (/^[01]+$/.test(s)) sync(parseInt(s, 2));
  };
  const onHex = (s: string) => {
    setHex(s);
    if (/^[0-9a-fA-F]+$/.test(s)) sync(parseInt(s, 16));
  };

  const bits = value.toString(2).padStart(8, '0').split('').map(Number);

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="grid gap-3 sm:grid-cols-3">
        <Field label="Decimal (base 10)" prefix="" value={dec} onInput={onDec} />
        <Field label="Binary (base 2)" prefix="0b" value={bin} onInput={onBin} />
        <Field label="Hex (base 16)" prefix="0x" value={hex} onInput={onHex} />
      </div>

      <label class="mt-4 block">
        <span class="mb-1 block text-sm text-muted">drag the value: {value}</span>
        <input
          type="range"
          min={0}
          max={255}
          step={1}
          value={value}
          onInput={(e) => sync(parseInt((e.target as HTMLInputElement).value, 10))}
          class="w-full accent-[#4f46e5]"
        />
      </label>

      {/* place-value strip */}
      <div class="mt-4">
        <p class="mb-2 text-sm text-muted">How the binary digits add up:</p>
        <div class="flex flex-wrap justify-center gap-1.5">
          {bits.map((b, i) => (
            <div key={i} class="flex w-9 flex-col items-center gap-1 sm:w-11">
              <span class="text-[0.6rem] font-semibold text-muted">{PLACES[i]}</span>
              <span
                class={`grid h-9 w-9 place-items-center rounded-lg border text-base font-bold sm:h-11 sm:w-11 ${
                  b ? 'border-brand bg-brand text-white' : 'border-border bg-surface-2 text-muted'
                }`}
              >
                {b}
              </span>
              <span class={`text-[0.6rem] ${b ? 'text-brand' : 'text-muted'}`}>
                {b ? PLACES[i] : 0}
              </span>
            </div>
          ))}
        </div>
        <p class="mt-3 text-center font-mono text-sm text-text">
          {bits
            .map((b, i) => (b ? PLACES[i] : null))
            .filter((x) => x !== null)
            .join(' + ') || '0'}{' '}
          = {value}
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  prefix,
  value,
  onInput,
}: {
  label: string;
  prefix: string;
  value: string;
  onInput: (s: string) => void;
}) {
  return (
    <label class="block">
      <span class="mb-1 block text-xs font-semibold text-muted">{label}</span>
      <div class="flex items-center rounded-lg border border-border bg-surface-2 px-2">
        {prefix && <span class="font-mono text-sm text-muted">{prefix}</span>}
        <input
          type="text"
          value={value}
          onInput={(e) => onInput((e.target as HTMLInputElement).value)}
          class="w-full bg-transparent px-1 py-2 font-mono text-base font-semibold text-text outline-none"
        />
      </div>
    </label>
  );
}
