import { useMemo, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Asset serializer demo.
   - Edit a small game object (id, name, position, health, inventory).
   - See it serialized live to (a) JSON text and (b) a compact binary
     byte layout shown as hex, with a JSON-vs-binary size comparison.
   - "Round-trip" button packs to bytes, parses them back, and checks
     the rebuilt object equals the original. Pure DOM/SVG, no canvas.
   ------------------------------------------------------------------ */

const COLORS = {
  indigo: '#4f46e5',
  sky: '#0ea5e9',
  emerald: '#10b981',
};

type Item = { name: string; qty: number };
type GameObject = {
  id: number;
  name: string;
  x: number;
  y: number;
  health: number;
  inventory: Item[];
};

// Binary layout (little-endian):
//   id        u32      4 bytes
//   health    u8       1 byte
//   x         float32  4 bytes
//   y         float32  4 bytes
//   name      u8 len + UTF-8 bytes
//   invCount  u8       1 byte
//   per item: u8 len + UTF-8 name bytes, then u8 qty
const enc = new TextEncoder();
const dec = new TextDecoder();

function serialize(o: GameObject): Uint8Array {
  const nameBytes = enc.encode(o.name);
  const itemChunks = o.inventory.map((it) => {
    const nb = enc.encode(it.name);
    return { nb, qty: it.qty & 0xff };
  });
  let size = 4 + 1 + 4 + 4 + 1 + nameBytes.length + 1;
  for (const c of itemChunks) size += 1 + c.nb.length + 1;

  const buf = new ArrayBuffer(size);
  const view = new DataView(buf);
  const out = new Uint8Array(buf);
  let off = 0;
  view.setUint32(off, o.id >>> 0, true); off += 4;
  view.setUint8(off, o.health & 0xff); off += 1;
  view.setFloat32(off, o.x, true); off += 4;
  view.setFloat32(off, o.y, true); off += 4;
  view.setUint8(off, nameBytes.length & 0xff); off += 1;
  out.set(nameBytes, off); off += nameBytes.length;
  view.setUint8(off, itemChunks.length & 0xff); off += 1;
  for (const c of itemChunks) {
    view.setUint8(off, c.nb.length & 0xff); off += 1;
    out.set(c.nb, off); off += c.nb.length;
    view.setUint8(off, c.qty); off += 1;
  }
  return out;
}

function deserialize(bytes: Uint8Array): GameObject {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let off = 0;
  const id = view.getUint32(off, true); off += 4;
  const health = view.getUint8(off); off += 1;
  const x = view.getFloat32(off, true); off += 4;
  const y = view.getFloat32(off, true); off += 4;
  const nameLen = view.getUint8(off); off += 1;
  const name = dec.decode(bytes.subarray(off, off + nameLen)); off += nameLen;
  const invCount = view.getUint8(off); off += 1;
  const inventory: Item[] = [];
  for (let i = 0; i < invCount; i++) {
    const len = view.getUint8(off); off += 1;
    const iname = dec.decode(bytes.subarray(off, off + len)); off += len;
    const qty = view.getUint8(off); off += 1;
    inventory.push({ name: iname, qty });
  }
  return { id, name, x, y, health, inventory };
}

const hex = (b: number) => b.toString(16).padStart(2, '0');

export default function AssetSerializerDemo() {
  const [obj, setObj] = useState<GameObject>({
    id: 4242,
    name: 'Hero',
    x: 12.5,
    y: -3.25,
    health: 87,
    inventory: [
      { name: 'sword', qty: 1 },
      { name: 'potion', qty: 5 },
    ],
  });
  const [roundTrip, setRoundTrip] = useState<null | {
    ok: boolean;
    rebuilt: GameObject;
  }>(null);

  const set = <K extends keyof GameObject>(key: K, value: GameObject[K]) => {
    setObj((o) => ({ ...o, [key]: value }));
    setRoundTrip(null);
  };

  const bytes = useMemo(() => serialize(obj), [obj]);
  const json = useMemo(() => JSON.stringify(obj), [obj]);
  const jsonPretty = useMemo(() => JSON.stringify(obj, null, 2), [obj]);
  const jsonSize = useMemo(() => enc.encode(json).length, [json]);

  const doRoundTrip = () => {
    const rebuilt = deserialize(bytes);
    const ok = JSON.stringify(rebuilt) === JSON.stringify(obj);
    setRoundTrip({ ok, rebuilt });
  };

  const setItem = (i: number, patch: Partial<Item>) => {
    setObj((o) => ({
      ...o,
      inventory: o.inventory.map((it, j) => (j === i ? { ...it, ...patch } : it)),
    }));
    setRoundTrip(null);
  };
  const addItem = () => {
    setObj((o) => ({ ...o, inventory: [...o.inventory, { name: 'item', qty: 1 }] }));
    setRoundTrip(null);
  };
  const removeItem = (i: number) => {
    setObj((o) => ({ ...o, inventory: o.inventory.filter((_, j) => j !== i) }));
    setRoundTrip(null);
  };

  const saved = jsonSize - bytes.length;
  const pct = jsonSize ? Math.round((saved / jsonSize) * 100) : 0;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="grid gap-4 md:grid-cols-2 md:items-start">
        {/* ---- editor ---- */}
        <div class="space-y-3 text-sm">
          <p class="font-semibold text-text">Game object</p>

          <div class="grid grid-cols-2 gap-2">
            <label class="block">
              <span class="mb-1 block text-muted">id (u32)</span>
              <input
                type="number" min={0} max={4294967295} value={obj.id}
                onInput={(e) => set('id', Math.max(0, parseInt((e.target as HTMLInputElement).value || '0', 10)))}
                class="w-full rounded-lg border border-border bg-surface-2 px-2 py-1.5 font-mono text-text"
              />
            </label>
            <label class="block">
              <span class="mb-1 block text-muted">name (UTF-8)</span>
              <input
                type="text" value={obj.name} maxLength={40}
                onInput={(e) => set('name', (e.target as HTMLInputElement).value)}
                class="w-full rounded-lg border border-border bg-surface-2 px-2 py-1.5 text-text"
              />
            </label>
          </div>

          <label class="block">
            <span class="mb-1 block text-muted">position x = <span class="font-mono">{obj.x.toFixed(2)}</span></span>
            <input type="range" min={-50} max={50} step={0.25} value={obj.x}
              onInput={(e) => set('x', parseFloat((e.target as HTMLInputElement).value))}
              class="w-full accent-[#4f46e5]" />
          </label>
          <label class="block">
            <span class="mb-1 block text-muted">position y = <span class="font-mono">{obj.y.toFixed(2)}</span></span>
            <input type="range" min={-50} max={50} step={0.25} value={obj.y}
              onInput={(e) => set('y', parseFloat((e.target as HTMLInputElement).value))}
              class="w-full accent-[#0ea5e9]" />
          </label>
          <label class="block">
            <span class="mb-1 block text-muted">health (u8) = <span class="font-mono">{obj.health}</span></span>
            <input type="range" min={0} max={255} step={1} value={obj.health}
              onInput={(e) => set('health', parseInt((e.target as HTMLInputElement).value, 10))}
              class="w-full accent-[#10b981]" />
          </label>

          <div>
            <div class="mb-1 flex items-center justify-between">
              <span class="text-muted">inventory[{obj.inventory.length}]</span>
              <button onClick={addItem}
                class="rounded-md bg-surface-2 px-2 py-1 text-xs font-semibold text-muted hover:text-text">
                + add
              </button>
            </div>
            <div class="space-y-2">
              {obj.inventory.map((it, i) => (
                <div key={i} class="flex items-center gap-2">
                  <input type="text" value={it.name} maxLength={20}
                    onInput={(e) => setItem(i, { name: (e.target as HTMLInputElement).value })}
                    class="min-w-0 flex-1 rounded-lg border border-border bg-surface-2 px-2 py-1 text-text" />
                  <input type="number" min={0} max={255} value={it.qty}
                    onInput={(e) => setItem(i, { qty: Math.max(0, Math.min(255, parseInt((e.target as HTMLInputElement).value || '0', 10))) })}
                    class="w-16 rounded-lg border border-border bg-surface-2 px-2 py-1 font-mono text-text" />
                  <button onClick={() => removeItem(i)}
                    class="rounded-md px-2 py-1 text-xs font-bold text-muted hover:text-text" aria-label="remove">
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ---- serialized views ---- */}
        <div class="space-y-3 text-sm">
          <div class="grid grid-cols-2 gap-2">
            <Readout label="JSON (text)" value={`${jsonSize} bytes`} color={COLORS.sky} />
            <Readout label="Binary (packed)" value={`${bytes.length} bytes`} color={COLORS.emerald} />
          </div>

          <div class="rounded-lg bg-surface-2 p-3">
            <div class="flex justify-between">
              <span class="text-muted">binary saves</span>
              <strong style={`color:${COLORS.emerald}`}>{saved} bytes ({pct}%)</strong>
            </div>
            <div class="mt-2 h-2 overflow-hidden rounded-full bg-border">
              <div class="h-full rounded-full"
                style={`width:${jsonSize ? Math.round((bytes.length / jsonSize) * 100) : 0}%;background:${COLORS.emerald}`} />
            </div>
            <p class="mt-1 text-xs text-muted">Bar shows binary size relative to JSON.</p>
          </div>

          <div>
            <p class="mb-1 text-muted">JSON serialization</p>
            <pre class="max-h-40 overflow-auto rounded-lg bg-surface-2 p-3 font-mono text-xs leading-relaxed text-text"><code>{jsonPretty}</code></pre>
          </div>

          <div>
            <p class="mb-1 text-muted">Binary byte layout (hex, little-endian)</p>
            <div class="flex flex-wrap gap-1 rounded-lg bg-surface-2 p-3 font-mono text-xs">
              {Array.from(bytes).map((b, i) => (
                <span key={i} class="rounded px-1 py-0.5"
                  style={`background:${COLORS.indigo}1a;color:${COLORS.indigo}`}>{hex(b)}</span>
              ))}
            </div>
          </div>

          <button onClick={doRoundTrip}
            class="w-full rounded-lg bg-brand px-3 py-2 font-semibold text-white transition hover:opacity-90">
            Deserialize / round-trip ⟳
          </button>

          {roundTrip && (
            <div class="rounded-lg p-3 text-xs"
              style={`background:${roundTrip.ok ? COLORS.emerald : '#ef4444'}1a;border:1px solid ${roundTrip.ok ? COLORS.emerald : '#ef4444'}55`}>
              <p class="font-semibold" style={`color:${roundTrip.ok ? COLORS.emerald : '#ef4444'}`}>
                {roundTrip.ok ? '✓ Round-trip OK — bytes parsed back to an identical object.' : '✗ Mismatch after round-trip.'}
              </p>
              <p class="mt-1 font-mono text-muted">{JSON.stringify(roundTrip.rebuilt)}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Readout({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div class="rounded-lg bg-surface-2 px-3 py-2">
      <span class="text-muted" style={color ? `color:${color}` : ''}>{label}</span>
      <div class="font-mono font-semibold text-text">{value}</div>
    </div>
  );
}
