import { useMemo, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Broadcasting checker.
   - Pick two shapes from presets (or edit the comma-lists).
   - Axes are aligned from the RIGHT; each pair is compatible if it is
     equal or one side is 1. The result takes the max of each pair.
   ------------------------------------------------------------------ */

const PRESETS: { label: string; a: string; b: string }[] = [
  { label: 'batch + bias', a: '32, 128', b: '128' },
  { label: 'image + per-channel', a: '256, 256, 3', b: '3' },
  { label: 'column + row', a: '4, 1', b: '1, 5' },
  { label: 'incompatible', a: '3, 4', b: '2, 4' },
];

const COLORS = { a: '#4f46e5', b: '#0ea5e9', ok: '#10b981', bad: '#f43f5e' };

function parse(s: string): number[] {
  return s
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
    .map((t) => Math.max(0, Math.floor(Number(t))))
    .filter((n) => Number.isFinite(n) && n > 0);
}

export default function BroadcastShapeChecker() {
  const [sa, setSa] = useState('256, 256, 3');
  const [sb, setSb] = useState('3');

  const result = useMemo(() => {
    const a = parse(sa);
    const b = parse(sb);
    const n = Math.max(a.length, b.length);
    const rows: { da: number | null; db: number | null; out: number | null; ok: boolean }[] = [];
    let compatible = a.length > 0 && b.length > 0;
    for (let p = 0; p < n; p++) {
      const da = p < a.length ? a[a.length - 1 - p] : null; // null = missing (treated as 1)
      const db = p < b.length ? b[b.length - 1 - p] : null;
      const va = da ?? 1;
      const vb = db ?? 1;
      const ok = va === vb || va === 1 || vb === 1;
      if (!ok) compatible = false;
      rows.unshift({ da, db, out: ok ? Math.max(va, vb) : null, ok });
    }
    return { compatible, rows };
  }, [sa, sb]);

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => {
              setSa(p.a);
              setSb(p.b);
            }}
            class="rounded-lg bg-surface-2 px-3 py-1.5 text-xs font-semibold text-muted transition hover:bg-brand-soft hover:text-brand"
          >
            {p.label}
          </button>
        ))}
      </div>

      <div class="grid gap-3 sm:grid-cols-2">
        <label class="block text-sm">
          <span class="mb-1 block font-semibold" style={`color:${COLORS.a}`}>
            shape A
          </span>
          <input
            value={sa}
            onInput={(e) => setSa((e.target as HTMLInputElement).value)}
            class="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 font-mono text-sm"
            placeholder="e.g. 256, 256, 3"
          />
        </label>
        <label class="block text-sm">
          <span class="mb-1 block font-semibold" style={`color:${COLORS.b}`}>
            shape B
          </span>
          <input
            value={sb}
            onInput={(e) => setSb((e.target as HTMLInputElement).value)}
            class="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 font-mono text-sm"
            placeholder="e.g. 3"
          />
        </label>
      </div>

      {/* per-axis alignment table */}
      <div class="mt-4 overflow-x-auto rounded-xl bg-surface-2 p-3">
        <table class="w-full text-center font-mono text-sm">
          <thead>
            <tr class="text-xs text-muted">
              <th class="px-2 py-1 text-left">axis (from right)</th>
              {result.rows.map((_, p) => (
                <th key={p} class="px-2 py-1">
                  {result.rows.length - p}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="px-2 py-1 text-left text-xs" style={`color:${COLORS.a}`}>
                A
              </td>
              {result.rows.map((r, p) => (
                <td key={p} class="px-2 py-1">
                  {r.da ?? '·'}
                </td>
              ))}
            </tr>
            <tr>
              <td class="px-2 py-1 text-left text-xs" style={`color:${COLORS.b}`}>
                B
              </td>
              {result.rows.map((r, p) => (
                <td key={p} class="px-2 py-1">
                  {r.db ?? '·'}
                </td>
              ))}
            </tr>
            <tr class="border-t border-border">
              <td class="px-2 py-1 text-left text-xs text-muted">match?</td>
              {result.rows.map((r, p) => (
                <td key={p} class="px-2 py-1" style={`color:${r.ok ? COLORS.ok : COLORS.bad}`}>
                  {r.ok ? '✓' : '✗'}
                </td>
              ))}
            </tr>
            <tr>
              <td class="px-2 py-1 text-left text-xs font-semibold" style={`color:${COLORS.ok}`}>
                result
              </td>
              {result.rows.map((r, p) => (
                <td key={p} class="px-2 py-1 font-bold">
                  {r.out ?? '—'}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <div
        class="mt-3 rounded-lg p-3 text-sm font-semibold"
        style={`background:${result.compatible ? 'rgba(16,185,129,0.12)' : 'rgba(244,63,94,0.12)'};color:${
          result.compatible ? COLORS.ok : COLORS.bad
        }`}
      >
        {result.compatible
          ? `✓ Broadcasts → result shape (${result.rows.map((r) => r.out).join(', ')})`
          : '✗ Cannot broadcast: some aligned axes differ and neither is 1.'}
      </div>
    </div>
  );
}
