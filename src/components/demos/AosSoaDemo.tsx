import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Array-of-Structs vs Struct-of-Arrays, seen through the cache.
   - Each entity has 4 fields: X, Y, HP, Sprite (1 cell = 4 bytes).
   - Toggle the memory layout (AoS interleaves; SoA groups by field).
   - A loop reads ONLY one field over every entity.
   - Each visual ROW is one cache line; we light up the lines the CPU
     must load, and measure useful vs wasted bytes.
   Canvas conventions copied from VectorPlayground.
   ------------------------------------------------------------------ */

type Layout = 'aos' | 'soa';
const FIELDS = ['X', 'Y', 'HP', 'S'] as const;
const NUM_FIELDS = FIELDS.length;
const BYTES_PER_CELL = 4;
const LINE_CELLS = 8; // one cache line holds 8 cells = 32 bytes here

const COLORS = {
  useful: '#10b981', // emerald — the bytes the loop actually wants
  wasted: 'rgba(79,70,229,0.30)', // indigo, faint — loaded but unused
  untouched: 'rgba(128,128,128,0.14)',
  touched: '#0ea5e9', // sky — outline of a loaded cache line
  text: 'rgba(128,128,128,0.95)',
  line: 'rgba(128,128,128,0.30)',
};

export default function AosSoaDemo() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [entities, setEntities] = useState(8);
  const [layout, setLayout] = useState<Layout>('aos');
  const [field, setField] = useState(0); // index into FIELDS the loop reads
  const sizeRef = useRef({ w: 520, h: 320, cell: 30, ox: 36, oy: 8 });

  const totalCells = entities * NUM_FIELDS;

  // For each visual cell index, what (entity, field) does it hold?
  const cellInfo = (i: number) => {
    if (layout === 'aos') return { entity: Math.floor(i / NUM_FIELDS), field: i % NUM_FIELDS };
    return { entity: i % entities, field: Math.floor(i / entities) };
  };

  // Which cache lines does the one-field loop force the CPU to load?
  const lineCount = Math.ceil(totalCells / LINE_CELLS);
  const lineTouched: boolean[] = new Array(lineCount).fill(false);
  for (let i = 0; i < totalCells; i++) {
    if (cellInfo(i).field === field) lineTouched[Math.floor(i / LINE_CELLS)] = true;
  }
  const linesLoaded = lineTouched.filter(Boolean).length;
  const usefulBytes = entities * BYTES_PER_CELL; // one wanted cell per entity
  const loadedBytes = linesLoaded * LINE_CELLS * BYTES_PER_CELL;
  const wastedBytes = loadedBytes - usefulBytes;
  const utilization = loadedBytes > 0 ? Math.round((usefulBytes / loadedBytes) * 100) : 0;

  // ---- responsive sizing with devicePixelRatio ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 560);
      const ox = 40; // room for "line N" labels on the left
      const cell = Math.max(20, Math.min(40, (w - ox - 8) / LINE_CELLS));
      const rows = Math.ceil(totalCells / LINE_CELLS);
      const oy = 8;
      const h = oy + rows * (cell + 6) + 4;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w, h, cell, ox, oy };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entities, layout, field]);

  useEffect(draw, [entities, layout, field]);

  function draw() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h, cell, ox, oy } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);
    ctx.font = `600 ${Math.round(cell * 0.34)}px Inter, sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';

    for (let i = 0; i < totalCells; i++) {
      const row = Math.floor(i / LINE_CELLS);
      const col = i % LINE_CELLS;
      const x = ox + col * cell;
      const y = oy + row * (cell + 6);
      const info = cellInfo(i);
      const isUseful = info.field === field;
      const loaded = lineTouched[row];
      ctx.fillStyle = isUseful ? COLORS.useful : loaded ? COLORS.wasted : COLORS.untouched;
      ctx.fillRect(x + 1, y + 1, cell - 2, cell - 2);
      // cell label, e.g. "X3"
      ctx.fillStyle = isUseful ? '#ffffff' : COLORS.text;
      ctx.fillText(`${FIELDS[info.field]}${info.entity}`, x + cell / 2, y + cell / 2 + 1);
    }

    // row labels + cache-line outline for loaded lines
    ctx.textAlign = 'right';
    for (let r = 0; r < lineCount; r++) {
      const y = oy + r * (cell + 6);
      ctx.fillStyle = COLORS.text;
      ctx.font = `600 ${Math.round(cell * 0.3)}px Inter, sans-serif`;
      ctx.fillText(`line ${r}`, ox - 6, y + cell / 2 + 1);
      if (lineTouched[r]) {
        const cells = Math.min(LINE_CELLS, totalCells - r * LINE_CELLS);
        ctx.strokeStyle = COLORS.touched;
        ctx.lineWidth = 2;
        ctx.strokeRect(ox + 0.5, y + 0.5, cells * cell - 1, cell - 1);
      }
    }
  }

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap gap-2">
        {(['aos', 'soa'] as Layout[]).map((l) => (
          <button
            key={l}
            onClick={() => setLayout(l)}
            class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              layout === l ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
            }`}
          >
            {l === 'aos' ? 'Array of Structs' : 'Struct of Arrays'}
          </button>
        ))}
      </div>

      <p class="mb-2 text-sm text-muted">
        The loop reads only field{' '}
        <span class="font-mono font-semibold text-text">{FIELDS[field]}</span> of every entity.
        Sky outlines = cache lines the CPU must load.
      </p>

      <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

      <div class="mt-3 flex flex-wrap gap-2">
        <span class="self-center text-xs text-muted">loop reads field:</span>
        {FIELDS.map((f, fi) => (
          <button
            key={f}
            onClick={() => setField(fi)}
            class={`rounded-lg px-3 py-1 text-sm font-mono font-semibold transition ${
              field === fi ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <label class="mt-3 block text-sm">
        <span class="mb-1 block text-muted">entities = {entities}</span>
        <input
          type="range" min={4} max={16} step={4} value={entities}
          onInput={(e) => setEntities(parseInt((e.target as HTMLInputElement).value))}
          class="w-full accent-[#10b981]"
        />
      </label>

      <div class="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <Readout label="cache lines" value={`${linesLoaded} / ${lineCount}`} />
        <Readout label="useful bytes" value={`${usefulBytes}`} color={COLORS.useful} />
        <Readout label="wasted bytes" value={`${wastedBytes}`} color="#4f46e5" />
        <Readout label="utilization" value={`${utilization}%`} />
      </div>

      <div class="mt-3 rounded-lg bg-surface-2 p-3 text-sm">
        {layout === 'soa' ? (
          <p>
            <strong>SoA</strong> packs every <span class="font-mono">{FIELDS[field]}</span> back-to-back, so the
            CPU loads almost only the bytes it needs — <strong>{utilization}%</strong> useful.
          </p>
        ) : (
          <p>
            <strong>AoS</strong> interleaves the fields, so each cache line drags along three unused fields per
            entity — only <strong>{utilization}%</strong> of the loaded bytes are useful.
          </p>
        )}
      </div>
    </div>
  );
}

function Readout({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div class="rounded-lg bg-surface-2 px-3 py-2">
      <span class="text-muted" style={color ? `color:${color}` : ''}>{label}</span>
      <div class="font-mono font-semibold">{value}</div>
    </div>
  );
}
