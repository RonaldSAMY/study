import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Interactive memory strip.
   - A horizontal strip of 48 byte-cells drawn on a crisp canvas.
   - Each cell shows its hex address and current byte value (0-255).
   - Click/tap a cell to select it (highlighted indigo).
   - Slider and +/- buttons change the selected byte; readout shows
     the value in decimal, hex and binary.
   - "Write sprite row" stamps a little pattern into memory.
   ------------------------------------------------------------------ */

const CELL_COUNT = 48;
const BASE_ADDR = 0x1000;

const COLORS = {
  cell: 'rgba(128,128,128,0.10)',
  cellBorder: 'rgba(128,128,128,0.30)',
  selected: '#4f46e5',
  text: '#1f2937',
  addr: 'rgba(120,120,120,0.95)',
  value: '#0ea5e9',
};

const hex2 = (n: number) => n.toString(16).toUpperCase().padStart(2, '0');
const hex4 = (n: number) => n.toString(16).toUpperCase().padStart(4, '0');
const bin8 = (n: number) => n.toString(2).padStart(8, '0');

export default function MemoryStripExplorer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [bytes, setBytes] = useState<number[]>(() => {
    const arr = new Array(CELL_COUNT).fill(0);
    // a little starting texture so the strip isn't all zeros
    arr[3] = 65; arr[4] = 66; arr[5] = 67; arr[12] = 255; arr[20] = 128;
    return arr;
  });
  const [selected, setSelected] = useState(5);
  // grid geometry, recomputed on resize
  const layoutRef = useRef({ w: 480, h: 220, cols: 12, rows: 4, cw: 38, ch: 46, padX: 6, padY: 6 });

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h, cols, cw, ch, padX, padY } = layoutRef.current;
    ctx.clearRect(0, 0, w, h);

    for (let i = 0; i < CELL_COUNT; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = padX + col * cw;
      const y = padY + row * ch;
      const isSel = i === selected;

      ctx.fillStyle = isSel ? COLORS.selected : COLORS.cell;
      roundRect(ctx, x, y, cw - 4, ch - 6, 6);
      ctx.fill();
      ctx.lineWidth = isSel ? 2 : 1;
      ctx.strokeStyle = isSel ? COLORS.selected : COLORS.cellBorder;
      ctx.stroke();

      // address label (top, small)
      ctx.font = '600 9px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = isSel ? 'rgba(255,255,255,0.85)' : COLORS.addr;
      ctx.fillText(hex4(BASE_ADDR + i), x + (cw - 4) / 2, y + 12);

      // byte value (center, bigger)
      ctx.font = '700 15px ui-monospace, monospace';
      ctx.fillStyle = isSel ? '#ffffff' : COLORS.value;
      ctx.fillText(String(bytes[i]), x + (cw - 4) / 2, y + 32);
    }
    ctx.textAlign = 'start';
  };

  // ---- responsive sizing with devicePixelRatio ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 620);
      const cols = w < 380 ? 6 : w < 520 ? 8 : 12;
      const rows = Math.ceil(CELL_COUNT / cols);
      const padX = 6;
      const padY = 6;
      const cw = (w - padX * 2) / cols;
      const ch = 46;
      const h = padY * 2 + rows * ch;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      layoutRef.current = { w, h, cols, rows, cw, ch, padX, padY };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // redraw whenever state changes
  useEffect(draw, [bytes, selected]);

  // ---- pick a cell on pointer down ----
  const onDown = (e: PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const { cols, cw, ch, padX, padY } = layoutRef.current;
    const col = Math.floor((px - padX) / cw);
    const row = Math.floor((py - padY) / ch);
    if (col < 0 || col >= cols) return;
    const idx = row * cols + col;
    if (idx >= 0 && idx < CELL_COUNT) {
      setSelected(idx);
      e.preventDefault();
    }
  };

  const setSelectedValue = (v: number) => {
    const clamped = Math.max(0, Math.min(255, v));
    setBytes((arr) => arr.map((b, i) => (i === selected ? clamped : b)));
  };

  const writeSpriteRow = () => {
    // stamp a small symmetric pattern starting at the selected cell
    const pattern = [0b00111100, 0b01111110, 0b11011011, 0b11111111];
    setBytes((arr) =>
      arr.map((b, i) => {
        const off = i - selected;
        return off >= 0 && off < pattern.length ? pattern[off] : b;
      }),
    );
  };

  const value = bytes[selected];

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <canvas
        ref={canvasRef}
        class="touch-none rounded-xl bg-surface-2"
        onPointerDown={onDown}
      />

      <p class="mt-3 text-sm text-muted">
        Tap a cell to select it, then change the byte stored there. One cell = one byte.
      </p>

      <div class="mt-3 grid gap-3 md:grid-cols-2">
        <div class="grid grid-cols-3 gap-2">
          <Readout label="address" value={`0x${hex4(BASE_ADDR + selected)}`} color={COLORS.selected} />
          <Readout label="index" value={String(selected)} />
          <Readout label="decimal" value={String(value)} color={COLORS.value} />
          <Readout label="hex" value={`0x${hex2(value)}`} />
          <Readout label="binary" value={bin8(value)} />
          <Readout label="char" value={value >= 32 && value < 127 ? `'${String.fromCharCode(value)}'` : '—'} />
        </div>

        <div class="space-y-3">
          <label class="block">
            <span class="mb-1 block text-sm text-muted">byte value = {value}</span>
            <input
              type="range" min={0} max={255} step={1} value={value}
              onInput={(e) => setSelectedValue(parseInt((e.target as HTMLInputElement).value, 10))}
              class="w-full accent-[#4f46e5]"
            />
          </label>
          <div class="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedValue(value - 1)}
              class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted transition hover:text-text"
            >
              − 1
            </button>
            <button
              onClick={() => setSelectedValue(value + 1)}
              class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted transition hover:text-text"
            >
              + 1
            </button>
            <button
              onClick={() => setSelectedValue(0)}
              class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted transition hover:text-text"
            >
              clear
            </button>
            <button
              onClick={writeSpriteRow}
              class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white transition hover:opacity-90"
            >
              Write sprite row
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Readout({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div class="rounded-lg bg-surface-2 px-3 py-2">
      <span class="text-xs text-muted" style={color ? `color:${color}` : ''}>{label}</span>
      <div class="font-mono text-sm font-semibold">{value}</div>
    </div>
  );
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
