import { useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Matrix grid inspector (no canvas — an editable data table).
   - A 3x3 matrix you can edit cell-by-cell.
   - Click a row or a column header to highlight it and read what that
     slice "means" when the matrix stores data.
   - Frames a matrix as rows = records, columns = features.
   ------------------------------------------------------------------ */

type Sel = { kind: 'row' | 'col'; index: number } | null;

const ROW_NAMES = ['Sensor A', 'Sensor B', 'Sensor C'];
const COL_NAMES = ['temp', 'humidity', 'pressure'];

export default function MatrixGridInspector() {
  const [m, setM] = useState<number[][]>([
    [21, 55, 101],
    [19, 60, 100],
    [23, 48, 102],
  ]);
  const [sel, setSel] = useState<Sel>(null);

  const setCell = (r: number, c: number, val: string) => {
    const n = parseFloat(val);
    setM((prev) => prev.map((row, ri) => row.map((x, ci) => (ri === r && ci === c ? (isNaN(n) ? 0 : n) : x))));
  };

  const inRow = (r: number) => sel?.kind === 'row' && sel.index === r;
  const inCol = (c: number) => sel?.kind === 'col' && sel.index === c;
  const cellHot = (r: number, c: number) => inRow(r) || inCol(c);

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <p class="mb-3 text-sm text-muted">
        This 3×3 matrix is a tiny spreadsheet of weather readings. Edit any cell, or click a
        row/column label to see what that slice represents.
      </p>

      <div class="overflow-x-auto">
        <table class="border-collapse text-sm">
          <thead>
            <tr>
              <th class="p-1"></th>
              {COL_NAMES.map((name, c) => (
                <th key={c} class="p-1">
                  <button
                    onClick={() => setSel(inCol(c) ? null : { kind: 'col', index: c })}
                    class={`w-full rounded-md px-2 py-1 text-xs font-semibold transition ${inCol(c) ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'}`}
                  >{name} ↓</button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {m.map((row, r) => (
              <tr key={r}>
                <th class="p-1">
                  <button
                    onClick={() => setSel(inRow(r) ? null : { kind: 'row', index: r })}
                    class={`w-full whitespace-nowrap rounded-md px-2 py-1 text-xs font-semibold transition ${inRow(r) ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'}`}
                  >{ROW_NAMES[r]} →</button>
                </th>
                {row.map((val, c) => (
                  <td key={c} class="p-1">
                    <input
                      type="number"
                      value={val}
                      onInput={(e) => setCell(r, c, (e.target as HTMLInputElement).value)}
                      class={`w-16 rounded-md border px-2 py-1.5 text-center font-mono transition ${
                        cellHot(r, c) ? 'border-brand bg-brand-soft text-brand' : 'border-border bg-surface-2 text-text'
                      }`}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div class="mt-4 rounded-lg bg-surface-2 p-3 text-sm">
        {sel === null && (
          <p class="text-muted">
            Entry <strong>a<sub>ij</sub></strong> sits in row <em>i</em>, column <em>j</em>.
            This matrix is <strong>3×3</strong> (rows × columns). Click a label to highlight a slice.
          </p>
        )}
        {sel?.kind === 'row' && (
          <p>
            <strong class="text-brand">Row {sel.index + 1} = {ROW_NAMES[sel.index]}</strong> is one
            complete record: all of its features in order
            <span class="font-mono"> ({m[sel.index].join(', ')})</span>. A row is a single sample.
          </p>
        )}
        {sel?.kind === 'col' && (
          <p>
            <strong class="text-brand">Column {sel.index + 1} = {COL_NAMES[sel.index]}</strong> is one
            feature measured across every sensor
            <span class="font-mono"> ({m.map((row) => row[sel.index]).join(', ')})</span>. A column is one variable.
          </p>
        )}
      </div>
    </div>
  );
}
