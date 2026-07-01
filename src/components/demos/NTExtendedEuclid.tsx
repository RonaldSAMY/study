import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Extended Euclidean algorithm as a shrinking table.
   - Learner edits a and b.
   - Each row holds (remainder r, Bezout x, Bezout y). The next row is
        q = floor(prevR / r)
        newR = prevR - q*r        (the classic (a,b) -> (b, a mod b))
        newX = prevX - q*x
        newY = prevY - q*y
     so r marches down to gcd while x and y track the coefficients with
     a*x + b*y = r on every single row (an invariant we display).
   - The current row is highlighted; a live caption narrates the step.
   - Transport: Play / Pause / Step / Back / Reset + speed.
   ------------------------------------------------------------------ */

type Row = { r: number; x: number; y: number; q: number | null; note: string };

function buildRows(a: number, b: number): Row[] {
  const rows: Row[] = [];
  let oldR = a, r = b;
  let oldX = 1, x = 0;
  let oldY = 0, y = 1;
  rows.push({ r: oldR, x: oldX, y: oldY, q: null, note: `Row 0: r = ${a} with (x, y) = (1, 0), because ${a}*1 + ${b}*0 = ${a}.` });
  rows.push({ r, x, y, q: null, note: `Row 1: r = ${b} with (x, y) = (0, 1), because ${a}*0 + ${b}*1 = ${b}.` });
  let guard = 0;
  while (r !== 0 && guard++ < 200) {
    const q = Math.floor(oldR / r);
    const nr = oldR - q * r;
    const nx = oldX - q * x;
    const ny = oldY - q * y;
    [oldR, r] = [r, nr];
    [oldX, x] = [x, nx];
    [oldY, y] = [y, ny];
    if (nr === 0) {
      rows.push({ r: nr, x: nx, y: ny, q, note: `q = floor of the division = ${q}. Remainder hits 0 -> stop. The row above holds gcd = ${oldR}.` });
    } else {
      rows.push({ r: nr, x: nx, y: ny, q, note: `q = ${q}: subtract ${q}x the row above. New r = ${nr}, and ${a}*(${nx}) + ${b}*(${ny}) = ${nr}.` });
    }
  }
  return rows;
}

export default function NTExtendedEuclid() {
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const idxRef = useRef(0);

  const [aText, setAText] = useState('48');
  const [bText, setBText] = useState('18');
  const [ab, setAb] = useState({ a: 48, b: 18 });
  const [rows, setRows] = useState<Row[]>(() => buildRows(48, 18));
  const [idx, setIdx] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  idxRef.current = idx;

  const load = () => {
    const a = parseInt(aText, 10);
    const b = parseInt(bText, 10);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return;
    if (a < 1 || b < 1 || a > 100000 || b > 100000) return;
    setAb({ a, b });
    setRows(buildRows(a, b));
    setIdx(1);
    setPlaying(false);
  };

  useEffect(() => {
    if (!playing) { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); return; }
    const interval = 950 / speed;
    const tick = (t: number) => {
      if (!lastRef.current) lastRef.current = t;
      if (t - lastRef.current >= interval) {
        lastRef.current = t;
        const next = idxRef.current + 1;
        if (next >= rows.length) { setIdx(rows.length - 1); setPlaying(false); return; }
        setIdx(next);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
  }, [playing, speed, rows]);

  const reset = () => { setPlaying(false); setIdx(1); lastRef.current = 0; };
  const stepF = () => { setPlaying(false); setIdx((v) => Math.min(rows.length - 1, v + 1)); };
  const stepB = () => { setPlaying(false); setIdx((v) => Math.max(1, v - 1)); };
  const play = () => { if (idx >= rows.length - 1) setIdx(1); lastRef.current = 0; setPlaying((p) => !p); };

  const cur = rows[Math.min(idx, rows.length - 1)];
  const done = idx >= rows.length - 1;
  // gcd row = the last row with r != 0
  const gcdRow = rows[rows.length - 2];

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 text-text shadow-sm">
      <div class="mb-3 flex flex-wrap items-end gap-2">
        <label class="flex flex-col text-xs text-muted">a
          <input value={aText} onInput={(e) => setAText((e.target as HTMLInputElement).value)} class="w-24 rounded-lg border border-border bg-surface-2 px-2 py-1 font-mono text-sm text-text" />
        </label>
        <label class="flex flex-col text-xs text-muted">b
          <input value={bText} onInput={(e) => setBText((e.target as HTMLInputElement).value)} class="w-24 rounded-lg border border-border bg-surface-2 px-2 py-1 font-mono text-sm text-text" />
        </label>
        <button onClick={load} class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Load</button>
      </div>

      <div class="overflow-x-auto rounded-xl border border-border">
        <table class="w-full border-collapse text-center font-mono text-sm">
          <thead>
            <tr class="bg-surface-2 text-muted">
              <th class="px-3 py-2 font-semibold">q</th>
              <th class="px-3 py-2 font-semibold" style="color:#4f46e5">r</th>
              <th class="px-3 py-2 font-semibold" style="color:#0ea5e9">x</th>
              <th class="px-3 py-2 font-semibold" style="color:#10b981">y</th>
              <th class="px-3 py-2 font-semibold text-muted">check a·x + b·y</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, idx + 1).map((row, i) => (
              <tr key={i} class={i === idx ? 'font-bold' : 'text-muted'} style={i === idx ? 'background:rgba(79,70,229,0.14)' : ''}>
                <td class="px-3 py-1.5">{row.q ?? '·'}</td>
                <td class="px-3 py-1.5">{row.r}</td>
                <td class="px-3 py-1.5">{row.x}</td>
                <td class="px-3 py-1.5">{row.y}</td>
                <td class="px-3 py-1.5">{ab.a}·({row.x}) + {ab.b}·({row.y}) = {ab.a * row.x + ab.b * row.y}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p class="mt-3 min-h-[3rem] rounded-lg bg-surface-2 px-3 py-2 text-sm">{cur.note}</p>
      {done && (
        <p class="mt-2 rounded-lg bg-brand-soft px-3 py-2 text-sm font-semibold">
          gcd({ab.a}, {ab.b}) = {gcdRow.r}, and {ab.a}·({gcdRow.x}) + {ab.b}·({gcdRow.y}) = {gcdRow.r} — that is Bezout's identity.
        </p>
      )}

      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={stepB} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏮ Back</button>
        <button onClick={play} class="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90">{playing ? '⏸ Pause' : '▶ Play'}</button>
        <button onClick={stepF} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">⏭ Step</button>
        <button onClick={reset} class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">↺ Reset</button>
        <label class="ml-auto flex items-center gap-2 text-xs text-muted">speed
          <input type="range" min={0.5} max={3} step={0.5} value={speed} onInput={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))} class="w-24 accent-[#4f46e5]" />
        </label>
      </div>
      <p class="mt-2 text-center text-xs text-muted">The invariant a·x + b·y = r holds on <em>every</em> row — that is why the last non-zero row hands you the coefficients for free.</p>
    </div>
  );
}
