import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   Big-O growth race.
   - Animate plotting operation-counts vs n for several complexity
     classes at once. Press Play and watch the curves diverge.
   - Toggle classes on/off, pick which one to "focus" (highlighted),
     choose the maximum n, and flip a linear/log y-axis.
   - Frames = the value of n (1 .. maxN). The transport controls
     (Play / Pause / Step / Reset + speed) move an index through them.
   ------------------------------------------------------------------ */

type ClassDef = { id: string; label: string; color: string; f: (n: number) => number };

const CLASSES: ClassDef[] = [
  { id: 'o1', label: 'O(1)', color: '#10b981', f: () => 1 },
  { id: 'ologn', label: 'O(log n)', color: '#0ea5e9', f: (n) => Math.max(1, Math.ceil(Math.log2(n))) },
  { id: 'on', label: 'O(n)', color: '#4f46e5', f: (n) => n },
  { id: 'onlogn', label: 'O(n log n)', color: '#f59e0b', f: (n) => n * Math.max(1, Math.log2(n)) },
  { id: 'on2', label: 'O(n²)', color: '#f43f5e', f: (n) => n * n },
  { id: 'o2n', label: 'O(2ⁿ)', color: '#8b5cf6', f: (n) => Math.pow(2, n) },
];

function fmt(x: number): string {
  if (!isFinite(x)) return '∞';
  if (x >= 1e6) return x.toExponential(1).replace('e+', '×10^');
  return Math.round(x).toLocaleString();
}

export default function BigOGrowthRace() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 480, h: 320, pl: 44, pb: 28, pt: 12, pr: 12 });

  const [enabled, setEnabled] = useState<Set<string>>(
    () => new Set(['on', 'onlogn', 'on2']),
  );
  const [focus, setFocus] = useState('on2');
  const [maxN, setMaxN] = useState(32);
  const [logScale, setLogScale] = useState(false);

  // transport
  const [idx, setIdx] = useState(0); // n - 1
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(8); // steps per second
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);

  const n = idx + 1;

  // refs for the resize closure to read current state
  const idxRef = useRef(idx); idxRef.current = idx;
  const enabledRef = useRef(enabled); enabledRef.current = enabled;
  const focusRef = useRef(focus); focusRef.current = focus;
  const maxNRef = useRef(maxN); maxNRef.current = maxN;
  const logRef = useRef(logScale); logRef.current = logScale;

  // reset the animation when the inputs that change the frames change
  useEffect(() => {
    setPlaying(false);
    setIdx(0);
  }, [maxN]);

  // autoplay loop
  useEffect(() => {
    if (!playing) return;
    const interval = 1000 / Math.max(1, speed);
    const loop = (t: number) => {
      if (!lastRef.current) lastRef.current = t;
      if (t - lastRef.current >= interval) {
        lastRef.current = t;
        setIdx((i) => {
          if (i >= maxN - 1) { setPlaying(false); return i; }
          return i + 1;
        });
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      lastRef.current = 0;
    };
  }, [playing, speed, maxN]);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h, pl, pb, pt, pr } = sizeRef.current;
    const curN = idxRef.current + 1;
    const mN = maxNRef.current;
    const en = enabledRef.current;
    const useLog = logRef.current;
    const fc = focusRef.current;

    ctx.clearRect(0, 0, w, h);
    const plotW = w - pl - pr;
    const plotH = h - pt - pb;

    const active = CLASSES.filter((c) => en.has(c.id));
    // y scale: max over enabled at maxN (so the frame grows into a fixed window)
    let yMax = 4;
    for (const c of active) {
      const v = c.f(mN);
      if (isFinite(v)) yMax = Math.max(yMax, v);
    }
    const yOf = (v: number) => {
      if (useLog) {
        const lv = Math.log10(Math.max(1, v));
        const lm = Math.log10(Math.max(10, yMax));
        return pt + plotH - (lv / lm) * plotH;
      }
      return pt + plotH - (Math.min(v, yMax) / yMax) * plotH;
    };
    const xOf = (nn: number) => pl + ((nn - 1) / Math.max(1, mN - 1)) * plotW;

    // grid + axes
    ctx.strokeStyle = 'rgba(128,128,128,0.18)';
    ctx.lineWidth = 1;
    for (let g = 0; g <= 4; g++) {
      const y = pt + (plotH * g) / 4;
      ctx.beginPath(); ctx.moveTo(pl, y); ctx.lineTo(pl + plotW, y); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(128,128,128,0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(pl, pt); ctx.lineTo(pl, pt + plotH); ctx.lineTo(pl + plotW, pt + plotH); ctx.stroke();

    // axis labels
    ctx.fillStyle = 'rgba(128,128,128,0.9)';
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('input size  n →', pl + plotW / 2, h - 6);
    ctx.save();
    ctx.translate(12, pt + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(useLog ? 'operations (log)' : 'operations', 0, 0);
    ctx.restore();
    ctx.textAlign = 'right';
    ctx.fillText(fmt(yMax), pl - 5, pt + 10);
    ctx.fillText('0', pl - 5, pt + plotH);

    // vertical scan line at current n
    const sx = xOf(curN);
    ctx.strokeStyle = 'rgba(128,128,128,0.45)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(sx, pt); ctx.lineTo(sx, pt + plotH); ctx.stroke();
    ctx.setLineDash([]);

    // curves up to current n
    for (const c of active) {
      const isFocus = c.id === fc;
      ctx.strokeStyle = c.color;
      ctx.globalAlpha = isFocus ? 1 : 0.55;
      ctx.lineWidth = isFocus ? 3.2 : 1.8;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      for (let nn = 1; nn <= curN; nn++) {
        const x = xOf(nn);
        const y = yOf(c.f(nn));
        if (nn === 1) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      // dot at the head
      const hx = xOf(curN);
      const hy = yOf(c.f(curN));
      ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.arc(hx, hy, isFocus ? 5 : 3.4, 0, Math.PI * 2);
      ctx.fillStyle = c.color; ctx.fill();
    }
    ctx.globalAlpha = 1;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 560);
      const h = Math.round(w * 0.66);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w, h, pl: 48, pb: 26, pt: 12, pr: 14 };
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(draw, [idx, enabled, focus, maxN, logScale]);

  const toggle = (id: string) => {
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const step = (d: number) => {
    setPlaying(false);
    setIdx((i) => Math.max(0, Math.min(maxN - 1, i + d)));
  };

  const focusClass = CLASSES.find((c) => c.id === focus)!;

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div class="grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
        <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

        <div class="space-y-3 text-sm">
          <div class="flex flex-wrap gap-1.5">
            {CLASSES.map((c) => (
              <button
                key={c.id}
                onClick={() => toggle(c.id)}
                class={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                  enabled.has(c.id) ? 'text-white' : 'bg-surface-2 text-muted hover:text-text'
                }`}
                style={enabled.has(c.id) ? `background:${c.color}` : ''}
              >
                {c.label}
              </button>
            ))}
          </div>

          <label class="block">
            <span class="mb-1 block text-muted">focus curve (highlighted)</span>
            <select
              value={focus}
              onChange={(e) => setFocus((e.target as HTMLSelectElement).value)}
              class="w-full rounded-lg border border-border bg-surface-2 px-2 py-1.5 text-text"
            >
              {CLASSES.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </label>

          <label class="block">
            <span class="mb-1 block text-muted">max n = {maxN}</span>
            <input
              type="range" min={4} max={64} step={1} value={maxN}
              onInput={(e) => setMaxN(parseInt((e.target as HTMLInputElement).value))}
              class="w-full accent-[#4f46e5]"
            />
          </label>

          <label class="flex items-center gap-2">
            <input
              type="checkbox" checked={logScale}
              onInput={(e) => setLogScale((e.target as HTMLInputElement).checked)}
              class="h-4 w-4 accent-[#0ea5e9]"
            />
            <span>logarithmic y-axis</span>
          </label>
        </div>
      </div>

      {/* transport */}
      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={() => step(-1)} class="rounded-lg bg-surface-2 px-2.5 py-1.5 text-sm font-semibold text-muted hover:text-text" title="Step back">⏮</button>
        <button
          onClick={() => { if (idx >= maxN - 1) setIdx(0); setPlaying((p) => !p); }}
          class="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white transition hover:opacity-90"
        >
          {playing ? '⏸ Pause' : '▶ Play'}
        </button>
        <button onClick={() => step(1)} class="rounded-lg bg-surface-2 px-2.5 py-1.5 text-sm font-semibold text-muted hover:text-text" title="Step forward">⏭</button>
        <button onClick={() => { setPlaying(false); setIdx(0); }} class="rounded-lg bg-surface-2 px-2.5 py-1.5 text-sm font-semibold text-muted hover:text-text" title="Reset">↺</button>
        <label class="ml-auto flex items-center gap-2 text-xs text-muted">
          speed
          <input type="range" min={1} max={24} step={1} value={speed}
            onInput={(e) => setSpeed(parseInt((e.target as HTMLInputElement).value))}
            class="w-24 accent-[#10b981]" />
        </label>
      </div>

      {/* live caption */}
      <div class="mt-3 rounded-lg bg-surface-2 p-3 text-sm">
        <div class="mb-1 font-semibold">
          At <span class="font-mono">n = {n}</span>, the{' '}
          <span style={`color:${focusClass.color}`}>{focusClass.label}</span> algorithm does{' '}
          <strong>{fmt(focusClass.f(n))}</strong> operations.
        </div>
        <div class="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
          {CLASSES.filter((c) => enabled.has(c.id)).map((c) => (
            <span key={c.id} style={`color:${c.color}`}>
              {c.label} = {fmt(c.f(n))}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
