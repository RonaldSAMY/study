import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------
   State-sync bandwidth lab: full snapshots vs delta compression.
   Each tick a fraction of the world changes. A FULL snapshot resends
   every entity; a DELTA resends only what changed (with periodic
   keyframes for reliability). Watch the bytes and the savings.
   ------------------------------------------------------------------ */

const COLORS = {
  full: '#4f46e5',
  delta: '#10b981',
  cell: 'rgba(128,128,128,0.22)',
  flash: '#0ea5e9',
};

const TICK_MS = 480;
const BYTES_ENTITY = 10; // position + rotation, packed
const DELTA_ID = 2; // index/id bytes per changed entity in a delta
const HEADER = 4; // per-packet header

export default function DeltaSnapshotBandwidthLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [count, setCount] = useState(64);
  const [churn, setChurn] = useState(0.2);
  const [keyEvery, setKeyEvery] = useState(8);
  const [ui, setUi] = useState({ fullTick: 0, deltaTick: 0, fullTotal: 0, deltaTotal: 0, saved: 0, keyframe: false });

  const countRef = useRef(count);
  const churnRef = useRef(churn);
  const keyRef = useRef(keyEvery);
  const flashRef = useRef<number[]>([]); // last-changed timestamp per entity
  const lastTickRef = useRef(0);
  const tickNoRef = useRef(0);
  const fullTotRef = useRef(0);
  const deltaTotRef = useRef(0);
  const lastFullRef = useRef(0);
  const lastDeltaRef = useRef(0);
  const lastKeyRef = useRef(false);
  const sizeRef = useRef({ w: 480, h: 230 });

  useEffect(() => { countRef.current = count; flashRef.current = new Array(count).fill(0); }, [count]);
  useEffect(() => { churnRef.current = churn; }, [churn]);
  useEffect(() => { keyRef.current = keyEvery; }, [keyEvery]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      const w = Math.min(parent.clientWidth, 560);
      const h = Math.round(Math.max(180, w * 0.4));
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w, h };
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(() => {
    let raf = 0;
    let uiClock = 0;

    const frame = (t: number) => {
      if (!lastTickRef.current) lastTickRef.current = t;
      const n = countRef.current;
      if (flashRef.current.length !== n) flashRef.current = new Array(n).fill(0);

      if (t - lastTickRef.current >= TICK_MS) {
        lastTickRef.current += TICK_MS;
        tickNoRef.current++;
        const isKey = tickNoRef.current % Math.max(1, keyRef.current) === 0;
        // mark changed entities
        let changed = 0;
        for (let i = 0; i < n; i++) {
          if (Math.random() < churnRef.current) { flashRef.current[i] = t; changed++; }
        }
        const fullBytes = HEADER + n * BYTES_ENTITY;
        const deltaBytes = isKey ? fullBytes : HEADER + changed * (BYTES_ENTITY + DELTA_ID);
        lastFullRef.current = fullBytes;
        lastDeltaRef.current = deltaBytes;
        lastKeyRef.current = isKey;
        fullTotRef.current += fullBytes;
        deltaTotRef.current += deltaBytes;
      }

      // draw entity grid
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const { w, h } = sizeRef.current;
          ctx.clearRect(0, 0, w, h);
          const cols = Math.ceil(Math.sqrt(n * (w / h)));
          const rows = Math.ceil(n / cols);
          const pad = 10;
          const cw = (w - 2 * pad) / cols;
          const ch = (h - 2 * pad) / rows;
          const r = Math.max(2.5, Math.min(cw, ch) * 0.34);
          for (let i = 0; i < n; i++) {
            const cx = pad + (i % cols) * cw + cw / 2;
            const cy = pad + Math.floor(i / cols) * ch + ch / 2;
            const age = (t - flashRef.current[i]) / 600;
            const lit = flashRef.current[i] > 0 && age < 1;
            ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
            if (lit) {
              ctx.globalAlpha = 1 - age;
              ctx.fillStyle = lastKeyRef.current ? COLORS.full : COLORS.flash;
              ctx.fill();
              ctx.globalAlpha = 1;
            } else {
              ctx.fillStyle = COLORS.cell; ctx.fill();
            }
          }
        }
      }

      if (t - uiClock > 130) {
        uiClock = t;
        const fT = fullTotRef.current, dT = deltaTotRef.current;
        setUi({
          fullTick: lastFullRef.current,
          deltaTick: lastDeltaRef.current,
          fullTotal: fT,
          deltaTotal: dT,
          saved: fT > 0 ? Math.round((1 - dT / fT) * 100) : 0,
          keyframe: lastKeyRef.current,
        });
      }
      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  const reset = () => { fullTotRef.current = 0; deltaTotRef.current = 0; tickNoRef.current = 0; };
  const kb = (b: number) => `${(b / 1024).toFixed(1)} KB`;
  const barFull = Math.max(2, Math.min(100, (ui.fullTick / Math.max(1, ui.fullTick)) * 100));
  const barDelta = Math.max(2, Math.min(100, (ui.deltaTick / Math.max(1, ui.fullTick)) * 100));

  return (
    <div class="not-prose rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <canvas ref={canvasRef} class="touch-none rounded-xl bg-surface-2" />

      <div class="mt-3 space-y-2 text-sm">
        <Bar label="Full snapshot" bytes={ui.fullTick} pct={barFull} color={COLORS.full} />
        <Bar label={`Delta${ui.keyframe ? ' (keyframe!)' : ''}`} bytes={ui.deltaTick} pct={barDelta} color={COLORS.delta} />
      </div>

      <div class="mt-3 grid grid-cols-3 gap-2 text-sm">
        <Readout label="full total" value={kb(ui.fullTotal)} />
        <Readout label="delta total" value={kb(ui.deltaTotal)} />
        <Readout label="bandwidth saved" value={`${ui.saved}%`} />
      </div>

      <div class="mt-3 grid gap-3 sm:grid-cols-3">
        <label class="block text-sm">
          <span class="mb-1 block text-muted">entities: {count}</span>
          <input type="range" min={16} max={256} step={8} value={count}
            onInput={(e) => setCount(parseInt((e.target as HTMLInputElement).value))} class="w-full accent-[#10b981]" />
        </label>
        <label class="block text-sm">
          <span class="mb-1 block text-muted">churn: {(churn * 100).toFixed(0)}%/tick</span>
          <input type="range" min={0.02} max={0.6} step={0.02} value={churn}
            onInput={(e) => setChurn(parseFloat((e.target as HTMLInputElement).value))} class="w-full accent-[#10b981]" />
        </label>
        <label class="block text-sm">
          <span class="mb-1 block text-muted">keyframe every {keyEvery} ticks</span>
          <input type="range" min={1} max={20} step={1} value={keyEvery}
            onInput={(e) => setKeyEvery(parseInt((e.target as HTMLInputElement).value))} class="w-full accent-[#10b981]" />
        </label>
      </div>

      <button onClick={reset} class="mt-3 rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted transition hover:text-text">
        Reset totals
      </button>
    </div>
  );
}

function Bar({ label, bytes, pct, color }: { label: string; bytes: number; pct: number; color: string }) {
  return (
    <div>
      <div class="mb-1 flex justify-between text-xs"><span class="text-muted">{label}</span><strong>{bytes} B/tick</strong></div>
      <div class="h-3 overflow-hidden rounded-full bg-surface-2">
        <div class="h-full rounded-full transition-all" style={`width:${pct}%;background:${color}`} />
      </div>
    </div>
  );
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div class="rounded-lg bg-surface-2 px-3 py-2">
      <span class="text-muted">{label}</span>
      <div class="font-mono font-semibold">{value}</div>
    </div>
  );
}
