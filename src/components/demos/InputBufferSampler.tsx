import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Input & Time playground.
   - A frame timeline ticks forward (driven by requestAnimationFrame,
     slowed to a few "logical frames" per second so you can watch it).
   - The player "lands" on a periodic action window (emerald ground).
   - You PRESS (button, or Space / J while focused). The press is
     captured immediately as an event, but only CONSUMED at the next
     frame sample (polling).
   - An INPUT BUFFER keeps a press "live" for N extra frames, so a jump
     pressed slightly before landing still counts.
   Canvas follows VectorPlayground conventions: devicePixelRatio
   scaling, responsive resize (cleaned up), redraw via rAF, and the
   loop is cancelled on unmount.
   ------------------------------------------------------------------ */

const FRAME_MS = 260;          // wall-clock time per logical frame
const LANDING_PERIOD = 7;      // a landing / action window every N frames
const HISTORY_MAX = 80;

const C = {
  indigo: '#4f46e5',
  sky: '#0ea5e9',
  emerald: '#10b981',
  skySoft: 'rgba(14,165,233,0.24)',
  emeraldSoft: 'rgba(16,185,129,0.20)',
  cell: 'rgba(128,128,128,0.12)',
  cellEdge: 'rgba(128,128,128,0.32)',
  ground: 'rgba(16,185,129,0.45)',
  ink: 'rgba(120,120,135,0.95)',
  faint: 'rgba(120,120,135,0.6)',
};

type Frame = {
  n: number;
  press: boolean;     // a queued press was sampled (consumed) this frame
  bufActive: boolean; // the buffer was still live at the end of this frame
  landing: boolean;   // this frame is an action window
  jump: boolean;      // a buffered press fired the jump on this landing
  miss: boolean;      // landing arrived with an empty buffer (no jump)
  wasted: boolean;    // a press expired here without ever reaching a landing
};

export default function InputBufferSampler() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [playing, setPlaying] = useState(true);
  const [bufferWindow, setBufferWindow] = useState(3); // N extra frames

  // --- mutable simulation state (refs so the rAF loop stays fresh) ---
  const frameRef = useRef(0);
  const bufferRef = useRef(0);     // frames of buffer remaining (incl. current)
  const pendingRef = useRef(false); // a press captured but not yet sampled
  const historyRef = useRef<Frame[]>([]);
  const statsRef = useRef({ landed: 0, wasted: 0, missed: 0 });
  const playingRef = useRef(playing);
  const bufWinRef = useRef(bufferWindow);
  const rafRef = useRef<number | null>(null);
  const lastTRef = useRef<number | null>(null);
  const accRef = useRef(0);
  const pulseRef = useRef(0);
  const sizeRef = useRef({ w: 520, h: 190, cols: 16, dpr: 1 });

  const [, setTick] = useState(0); // forces readout re-render each frame

  useEffect(() => { playingRef.current = playing; }, [playing]);
  useEffect(() => { bufWinRef.current = bufferWindow; }, [bufferWindow]);

  // ---- queue a press (button or key) ----
  const queuePress = () => { pendingRef.current = true; pulseRef.current = 1; };

  const reset = () => {
    frameRef.current = 0;
    bufferRef.current = 0;
    pendingRef.current = false;
    historyRef.current = [];
    statsRef.current = { landed: 0, wasted: 0, missed: 0 };
    accRef.current = 0;
  };

  // ---- advance one logical frame (poll -> act -> decay) ----
  const advanceFrame = () => {
    frameRef.current += 1;
    const n = frameRef.current;
    const landing = n % LANDING_PERIOD === 0;
    let press = false, jump = false, miss = false, wasted = false;

    // 1. POLL: read whatever input was captured since the last sample.
    if (pendingRef.current) {
      press = true;
      pendingRef.current = false;
      bufferRef.current = bufWinRef.current + 1; // live now + N more frames
    }

    // 2. ACT: at the action window, use a buffered press if one exists.
    if (landing) {
      if (bufferRef.current > 0) {
        jump = true;
        bufferRef.current = 0;
        statsRef.current.landed += 1;
      } else {
        miss = true;
        statsRef.current.missed += 1;
      }
    }

    // 3. DECAY: age the buffer; note presses that expired unused.
    if (!jump && bufferRef.current > 0) {
      bufferRef.current -= 1;
      if (bufferRef.current === 0) { wasted = true; statsRef.current.wasted += 1; }
    }

    const f: Frame = {
      n, press, landing, jump, miss, wasted,
      bufActive: bufferRef.current > 0 || press,
    };
    const h = historyRef.current;
    h.push(f);
    if (h.length > HISTORY_MAX) h.shift();
  };

  // ---- the animation loop (always running; advances only when playing) ----
  useEffect(() => {
    const loop = (t: number) => {
      if (lastTRef.current == null) lastTRef.current = t;
      const dt = t - lastTRef.current;
      lastTRef.current = t;
      pulseRef.current = Math.max(0, pulseRef.current - dt / 600);

      if (playingRef.current) {
        accRef.current += dt;
        let advanced = false;
        while (accRef.current >= FRAME_MS) {
          accRef.current -= FRAME_MS;
          advanceFrame();
          advanced = true;
        }
        if (advanced) setTick((x) => (x + 1) % 100000);
      }
      draw();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastTRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- responsive canvas with devicePixelRatio ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 720);
      const h = 190;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const cols = Math.max(8, Math.min(16, Math.floor(w / 46)));
      sizeRef.current = { w, h, cols, dpr };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- draw the frame timeline ----
  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h, cols } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);

    const padX = 12;
    const gap = 5;
    const cellW = (w - padX * 2 - gap * (cols - 1)) / cols;
    const cellTop = 52;
    const cellH = 70;

    // header
    ctx.font = '600 13px Inter, system-ui, sans-serif';
    ctx.fillStyle = C.ink;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(`frame ${frameRef.current}`, padX, 22);
    ctx.fillStyle = C.faint;
    ctx.fillText('→ time (one cell = one frame sample)', w - 260 < padX + 90 ? padX + 90 : w - 260, 22);

    const slice = historyRef.current.slice(-cols);
    const lastIdx = slice.length - 1;

    slice.forEach((f, i) => {
      const x = padX + i * (cellW + gap);
      const isCurrent = i === lastIdx;

      // base cell
      let fill = C.cell;
      if (f.bufActive) fill = C.skySoft;
      if (f.landing) fill = C.emeraldSoft;
      if (f.press) fill = 'rgba(14,165,233,0.55)';
      if (f.jump) fill = 'rgba(16,185,129,0.85)';
      ctx.fillStyle = fill;
      roundRect(ctx, x, cellTop, cellW, cellH, 8);
      ctx.fill();

      // border
      ctx.lineWidth = isCurrent ? 3 : 1.5;
      ctx.strokeStyle = isCurrent ? C.indigo : C.cellEdge;
      if (f.wasted) { ctx.setLineDash([4, 3]); ctx.strokeStyle = C.faint; }
      roundRect(ctx, x, cellTop, cellW, cellH, 8);
      ctx.stroke();
      ctx.setLineDash([]);

      // landing = emerald ground bar at the bottom
      if (f.landing) {
        ctx.fillStyle = C.ground;
        ctx.fillRect(x + 4, cellTop + cellH - 7, cellW - 8, 4);
      }

      // glyphs
      ctx.textAlign = 'center';
      const cx = x + cellW / 2;
      if (f.jump) {
        ctx.fillStyle = '#ffffff';
        ctx.font = `700 ${Math.min(18, cellW * 0.5)}px Inter, system-ui, sans-serif`;
        ctx.fillText('★', cx, cellTop + cellH / 2 + 6);
      } else if (f.press) {
        ctx.fillStyle = '#ffffff';
        ctx.font = `700 ${Math.min(15, cellW * 0.42)}px Inter, system-ui, sans-serif`;
        ctx.fillText('▲', cx, cellTop + cellH / 2 + 5);
      } else if (f.wasted) {
        ctx.fillStyle = C.faint;
        ctx.font = `700 ${Math.min(15, cellW * 0.42)}px Inter, system-ui, sans-serif`;
        ctx.fillText('✕', cx, cellTop + cellH / 2 + 5);
      } else if (f.miss) {
        ctx.fillStyle = 'rgba(16,185,129,0.8)';
        ctx.font = `700 ${Math.min(14, cellW * 0.4)}px Inter, system-ui, sans-serif`;
        ctx.fillText('–', cx, cellTop + cellH / 2 + 5);
      }

      // frame number
      ctx.fillStyle = C.faint;
      ctx.font = '500 10px Inter, system-ui, sans-serif';
      ctx.fillText(`${f.n}`, cx, cellTop + cellH + 14);
      ctx.textAlign = 'left';
    });

    // "captured, waiting for next sample" pulse above the right edge
    if (pendingRef.current || pulseRef.current > 0.01) {
      const px = padX + (slice.length) * (cellW + gap) - cellW / 2;
      const a = pendingRef.current ? 0.6 + 0.4 * Math.abs(Math.sin(Date.now() / 160)) : pulseRef.current;
      ctx.globalAlpha = Math.min(1, a);
      ctx.fillStyle = C.sky;
      ctx.beginPath();
      ctx.arc(Math.min(px, w - 14), 38, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = C.sky;
      ctx.font = '600 11px Inter, system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('press captured…', Math.min(px, w - 14) - 12, 42);
      ctx.textAlign = 'left';
    }
  };

  // ---- keyboard (only while the demo is focused) ----
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'j' || e.key === 'J' || e.key === 'ArrowUp') {
      e.preventDefault();
      queuePress();
    }
  };

  const s = statsRef.current;
  const bufMs = Math.round((bufferWindow + 1) * FRAME_MS);

  return (
    <div
      class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm outline-none focus-within:ring-2 focus-within:ring-brand/40"
      tabIndex={0}
      onKeyDown={onKeyDown}
    >
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setPlaying((p) => !p)}
          class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white transition hover:opacity-90"
        >
          {playing ? '⏸ Pause' : '▶ Play'}
        </button>
        <button
          onClick={queuePress}
          class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-text transition hover:bg-brand-soft"
        >
          ▲ Press (Jump)
        </button>
        <button
          onClick={reset}
          class="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted transition hover:text-text"
        >
          ↺ Reset
        </button>
        <span class="ml-auto text-xs text-muted">Click here, then tap <kbd class="rounded bg-surface-2 px-1">Space</kbd> / <kbd class="rounded bg-surface-2 px-1">J</kbd></span>
      </div>

      <canvas ref={canvasRef} class="touch-none w-full rounded-xl bg-surface-2" />

      <div class="mt-3 grid gap-4 md:grid-cols-[1fr,auto] md:items-start">
        <div class="space-y-3 text-sm">
          <label class="block">
            <span class="mb-1 block text-muted">
              buffer window = {bufferWindow} {bufferWindow === 1 ? 'frame' : 'frames'} (≈ {bufMs} ms live)
            </span>
            <input
              type="range" min={0} max={8} step={1} value={bufferWindow}
              onInput={(e) => setBufferWindow(parseInt((e.target as HTMLInputElement).value, 10))}
              class="w-full accent-[#0ea5e9]"
            />
            <span class="mt-1 block text-xs text-muted">
              {bufferWindow === 0
                ? 'No buffer: you must press on the exact landing frame — brutal.'
                : 'Press a little early; the buffer holds your jump until you land.'}
            </span>
          </label>

          <div class="flex flex-wrap gap-3 text-xs text-muted">
            <Legend swatch="rgba(14,165,233,0.55)" label="press sampled (▲)" />
            <Legend swatch="rgba(14,165,233,0.24)" label="buffer live" />
            <Legend swatch="rgba(16,185,129,0.20)" label="landing window" />
            <Legend swatch="rgba(16,185,129,0.85)" label="jump fired (★)" />
            <Legend swatch="transparent" border label="press wasted (✕)" />
          </div>
        </div>

        <div class="grid grid-cols-3 gap-2 text-sm">
          <Readout label="jumps landed" value={`${s.landed}`} color={C.emerald} />
          <Readout label="wasted (early)" value={`${s.wasted}`} color={C.sky} />
          <Readout label="missed" value={`${s.missed}`} color={C.faint} />
        </div>
      </div>
    </div>
  );
}

function Readout({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div class="rounded-lg bg-surface-2 px-3 py-2 text-center">
      <div class="font-mono text-lg font-semibold" style={color ? `color:${color}` : ''}>{value}</div>
      <span class="text-[0.7rem] leading-tight text-muted">{label}</span>
    </div>
  );
}

function Legend({ swatch, label, border }: { swatch: string; label: string; border?: boolean }) {
  return (
    <span class="flex items-center gap-1.5">
      <span
        class="inline-block h-3 w-3 rounded"
        style={`background:${swatch};${border ? 'border:1.5px dashed rgba(120,120,135,0.6)' : ''}`}
      />
      {label}
    </span>
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
