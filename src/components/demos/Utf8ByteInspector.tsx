import { useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Text-encoding inspector.
   - Type (or pick) a single character.
   - See its Unicode code point (U+XXXX) and the UTF-8 bytes that
     encode it, in hex and binary. Watch the byte count grow for
     characters further up the Unicode range.
   ------------------------------------------------------------------ */

const PRESETS = ['A', '9', '?', 'é', 'ñ', 'Ω', '中', '👾'];

export default function Utf8ByteInspector() {
  const [text, setText] = useState('A');

  // take the first full code point (handles emoji / surrogate pairs)
  const chars = Array.from(text);
  const ch = chars.length ? chars[0] : '';
  const cp = ch ? ch.codePointAt(0)! : 0;

  const bytes = ch ? Array.from(new TextEncoder().encode(ch)) : [];
  const cpHex = cp.toString(16).toUpperCase().padStart(4, '0');

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <label class="block">
        <span class="mb-1 block text-sm text-muted">Type a character:</span>
        <input
          type="text"
          value={text}
          onInput={(e) => setText((e.target as HTMLInputElement).value)}
          class="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-2xl font-semibold text-text outline-none focus:border-brand"
        />
      </label>

      <div class="mt-3 flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p}
            onClick={() => setText(p)}
            class="rounded-lg bg-surface-2 px-3 py-1.5 text-lg transition hover:bg-brand-soft"
          >
            {p}
          </button>
        ))}
      </div>

      {ch && (
        <>
          <div class="mt-4 grid grid-cols-3 gap-2 text-sm">
            <Readout label="Character" value={ch} />
            <Readout label="Code point" value={`U+${cpHex}`} />
            <Readout label="UTF-8 size" value={`${bytes.length} byte${bytes.length > 1 ? 's' : ''}`} />
          </div>

          <p class="mt-4 mb-2 text-sm text-muted">UTF-8 bytes:</p>
          <div class="flex flex-wrap gap-2">
            {bytes.map((byte, i) => (
              <div key={i} class="rounded-lg border border-border bg-surface-2 px-3 py-2 text-center">
                <div class="font-mono text-base font-semibold text-brand">
                  0x{byte.toString(16).toUpperCase().padStart(2, '0')}
                </div>
                <div class="mt-0.5 font-mono text-[0.7rem] text-muted">
                  {byte.toString(2).padStart(8, '0')}
                </div>
              </div>
            ))}
          </div>

          <p class="mt-3 text-xs text-muted">
            Code points up to U+007F fit in one byte (that is plain ASCII). Larger code points
            spill into 2, 3 or 4 bytes.
          </p>
        </>
      )}
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
