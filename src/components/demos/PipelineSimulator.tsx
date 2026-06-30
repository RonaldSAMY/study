import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   5-stage pipeline visualizer.
   - Columns = stages (Fetch, Decode, Execute, Memory, Writeback).
   - Rows = instructions (colored).
   - Each Tick advances the clock; every in-flight instruction moves
     one stage to the right, so the pipeline fills diagonally.
   - Toggle "Pipelined" vs "One-at-a-time" to see the throughput win:
     pipelined finishes N instructions in N+4 ticks, the naive version
     in 5N ticks.
   ------------------------------------------------------------------ */

const STAGES = ['Fetch', 'Decode', 'Exec', 'Mem', 'WB'];
const NS = STAGES.length; // 5

const INSTR = [
  { name: 'LOAD  r1,[a]', color: '#4f46e5' },
  { name: 'ADD   r2,r1,8', color: '#0ea5e9' },
  { name: 'MUL   r3,r2,r2', color: '#10b981' },
  { name: 'STORE [b],r3', color: '#f59e0b' },
  { name: 'SUB   r4,r3,1', color: '#ec4899' },
];
const N = INSTR.length;

const STEP_MS = 650;

// stage index of instruction i at clock t (>=1).
//  -1 => not started yet, 0..4 => in that stage, >=5 => finished.
function stageOf(i: number, t: number, pipelined: boolean): number {
  return pipelined ? t - 1 - i : t - 1 - i * NS;
}

const totalTicks = (pipelined: boolean) => (pipelined ? N + NS - 1 : N * NS);

export default function PipelineSimulator() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 480, labelW: 110, colW: 70, headerH: 28, rowH: 40 });
  const [pipelined, setPipelined] = useState(true);
  const [clock, setClock] = useState(0);
  const [running, setRunning] = useState(false);
  const pipeRef = useRef(pipelined);
  pipeRef.current = pipelined;

  const finished = clock >= totalTicks(pipelined);
  const completed = Math.min(
    N,
    Array.from({ length: N }, (_, i) => stageOf(i, clock, pipelined)).filter((s) => s >= NS).length,
  );

  const tick = () => setClock((c) => Math.min(c + 1, totalTicks(pipeRef.current)));
  const reset = () => {
    setRunning(false);
    setClock(0);
  };
  const switchMode = (p: boolean) => {
    setPipelined(p);
    setRunning(false);
    setClock(0);
  };

  // ---- draw ----
  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, labelW, colW, headerH, rowH } = sizeRef.current;
    const h = headerH + N * rowH;
    ctx.clearRect(0, 0, w, h);

    // stage headers
    ctx.font = '600 13px Inter, system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    for (let j = 0; j < NS; j++) {
      const x = labelW + j * colW;
      ctx.fillStyle = 'rgba(128,128,128,0.10)';
      ctx.fillRect(x + 1, 1, colW - 2, headerH - 2);
      ctx.fillStyle = 'rgba(128,128,128,0.95)';
      ctx.fillText(STAGES[j], x + colW / 2, headerH / 2);
    }

    // rows
    for (let i = 0; i < N; i++) {
      const y = headerH + i * rowH;
      const s = stageOf(i, clock, pipelined);
      const done = s >= NS;

      // instruction label + color swatch
      ctx.fillStyle = INSTR[i].color;
      ctx.globalAlpha = done ? 0.45 : 1;
      ctx.fillRect(6, y + rowH / 2 - 6, 12, 12);
      ctx.globalAlpha = 1;
      ctx.fillStyle = done ? 'rgba(128,128,128,0.6)' : 'rgba(128,128,128,0.95)';
      ctx.font = '12px ui-monospace, monospace';
      ctx.textAlign = 'left';
      ctx.fillText((done ? '✓ ' : '') + INSTR[i].name, 24, y + rowH / 2);

      // faint cell separators for this row
      ctx.strokeStyle = 'rgba(128,128,128,0.16)';
      ctx.lineWidth = 1;
      for (let j = 0; j < NS; j++) {
        const x = labelW + j * colW;
        ctx.strokeRect(x + 1, y + 2, colW - 2, rowH - 4);
      }

      // active block in its current stage column
      if (s >= 0 && s < NS) {
        const x = labelW + s * colW;
        ctx.fillStyle = INSTR[i].color;
        roundRect(ctx, x + 4, y + 5, colW - 8, rowH - 10, 6);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = '700 12px Inter, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(STAGES[s], x + colW / 2, y + rowH / 2);
      }
    }
  };

  // ---- responsive sizing ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 560);
      const labelW = Math.max(96, Math.min(140, w * 0.26));
      const colW = (w - labelW) / NS;
      const headerH = 28;
      const rowH = Math.max(34, Math.min(44, (w / NS) * 0.6));
      const h = headerH + N * rowH;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w, labelW, colW, headerH, rowH };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // redraw on state change
  useEffect(draw, [clock, pipelined]);

  // ---- run loop ----
  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let last = performance.now();
    const loop = (t: number) => {
      if (t - last >= STEP_MS) {
        last = t;
        setClock((c) => {
          const max = totalTicks(pipeRef.current);
          if (c >= max) {
            setRunning(false);
            return c;
          }
          return c + 1;
        });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running]);

  const ideal = totalTicks(true);
  const naive = totalTicks(false);

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <button
          onClick={() => switchMode(true)}
          class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
            pipelined ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
          }`}
        >
          Pipelined
        </button>
        <button
          onClick={() => switchMode(false)}
          class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
            !pipelined ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-text'
          }`}
        >
          One-at-a-time
        </button>
        <div class="mx-1 h-5 w-px bg-border" />
        <button
          onClick={tick}
          disabled={running || finished}
          class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-text transition hover:bg-brand-soft disabled:opacity-50"
        >
          Tick
        </button>
        <button
          onClick={() => setRunning((r) => !r)}
          disabled={finished}
          class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-text transition hover:bg-brand-soft disabled:opacity-50"
        >
          {running ? 'Pause' : 'Run'}
        </button>
        <button
          onClick={reset}
          class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted transition hover:text-text"
        >
          Reset
        </button>
      </div>

      <div class="grid gap-4 md:grid-cols-[1fr,auto] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

        <div class="space-y-3 text-sm md:w-48">
          <div class="grid grid-cols-2 gap-2">
            <Readout label="clock" value={`${clock}`} />
            <Readout label="done" value={`${completed} / ${N}`} color="#10b981" />
          </div>
          <div class="rounded-lg bg-surface-2 p-3">
            <div class="flex justify-between">
              <span class="text-muted">mode</span>
              <strong>{pipelined ? 'pipelined' : 'serial'}</strong>
            </div>
            <div class="flex justify-between">
              <span class="text-muted">finishes in</span>
              <strong>{pipelined ? ideal : naive} ticks</strong>
            </div>
            <p class="mt-1 text-xs text-muted">
              {pipelined
                ? `${N} instructions in ${ideal} ticks — stages overlap like an assembly line.`
                : `${N} instructions × ${NS} stages = ${naive} ticks. Each one finishes before the next starts.`}
            </p>
          </div>
          {finished && (
            <div class="rounded-lg bg-brand-soft p-3 text-center text-xs font-semibold text-brand">
              Done in {clock} ticks. Pipelining saved {naive - ideal} ticks here.
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
      <span class="text-muted">{label}</span>
      <div class="font-mono font-semibold" style={color ? `color:${color}` : ''}>
        {value}
      </div>
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
